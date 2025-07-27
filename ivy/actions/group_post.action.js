/**
 * Název souboru: group_post.action.js
 * Umístění: ~/ivy/actions/group_post.action.js
 *
 * Popis: Group post akce - příspěvky do zájmových skupin
 * - Implementuje BaseAction
 * - Placeholder implementace
 * - Žádné fallbacky
 */

import { BaseAction } from '../libs/base_action.class.js';
import { Log } from '../libs/iv_log.class.js';

export class GroupPostAction extends BaseAction {
  constructor() {
    super('group_post');
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
      reason: 'GroupPost není zatím implementováno',
      critical: false
    };
  }

  /**
   * Provedení group post
   */
  async execute(user, context, pickedAction) {
    await Log.warn(`[${user.id}]`, 'groupPost není zatím implementováno');
    return false;
  }
}