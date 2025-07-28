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
import { PostUtioGAction } from '../actions/post_utio_g.action.js';
import { PostUtioGvAction } from '../actions/post_utio_gv.action.js';
import { PostUtioPAction } from '../actions/post_utio_p.action.js';
import { AccountDelayAction } from '../actions/account_delay.action.js';
import { AccountSleepAction } from '../actions/account_sleep.action.js';
import { QuotePostAction } from '../actions/quote_post.action.js';
import { NewsPostAction } from '../actions/news_post.action.js';
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
      // Registrace UTIO akcí
      this.registerAction('post_utio_g', PostUtioGAction);
      this.registerAction('post_utio_gv', PostUtioGvAction);
      this.registerAction('post_utio_p', PostUtioPAction);

      // Registrace account akcí
      this.registerAction('account_delay', AccountDelayAction);
      this.registerAction('account_sleep', AccountSleepAction);

      // Registrace ostatních akcí
      this.registerAction('quote_post', QuotePostAction);
      this.registerAction('news_post', NewsPostAction);
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
   * Získá požadavky konkrétní akce na služby
   * @param {string} actionCode - Kód akce
   * @returns {object} - {needsFB: boolean, needsUtio: boolean}
   */
  async getActionRequirements(actionCode) {
    const ActionClass = this.actionMap.get(actionCode);
    if (!ActionClass) {
      await Log.warn('[ACTION_ROUTER]', `Neznámý action_code: ${actionCode}`);
      return { needsFB: false, needsUtio: false };
    }

    // Vytvoř dočasnou instanci pro získání požadavků
    const tempInstance = new ActionClass();
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
    const ActionClass = this.actionMap.get(actionCode);
    if (!ActionClass) {
      return {
        ready: false,
        reason: `Neznámá akce: ${actionCode}`,
        critical: true
      };
    }

    try {
      const actionInstance = new ActionClass();
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

    const ActionClass = this.actionMap.get(actionCode);
    if (!ActionClass) {
      await Log.error(`[${user.id}]`, `Neznámá akce: ${actionCode}`);
      return false;
    }

    try {
      Log.info(`[${user.id}]`, `Spouštím akci: ${actionCode}`);

      // Vytvoř instanci akce
      const actionInstance = new ActionClass();
      await actionInstance.init();

      // Předběžné ověření připravenosti
      const readinessCheck = await actionInstance.verifyReadiness(user, context);
      if (!readinessCheck.ready && readinessCheck.critical) {
        await Log.error(`[${user.id}]`, `Akce ${actionCode} není připravena: ${readinessCheck.reason}`);
        await actionInstance.logActionQuality(user, false, {
          reason: readinessCheck.reason,
          verificationUsed: true,
          preChecksPassed: false
        });
        return false;
      }

      // Provedení akce
      const result = await actionInstance.execute(user, context, pickedAction);

      // Logování kvality akce
      await actionInstance.logActionQuality(user, result, {
        verificationUsed: readinessCheck.ready,
        preChecksPassed: readinessCheck.ready,
        reason: result ? 'Success' : 'Failed'
      });

      if (result) {
        Log.success(`[${user.id}]`, `Akce ${actionCode} úspěšně dokončena`);
      } else {
        Log.info(`[${user.id}]`, `Akce ${actionCode} selhala`);
      }

      return result;

    } catch (error) {
      await Log.error(`[${user.id}] executeAction`, error);
      
      // Pokus o logování kvality i při chybě
      try {
        const tempInstance = new ActionClass();
        await tempInstance.logActionQuality(user, false, {
          reason: error.message,
          verificationUsed: false,
          preChecksPassed: false
        });
      } catch (logError) {
        // Ignoruj chyby při logování
      }

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
   * Kontroluje, zda je router inicializován
   */
  ensureInitialized() {
    if (!this.initialized) {
      throw new Error('ActionRouter není inicializován. Zavolej init() nejdříve.');
    }
  }
}