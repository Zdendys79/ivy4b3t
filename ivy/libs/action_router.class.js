/**
 * Název souboru: action_router.class.js
 * Umístění: ~/ivy/libs/action_router.class.js
 *
 * Popis: Router pro směrování akcí do specializovaných tříd
 * - Registruje akce a jejich třídy
 * - Poskytuje jednotné rozhraní pro spouštění akcí
 * - Nahrazuje switch statement v IvActions
 */

import { Log } from './iv_log.class.js';
import { BaseAction } from './base_action.class.js';

// Import všech action tříd
import { UtioPostAction } from '../actions/utio_post.action.js';
import { PostUtioPAction } from '../actions/post_utio_p.action.js';
import { AccountDelayAction } from '../actions/account_delay.action.js';
import { AccountSleepAction } from '../actions/account_sleep.action.js';
import { UniversalPostAction } from '../actions/universal_post.action.js';
import { GroupPostAction } from '../actions/group_post.action.js';
import { TimelinePostAction } from '../actions/timeline_post.action.js';
import { CommentAction } from '../actions/comment.action.js';
import { ReactAction } from '../actions/react.action.js';
import { MessengerCheckAction } from '../actions/messenger_check.action.js';
import { MessengerReplyAction } from '../actions/messenger_reply.action.js';
import { GroupExploreAction } from '../actions/group_explore.action.js';

export class ActionRouter {
  constructor() {
    this.actionMap = new Map();
    this.initialized = false;
  }

  /**
   * Inicializuje router a registruje všechny akce
   */
  async init() {
    if (this.initialized) {
      return true;
    }

    try {
      // Registrace UTIO akcí - univerzální pattern
      // post_utio_g, post_utio_gv budou používat UtioPostAction
      // post_utio_p zůstává samostatně (jiná implementace)
      this.registerAction('post_utio_p', PostUtioPAction);

      // Registrace account akcí
      this.registerAction('account_delay', AccountDelayAction);
      this.registerAction('account_sleep', AccountSleepAction);

      // Registrace univerzálních post akcí
      this.registerAction('quote_post', UniversalPostAction);
      this.registerAction('news_post', UniversalPostAction);

      // Záložní registrace starých akcí (pro postupný přechod)
      // this.registerAction('quote_post', QuotePostAction);
      // this.registerAction('news_post', NewsPostAction);
      this.registerAction('group_post', GroupPostAction);
      this.registerAction('timeline_post', TimelinePostAction);
      this.registerAction('comment', CommentAction);
      this.registerAction('react', ReactAction);
      this.registerAction('messenger_check', MessengerCheckAction);
      this.registerAction('messenger_reply', MessengerReplyAction);
      this.registerAction('group_explore', GroupExploreAction);

      this.initialized = true;
      Log.success('[ACTION_ROUTER]', `Inicializován s ${this.actionMap.size} akcemi`);
      return true;

    } catch (error) {
      await Log.error('[ACTION_ROUTER]', `Chyba při inicializaci: ${error.message}`);
      return false;
    }
  }

  /**
   * Registruje akci a její třídu
   * @param {string} actionCode - Kód akce
   * @param {Class} ActionClass - Třída akce
   */
  registerAction(actionCode, ActionClass) {
    if (!ActionClass.prototype instanceof BaseAction) {
      throw new Error(`Action class for ${actionCode} must extend BaseAction`);
    }

    this.actionMap.set(actionCode, ActionClass);
  }

  /**
   * Pomocná metoda pro získání Action třídy podle action_code
   * @param {string} actionCode 
   * @returns {Class|null}
   */
  getActionClass(actionCode) {
    // Nejprve zkus přímé vyhledání
    if (this.actionMap.has(actionCode)) {
      return this.actionMap.get(actionCode);
    }
    
    // Pokud začíná post_utio_ (kromě post_utio_p), použij univerzální akci
    if (actionCode.startsWith('post_utio_') && actionCode !== 'post_utio_p') {
      return UtioPostAction;
    }
    
    return null;
  }

