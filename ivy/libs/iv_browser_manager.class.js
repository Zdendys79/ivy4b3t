/**
 * Název souboru: iv_browser_manager.class.js
 * Umístění: ~/ivy/libs/iv_browser_manager.class.js
 *
 * Popis: Třída pro správu prohlížeče Puppeteer
 * - Spouštění, konfigurace a zavírání prohlížeče
 * - Tracking aktivních instances pro graceful shutdown
 * - Správa profilů uživatelů
 */

import fs from 'fs';
import path from 'path';
import os from 'node:os';
import puppeteer from 'puppeteer';

import { Log } from './iv_log.class.js';
import { getIvyConfig } from './iv_config.class.js';
import { Wait } from './iv_wait.class.js';

const config = getIvyConfig();

export class BrowserManager {
  constructor() {
    this.isLinux = process.platform === 'linux';
    this.hostname = os.hostname();
    this.debugKeepOpen = process.env.DEBUG_KEEP_BROWSER_OPEN === 'true';
    this.activeBrowsers = new Set();
    this.userDataDir = this.isLinux ? '/home/remotes/Chromium' : './profiles';
  }

  /**
   * Otevře prohlížeč pro daného uživatele
   * @param {Object} user - Uživatelská data
   * @returns {Promise<Object>} {instance: browser, context: context}
   */
  async openForUser(user) {
    const profileDir = `Profile${user.id}`;
    const lockFile = path.join(this.userDataDir, profileDir, 'SingletonLock');

    // Vyčistit SingletonLock
    await this._cleanupSingletonLock(lockFile, profileDir);

    // Spustit prohlížeč
    const browser = await puppeteer.launch({
      headless: false,
      defaultViewport: null,
      args: this._getBrowserArgs(profileDir)
    });

    // Nastavit context a permissions
    const context = browser.defaultBrowserContext();
    await this._setupContextPermissions(context);

    // Tracking pro graceful shutdown
    this.activeBrowsers.add(browser);

    Log.info(`[${user.id}]`, `BrowserManager otevřel prohlížeč pro profil ${profileDir}`);

    return {
      instance: browser,
      context: context
    };
  }

