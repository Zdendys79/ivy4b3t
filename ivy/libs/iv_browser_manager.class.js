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
import * as wait from '../iv_wait.js';

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
      await wait.delay(2000, false);

      const closePromise = browser.close();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Browser close timeout')), config.browser_close_timeout)
      );

      await Promise.race([closePromise, timeoutPromise]);
      Log.info('[BROWSER]', 'BrowserManager úspěšně zavřel prohlížeč');

    } catch (err) {
      await Log.warn('[BROWSER]', `Chyba při uzavírání prohlížeče: ${err.message}`);

      try {
        const pages = await browser.pages();
        for (const page of pages) {
          await page.close();
        }
        await browser.close();
        Log.info('[BROWSER]', 'Prohlížeč force-uzavřen');
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

    Log.info('[BROWSER]', `Zavírám ${this.activeBrowsers.size} aktivních browser instances...`);
    
    const shutdownPromises = Array.from(this.activeBrowsers).map(async (browser) => {
      try {
        if (browser && browser.isConnected()) {
          const pages = await browser.pages();
          for (const page of pages) {
            if (!page.isClosed()) {
              await page.close();
            }
          }
          await browser.close();
        }
      } catch (err) {
        Log.warn('[BROWSER]', `Chyba při zavírání browser instance: ${err.message}`);
      }
    });

    try {
      await Promise.race([
        Promise.all(shutdownPromises),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Shutdown timeout')), config.shutdown_timeout)
        )
      ]);
      Log.success('[BROWSER]', 'Všechny browser instances úspěšně uzavřeny');
    } catch (err) {
      Log.warn('[BROWSER]', `Timeout při zavírání browsers: ${err.message}`);
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