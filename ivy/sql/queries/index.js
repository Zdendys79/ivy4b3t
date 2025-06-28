/**
 * Název souboru: index.js
 * Umístění: ~/ivy/sql/queries/index.js
 *
 * Popis: Hlavní exportní bod pro všechny SQL dotazy
 * Načítá a kombinuje všechny moduly dotazů do jednoho objektu
 */

import { USERS } from './users.js';
import { ACTIONS } from './actions.js';
import { GROUPS } from './groups.js';
import { LIMITS } from './limits.js';
import { SYSTEM } from './system.js';
import { LOGS } from './logs.js';
import { QUOTES } from './quotes.js';

// Import legacy dotazů pro zpětnou kompatibilitu
import legacyQueries from '../legacy/iv_sql_queries.js';

/**
 * Hlavní SQL objekt obsahující všechny dotazy
 * Organizované podle funkcionality do kategorií
 */
export const SQL = {
  users: USERS,
  actions: ACTIONS,
  groups: GROUPS,
  limits: LIMITS,
  system: SYSTEM,
  logs: LOGS,
  quotes: QUOTES
};

/**
 * Legacy dotazy pro zpětnou kompatibilitu
 * Používané starými částmi systému, které ještě nebyly refaktorovány
 */
export const LEGACY_QUERIES = legacyQueries;

/**
 * Kombinovaný export všech dotazů
 * Pro případy, kdy potřebujeme přístup ke všem dotazům najednou
 */
export const ALL_QUERIES = {
  ...SQL.users,
  ...SQL.actions,
  ...SQL.groups,
  ...SQL.limits,
  ...SQL.system,
  ...SQL.logs,
  ...SQL.quotes,
  ...LEGACY_QUERIES
};

/**
 * Utility funkce pro práci s dotazy
 */
export const QueryUtils = {
  /**
   * Získá všechny dostupné kategorie dotazů
   */
  getCategories() {
    return Object.keys(SQL);
  },

  /**
   * Získá všechny dotazy v konkrétní kategorii
   */
  getCategoryQueries(category) {
    return SQL[category] || {};
  },

  /**
   * Vyhledá dotaz podle názvu napříč všemi kategoriemi
   */
  findQuery(queryName) {
    for (const [category, queries] of Object.entries(SQL)) {
      if (queries[queryName]) {
        return {
          category,
          query: queries[queryName]
        };
      }
    }

    // Zkusit v legacy dotazech
    if (LEGACY_QUERIES[queryName]) {
      return {
        category: 'legacy',
        query: LEGACY_QUERIES[queryName]
      };
    }

    return null;
  },

  /**
   * Získá statistiky o dostupných dotazech
   */
  getStatistics() {
    const stats = {
      categories: Object.keys(SQL).length,
      totalQueries: 0,
      legacyQueries: Object.keys(LEGACY_QUERIES).length,
      byCategory: {}
    };

    for (const [category, queries] of Object.entries(SQL)) {
      const count = Object.keys(queries).length;
      stats.byCategory[category] = count;
      stats.totalQueries += count;
    }

    stats.totalQueries += stats.legacyQueries;

    return stats;
  },

  /**
   * Validuje, že všechny dotazy jsou stringy
   */
  validateQueries() {
    const errors = [];

    for (const [category, queries] of Object.entries(SQL)) {
      for (const [queryName, query] of Object.entries(queries)) {
        if (typeof query !== 'string') {
          errors.push(`${category}.${queryName}: Expected string, got ${typeof query}`);
        }
      }
    }

    for (const [queryName, query] of Object.entries(LEGACY_QUERIES)) {
      if (typeof query !== 'string') {
        errors.push(`legacy.${queryName}: Expected string, got ${typeof query}`);
      }
    }

    return errors;
  }
};

/**
 * Konstanty pro často používané hodnoty
 */
export const SQL_CONSTANTS = {
  // Výchozí limity pro stránkování
  DEFAULT_LIMIT: 50,
  MAX_LIMIT: 1000,

  // Časové intervaly
  INTERVALS: {
    HOUR: '1 HOUR',
    DAY: '1 DAY',
    WEEK: '7 DAY',
    MONTH: '30 DAY',
    YEAR: '365 DAY'
  },

  // Typy skupin
  GROUP_TYPES: {
    GENERAL: 'G',
    SALE: 'GV',
    PRIVATE: 'P',
    REGIONAL: 'Z'
  },

  // Akční kódy
  ACTION_CODES: {
    SLEEP: 'account_sleep',
    DELAY: 'account_delay',
    POST_GENERAL: 'post_utio_G',
    POST_SALE: 'post_utio_GV',
    POST_PRIVATE: 'post_utio_P',
    POST_REGIONAL: 'post_utio_Z'
  }
};

/**
 * Helper funkce pro dynamické sestavování dotazů
 */
export const QueryBuilder = {
  /**
   * Vytvoří IN klauzuli pro pole hodnot
   */
  buildInClause(values) {
    if (!Array.isArray(values) || values.length === 0) {
      return { clause: 'FALSE', params: [] };
    }

    const placeholders = values.map(() => '?').join(',');
    return {
      clause: `IN (${placeholders})`,
      params: values
    };
  },

  /**
   * Vytvoří LIMIT klauzuli s validací
   */
  buildLimitClause(limit = SQL_CONSTANTS.DEFAULT_LIMIT, offset = 0) {
    const validLimit = Math.min(Math.max(1, parseInt(limit)), SQL_CONSTANTS.MAX_LIMIT);
    const validOffset = Math.max(0, parseInt(offset));

    return {
      clause: `LIMIT ${validOffset}, ${validLimit}`,
      params: []
    };
  },

  /**
   * Vytvoří ORDER BY klauzuli s validací
   */
  buildOrderClause(field, direction = 'ASC') {
    const validDirection = ['ASC', 'DESC'].includes(direction.toUpperCase())
      ? direction.toUpperCase()
      : 'ASC';

    // Základní validace názvu pole (pouze alfanumerické znaky a podtržítka)
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(field)) {
      throw new Error(`Invalid field name: ${field}`);
    }

    return {
      clause: `ORDER BY ${field} ${validDirection}`,
      params: []
    };
  }
};

// Export default pro jednodušší import
export default SQL;
