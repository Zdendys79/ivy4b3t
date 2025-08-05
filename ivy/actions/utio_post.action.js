/**
 * Název souboru: utio_post.action.js
 * Umístění: ~/ivy/actions/utio_post.action.js
 *
 * Popis: Univerzální UTIO postovací akce
 * - Typ skupiny se extrahuje z action_code (post_utio_G → G)
 * - Jedna akce pro všechny typy UTIO postování
 * - Využívá BaseUtioPostAction společný modul
 */

import { BaseUtioPostAction } from '../libs/base_utio_post_action.class.js';

export class UtioPostAction extends BaseUtioPostAction {
  constructor(actionCode) {
    // Extrahuj typ skupiny z action_code (post_utio_G → G)
    const groupType = actionCode.replace('post_utio_', '').toUpperCase();
    super(actionCode, groupType);
  }
}