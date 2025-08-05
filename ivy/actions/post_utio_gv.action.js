/**
 * Název souboru: post_utio_gv.action.js
 * Umístění: ~/ivy/actions/post_utio_gv.action.js
 *
 * Popis: Implementace UTIO post do veřejných skupin
 * - Využívá společný BaseUtioPostAction modul
 * - Typ skupiny: GV (veřejné skupiny)
 */

import { BaseUtioPostAction } from '../libs/base_utio_post_action.class.js';

export class PostUtioGvAction extends BaseUtioPostAction {
  constructor() {
    super('post_utio_gv', 'GV');
  }
}