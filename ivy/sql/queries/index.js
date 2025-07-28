/**
 * Název souboru: index.js
 * Umístění: ~/ivy/sql/queries/index.js
 *
 * Popis: Finálně opravený hlavní exportní bod pro všechny SQL dotazy.
 * Sjednocuje pojmenované a výchozí exporty.
 */

import { ACTIONS } from './actions.js';
import actionQuality from './action_quality.js'; // default export
import { BEHAVIORAL_PROFILES } from './behavioral_profiles.js';
import { GROUPS } from './groups.js';
import { LIMITS } from './limits.js';
// Removed messageHashes import - table no longer exists
import { QUOTES } from './quotes.js';
import RSS from './rss.js'; // default export  
import { SYSTEM } from './system.js';
// Removed systemMetrics import - table no longer exists
import { USER_GROUP_BLOCKING } from './user_group_blocking.js';
import { USERS } from './users.js';

export const SQL = {
  actions: ACTIONS,
  action_quality: actionQuality,
  behavioral_profiles: BEHAVIORAL_PROFILES,
  groups: GROUPS,
  limits: LIMITS,
  // Removed message_hashes and system_metrics - tables no longer exist
  quotes: QUOTES,
  rss: RSS,
  system: SYSTEM,
  user_group_blocking: USER_GROUP_BLOCKING,
  users: USERS
};

/**
 * Utility funkce pro práci s dotazy
 */
export const QueryUtils = {
  /**
   * Získá dotaz podle cesty (např. "error_reports.insertErrorReport")
   */
  getQuery(path) {
    const parts = path.split('.');
    let current = SQL;

    for (const part of parts) {
      if (current[part] === undefined) {
        return null;
      }
      current = current[part];
    }

    return typeof current === 'string' ? current : null;
  },

  /**
   * Získá všechny dostupné kategorie dotazů
   */
  getCategories() {
    return Object.keys(SQL);
  },
};