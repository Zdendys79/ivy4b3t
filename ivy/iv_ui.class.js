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
    Log.info('[UI]', `Prohlížeč zůstane otevřený. Zavřete ho manuálně pro pokračování cyklu.`);
    await this._waitForBrowserClose();
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
      Log.success('[UI]', `Skupina ${group.nazev} otevřena pro uživatele ${user_id}`);
      await this._waitForBrowserClose();
      return true;
    } catch (err) {
      await Log.error('[UI] user_group', err);
      return false;
    }
  }

  async _waitForBrowserClose() {
    if (!this.fbBot || !this.fbBot.page || !this.fbBot.page.browser()) {
      Log.warn('[UI]', 'Nelze čekat na zavření prohlížeče, instance není dostupná.');
      return;
    }
    const browser = this.fbBot.page.browser();
    Log.info('[UI]', 'Čekám na manuální zavření prohlížeče...');
    await new Promise(resolve => browser.once('disconnected', resolve));
    Log.info('[UI]', 'Prohlížeč byl manuálně zavřen, UI příkaz je považován za dokončený.');
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
