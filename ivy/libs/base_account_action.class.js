/**
 * Název souboru: base_account_action.class.js
 * Umístění: ~/ivy/libs/base_account_action.class.js
 *
 * Popis: Base třída pro account akce - čte parametry z action_definitions
 * - Kratší a jasnější než duplikovaný kód
 * - Hodnoty z databáze, ne hardcoded
 */

import { BaseAction } from './base_action.class.js';
import { Log } from './iv_log.class.js';

export class BaseAccountAction extends BaseAction {
  constructor(actionName, displayUnit = 'min') {
    super(actionName);
    this.displayUnit = displayUnit;
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
      reason: `${this.actionName} je vždy připraven`
    };
  }

  /**
   * Provedení account akce - parametry už jsou v pickedAction z wheel
   */
  async execute(user, context, pickedAction) {
    try {
      // Wheel už předal kompletní akci s parametry
      const minMinutes = pickedAction.min_minutes;
      const maxMinutes = pickedAction.max_minutes;
      
      const minutes = minMinutes + Math.random() * (maxMinutes - minMinutes);
      const value = this.displayUnit === 'h' ? Math.round(minutes / 60) : Math.round(minutes);
      const logText = `Account ${this.actionName.replace('account_', '')}: ${value}${this.displayUnit}`;
      
      await this.db.updateUserWorktime(user.id, minutes);
      await this.logAction(user, null, logText);
      
      Log.info(`[${user.id}]`, logText);
      return true;

    } catch (err) {
      await Log.error(`[${user.id}]`, `Chyba při ${this.actionName}: ${err.message}`);
      return false;
    }
  }
}