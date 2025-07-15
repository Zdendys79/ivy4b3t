/**
 * Název souboru: iv_actions_new.class.js
 * Umístění: ~/ivy/libs/iv_actions_new.class.js
 *
 * Popis: Refaktorovaná IvActions třída - pouze delegace na ActionRouter
 * - Žádné fallbacky - buď funguje, nebo ne
 * - Single Responsibility: pouze delegace na ActionRouter
 * - KISS, YAGNI, DRY principy
 */

import { Log } from './iv_log.class.js';
import { ActionRouter } from './action_router.class.js';

export class IvActions {
  constructor() {
    this.actionRouter = new ActionRouter();
    this.initialized = false;
  }

  /**
   * Inicializuje ActionRouter
   */
  async init() {
    try {
      const routerInit = await this.actionRouter.init();
      if (!routerInit) {
        throw new Error('ActionRouter initialization failed');
      }
      
      this.initialized = true;
      return true;
    } catch (error) {
      await Log.error('[ACTIONS]', `Chyba při inicializaci IvActions: ${error.message}`);
      throw error; // Žádné fallbacky - nech to selhat
    }
  }

  /**
   * Určuje požadavky konkrétní akce na služby (FB, UTIO)
   * @param {string} actionCode - kód akce
   * @returns {object} - {needsFB: boolean, needsUtio: boolean}
   */
  getActionRequirements(actionCode) {
    this.ensureInitialized();
    return this.actionRouter.getActionRequirements(actionCode);
  }

  /**
   * Ověří připravenost před spuštěním jakékoliv akce
   * @param {Object} user - Uživatelské data
   * @param {Object} fbBot - FBBot instance
   * @param {string} actionCode - Kód akce
   * @param {Object} options - Další možnosti
   * @returns {Promise<Object>} Výsledek ověření
   */
  async verifyActionReadiness(user, fbBot, actionCode, options = {}) {
    this.ensureInitialized();
    
    // Delegace na ActionRouter s vytvořením context objektu
    const context = { fbBot };
    return await this.actionRouter.verifyActionReadiness(actionCode, user, context);
  }

  /**
   * HLAVNÍ FUNKCE - Spouští konkrétní akci na základě action_code
   * @param {Object} user - Uživatelské data
   * @param {string} actionCode - Kód akce k provedení
   * @param {Object} context - Kontext s instancemi botů
   * @param {Object} pickedAction - Vybraná akce z wheel of fortune
   * @returns {Promise<boolean>} True pokud byla akce úspěšná
   */
  async runAction(user, actionCode, context, pickedAction) {
    this.ensureInitialized();
    
    // Prostá delegace na ActionRouter - žádné fallbacky
    return await this.actionRouter.executeAction(actionCode, user, context, pickedAction);
  }

  /**
   * Ověří, že je třída inicializována
   */
  ensureInitialized() {
    if (!this.initialized) {
      throw new Error('IvActions není inicializována. Zavolej init() nejdříve.');
    }
  }

  /**
   * Získá seznam registrovaných akcí
   * @returns {Array<string>} Seznam kódů akcí
   */
  getRegisteredActions() {
    this.ensureInitialized();
    return this.actionRouter.getRegisteredActions();
  }
}

// Export pro kompatibilitu s původním kódem
export async function getActionRequirements(actionCode) {
  const actions = new IvActions();
  await actions.init();
  return actions.getActionRequirements(actionCode);
}

export async function runAction(user, actionCode, context, pickedAction) {
  const actions = new IvActions();
  await actions.init();
  return await actions.runAction(user, actionCode, context, pickedAction);
}