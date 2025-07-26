/**
 * Název souboru: timeline_post.action.js
 * Umístění: ~/ivy/actions/timeline_post.action.js
 *
 * Popis: Timeline post akce - příspěvky na timeline
 * - Implementuje BaseAction
 * - Placeholder implementace
 * - Žádné fallbacky
 */

import { BaseAction } from '../libs/base_action.class.js';
import { Log } from '../libs/iv_log.class.js';

export class TimelinePostAction extends BaseAction {
  constructor() {
    super('timeline_post');
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
      reason: 'TimelinePost není zatím implementováno',
      critical: false
    };
  }

  /**
   * Provedení timeline post
   */
  async execute(user, context, pickedAction) {
    await Log.warn(`[${user.id}]`, 'timelinePost není zatím implementováno');
    return false;
  }
}