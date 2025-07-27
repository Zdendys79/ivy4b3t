/**
 * Název souboru: account_delay.action.js
 * Umístění: ~/ivy/actions/account_delay.action.js
 *
 * Popis: Account delay akce - prodleva účtu na 1-4 hodiny
 * - Implementuje BaseAction
 * - Pouze jedna odpovědnost: nastavit delay účtu
 * - Žádné fallbacky
 */

import { BaseAction } from '../libs/base_action.class.js';
import { Log } from '../libs/iv_log.class.js';

export class AccountDelayAction extends BaseAction {
  constructor() {
    super('account_delay');
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
    // Account delay funguje jen v produkční verzi, na main větvi se nepoužívá
    if (global.isTestBranch) {
      return {
        ready: false,
        reason: 'Account delay se nepoužívá na main větvi - používá se next_worktime při výběru uživatele',
        critical: false
      };
    }
    
    return {
      ready: true,
      reason: 'Account delay je připraven pro produkční větev'
    };
  }

  /**
   * Provedení account delay - pouze pro produkční větev
   */
  async execute(user, context, pickedAction) {
    try {
      // Nastav delay na 1-4 hodiny (pouze pro produkční větev)
      const delayMinutes = 60 + Math.random() * 180; // 1-4 hodiny
      
      await this.db.updateUserWorktime(user.id, delayMinutes);
      await this.logAction(user, null, `Account delay: ${Math.round(delayMinutes)}min`);
      
      Log.info(`[${user.id}]`, `⏳ Account delay: ${Math.round(delayMinutes)}min`);
      return true;

    } catch (err) {
      await Log.error(`[${user.id}]`, `Chyba při account delay: ${err.message}`);
      return false;
    }
  }
}