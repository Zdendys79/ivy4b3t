/**
 * Název souboru: iv_ui.class.js
 * Umístění: ~/ivy/iv_ui.class.js
 *
 * Popis: Třída UIBot pro zpracování UI příkazů z webového rozhraní.
 *        Umožňuje přerušit běžný cyklus a přepnout do UI režimu podle příkazů z databáze.
 *        Navržena podle vzoru FBBot pro konzistentní architekturu.
 */

import os from 'node:os';
import puppeteer from 'puppeteer';

import { db } from './iv_sql.js'
import { FBBot } from './iv_fb.class.js';
import { Log } from './iv_log.class.js';

import * as wait from './iv_wait.js';

export class UIBot {
  constructor() {
    this.hostname = os.hostname();
    this.browser = null;
    this.fbBot = null;
    this.currentCommand = null;
    this.intervalHandle = null;
    this.isProcessing = false;
  }

  /**
   * Zkontroluje, zda existuje UI příkaz pro tento host
   * @returns {Promise<Object|null>} UI příkaz nebo null
   */
  async checkForCommand() {
    try {
      const command = await db.getUICommand();
      if (command && command.host === this.hostname) {
        Log.info('[UI]', `Nalezen UI příkaz: ${command.command} (ID: ${command.id})`);
        return command;
      }
      return null;
    } catch (err) {
      await Log.error('[UI] checkForCommand', err);
      return null;
    }
  }

  /**
   * Zpracuje UI příkaz
   * @param {Object} command - UI příkaz z databáze
   * @returns {Promise<boolean>} True pokud byl příkaz úspěšně zpracován
   */
  async processCommand(command) {
    if (this.isProcessing) {
      await Log.warn('[UI]', 'UI příkaz se již zpracovává, přeskakuji');
      return false;
    }

    this.isProcessing = true;
    this.currentCommand = command;
    let result = false;

    try {
      const data = command.data ? JSON.parse(command.data) : {};
      Log.info('[UI]', `Zpracovávám příkaz: ${command.command}`);

      // Označit příkaz jako přijatý
      await db.uICommandAccepted(command.id);

      switch (command.command) {
        case 'print':
          result = await this._handlePrint(data);
          break;

        case 'restart':
          result = await this._handleRestart(command);
          break;

        case 'pause':
          result = await this._handlePause(data);
          break;

        case 'call_user':
          result = await this._handleCallUser(data);
          break;

        case 'user_group':
          result = await this._handleUserGroup(data);
          break;

        case 'LOGIN_USER':
          result = await this._handleLoginUser(data);
          break;

        default:
          await Log.warn('[UI]', `Neznámý příkaz: ${command.command}`);
          result = false;
      }

      if (result) {
        await db.uICommandSolved(command.id);
        Log.success('[UI]', `Příkaz ${command.command} úspěšně dokončen`);
      } else {
        await Log.error('[UI]', `Příkaz ${command.command} se nezdařil`);
      }

    } catch (err) {
      await Log.error('[UI] processCommand', err);
      result = false;
    } finally {
      this.isProcessing = false;
      await this._cleanup();
    }

    return result;
  }

  /**
   * Zavře všechny zdroje
   * @returns {Promise<void>}
   */
  async close() {
    Log.info('[UI]', 'Zavírám UIBot zdroje...');
    await this._cleanup();
    this.currentCommand = null;
    this.isProcessing = false;
  }

  // ==========================================
  // 🔧 PRIVATE METODY PRO ZPRACOVÁNÍ PŘÍKAZŮ
  // ==========================================

  /**
   * Zpracuje print příkaz
   * @param {Object} data - Data příkazu
   * @returns {Promise<boolean>}
   * @private
   */
  async _handlePrint(data) {
    Log.info('[UI][print]', data.message || 'Prázdná zpráva');
    return true;
  }

  /**
   * Zpracuje restart příkaz
   * @param {Object} command - Příkaz objekty
   * @returns {Promise<boolean>}
   * @private
   */
  async _handleRestart(command) {
    await Log.warn('[UI]', 'Restart příkaz přijat - ukončuji proces');

    await this._cleanup();
    await db.systemLog("UI command", "Požadavek na restart programu.", command.data);
    await db.uICommandSolved(command.id);

    // Ukončí celý proces - bude restartován systemd nebo jiným správcem procesů
    process.kill(process.pid, 'SIGTERM');

    return true;
  }

