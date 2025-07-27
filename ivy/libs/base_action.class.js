/**
 * Název souboru: base_action.class.js
 * Umístění: ~/ivy/libs/base_action.class.js
 *
 * Popis: Abstract třída pro všechny akce
 * - Definuje společné rozhraní
 * - Poskytuje základní funkcionalita
 * - Vynucuje implementaci execute() metody
 */

import { Log } from './iv_log.class.js';
import { getIvyConfig } from './iv_config.class.js';
import { db } from '../iv_sql.js';

const config = getIvyConfig();

export class BaseAction {
  constructor(actionCode) {
    this.actionCode = actionCode;
    this.db = db;
    this.config = config;
    this.initialized = false;
    
    if (this.constructor === BaseAction) {
      throw new Error('BaseAction is abstract and cannot be instantiated directly');
    }
  }

  /**
   * Inicializace akce - override v potomcích
   */
  async init() {
    this.initialized = true;
    return true;
  }

  /**
   * Definuje požadavky akce na služby
   * @returns {object} - {needsFB: boolean, needsUtio: boolean}
   */
  getRequirements() {
    return {
      needsFB: false,
      needsUtio: false
    };
  }

  /**
   * Ověří připravenost před spuštěním akce
   * @param {Object} user - Uživatelské data
   * @param {Object} context - Kontext s instancemi botů
   * @returns {Promise<Object>} Výsledek ověření
   */
  async verifyReadiness(user, context) {
    return {
      ready: true,
      reason: 'Základní verifikace prošla'
    };
  }

  /**
   * Hlavní metoda pro provedení akce - MUSÍ být implementována v potomcích
   * @param {Object} user - Uživatelské data
   * @param {Object} context - Kontext s instancemi botů
   * @param {Object} pickedAction - Vybraná akce z wheel
   * @returns {Promise<boolean>} True pokud byla akce úspěšná
   */
  async execute(user, context, pickedAction) {
    throw new Error(`execute() method must be implemented in ${this.constructor.name}`);
  }

  /**
   * Zaloguje kvalitu akce
   * @param {Object} user - Uživatelské data
   * @param {boolean} success - Úspěch akce
   * @param {Object} details - Další detaily
   */
  async logActionQuality(user, success, details = {}) {
    try {
      const qualityData = {
        user_id: user.id,
        action_code: this.actionCode,
        success: success,
        timestamp: new Date().toISOString(),
        details: JSON.stringify(details),
        verification_used: details.verificationUsed || false,
        pre_checks_passed: details.preChecksPassed || false
      };

      await this.db.logActionQuality(qualityData);

      if (!success) {
        await Log.warn(`[${user.id}]`, `Neúspěšná akce ${this.actionCode}: ${details.reason || 'Neznámý důvod'}`);
      }

    } catch (err) {
      await Log.error(`[${user.id}]`, `Chyba při logování kvality akce: ${err.message}`);
    }
  }

  /**
   * Zaloguje provedení akce do databáze
   * @param {Object} user - Uživatelské data
   * @param {number} groupId - ID skupiny (optional)
   * @param {string} description - Popis akce
   */
  async logAction(user, groupId = null, description = null) {
    try {
      await this.db.logAction(user.id, this.actionCode, groupId, description || `Akce: ${this.actionCode}`);
    } catch (err) {
      await Log.error(`[${user.id}]`, `Chyba při logování akce: ${err.message}`);
    }
  }

  /**
   * Kontroluje, zda je akce inicializována
   */
  ensureInitialized() {
    if (!this.initialized) {
      throw new Error(`${this.constructor.name} není inicializována. Zavolej init() nejdříve.`);
    }
  }
}