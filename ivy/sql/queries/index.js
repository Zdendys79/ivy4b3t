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
import { DISCOVERED_LINKS } from './discovered_links.js';
import { ERROR_REPORTS } from './error-reports.js';
import { GROUP_DETAILS } from './group_details.js';
import { GROUPS } from './groups.js';
import { HOSTNAME_PROTECTION } from './hostname_protection.js';
import { LIMITS } from './limits.js';
import { LOGS } from './logs.js';
import messageHashes from './message_hashes.js'; // default export
import { QUOTES } from './quotes.js';
import { SYSTEM } from './system.js';
import systemMetrics from './system_metrics.js'; // default export
import { USER_GROUP_BLOCKING } from './user_group_blocking.js';
import { USERS } from './users.js';

export const SQL = {
  actions: ACTIONS,
  action_quality: actionQuality,
  behavioral_profiles: BEHAVIORAL_PROFILES,
  discovered_links: DISCOVERED_LINKS,
  'error-reports': ERROR_REPORTS,
  group_details: GROUP_DETAILS,
  groups: GROUPS,
  hostname_protection: HOSTNAME_PROTECTION,
  limits: LIMITS,
  logs: LOGS,
  message_hashes: messageHashes,
  quotes: QUOTES,
  system: SYSTEM,
  system_metrics: systemMetrics,
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