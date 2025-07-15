/**
 * Název souboru: comment.action.js
 * Umístění: ~/ivy/actions/comment.action.js
 *
 * Popis: Comment akce - komentování příspěvků
 * - Implementuje BaseAction
 * - Placeholder implementace
 * - Žádné fallbacky
 */

import { BaseAction } from '../libs/base_action.class.js';
import { Log } from '../libs/iv_log.class.js';

export class CommentAction extends BaseAction {
  constructor() {
    super('comment');
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
      reason: 'Comment není zatím implementováno',
      critical: false
    };
  }

  /**
   * Provedení comment
   */
  async execute(user, context, pickedAction) {
    await Log.warn(`[${user.id}]`, 'comment není zatím implementováno');
    return false;
  }
}