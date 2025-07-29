/**
 * Název souboru: iv_user_selector.class.js
 * Umístění: ~/ivy/libs/iv_user_selector.class.js
 *
 * Popis: Třída pro výběr uživatelů z databáze
 * - Různé strategie výběru podle větve a kontextu
 * - Extrakce uživatelů z UI příkazů
 * - Validace uživatelských dat
 */

import os from 'node:os';

import { db } from '../iv_sql.js';
import { Log } from './iv_log.class.js';
import { UIBot } from './iv_ui.class.js';

export class UserSelector {
  constructor() {
    this.hostname = os.hostname();
  }

  /**
   * Kontrola UI příkazů v databázi
   * @returns {Promise<Object|null>} UI příkaz nebo null
   */
  async checkForUICommand() {
    return await UIBot.quickCheck();
  }

  /**
   * Získá uživatele pro UI příkaz
   * @param {Object} uiCommand - UI příkaz z databáze
   * @returns {Promise<Object|null>} Uživatel nebo null
   */
  async getUserForUICommand(uiCommand) {
    try {
      const commandData = JSON.parse(uiCommand.data || '{}');
      let userId = commandData.user_id || commandData.account_id || commandData.id;
      
      if (userId) {
        const user = await db.getUserById(userId);
        if (user && await this._validateUser(user)) {
          Log.info('[USER_SELECTOR]', `Vybrán uživatel ${user.id} pro UI příkaz ${uiCommand.command}`);
          return user;
        }
      }
      
      await Log.warn('[USER_SELECTOR]', 'UI příkaz neobsahuje platného uživatele');
      return null;
    } catch (err) {
      await Log.error('[USER_SELECTOR]', `Chyba při extrakci uživatele z UI příkazu: ${err.message}`);
      return null;
    }
  }

  /**
   * Hlavní metoda pro výběr uživatele podle kontextu
   * @returns {Promise<Object|null>} Vybraný uživatel nebo null
   */
  async selectUser() {
    try {
      let user;
      if (global.isTestBranch) {
        user = await this._selectUserForMainBranch();
      } else {
        user = await this._selectUserForProductionBranch();
      }

      if (user && await this._validateUser(user)) {
        Log.success('[USER_SELECTOR]', `Vybrán uživatel ${user.id} (${user.name} ${user.surname})`);
        return user;
      }

      Log.info('[USER_SELECTOR]', 'Nebyl nalezen žádný vhodný uživatel');
      return null;
    } catch (err) {
      await Log.error('[USER_SELECTOR]', `Chyba při výběru uživatele: ${err.message}`);
      return null;
    }
  }

  /**
   * Zobrazí statistiky zablokovaných účtů
   * @returns {Promise<void>}
   */
  async showAccountLockStats() {
    try {
      // Jednoduché počítání zablokovaných účtů místo komplexních statistik
      // Filtruje pouze uživatele pro místní hostname
      const totalUsers = await db.safeQueryAll('users.getByHostname', [this.hostname]);
      const lockedUsers = totalUsers.filter(user => user.locked !== null);
      
      Log.info('[USER_SELECTOR]', `=== Statistiky účtů (${this.hostname}) ===`);
      Log.info('[USER_SELECTOR]', `Zablokováno: ${lockedUsers.length} z ${totalUsers.length} celkem`);
      
      if (lockedUsers.length > 0) {
        const lockTypes = {};
        lockedUsers.forEach(user => {
          const type = user.lock_type || 'neznámý';
          lockTypes[type] = (lockTypes[type] || 0) + 1;
        });
        
        Log.info('[USER_SELECTOR]', `Typy zablokování:`);
        Object.entries(lockTypes).forEach(([type, count]) => {
          Log.info('[USER_SELECTOR]', `  ${type}: ${count}x`);
        });
      }
    } catch (err) {
      Log.debug('[USER_SELECTOR]', `Chyba při načítání statistik: ${err.message}`);
    }
  }

  // ==========================================
  // PRIVATE METODY
  // ==========================================

  /**
   * Výběr uživatele pro main větev (rotační)
   * @returns {Promise<Object|null>}
   */
  async _selectUserForMainBranch() {
    Log.info('[USER_SELECTOR]', 'MAIN větev - používám rotační výběr uživatele s dostupnými akcemi');
    
    const user = await db.getUserWithAvailableActions(this.hostname);
    if (user) {
      await db.updateUserWorktime(user.id, 15);
      Log.info('[USER_SELECTOR]', `MAIN větev: Čas aktivity uživatele ${user.id} posunut o ${Log.formatTime(15, 'min')}`);
    }
    
    return user;
  }

  /**
   * Výběr uživatele pro produkční větev (podle dostupných akcí)
   * @returns {Promise<Object|null>}
   */
  async _selectUserForProductionBranch() {
    Log.info('[USER_SELECTOR]', 'Produkční větev - standardní výběr uživatele');
    
    const user = await db.getUserWithAvailableActions(this.hostname);
    if (user) {
      // Aktualizuj next_worktime hned po výběru - vždy!
      await db.updateUserWorktime(user.id, 15);
      Log.info('[USER_SELECTOR]', `Produkční větev: Čas aktivity uživatele ${user.id} posunut o ${Log.formatTime(15, 'min')}`);
    }
    
    return user;
  }

  /**
   * Validuje uživatelská data
   * @param {Object} user - Uživatelská data
   * @returns {boolean} True pokud je uživatel validní
   */
  async _validateUser(user) {
    if (!user || !user.id || !user.name || !user.surname) {
      await Log.warn('[USER_SELECTOR]', `Nevalidní uživatel: ${JSON.stringify(user)}`);
      return false;
    }
    return true;
  }
}