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
    this.debugKeepOpen = process.env.DEBUG_KEEP_BROWSER_OPEN === 'true';
    this.activeBrowsers = new Set();
    this.userBrowsers = new Map(); // Map userId -> {browser, context}
    this.userDataDir = this.isLinux ? '/home/remotes/Chromium' : './profiles';
  }

  /**
   * Otevře prohlížeč pro daného uživatele
   * @param {Object} user - Uživatelská data
   * @returns {Promise<Object>} {instance: browser, context: context}
   */
  async openForUser(user) {
    // BROWSER REUSE OPTIMIZATION: Check if user already has an active browser
    // This prevents Chrome SingletonLock errors and improves performance by
    // reusing existing browser instances for the same user profile
    if (this.userBrowsers.has(user.id)) {
      const existing = this.userBrowsers.get(user.id);
      // Verify the browser connection is still alive before reusing
      if (existing.browser.isConnected()) {
        Log.info(`[${user.id}]`, `Používám existující browser pro profil Profile${user.id}`);
        return {
          instance: existing.browser,
          context: existing.context
        };
      } else {
        // Browser connection died, clean up stale references
        this.userBrowsers.delete(user.id);
        this.activeBrowsers.delete(existing.browser);
      }
    }
    
    const profileDir = `Profile${user.id}`;
    const lockFile = path.join(this.userDataDir, profileDir, 'SingletonLock');

    // Vyčistit SingletonLock
    await this._cleanupSingletonLock(lockFile, profileDir);

    // Spustit prohlížeč s retry při SingletonLock chybě
    let browser;
    const maxRetries = 3;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        browser = await puppeteer.launch({
          headless: false,
          defaultViewport: null,
          args: this._getBrowserArgs(profileDir)
        });
        break; // Úspěch - ukončit retry loop
        
      } catch (err) {
        const isSingletonError = err.message.includes('SingletonLock') || 
                                err.message.includes('Failed to create a ProcessSingleton');
        
        if (isSingletonError && attempt < maxRetries) {
          Log.warn('[BROWSER]', `Pokus ${attempt}/${maxRetries} selhal kvůli SingletonLock - zkouším agresivní cleanup`);
          
          // Agresivní cleanup při retry
          await this._cleanupSingletonLock(lockFile, profileDir);
          
          // Delší čekání před dalším pokusem
          await Wait.toSeconds(2, `Retry ${attempt + 1}/${maxRetries} - po cleanup`);
          
        } else {
          // Buď není SingletonLock chyba, nebo jsme vyčerpali pokusy
          throw err;
        }
      }
    }

    // Nastavit context a permissions
    const context = browser.defaultBrowserContext();
    await this._setupContextPermissions(context);

    // Register browser for tracking and user association
    // activeBrowsers: for graceful shutdown of all browsers
    // userBrowsers: for user-specific browser reuse optimization
    this.activeBrowsers.add(browser);
    this.userBrowsers.set(user.id, { browser, context });

    Log.info(`[${user.id}]`, `BrowserManager otevřel nový prohlížeč pro profil ${profileDir}`);

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
      this._removeFromUserBrowsers(browser);
      return;
    }

    try {
      // Pauza před zavřením odstraněna - zbytečná

      // Nejdřív zavři všechny stránky
      try {
        const pages = await browser.pages();
        for (const page of pages) {
          if (!page.isClosed()) {
            await page.close();
          }
        }
      } catch (pageErr) {
        await Log.warn('[BROWSER]', `Chyba při zavírání stránek: ${pageErr.message}`);
      }

      // Pak zavři browser s timeoutem
      const timeoutSeconds = config.getBrowserCloseTimeoutSeconds();
      
      const closePromise = browser.close();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Browser close timeout after ${timeoutSeconds}s`)), timeoutSeconds * 1000)
      );

      await Promise.race([closePromise, timeoutPromise]);

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
      this._removeFromUserBrowsers(browser);
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
    this.userBrowsers.clear();
  }

  /**
   * Odstraní browser z userBrowsers mapy
   * @param {Object} browser - Browser instance k odstranění
   * @private
   */
  _removeFromUserBrowsers(browser) {
    for (const [userId, data] of this.userBrowsers.entries()) {
      if (data.browser === browser) {
        this.userBrowsers.delete(userId);
        Log.debug('[BROWSER]', `Odstraněn browser z mapy pro uživatele ${userId}`);
        break;
      }
    }
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
        // Pokus o odstranění lock souboru
        fs.unlinkSync(lockFile);
        Log.debug('[BROWSER]', `Odstraněn existující SingletonLock pro ${profileDir}`);
        
        // Počkat trochu pro stabilizaci po odstranění lock souboru
        await Wait.toSeconds(1, 'Po odstranění SingletonLock');
      }
      
      // Agresivní cleanup - ukončit všechny chrome procesy pro daný profil
      try {
        const { exec } = await import('child_process');
        const util = await import('util');
        const execPromise = util.promisify(exec);
        
        // Najít a ukončit chrome procesy s daným profilem
        const profilePath = path.join(this.userDataDir, profileDir);
        await execPromise(`pkill -f "${profilePath}" || true`);
        
        Log.debug('[BROWSER]', `Ukončeny chrome procesy pro profil ${profileDir}`);
        
        // Další krátká pauza po ukončení procesů
        await Wait.toSeconds(0.5, 'Po ukončení chrome procesů');
        
      } catch (killErr) {
        // Tichá chyba - pkill může selhat pokud nejsou žádné procesy
        Log.debug('[BROWSER]', `Pkill pro ${profileDir}: ${killErr.message}`);
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