  /**
   * Zavře prohlížeč
   * @param {Object} browser - Puppeteer browser instance
   * @returns {Promise<void>}
   */
  async closeBrowser(browser) {
    if (this.debugKeepOpen) {
      Log.info('[BROWSER]', 'Debug režim: prohlížeč NEBUDE zavřen');
      return;
    }

    if (!browser || !browser.isConnected()) {
      Log.info('[BROWSER]', 'Prohlížeč již byl uzavřen nebo neexistuje');
      this.activeBrowsers.delete(browser);
      return;
    }

    try {
      // Krátká pauza před zavřením
      Log.debug('[BROWSER]', `Čekám ${Log.formatTime(1)} před zavřením prohlížeče...`);
      await Wait.toSeconds(1);

      // Nejdřív zavři všechny stránky
      try {
        const pages = await browser.pages();
        Log.info('[BROWSER]', `Zavírám ${pages.length} stránek...`);
        
        for (const page of pages) {
          if (!page.isClosed()) {
            Log.debug('[BROWSER]', `Zavírám stránku: ${page.url()}`);
            await page.close();
          }
        }
        Log.debug('[BROWSER]', 'Všechny stránky zavřeny');
      } catch (pageErr) {
        await Log.warn('[BROWSER]', `Chyba při zavírání stránek: ${pageErr.message}`);
      }

      // Pak zavři browser s timeoutem
      const timeoutSeconds = config.getBrowserCloseTimeoutSeconds();
      Log.info('[BROWSER]', `Zavírám browser s timeout ${timeoutSeconds}s...`);
      
      const closePromise = browser.close();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Browser close timeout after ${timeoutSeconds}s`)), timeoutSeconds * 1000)
      );

      await Promise.race([closePromise, timeoutPromise]);
      Log.success('[BROWSER]', 'BrowserManager úspěšně zavřel prohlížeč');

    } catch (err) {
      await Log.warn('[BROWSER]', `Chyba při uzavírání prohlížeče: ${err.message}`);

      // Force close jako poslední možnost
      try {
        if (browser.isConnected()) {
          await browser.close();
          Log.info('[BROWSER]', 'Prohlížeč force-uzavřen');
        }
      } catch (forceErr) {
        await Log.error('[BROWSER]', `Force close také selhal: ${forceErr.message}`);
      }
    } finally {
      this.activeBrowsers.delete(browser);
    }
  }

  /**
   * Graceful shutdown všech aktivních browser instances
   * @returns {Promise<void>}
   */
  async shutdownAll() {
    if (this.activeBrowsers.size === 0) {
      Log.info('[BROWSER]', 'Žádné aktivní browser instances k uzavření');
      return;
    }

    const browserCount = this.activeBrowsers.size;
    Log.info('[BROWSER]', `Zavírám ${browserCount} aktivních browser instances...`);
    
    const shutdownPromises = Array.from(this.activeBrowsers).map(async (browser, index) => {
      try {
        Log.debug('[BROWSER]', `Zavírám browser instance ${index + 1}/${browserCount}`);
        if (browser && browser.isConnected()) {
          const pages = await browser.pages();
          Log.debug('[BROWSER]', `Browser ${index + 1} má ${pages.length} stránek`);
          
          for (const page of pages) {
            if (!page.isClosed()) {
              await page.close();
            }
          }
          await browser.close();
          Log.debug('[BROWSER]', `Browser instance ${index + 1} úspěšně zavřen`);
        }
      } catch (err) {
        await Log.warn('[BROWSER]', `Chyba při zavírání browser instance ${index + 1}: ${err.message}`);
      }
    });

    try {
      const timeoutSeconds = config.getShutdownTimeoutSeconds();
      Log.info('[BROWSER]', `Čekám na shutdown všech browsers s timeout ${timeoutSeconds}s...`);
      
      await Promise.race([
        Promise.all(shutdownPromises),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error(`Shutdown timeout after ${timeoutSeconds}s`)), timeoutSeconds * 1000)
        )
      ]);
      Log.success('[BROWSER]', 'Všechny browser instances úspěšně uzavřeny');
    } catch (err) {
      await Log.warn('[BROWSER]', `Timeout při zavírání browsers: ${err.message}`);
    }
    
    this.activeBrowsers.clear();
  }

  /**
   * Vrátí počet aktivních browser instances
   * @returns {number}
   */
  getActiveBrowserCount() {
    return this.activeBrowsers.size;
  }

  /**
   * Čeká na timeout nebo zavření prohlížeče (s podporou okamžitého ukončení)
   * @param {Object} user - Uživatelská data
   * @param {Object} browser - Browser instance
   * @param {number} timeoutMs - Timeout v ms
   * @returns {Promise<string>} 'timeout' nebo 'closed' nebo 'restart' nebo 'ui_command'
   */
  async waitForBrowserCloseOrTimeout(user, browser, timeoutMs) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      let resolved = false;
      
      const checkInterval = setInterval(() => {
        if (resolved) return;
        
        const elapsed = Date.now() - startTime;
        
        // Kontrola restart_needed - okamžité ukončení
        if (global.systemState?.restart_needed) {
          resolved = true;
          clearInterval(checkInterval);
          Log.info(`[${user.id}]`, 'Čekání ukončeno kvůli restart_needed');
          resolve('restart');
          return;
        }
        
        // Kontrola UI příkazu - okamžité ukončení
        if (global.uiCommandCache) {
          resolved = true;
          clearInterval(checkInterval);
          Log.info(`[${user.id}]`, 'Čekání ukončeno kvůli UI příkazu');
          resolve('ui_command');
          return;
        }
        
        // Timeout dosažen
        if (elapsed >= timeoutMs) {
          resolved = true;
          clearInterval(checkInterval);
          Log.info(`[${user.id}]`, `Timeout ${timeoutMs/1000}s dosažen`);
          resolve('timeout');
          return;
        }
        
        // Kontrola, zda je prohlížeč stále připojen
        if (!browser || !browser.isConnected()) {
          resolved = true;
          clearInterval(checkInterval);
          Log.info(`[${user.id}]`, 'Prohlížeč byl zavřen');
          resolve('closed');
          return;
        }
      }, 500);
    });
  }

  // ==========================================
  // PRIVATE METODY
  // ==========================================

  /**
   * Vyčistí SingletonLock soubor
   * @param {string} lockFile - Cesta k lock souboru
   * @param {string} profileDir - Název profilu
   * @returns {Promise<void>}
   */
  async _cleanupSingletonLock(lockFile, profileDir) {
    try {
      if (fs.existsSync(lockFile)) {
        fs.unlinkSync(lockFile);
        Log.debug('[BROWSER]', `Odstraněn existující SingletonLock pro ${profileDir}`);
        
        // Počkat trochu pro stabilizaci po odstranění lock souboru
        await Wait.toSeconds(1, 'Po odstranění SingletonLock');
      }
    } catch (err) {
      if (err.code !== 'ENOENT') {
        await Log.warn('[BROWSER]', `Chyba při mazání SingletonLock: ${err.message}`);
      }
    }
  }

  /**
   * Vrátí argumenty pro spuštění prohlížeče
   * @param {string} profileDir - Název profilu
   * @returns {Array<string>}
   */
  _getBrowserArgs(profileDir) {
    return [
      '--suppress-message-center-popups',
      '--disable-notifications',
      '--disable-infobars',
      '--disable-session-crashed-bubble',
      '--disable-restore-session-state',
      '--hide-crash-restore-bubble',
      '--disable-background-networking',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-features=TranslateUI,SessionRestore',
      '--disable-ipc-flooding-protection',
      '--disable-prompt-on-repost',
      '--disable-hang-monitor',
      '--disable-client-side-phishing-detection',
      '--disable-popup-blocking',
      '--start-maximized',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      `--profile-directory=${profileDir}`,
      `--user-data-dir=${this.userDataDir}`
    ];
  }

  /**
   * Nastaví permissions pro context
   * @param {Object} context - Browser context
   * @returns {Promise<void>}
   */
  async _setupContextPermissions(context) {
    const origins = [
      'https://www.FB.com',
      'https://m.FB.com',
      'https://utio.b3group.cz'
    ];

    for (const origin of origins) {
      await context.overridePermissions(origin, []);
    }
  }
}