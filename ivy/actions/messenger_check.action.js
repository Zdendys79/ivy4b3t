/**
 * Název souboru: messenger_check.action.js
 * Umístění: ~/ivy/actions/messenger_check.action.js
 *
 * Popis: Messenger check akce - kontrola zpráv
 * - Implementuje BaseAction
 * - Placeholder implementace
 * - Žádné fallbacky
 */

import { BaseAction } from '../libs/base_action.class.js';
import { Log } from '../libs/iv_log.class.js';

export class MessengerCheckAction extends BaseAction {
  constructor() {
    super('messenger_check');
  }

  /**
   * Definuje požadavky akce na služby
   */
  getRequirements() {
    return {
      needsFB: true,
      needsUtio: false
    };
  }

  /**
   * Ověří připravenost akce
   */
  async verifyReadiness(user, context) {
    return {
      ready: false,
      reason: 'MessengerCheck není zatím implementováno',
      critical: false
    };
  }

  /**
   * Provedení messenger check
   */
  async execute(user, context, pickedAction) {
    await Log.warn(`[${user.id}]`, 'messengerCheck není zatím implementováno');
    return false;
  }
}