/**
 * Název souboru: iv_fb_group_analyzer.js
 * Umístění: ~/ivy/iv_fb_group_analyzer.js
 *
 * Popis: DISABLED - Analyzátor FB skupin odstraněn kvůli chybějícím tabulkám
 * Tabulky group_details a discovered_group_links již neexistují
 */

import { Log } from './libs/iv_log.class.js';
import { Wait } from './libs/iv_wait.class.js';

export class FBGroupAnalyzer {
  constructor(page, fbBot = null) {
    this.page = page;
    this.fbBot = fbBot;
    this.currentGroupInfo = null;
  }

  /**
   * DISABLED - Hlavní funkce pro analýzu skupiny
   */
  async analyzeCurrentGroup(userId) {
    await Log.warn('[GROUP_ANALYZER]', 'Group analyzer je deaktivován - chybějící tabulky group_details');
    return null;
  }

  /**
   * DISABLED - Všechny ostatní metody analyzátoru byly odstraněny
   * kvůli chybějícím tabulkám group_details a discovered_group_links
   */
  
  async navigateToRandomGroup() {
    await Log.warn('[GROUP_ANALYZER]', 'navigateToRandomGroup je deaktivován - chybějící tabulky');
    return false;
  }

  getCurrentGroupInfo() {
    return null;
  }

  async getUserExplorationStats(userId) {
    await Log.warn('[GROUP_ANALYZER]', 'getUserExplorationStats je deaktivován - chybějící tabulky');
    return null;
  }
}