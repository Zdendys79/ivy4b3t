/**
 * Název souboru: index.js
 * Umístění: ~/ivy/sql/queries/index.js
 *
 * Popis: AKTUALIZOVANÝ hlavní exportní bod pro všechny SQL dotazy
 * Změny: Přidán ERROR_REPORTS modul pro FB error reporting systém
 */

import { USERS } from './users.js';
import { DISCOVERED_LINKS } from './discovered_links.js';

export const SQL = {
  actions: ACTIONS,
  behavioral_profiles: BEHAVIORAL_PROFILES,
  discovered_links: DISCOVERED_LINKS,
  'error-reports': ERROR_REPORTS,
  group_details: GROUP_DETAILS,
  groups: GROUPS,
  user_limits: userLimits,
  action_quality: actionQuality,
  system_metrics: systemMetrics,
  message_hashes: messageHashes
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
  },

  /**
   * Ověří dotazy proti známé struktuře databáze
   */
  validateAgainstSchema() {
    const knownTables = {
      'fb_groups': ['id', 'fb_id', 'nazev', 'priority', 'user_counter', 'note', 'last_seen', 'next_seen', 'typ', 'region_id', 'district_id'],
      'fb_users': ['id', 'name', 'surname', 'day_limit', 'max_limit', 'next_worktime', 'next_statement', 'e_mail', 'e_pass', 'fb_login', 'fb_pass', 'u_login', 'u_pass', 'locked', 'lock_reason', 'lock_type', 'unlocked', 'day_limit_updated', 'last_add_group', 'portal_id', 'host'],
      'fb_error_reports': ['id', 'created', 'user_id', 'user_name', 'user_surname', 'group_id', 'group_fb_id', 'error_type', 'error_reason', 'page_url', 'page_title', 'page_elements_summary', 'detected_buttons', 'detected_texts', 'full_analysis_data', 'hostname', 'user_agent', 'reviewed', 'resolved', 'resolution_notes'],
      'quotes': ['id', 'user_id', 'posted', 'text', 'hash'],
      'action_definitions': ['action_code', 'label', 'description', 'weight', 'min_minutes', 'max_minutes', 'repeatable', 'active'],
      'action_log': ['id', 'timestamp', 'account_id', 'action_code', 'reference_id', 'text'],
      'user_action_plan': ['user_id', 'action_code', 'next_time'],
      'variables': ['name', 'value', 'changed'],
      'versions': ['id', 'code', 'hash', 'source', 'hostname', 'created'],
      'log_s': ['time', 'hostname', 'title', 'text', 'data'],
      'log_u': ['time', 'user_id', 'type', 'data', 'text']
    };

    const deprecatedColumns = {
      'fb_users': ['password'], // Např. deprecated sloupce
      'quotes': ['category'] // Např. pokud byl odstraněn
    };

    const warnings = [];

    for (const [category, queries] of Object.entries(SQL)) {
      for (const [queryName, query] of Object.entries(queries)) {
        // Kontrola na deprecated sloupce
        for (const [table, columns] of Object.entries(deprecatedColumns)) {
          for (const column of columns) {
            if (query.includes(`${table}.${column}`) || query.includes(`\`${column}\``)) {
              warnings.push(`${category}.${queryName}: Uses deprecated column ${table}.${column}`);
            }
          }
        }

        // Kontrola na neexistující tabulky
        const deprecatedTables = ['statements', 'log'];
        for (const table of deprecatedTables) {
          if (query.includes(`FROM ${table}`) || query.includes(`JOIN ${table}`) || query.includes(`INTO ${table}`)) {
            warnings.push(`${category}.${queryName}: Uses non-existent table ${table}`);
          }
        }
      }
    }

    return warnings;
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

  // Error types pro fb_error_reports
  ERROR_TYPES: {
    VIDEOSELFIE: 'VIDEOSELFIE',
    ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
    IDENTITY_VERIFICATION: 'IDENTITY_VERIFICATION',
    SUSPICIOUS_ACTIVITY: 'SUSPICIOUS_ACTIVITY',
    PHONE_VERIFICATION: 'PHONE_VERIFICATION',
    SECURITY_CHECKPOINT: 'SECURITY_CHECKPOINT',
    LOGIN_ERROR: 'LOGIN_ERROR',
    PAGE_ERROR: 'PAGE_ERROR',
    NETWORK_ERROR: 'NETWORK_ERROR',
    UNKNOWN: 'UNKNOWN'
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
  },

  // Stavy schématu
  SCHEME_STATUS: {
    TODO: 'todo',
    PARTIAL: 'partial',
    DONE: 'done',
    DEPRECATED: 'deprecated'
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

    const placeholders = values.map(() => '?').join(', ');
    return {
      clause: `IN (${placeholders})`,
      params: values
    };
  },

  /**
   * Vytvoří LIKE klauzuli pro vyhledávání
   */
  buildLikeClause(searchTerm, columns) {
    if (!searchTerm || !Array.isArray(columns) || columns.length === 0) {
      return { clause: 'TRUE', params: [] };
    }

    const conditions = columns.map(col => `${col} LIKE ?`).join(' OR ');
    const searchPattern = `%${searchTerm}%`;
    const params = new Array(columns.length).fill(searchPattern);

    return {
      clause: `(${conditions})`,
      params: params
    };
  },

  /**
   * Vytvoří ORDER BY klauzuli
   */
  buildOrderByClause(orderBy, validColumns = []) {
    if (!orderBy) return '';

    const orders = Array.isArray(orderBy) ? orderBy : [orderBy];
    const validOrders = orders.filter(order => {
      const [column] = order.split(' ');
      return validColumns.length === 0 || validColumns.includes(column);
    });

    return validOrders.length > 0 ? `ORDER BY ${validOrders.join(', ')}` : '';
  },

  /**
   * Vytvoří LIMIT klauzuli s validací
   */
  buildLimitClause(limit, offset = 0) {
    const safeLimit = Math.min(Math.max(1, parseInt(limit) || SQL_CONSTANTS.DEFAULT_LIMIT), SQL_CONSTANTS.MAX_LIMIT);
    const safeOffset = Math.max(0, parseInt(offset) || 0);

    return safeOffset > 0 ? `LIMIT ${safeOffset}, ${safeLimit}` : `LIMIT ${safeLimit}`;
  }
};

