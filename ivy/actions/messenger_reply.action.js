/**
 * Název souboru: messenger_reply.action.js
 * Umístění: ~/ivy/actions/messenger_reply.action.js
 *
 * Popis: Messenger reply akce - odpovědi na zprávy
 * - Implementuje BaseAction
 * - Placeholder implementace
 * - Žádné fallbacky
 */

import { BaseAction } from '../libs/base_action.class.js';
import { Log } from '../libs/iv_log.class.js';

export class MessengerReplyAction extends BaseAction {
  constructor() {
    super('messenger_reply');
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
      reason: 'MessengerReply není zatím implementováno',
      critical: false
    };
  }

  /**
   * Provedení messenger reply
   */
  async execute(user, context, pickedAction) {
    await Log.warn(`[${user.id}]`, 'messengerReply není zatím implementováno');
    return false;
  }
}