  /**
   * Zpracuje pause příkaz
   * @param {Object} data - Data příkazu {min: number}
   * @returns {Promise<boolean>}
   * @private
   */
  async _handlePause(data) {
    const minutes = data.min || 1;
    Log.info('[UI]', `Pauza na ${minutes} minut`);

    let remainingSeconds = minutes * 60;

    return new Promise((resolve) => {
      this.intervalHandle = setInterval(() => {
        remainingSeconds -= 10;
        if (remainingSeconds > 0) {
          Log.info('[UI][pause]', `Zbývá ${Math.floor(remainingSeconds / 60)}:${(remainingSeconds % 60).toString().padStart(2, '0')}`);
        } else {
          clearInterval(this.intervalHandle);
          this.intervalHandle = null;
          Log.info('[UI][pause]', 'Pauza dokončena');
          resolve(true);
        }
      }, 10000); // Update každých 10 sekund
    });
  }

  /**
   * Zpracuje call_user příkaz - přihlásí uživatele a čeká na další příkazy
   * @param {Object} data - Data příkazu {user_id: number}
   * @returns {Promise<boolean>}
   * @private
   */
  async _handleCallUser(data) {
    const userId = data.user_id;
    if (!userId) {
      await Log.error('[UI]', 'call_user: Chybí user_id');
      return false;
    }

    try {
      Log.info('[UI]', `Přihlašuji uživatele ${userId}`);

      // Získej data uživatele
      const user = await db.getUserById(userId);
      if (!user) {
        await Log.error('[UI]', `Uživatel ${userId} nenalezen`);
        return false;
      }

      // Otevři browser a přihlas uživatele
      await this._initializeBrowser(userId);
      await this.fbBot.openFB(user);

      Log.success('[UI]', `Uživatel ${user.name} ${user.surname} úspěšně přihlášen`);

      // Čekej na další příkazy (max 20 minut)
      const nextCommand = await this._waitForNextCommand(20);

      if (nextCommand) {
        Log.info('[UI]', 'Nalezen následující příkaz, zpracovávám...');
        return await this.processCommand(nextCommand);
      } else {
        Log.info('[UI]', 'Žádný další příkaz, ukončuji call_user');
        return true;
      }

    } catch (err) {
      await Log.error('[UI] call_user', err);
      return false;
    }
  }

  /**
   * Zpracuje user_group příkaz - přihlásí uživatele a otevře skupinu
   * @param {Object} data - Data příkazu {user_id: number, group_id: number}
   * @returns {Promise<boolean>}
   * @private
   */
  async _handleUserGroup(data) {
    const { user_id, group_id } = data;
    if (!user_id || !group_id) {
      await Log.error('[UI]', 'user_group: Chybí user_id nebo group_id');
      return false;
    }

    try {
      Log.info('[UI]', `Otevírám skupinu ${group_id} pro uživatele ${user_id}`);

      // Získej data uživatele a skupiny
      const user = await db.getUserById(user_id);
      const group = await db.getGroupById(group_id);

      if (!user) {
        await Log.error('[UI]', `Uživatel ${user_id} nenalezen`);
        return false;
      }

      if (!group) {
        await Log.error('[UI]', `Skupina ${group_id} nenalezena`);
        return false;
      }

      // Otevři browser a přihlas uživatele
      await this._initializeBrowser(user_id);
      await this.fbBot.openFB(user);
      await wait.delay(2000);

      // Otevři skupinu
      await this.fbBot.openGroup(group);
      await wait.delay(2000);

      Log.success('[UI]', `Skupina ${group.nazev} otevřena pro uživatele ${user.name} ${user.surname}`);

      // Čekej na další příkazy (max 20 minut)
      const nextCommand = await this._waitForNextCommand(20);

      if (nextCommand) {
        Log.info('[UI]', 'Nalezen následující příkaz, zpracovávám...');
        return await this.processCommand(nextCommand);
      } else {
        Log.info('[UI]', 'Žádný další příkaz, ukončuji user_group');
        return true;
      }

    } catch (err) {
      await Log.error('[UI] user_group', err);
      return false;
    }
  }

