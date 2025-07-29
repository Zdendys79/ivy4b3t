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

import { Wait } from './iv_wait.class.js';

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
   * Statická metoda pro rychlou kontrolu UI příkazu
   * @returns {Promise<Object|null>} UI příkaz nebo null
   */
  static async quickCheck() {
    try {
      const hostname = os.hostname();
      const command = await db.getUICommand();
      if (command && command.host === hostname) {
        Log.info('[UI]', `Nalezen UI příkaz: ${command.command} (ID: ${command.id})`);
        return command;
      }
      return null;
    } catch (err) {
      await Log.error('[UI] quickCheck', err);
      return null;
    }
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
    
    let fbBot = null;
    let uiCommandSuccessful = false;

    try {
      Log.info(`[${user.id}]`, `UIBot převzal kontrolu pro příkaz: ${command.command}`);

      // Inicializuj FB bota s existujícím kontextem - BEZ ANALÝZY pro UI režim
      fbBot = new FBBot(context, user.id, true);
      if (!await fbBot.init()) {
        throw new Error('FB initialization failed for UI command');
      }
      
      // Debug context removed - debugger simplified

      // Otevři stránku FB (analýza je již zakázána v konstruktoru)
      const fbOpenSuccess = await fbBot.openFB(user);
      if (!fbOpenSuccess) {
        throw new Error('Failed to open Facebook page');
      }

      // Zpracuj UI příkaz s timeoutem
      let uiSuccess = false;
      try {
        const timeoutMs = config.ui_timeout_minutes * 60 * 1000;
        Log.info(`[${user.id}]`, `Spouštím UI příkaz ${command.command} s timeout ${config.ui_timeout_minutes} minut (${timeoutMs}ms)`);
        
        // Aktualizovat globální stav pro heartbeat
        global.systemState.currentUserId = user.id;
        global.systemState.currentAction = `ui_${command.command}`;
        global.systemState.actionStartTime = Date.now();
        
        const uiPromise = this.processCommand(command, fbBot);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`UI command timeout after ${config.ui_timeout_minutes} minutes (${timeoutMs}ms)`)), timeoutMs)
        );

        uiSuccess = await Promise.race([uiPromise, timeoutPromise]);
      } catch (err) {
        if (err.message.includes('timeout')) {
          await Log.warn(`[${user.id}]`, `UI příkaz ${command.command} vypršel: ${err.message}`);
          uiSuccess = false;
        } else {
          throw err;
        }
      }

      if (uiSuccess) {
        Log.success(`[${user.id}]`, `UI příkaz ${command.command} dokončen úspěšně`);
        uiCommandSuccessful = true;
      } else {
        await Log.warn(`[${user.id}]`, `UI příkaz ${command.command} selhal`);
      }
      
      // Vymazat UI stav z globálního stavu
      global.systemState.currentUserId = null;
      global.systemState.currentAction = null;
      global.systemState.actionStartTime = null;
      
      // KRITICKÉ: Vymazat UI cache aby se heartbeat nepokusil znovu spustit stejný příkaz
      global.uiCommandCache = null;

    } catch (err) {
      await Log.error(`[${user.id}]`, `Chyba při zpracování UI příkazu: ${err.message}`);
    } finally {
      // Zavřít prohlížeč pouze pokud je stále otevřený
      // (uživatel ho mohl už zavřít během UI příkazu)
      if (browser && browser.isConnected()) {
        await this._closeBrowserSafely(browser);
      }
      
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
    if (this.intervalHandle) {
      Log.info('[UI]', 'Zavírám UIBot zdroje...');
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    this.currentCommand = null;
    this.isProcessing = false;
  }

  // ==========================================
  // PRIVATE METODY PRO ZPRACOVÁNÍ PŘÍKAZŮ
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
    await Wait.toMinutes(minutes, 'Pauza na oběd');
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
      await Log.warn('[UI]', 'Nelze čekat, instance prohlížeče není dostupná.');
      return;
    }
    const browser = this.fbBot.page.browser();
    const checkIntervalMs = 30000; // Kontrola každých 30 sekund
    const timeoutMs = timeoutMinutes * 60 * 1000;
    let elapsedTime = 0;

    Log.info('[UI]', `Čekám na manuální zavření prohlížeče (max ${timeoutMinutes} minut = ${timeoutMs}ms)...`);

    // Spustíme interval, který bude posílat heartbeat
    const heartbeatInterval = setInterval(async () => {
      try {
        elapsedTime += checkIntervalMs;
        const remainingMinutes = Math.ceil((timeoutMs - elapsedTime) / 60000);
        Log.debug('[UI]', `Heartbeat - zbývá ${remainingMinutes} minut čekání...`);
        db.heartBeat(this.currentCommand.user_id || 0, 0, 'UI_WAIT');
      } catch (e) {
        await Log.warn('[UI]', `Heartbeat během čekání selhal: ${e.message}`);
      }
    }, checkIntervalMs);

    try {
      // Čekáme na jednu ze dvou událostí: zavření prohlížeče nebo timeout
      Log.debug('[UI]', 'Spouštím Promise.race mezi browser.disconnected a setTimeout...');
      await Promise.race([
        new Promise(resolve => {
          browser.once('disconnected', () => {
            Log.debug('[UI]', 'Browser disconnected event triggered');
            resolve();
          });
        }),
        new Promise(resolve => {
          setTimeout(() => {
            Log.debug('[UI]', `Timeout ${timeoutMs}ms elapsed`);
            resolve();
          }, timeoutMs);
        })
      ]);

      if (!browser.isConnected()) {
        Log.success('[UI]', 'Prohlížeč byl manuálně zavřen, UI příkaz je považován za dokončený.');
      } else {
        await Log.warn('[UI]', `Timeout čekání na zavření prohlížeče po ${timeoutMinutes} minutách.`);
      }
    } finally {
      // Vždy po skončení čekání zrušíme interval pro heartbeat
      clearInterval(heartbeatInterval);
      Log.debug('[UI]', 'Heartbeat interval cleared');
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
      Log.debug('[UI]', 'Čekám 2s před zavřením prohlížeče...');
      await Wait.toSeconds(2, 'Čekání před zavřením prohlížeče');
      
      Log.info('[UI]', 'Zavírám prohlížeč...');
      await browser.close();
      Log.success('[UI]', 'UIBot úspěšně zavřel prohlížeč');
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
