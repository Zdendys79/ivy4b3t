/**
 * Název souboru: group_explore.action.js
 * Umístění: ~/ivy/actions/group_explore.action.js
 *
 * Popis: Group explore akce - průzkum skupin
 * - Implementuje BaseAction
 * - Pouze jedna odpovědnost: průzkum skupin
 * - Žádné fallbacky
 */

import { BaseAction } from '../libs/base_action.class.js';
import { Log } from '../libs/iv_log.class.js';
import { groupExploreAction } from '../iv_group_explore_action.js';

export class GroupExploreAction extends BaseAction {
  constructor() {
    super('group_explore');
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
    const { fbBot } = context;
    
    if (!fbBot) {
      return {
        ready: false,
        reason: 'Chybí FBBot instance',
        critical: true
      };
    }

    return {
      ready: true,
      reason: 'Akce je připravena'
    };
  }

  /**
   * Provedení group explore
   */
  async execute(user, context, pickedAction) {
    const { fbBot } = context;

    try {
      // Delegace na původní groupExploreAction
      const result = await groupExploreAction.execute(user, fbBot);
      
      if (result.success) {
        await this.logAction(user, null, 'Group explore successful');
        return true;
      } else {
        await Log.warn(`[${user.id}]`, `Group explore failed: ${result.reason || 'Unknown reason'}`);
        return false;
      }

    } catch (err) {
      await Log.error(`[${user.id}]`, `Chyba při group explore: ${err.message}`);
      return false;
    }
  }
}