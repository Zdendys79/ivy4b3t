/**
 * Název souboru: iv_sql.js (vyčištěná verze)
 * Umístění: ~/ivy/iv_sql.js
 *
 * Popis: Databázové připojení a core funkce
 * QueryBuilder je nyní v samostatném souboru iv_querybuilder.class.js
 */

import fs from 'node:fs';
import mysql from 'mysql2/promise';
import { QueryUtils } from './sql/queries/index.js';
import { QueryBuilder } from './iv_querybuilder.class.js';
import { Log } from './iv_log.class.js';
import { isDebugMode } from './iv_debug.js';

// =========================================================
// DATABASE CONNECTION SETUP
// =========================================================

const sql_setup = JSON.parse(fs.readFileSync('./sql/sql_config.json'));

const pool = mysql.createPool({
  host: sql_setup.host,
  user: sql_setup.user,
  password: sql_setup.password,
  database: sql_setup.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  acquireTimeout: 60000,
  timeout: 60000
});

// =========================================================
// CORE DATABASE FUNCTIONS
// =========================================================

/**
 * Hlavní funkce pro vykonání SQL dotazu
 */
async function executeQuery(queryPath, params = []) {
  const debugMode = isDebugMode();
  const query = QueryUtils.getQuery(queryPath);

  if (!query) {
    const error = `Query not found: ${queryPath}`;
    Log.error('[SQL]', error);
    throw new Error(error);
  }

  if (debugMode) {
    Log.debug('[SQL]', `Executing query: ${queryPath} with params: ${JSON.stringify(params)}`);
  }

  try {
    const [rows] = await pool.execute(query, params);

    if (debugMode) {
      Log.debug('[SQL]', `Query ${queryPath} successful, affected rows: ${rows.affectedRows || rows.length || 0}`);
    }

    return rows;

  } catch (err) {
    if (debugMode) {
      Log.error('[SQL][DEBUG]', `Query failed: ${queryPath}`);
      Log.error('[SQL][DEBUG]', `SQL: ${query}`);
      Log.error('[SQL][DEBUG]', `Params: ${JSON.stringify(params)}`);
      Log.error('[SQL][DEBUG]', `Error: ${err.message}`);
      if (err.code) Log.error('[SQL][DEBUG]', `Error code: ${err.code}`);
      if (err.sqlState) Log.error('[SQL][DEBUG]', `SQL State: ${err.sqlState}`);
    } else {
      Log.error('[SQL]', `Query ${queryPath} failed: ${err.code || err.message}`);
    }

    throw err;
  }
}

/**
 * Bezpečné vykonání dotazu s očekáváním prvního řádku
 */
async function safeQueryFirst(queryPath, params = []) {
  const debugMode = isDebugMode();

  try {
    if (debugMode) {
      Log.debug('[SQL]', `safeQueryFirst: ${queryPath}`);
    }

    const rows = await executeQuery(queryPath, params);
    if (!rows || !rows.length || !rows[0]) {
      if (debugMode) {
        Log.debug('[SQL]', `safeQueryFirst ${queryPath} returned no results`);
      }
      return false;
    }

    if (debugMode) {
      Log.debug('[SQL]', `safeQueryFirst ${queryPath} returned 1 row`);
    }

    return rows[0];
  } catch (err) {
    if (debugMode) {
      Log.error('[SQL][DEBUG]', `safeQueryFirst ${queryPath} exception: ${err.message}`);
    } else {
      Log.error('[SQL]', `safeQueryFirst ${queryPath} failed`);
    }
    return false;
  }
}

/**
 * Bezpečné vykonání dotazu s očekáváním více řádků
 */
