/**
 * Název souboru: account_sleep.action.js
 * Umístění: ~/ivy/actions/account_sleep.action.js
 *
 * Popis: Account sleep akce - uspání účtu na 1-3 dny
 * - Implementuje BaseAction
 * - Pouze jedna odpovědnost: nastavit sleep účtu
 * - Žádné fallbacky
 */

import { BaseAction } from '../libs/base_action.class.js';
import { Log } from '../libs/iv_log.class.js';

export class AccountSleepAction extends BaseAction {
  constructor() {
    super('account_sleep');
  }

  /**
   * Definuje požadavky akce na služby
   */
  getRequirements() {
    return {
      needsFB: false,
      needsUtio: false
    };
  }

  /**
   * Ověří připravenost akce
   */
  async verifyReadiness(user, context) {
    return {
      ready: true,
      reason: 'Account sleep je vždy připraven'
    };
  }

  /**
   * Provedení account sleep
   */
  async execute(user, context, pickedAction) {
    try {
      // Nastav sleep na 1-3 dny
      const sleepMinutes = 1440 + Math.random() * 2880; // 1-3 dny
      
      await this.db.updateUserWorktime(user.id, sleepMinutes);
      await this.logAction(user, null, `Account sleep: ${Math.round(sleepMinutes / 60)}h`);
      
      Log.info(`[${user.id}]`, `😴 Account sleep: ${Math.round(sleepMinutes / 60)}h`);
      return true;

    } catch (err) {
      await Log.error(`[${user.id}]`, `Chyba při account sleep: ${err.message}`);
      return false;
    }
  }
}