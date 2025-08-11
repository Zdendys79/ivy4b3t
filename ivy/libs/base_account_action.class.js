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
    this.actionName = actionName; // Explicitně nastavit actionName
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
      const minMinutes = pickedAction.min_minutes || 60;  // Fallback hodnoty
      const maxMinutes = pickedAction.max_minutes || 240;
      
      // Kontrola platnosti hodnot
      if (!Number.isInteger(minMinutes) || !Number.isInteger(maxMinutes) || minMinutes <= 0 || maxMinutes <= 0) {
        throw new Error(`Neplatné hodnoty min_minutes=${minMinutes}, max_minutes=${maxMinutes}`);
      }
      
      const minutes = minMinutes + Math.random() * (maxMinutes - minMinutes);
      
      // Kontrola na NaN před validací
      if (isNaN(minutes) || !isFinite(minutes)) {
        throw new Error(`Vypočítaná hodnota minutes je neplatná: ${minutes}`);
      }
      
      // Validace hodnoty - MySQL INTERVAL má omezení (max ~30 dní = 43200 minut)
      const validatedMinutes = Math.min(Math.max(Math.round(minutes), 1), 43200);
      
      const value = this.displayUnit === 'h' ? Math.round(validatedMinutes / 60) : validatedMinutes;
      const logText = `Account ${this.actionName.replace('account_', '')}: ${value}${this.displayUnit}`;
      
      // Aktualizuj action plan - pro dlouhé sleep periods použij hodiny místo minut
      if (this.actionName === 'account_sleep') {
        const hours = Math.round(validatedMinutes / 60);
        await this.db.safeExecute('actions.scheduleNextHours', [hours, user.id, this.actionName]);
      } else {
        await this.db.safeExecute('actions.scheduleNext', [validatedMinutes, user.id, this.actionName]);
      }
      await this.logAction(user, null, logText);
      
      Log.info(`[${user.id}]`, logText);
      return true;

    } catch (err) {
      await Log.error(`[${user.id}]`, `Chyba při ${this.actionName}: ${err.message}`);
      return false;
    }
  }
}