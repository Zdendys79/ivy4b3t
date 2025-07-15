/**
 * Název souboru: react.action.js
 * Umístění: ~/ivy/actions/react.action.js
 *
 * Popis: React akce - reakce na příspěvky
 * - Implementuje BaseAction
 * - Placeholder implementace
 * - Žádné fallbacky
 */

import { BaseAction } from '../libs/base_action.class.js';
import { Log } from '../libs/iv_log.class.js';

export class ReactAction extends BaseAction {
  constructor() {
    super('react');
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
      reason: 'React není zatím implementováno',
      critical: false
    };
  }

  /**
   * Provedení react
   */
  async execute(user, context, pickedAction) {
    await Log.warn(`[${user.id}]`, 'react není zatím implementováno');
    return false;
  }
}