/**
 * Diagnostické funkce
 */
export const Diagnostics = {
  /**
   * Spustí všechny validace
   */
  runAllValidations() {
    const results = {
      timestamp: new Date().toISOString(),
      statistics: QueryUtils.getStatistics(),
      syntaxErrors: QueryUtils.validateQueries(),
      schemaWarnings: QueryUtils.validateAgainstSchema()
    };

    return results;
  },

  /**
   * Vytiskne report o stavu dotazů
   */
  printReport() {
    const results = this.runAllValidations();

    console.log('='.repeat(50));
    console.log('SQL QUERIES DIAGNOSTIC REPORT');
    console.log('='.repeat(50));
    console.log(`Generated: ${results.timestamp}`);
    console.log(`Total categories: ${results.statistics.categories}`);
    console.log(`Total queries: ${results.statistics.totalQueries}`);

    console.log('\nQueries by category:');
    for (const [category, count] of Object.entries(results.statistics.byCategory)) {
      console.log(`  ${category}: ${count} queries`);
    }

    if (results.syntaxErrors.length > 0) {
      console.log('\n❌ SYNTAX ERRORS:');
      results.syntaxErrors.forEach(error => console.log(`  ${error}`));
    } else {
      console.log('\n✅ No syntax errors found');
    }

    if (results.schemaWarnings.length > 0) {
      console.log('\n⚠️  SCHEMA WARNINGS:');
      results.schemaWarnings.forEach(warning => console.log(`  ${warning}`));
    } else {
      console.log('\n✅ No schema warnings found');
    }

    console.log('='.repeat(50));

    return results;
  }
};
