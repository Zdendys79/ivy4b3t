/**
 * Název souboru: account_sleep.action.js
 * Umístění: ~/ivy/actions/account_sleep.action.js
 *
 * Popis: Account sleep akce - uspání účtu na 1-3 dny  
 * - Kratší kód díky BaseAccountAction
 */

import { BaseAccountAction } from '../libs/base_account_action.class.js';

export class AccountSleepAction extends BaseAccountAction {
  constructor() {
    super('account_sleep', 'h'); // Hodnoty z action_definitions, zobrazení v hodinách
  }
}