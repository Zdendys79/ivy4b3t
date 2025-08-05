/**
 * Název souboru: post_utio_g.action.js
 * Umístění: ~/ivy/actions/post_utio_g.action.js
 *
 * Popis: Implementace UTIO post do skupin
 * - Využívá společný BaseUtioPostAction modul
 * - Typ skupiny: G (běžné skupiny)
 */

import { BaseUtioPostAction } from '../libs/base_utio_post_action.class.js';

export class PostUtioGAction extends BaseUtioPostAction {
  constructor() {
    super('post_utio_g', 'G');
  }
}