  /**
   * Získá požadavky konkrétní akce na služby
   * @param {string} actionCode - Kód akce
   * @returns {object} - {needsFB: boolean, needsUtio: boolean}
   */
  async getActionRequirements(actionCode) {
    const ActionClass = this.getActionClass(actionCode);
    if (!ActionClass) {
      await Log.warn('[ACTION_ROUTER]', `Neznámý action_code: ${actionCode}`);
      return { needsFB: false, needsUtio: false };
    }

    // Vytvoř dočasnou instanci pro získání požadavků
    const tempInstance = this._createActionInstance(ActionClass, actionCode);
    return tempInstance.getRequirements();
  }

  /**
   * Ověří připravenost akce
   * @param {string} actionCode - Kód akce
   * @param {Object} user - Uživatelské data
   * @param {Object} context - Kontext s instancemi botů
   * @returns {Promise<Object>} Výsledek ověření
   */
  async verifyActionReadiness(actionCode, user, context) {
    const ActionClass = this.getActionClass(actionCode);
    if (!ActionClass) {
      return {
        ready: false,
        reason: `Neznámá akce: ${actionCode}`,
        critical: true
      };
    }

    try {
      const actionInstance = this._createActionInstance(ActionClass, actionCode);
      await actionInstance.init();
      return await actionInstance.verifyReadiness(user, context);

    } catch (error) {
      await Log.error(`[${user.id}]`, `Chyba při ověřování akce ${actionCode}: ${error.message}`);
      return {
        ready: false,
        reason: `Chyba při ověřování: ${error.message}`,
        critical: true
      };
    }
  }

  /**
   * Spustí konkrétní akci
   * @param {string} actionCode - Kód akce k provedení
   * @param {Object} user - Uživatelské data
   * @param {Object} context - Kontext s instancemi botů
   * @param {Object} pickedAction - Vybraná akce z wheel of fortune
   * @returns {Promise<boolean>} True pokud byla akce úspěšná
   */
  async executeAction(actionCode, user, context, pickedAction) {
    this.ensureInitialized();

    const ActionClass = this.getActionClass(actionCode);
    if (!ActionClass) {
      await Log.error(`[${user.id}]`, `Neznámá akce: ${actionCode}`);
      return false;
    }

    try {
      Log.info(`[${user.id}]`, `Spouštím akci: ${actionCode}`);

      // Vytvoř instanci akce
      const actionInstance = this._createActionInstance(ActionClass, actionCode);
      await actionInstance.init();

      // Předběžné ověření připravenosti
      const readinessCheck = await actionInstance.verifyReadiness(user, context);
      if (!readinessCheck.ready && readinessCheck.critical) {
        await Log.error(`[${user.id}]`, `Akce ${actionCode} není připravena: ${readinessCheck.reason}`);
        return false;
      }

      // Provedení akce
      const result = await actionInstance.execute(user, context, pickedAction);


      if (result) {
        Log.success(`[${user.id}]`, `Akce ${actionCode} úspěšně dokončena`);
      } else {
        Log.info(`[${user.id}]`, `Akce ${actionCode} selhala`);
      }

      return result;

    } catch (error) {
      await Log.error(`[${user.id}] executeAction`, error);
      

      return false;
    }
  }

  /**
   * Získá seznam všech registrovaných akcí
   * @returns {Array<string>} Seznam kódů akcí
   */
  getRegisteredActions() {
    return Array.from(this.actionMap.keys());
  }

  /**
   * Vytvoří instanci akce se správnými parametry
   * @private
   * @param {Class} ActionClass - Třída akce
   * @param {string} actionCode - Kód akce
   * @returns {BaseAction} Instance akce
   */
  _createActionInstance(ActionClass, actionCode) {
    // Speciální handling pro UniversalPostAction
    if (ActionClass === UniversalPostAction) {
      if (actionCode === 'quote_post') {
        return new UniversalPostAction('quote');
      } else if (actionCode === 'news_post') {
        return new UniversalPostAction('news');
      }
    }
    
    // Standardní vytvoření instance
    return new ActionClass(actionCode);
  }

  /**
   * Kontroluje, zda je router inicializován
   */
  ensureInitialized() {
    if (!this.initialized) {
      throw new Error('ActionRouter není inicializován. Zavolej init() nejdříve.');
    }
  }
}