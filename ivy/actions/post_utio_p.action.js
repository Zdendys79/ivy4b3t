/**
 * Název souboru: post_utio_p.action.js
 * Umístění: ~/ivy/actions/post_utio_p.action.js
 *
 * Popis: UTIO post do prodejních skupin (P)
 * - Implementuje BaseAction
 * - Pouze jedna odpovědnost: post UTIO do prodejních skupin
 * - Žádné fallbacky
 */

import { BaseAction } from '../libs/base_action.class.js';
import { Log } from '../libs/iv_log.class.js';

export class PostUtioPAction extends BaseAction {
  constructor() {
    super('post_utio_p');
  }

  /**
   * Definuje požadavky akce na služby
   */
  getRequirements() {
    return {
      needsFB: true,
      needsUtio: true
    };
  }

  /**
   * Ověří připravenost akce
   */
  async verifyReadiness(user, context) {
    return {
      ready: false,
      reason: 'Akce post_utio_p není zatím plně implementována',
      critical: false
    };
  }

  /**
   * Provedení UTIO post do prodejní skupiny
   */
  async execute(user, context, pickedAction) {
    await Log.warn(`[${user.id}]`, 'Akce post_utio_p není zatím plně implementována s novou logikou.');
    return false;
  }
}