async function safeQueryAll(queryPath, params = []) {
  const debugMode = isDebugMode();

  try {
    if (debugMode) {
      Log.debug('[SQL]', `safeQueryAll: ${queryPath}`);
    }

    const rows = await executeQuery(queryPath, params);
    const resultCount = rows ? rows.length : 0;

    if (debugMode) {
      Log.debug('[SQL]', `safeQueryAll ${queryPath} returned ${resultCount} rows`);
    }

    return rows || [];
  } catch (err) {
    if (debugMode) {
      Log.error('[SQL][DEBUG]', `safeQueryAll ${queryPath} exception: ${err.message}`);
    } else {
      Log.error('[SQL]', `safeQueryAll ${queryPath} failed`);
    }
    return [];
  }
}

/**
 * Bezpečné vykonání dotazu bez očekávání výsledku (INSERT, UPDATE, DELETE)
 */
async function safeExecute(queryPath, params = []) {
  const debugMode = isDebugMode();

  try {
    if (debugMode) {
      Log.debug('[SQL]', `safeExecute: ${queryPath}`);
    }

    const result = await executeQuery(queryPath, params);

    if (result !== false) {
      if (debugMode) {
        Log.debug('[SQL]', `safeExecute ${queryPath} successful`);
      }
      return true;
    } else {
      if (debugMode) {
        Log.error('[SQL][DEBUG]', `safeExecute ${queryPath} returned false`);
      } else {
        Log.error('[SQL]', `safeExecute ${queryPath} failed`);
      }
      return false;
    }
  } catch (err) {
    if (debugMode) {
      Log.error('[SQL][DEBUG]', `safeExecute ${queryPath} exception: ${err.message}`);
    } else {
      Log.error('[SQL]', `safeExecute ${queryPath} failed`);
    }
    return false;
  }
}

// =========================================================
// CONNECTION UTILITIES
// =========================================================

/**
 * Test databázového připojení
 */
export async function testConnection() {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    Log.info('[SQL]', 'Database connection test successful');
    return true;
  } catch (err) {
    Log.error('[SQL]', `Database connection test failed: ${err.message}`);
    return false;
  }
}

/**
 * Uzavření databázového poolu
 */
export async function closeConnection() {
  try {
    await pool.end();
    Log.info('[SQL]', 'Database connection pool closed');
    return true;
  } catch (err) {
    Log.error('[SQL]', `Error closing database connection: ${err.message}`);
    return false;
  }
}

/**
 * Získání statistik připojení
 */
export function getConnectionStats() {
  return {
    config: {
      host: sql_setup.host,
      database: sql_setup.database,
      connectionLimit: 10
    },
    pool: {
      activeConnections: pool._allConnections ? pool._allConnections.length : 0,
      freeConnections: pool._freeConnections ? pool._freeConnections.length : 0,
      queuedRequests: pool._connectionQueue ? pool._connectionQueue.length : 0
    }
  };
}

// =========================================================
// QUERY BUILDER INSTANCE
// =========================================================

/**
 * Hlavní instance QueryBuilder s předanými safe funkcemi
 */
export const db = new QueryBuilder(safeQueryFirst, safeQueryAll, safeExecute);

// =========================================================
// VALIDATION AND STARTUP
// =========================================================

/**
 * Inicializace a validace databázového připojení
 */
export async function initializeDatabase() {
  const debugMode = isDebugMode();
  
  try {
    // Test připojení
    const connectionOk = await testConnection();
    if (!connectionOk) {
      throw new Error('Database connection failed');
    }

    // Validace SQL modulů
    const modulesOk = db.validateSQLModules();
    if (!modulesOk) {
      throw new Error('SQL modules validation failed');
    }

    if (debugMode) {
      const stats = getConnectionStats();
      Log.debug('[SQL]', 'Database initialized:', stats);
      Log.debug('[SQL]', 'QueryBuilder stats:', db.getStats());
    }

    Log.info('[SQL]', 'Database initialization successful');
    return true;

  } catch (err) {
    Log.error('[SQL]', `Database initialization failed: ${err.message}`);
    return false;
  }
}

// =========================================================
// EXPORTS
// =========================================================

// Export the SQL modules for direct access
export { SQL } from './sql/queries/index.js';

// Export pro debug a testing
export { executeQuery, safeQueryFirst, safeQueryAll, safeExecute };