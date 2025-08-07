/**
 * Název souboru: account_delay.action.js
 * Umístění: ~/ivy/actions/account_delay.action.js
 *
 * Popis: Account delay akce - prodleva účtu na 1-4 hodiny
 * - Kratší kód díky BaseAccountAction
 */

import { BaseAccountAction } from '../libs/base_account_action.class.js';

export class AccountDelayAction extends BaseAccountAction {
  constructor() {
    super('account_delay', 'h'); // Hodnoty z action_definitions, zobrazení v hodinách
  }
}