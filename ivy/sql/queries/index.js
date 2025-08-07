/**
 * Název souboru: index.js
 * Umístění: ~/ivy/sql/queries/index.js
 *
 * Popis: Finálně opravený hlavní exportní bod pro všechny SQL dotazy.
 * Sjednocuje pojmenované a výchozí exporty.
 */

import { ACTIONS } from './actions.js';
import { BEHAVIORAL_PROFILES } from './behavioral_profiles.js';
import { GROUPS } from './groups.js';
import { LIMITS } from './limits.js';
import { LOGS } from './logs.js';
// Removed messageHashes import - table no longer exists
import { NEWS } from './news.js';
import { QUOTES } from './quotes.js';
  
import { SYSTEM } from './system.js';
// Removed systemMetrics import - table no longer exists
import { USER_GROUP_BLOCKING } from './userGroupBlocking.js';
import { USERS } from './users.js';

export const SQL = {
  actions: ACTIONS,
  behavioralProfiles: BEHAVIORAL_PROFILES,
  groups: GROUPS,
  limits: LIMITS,
  logs: LOGS,
  // Removed message_hashes and system_metrics - tables no longer exist
  news: NEWS,
  quotes: QUOTES,
  system: SYSTEM,
  userGroupBlocking: USER_GROUP_BLOCKING,
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