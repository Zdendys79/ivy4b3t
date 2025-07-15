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

import { db } from '../iv_sql.js'
import { FBBot } from './iv_fb.class.js';
import { Log } from './iv_log.class.js';
import { getIvyConfig } from './iv_config.class.js';

const config = getIvyConfig();

import * as wait from '../iv_wait.js';

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
   * @param {FBBot} fbBot - Aktivní a inicializovaná instance FBBot
   * @returns {Promise<boolean>} True pokud byl příkaz úspěšně zpracován
   */
  async processCommand(command, fbBot) {
    if (this.isProcessing) {
      await Log.warn('[UI]', 'UI příkaz se již zpracovává, přeskakuji');
      return false;
    }

    this.isProcessing = true;
    this.currentCommand = command;
    this.fbBot = fbBot; // Uložíme si referenci na existujícího bota

    let result = false;

    try {
      const data = command.data ? JSON.parse(command.data) : {};
      Log.info('[UI]', `Zpracovávám příkaz: ${command.command}`);

      await db.uiCommandAccepted(command.id);

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
        default:
          await Log.warn('[UI]', `Neznámý příkaz: ${command.command}`);
          result = false;
      }

      if (result) {
        await db.uiCommandSolved(command.id);
        Log.success('[UI]', `Příkaz ${command.command} úspěšně dokončen`);
      } else {
        await Log.error('[UI]', `Příkaz ${command.command} se nezdařil`);
      }

    } catch (err) {
      await Log.error('[UI] processCommand', err);
      result = false;
    } finally {
      this.isProcessing = false;
      // Cleanup se již nedělá zde, je plně v gesci workeru
    }

    return result;
  }

  /**
   * NOVÁ HLAVNÍ FUNKCE - Kompletní zpracování UI příkazu s timeoutem a zavřením prohlížeče
   * @param {Object} command - UI příkaz z databáze
   * @param {Object} user - Uživatelská data
   * @param {Object} browser - Puppeteer browser instance
   * @param {Object} context - Browser context
   * @returns {Promise<void>} Vždy zavře prohlížeč
   */
  async handleUICommandComplete(command, user, browser, context) {
    const { FBBot } = await import('./iv_fb.class.js');
    const { setDebugContext } = await import('../iv_interactive_debugger.js');
    
    let fbBot = null;

    try {
      Log.info(`[${user.id}]`, `🎮 UIBot převzal kontrolu pro příkaz: ${command.command}`);

      // Inicializuj FB bota s existujícím kontextem
      fbBot = new FBBot(context, user.id);
      if (!await fbBot.init()) {
        throw new Error('FB initialization failed for UI command');
      }
      
      // Set debug context
      if (fbBot.page) {
        setDebugContext(user, fbBot.page);
      }

      // Otevři stránku FB bez analýzy
      const fbOpenSuccess = await fbBot.openFB(user, false);
      if (!fbOpenSuccess) {
        throw new Error('Failed to open Facebook page');
      }

      // Zpracuj UI příkaz s timeoutem 20 minut
      let uiSuccess = false;
      try {
        const uiPromise = this.processCommand(command, fbBot);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`UI command timeout - ${config.ui_timeout_minutes} minutes`)), config.ui_timeout_minutes * 60 * 1000)
        );

        uiSuccess = await Promise.race([uiPromise, timeoutPromise]);
      } catch (err) {
        if (err.message.includes('timeout')) {
          await Log.warn(`[${user.id}]`, `UI příkaz ${command.command} vypršel po 20 minutách`);
          uiSuccess = false;
        } else {
          throw err;
        }
      }

      if (uiSuccess) {
        Log.success(`[${user.id}]`, `UI příkaz ${command.command} dokončen úspěšně`);
      } else {
        await Log.warn(`[${user.id}]`, `UI příkaz ${command.command} selhal`);
      }

    } catch (err) {
      await Log.error(`[${user.id}]`, `Chyba při zpracování UI příkazu: ${err.message}`);
    } finally {
      // UIBot vždy zavře prohlížeč
      await this._closeBrowserSafely(browser);
      
      // Cleanup FB bota
      if (fbBot) {
        try {
          await fbBot.close();
        } catch (e) {
          // Ignoruj cleanup chyby
        }
      }
      
      // Cleanup vlastních zdrojů
      await this.close();
    }
  }

  /**
   * Zavře všechny zdroje
   * @returns {Promise<void>}
   */
  async close() {
    Log.info('[UI]', 'Zavírám UIBot zdroje...');
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    this.currentCommand = null;
    this.isProcessing = false;
  }

  // ==========================================
  // 🔧 PRIVATE METODY PRO ZPRACOVÁNÍ PŘÍKAZŮ
  // ==========================================

  async _handlePrint(data) {
    Log.info('[UI][print]', data.message || 'Prázdná zpráva');
    return true;
  }

  async _handleRestart(command) {
    await Log.warn('[UI]', 'Restart příkaz přijat - ukončuji proces');
    await db.uiCommandSolved(command.id);
    process.kill(process.pid, 'SIGTERM');
    return true;
  }

  async _handlePause(data) {
    const minutes = data.min || 1;
    Log.info('[UI]', `Pauza na ${minutes} minut`);
    await wait.delay(minutes * 60 * 1000);
    Log.info('[UI][pause]', 'Pauza dokončena');
    return true;
  }

  async _handleCallUser(data) {
    const userId = data.user_id;
    if (!userId) {
      await Log.error('[UI]', 'call_user: Chybí user_id');
      return false;
    }
    if (!this.fbBot) {
      await Log.error('[UI]', 'call_user: FBBot instance nebyla poskytnuta.');
      return false;
    }
    Log.success('[UI]', `Uživatel ${userId} je nyní aktivní pro manuální správu.`);
    await this._waitForBrowserCloseOrNextCommand();
    return true;
  }

  async _handleUserGroup(data) {
    const { user_id, group_id } = data;
    if (!user_id || !group_id) {
      await Log.error('[UI]', 'user_group: Chybí user_id nebo group_id');
      return false;
    }
    if (!this.fbBot) {
      await Log.error('[UI]', 'user_group: FBBot instance nebyla poskytnuta.');
      return false;
    }

    try {
      const group = await db.getGroupById(group_id);
      if (!group) {
        await Log.error('[UI]', `Skupina ${group_id} nenalezena`);
        return false;
      }
      await this.fbBot.openGroup(group);
      Log.success('[UI]', `Skupina ${group.name} otevřena pro uživatele ${user_id}`);
      await this._waitForBrowserCloseOrNextCommand();
      return true;
    } catch (err) {
      await Log.error('[UI] user_group', err);
      return false;
    }
  }

  async _waitForBrowserCloseOrNextCommand(timeoutMinutes = 20) {
    if (!this.fbBot || !this.fbBot.page || !this.fbBot.page.browser()) {
      Log.warn('[UI]', 'Nelze čekat, instance prohlížeče není dostupná.');
      return;
    }
    const browser = this.fbBot.page.browser();
    const checkIntervalMs = 30000; // Kontrola každých 30 sekund
    const timeoutMs = timeoutMinutes * 60 * 1000;
    let elapsedTime = 0;

    Log.info('[UI]', `Čekám na manuální zavření prohlížeče (max ${timeoutMinutes} min)...`);

    // Spustíme interval, který bude posílat heartbeat
    const heartbeatInterval = setInterval(() => {
      try {
        db.heartBeat(this.currentCommand.user_id || 0, 0, 'UI_WAIT');
      } catch (e) {
        Log.warn('[UI]', `Heartbeat během čekání selhal: ${e.message}`);
      }
    }, checkIntervalMs);

    try {
      // Čekáme na jednu ze dvou událostí: zavření prohlížeče nebo timeout
      await Promise.race([
        new Promise(resolve => browser.once('disconnected', resolve)),
        new Promise(resolve => setTimeout(resolve, timeoutMs))
      ]);

      if (!browser.isConnected()) {
        Log.info('[UI]', 'Prohlížeč byl manuálně zavřen, UI příkaz je považován za dokončený.');
      } else {
        Log.info('[UI]', 'Timeout čekání na zavření prohlížeče.');
      }
    } finally {
      // Vždy po skončení čekání zrušíme interval pro heartbeat
      clearInterval(heartbeatInterval);
    }
  }

  /**
   * Bezpečně zavře prohlížeč
   * @param {Object} browser - Puppeteer browser instance
   * @returns {Promise<void>}
   */
  async _closeBrowserSafely(browser) {
    const DEBUG_KEEP_BROWSER_OPEN = process.env.DEBUG_KEEP_BROWSER_OPEN === 'true';
    
    if (DEBUG_KEEP_BROWSER_OPEN) {
      Log.info('[UI]', 'Debug režim: prohlížeč NEBUDE zavřen');
      return;
    }

    if (!browser || !browser.isConnected()) {
      Log.info('[UI]', 'Prohlížeč již byl uzavřen nebo neexistuje');
      return;
    }

    try {
      await wait.delay(2000, false);
      await browser.close();
      Log.info('[UI]', 'UIBot úspěšně zavřel prohlížeč');
    } catch (err) {
      await Log.warn('[UI]', `Chyba při uzavírání prohlížeče: ${err.message}`);
    }
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
    // Toto je legacy volání, které nebude fungovat s novou logikou,
    // protože nemá kontext FBBot. Ponecháno prozatím.
    return await uiBot.processCommand(command, null);
  } finally {
    await uiBot.close();
  }
}
