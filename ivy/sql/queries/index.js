/**
 * Název souboru: index.js
 * Umístění: ~/ivy/sql/queries/index.js
 *
 * Popis: Hlavní exportní bod pro všechny SQL dotazy
 * Načítá a kombinuje všechny moduly dotazů do jednoho objektu
 * KOMPLETNĚ BEZ LEGACY DOTAZŮ - pouze čistý modulární systém
 */

import { USERS } from './users.js';
import { ACTIONS } from './actions.js';
import { GROUPS } from './groups.js';
import { LIMITS } from './limits.js';
import { SYSTEM } from './system.js';
import { LOGS } from './logs.js';
import { QUOTES } from './quotes.js';

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
 * Utility funkce pro práci s dotazy
 */
export const QueryUtils = {
  /**
   * Získá dotaz podle cesty (např. "system.heartbeat")
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

    return null;
  },

  /**
   * Získá statistiky o dostupných dotazech
   */
  getStatistics() {
    const stats = {
      categories: Object.keys(SQL).length,
      totalQueries: 0,
      byCategory: {}
    };

    for (const [category, queries] of Object.entries(SQL)) {
      const count = Object.keys(queries).length;
      stats.byCategory[category] = count;
      stats.totalQueries += count;
    }

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
    POST_REGIONAL: 'post_utio_Z',
    QUOTE_POST: 'quote_post'
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
  },

  /**
   * Sestaví WHERE podmínku pro časový rozsah
   */
  buildTimeRangeClause(field, hours) {
    if (!field || typeof hours !== 'number') {
      throw new Error('Invalid time range parameters');
    }

    return {
      clause: `${field} >= NOW() - INTERVAL ? HOUR`,
      params: [hours]
    };
  },

  /**
   * Sestaví podmínku pro stránkování
   */
  buildPaginationParams(page = 1, limit = SQL_CONSTANTS.DEFAULT_LIMIT) {
    const validPage = Math.max(1, parseInt(page));
    const validLimit = Math.min(Math.max(1, parseInt(limit)), SQL_CONSTANTS.MAX_LIMIT);
    const offset = (validPage - 1) * validLimit;

    return {
      limit: validLimit,
      offset: offset,
      params: [offset, validLimit]
    };
  }
};

/**
 * Utility funkce pro debug a diagnostiku
 */
export const SQLDebug = {
  /**
   * Vypíše všechny dostupné dotazy
   */
  listAllQueries() {
    const queries = [];

    for (const [category, categoryQueries] of Object.entries(SQL)) {
      for (const queryName of Object.keys(categoryQueries)) {
        queries.push(`${category}.${queryName}`);
      }
    }

    return queries.sort();
  },

  /**
   * Vyhledá dotazy podle klíčového slova
   */
  searchQueries(keyword) {
    const results = [];
    const lowerKeyword = keyword.toLowerCase();

    for (const [category, categoryQueries] of Object.entries(SQL)) {
      for (const [queryName, querySQL] of Object.entries(categoryQueries)) {
        if (queryName.toLowerCase().includes(lowerKeyword) ||
            querySQL.toLowerCase().includes(lowerKeyword)) {
          results.push({
            path: `${category}.${queryName}`,
            category,
            name: queryName,
            sql: querySQL
          });
        }
      }
    }

    return results;
  },

  /**
   * Zkontroluje integritu všech dotazů
   */
  validateAllQueries() {
    const issues = [];

    for (const [category, categoryQueries] of Object.entries(SQL)) {
      for (const [queryName, querySQL] of Object.entries(categoryQueries)) {
        if (typeof querySQL !== 'string') {
          issues.push({
            path: `${category}.${queryName}`,
            issue: `Not a string (${typeof querySQL})`
          });
          continue;
        }

        if (querySQL.trim().length === 0) {
          issues.push({
            path: `${category}.${queryName}`,
            issue: 'Empty query'
          });
          continue;
        }

        // Základní SQL syntax checks
        const trimmed = querySQL.trim().toUpperCase();
        if (!['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'WITH'].some(keyword => trimmed.startsWith(keyword))) {
          issues.push({
            path: `${category}.${queryName}`,
            issue: 'Does not start with valid SQL keyword'
          });
        }
      }
    }

    return issues;
  },

  /**
   * Spočítá parametry v dotazu
   */
  countParameters(queryPath) {
    const query = QueryUtils.getQuery(queryPath);
    if (!query) return null;

    const matches = query.match(/\?/g);
    return matches ? matches.length : 0;
  }
};

// Export default pro jednodušší import
export default SQL;
