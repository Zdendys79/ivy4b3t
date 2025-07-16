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
        if (user && this._validateUser(user)) {
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
      const isMainBranch = process.env.IVY_GIT_BRANCH === 'main';

      let user;
      if (isMainBranch) {
        user = await this._selectUserForMainBranch();
      } else {
        user = await this._selectUserForProductionBranch();
      }

      if (user && this._validateUser(user)) {
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
      const stats = await db.getAccountLockStats();
      if (stats && stats.length > 0) {
        Log.info('[USER_SELECTOR]', '=== Statistiky zablokovaných účtů ===');
        stats.forEach(stat => {
          Log.info('[USER_SELECTOR]', `${stat.lock_type}: ${stat.count} celkem (${stat.last_24h} za 24h, ${stat.last_7d} za 7d)`);
        });
      }

      const recentLocks = await db.getRecentAccountLocks();
      if (recentLocks && recentLocks.length > 0) {
        Log.info('[USER_SELECTOR]', '=== Nedávná zablokování ===');
        recentLocks.forEach(lock => {
          Log.info('[USER_SELECTOR]', `${lock.lock_date}: ${lock.lock_type} - ${lock.daily_count}x`);
        });
      }
    } catch (err) {
      await Log.error('[USER_SELECTOR]', `Chyba při načítání statistik: ${err.message}`);
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
    Log.info('[USER_SELECTOR]', '🌿 MAIN větev - používám rotační výběr uživatele s dostupnými akcemi');
    
    const user = await db.getUserWithAvailableActions(this.hostname);
    if (user) {
      await db.updateUserWorktime(user.id, 15);
      Log.info('[USER_SELECTOR]', `🌿 MAIN větev: Čas aktivity uživatele ${user.id} posunut o 15 minut`);
    }
    
    return user;
  }

  /**
   * Výběr uživatele pro produkční větev (podle dostupných akcí)
   * @returns {Promise<Object|null>}
   */
  async _selectUserForProductionBranch() {
    Log.info('[USER_SELECTOR]', '🚀 Produkční větev - standardní výběr uživatele');
    
    const user = await db.getUserWithAvailableActions(this.hostname);
    if (user) {
      // Aktualizuj next_worktime hned po výběru - vždy!
      await db.updateUserWorktime(user.id, 15);
      Log.info('[USER_SELECTOR]', `🚀 Produkční větev: Čas aktivity uživatele ${user.id} posunut o 15 minut`);
    }
    
    return user;
  }

  /**
   * Validuje uživatelská data
   * @param {Object} user - Uživatelská data
   * @returns {boolean} True pokud je uživatel validní
   */
  _validateUser(user) {
    if (!user || !user.id || !user.name || !user.surname) {
      Log.warn('[USER_SELECTOR]', `Nevalidní uživatel: ${JSON.stringify(user)}`);
      return false;
    }
    return true;
  }
}