  /**
   * Zpracuje LOGIN_USER příkaz - pouze přihlásí uživatele
   * @param {Object} data - Data příkazu {user_id: number}
   * @returns {Promise<boolean>}
   * @private
   */
  async _handleLoginUser(data) {
    const userId = data.user_id;
    if (!userId) {
      await Log.error('[UI]', 'LOGIN_USER: Chybí user_id');
      return false;
    }

    try {
      Log.info('[UI]', `Přihlašuji uživatele ${userId} na základě UI příkazu...`);

      const user = await db.getUserById(userId);
      if (!user) {
        await Log.error('[UI]', `Uživatel ${userId} nenalezen`);
        return false;
      }

      // Otevři browser a přihlas uživatele
      await this._initializeBrowser(userId);
      const loginResult = await this.fbBot.openFB(user);

      if (loginResult === 'still_loged' || loginResult === 'now_loged') {
        Log.success('[UI]', `Uživatel ${user.name} ${user.surname} je úspěšně přihlášen.`);
        // Nečekáme na další příkazy, jen přihlásíme a skončíme.
        // Prohlížeč zůstane otevřený pro další cyklus workeru.
        this.browser = null; // Trik, aby se prohlížeč nezavřel v _cleanup
        return true;
      } else {
        await Log.error('[UI]', `Přihlášení uživatele ${userId} selhalo se stavem: ${loginResult}`);
        return false;
      }

    } catch (err) {
      await Log.error('[UI] LOGIN_USER', err);
      return false;
    }
  }

  // ==========================================
  // 🔧 PRIVATE HELPER METODY
  // ==========================================

  /**
   * Inicializuje browser a FBBot
   * @param {number} userId - ID uživatele pro profil
   * @returns {Promise<void>}
   * @private
   */
  async _initializeBrowser(userId) {
    if (this.browser && !this.browser.isConnected()) {
      await this._cleanup();
    }

    if (!this.browser) {
      Log.info('[UI]', `Otevírám browser pro uživatele ${userId}`);

      const isLinux = process.platform === 'linux';
      const userDataDir = isLinux ? '/home/remotes/Chromium' : './profiles';

      this.browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        args: [
          '--suppress-message-center-popups',
          '--disable-notifications',
          '--disable-infobars',
          '--start-maximized',
          '--no-sandbox',
          '--disable-setuid-sandbox',
          `--profile-directory=Profile${userId}`,
          `--user-data-dir=${userDataDir}`
        ]
      });

      const context = this.browser.defaultBrowserContext();
      await context.overridePermissions("https://www.FB.com", []);
      await context.overridePermissions("https://m.FB.com", []);

      this.fbBot = new FBBot(context);
      await this.fbBot.init();
    }
  }

  /**
   * Čeká na další UI příkaz
   * @param {number} timeoutMinutes - Timeout v minutách
   * @returns {Promise<Object|null>} Další příkaz nebo null
   * @private
   */
  async _waitForNextCommand(timeoutMinutes = 20) {
    const timeoutMs = timeoutMinutes * 60 * 1000;
    const checkIntervalMs = 5000; // Kontrola každých 5 sekund
    const maxChecks = Math.floor(timeoutMs / checkIntervalMs);

    Log.info('[UI]', `Čekám na další příkaz (max ${timeoutMinutes} minut)...`);

    for (let i = 0; i < maxChecks; i++) {
      await wait.delay(checkIntervalMs);

      // Kontrola nového příkazu
      const newCommand = await this.checkForCommand();
      if (newCommand && newCommand.id !== this.currentCommand?.id) {
        return newCommand;
      }

      // Kontrola, zda je browser stále připojen
      if (this.browser && !this.browser.isConnected()) {
        await Log.warn('[UI]', 'Browser se odpojil během čekání');
        break;
      }

      // Logování každou minutu
      if (i % 12 === 0) { // 12 * 5s = 60s
        const remainingMinutes = Math.ceil((maxChecks - i) * checkIntervalMs / 60000);
        Log.info('[UI]', `Čekám na příkaz... (zbývá ~${remainingMinutes} min)`);
      }
    }

    Log.info('[UI]', 'Timeout čekání na další příkaz');
    return null;
  }

  /**
   * Vyčistí všechny zdroje
   * @returns {Promise<void>}
   * @private
   */
  async _cleanup() {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }

    if (this.browser && this.browser.isConnected()) {
      try {
        await this.browser.close();
        Log.info('[UI]', 'Browser uzavřen');
      } catch (err) {
        await Log.warn('[UI]', `Chyba při zavírání browseru: ${err.message}`);
      }
    }

    this.browser = null;
    this.fbBot = null;
  }
}

// Export pro zpětnou kompatibilitu se starým kódem
export async function checkUI() {
  const uiBot = new UIBot();
  return await uiBot.checkForCommand();
}

export async function solveUICommand(command) {
  const uiBot = new UIBot();
  try {
    return await uiBot.processCommand(command);
  } finally {
    await uiBot.close();
  }
}
