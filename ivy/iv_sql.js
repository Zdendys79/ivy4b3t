/**
 * Název souboru: iv_sql.js (vyčištěná verze)
 * Umístění: ~/ivy/iv_sql.js
 *
 * Popis: Databázové připojení a core funkce
 * QueryBuilder je nyní v samostatném souboru iv_querybuilder.class.js
 */

import mysql from 'mysql2/promise';

import { QueryUtils } from './sql/queries/index.js';
import { QueryBuilder } from './libs/iv_querybuilder.class.js';
import { Log } from './libs/iv_log.class.js';

let sql_setup;

// Use ONLY environment variables for database connection - NO config files
if (!process.env.DB_USER || !process.env.DB_PASS || !process.env.DB_HOST || !process.env.DB_NAME) {
  await Log.error('[SQL]', 'CHYBA: Chybí povinné systémové proměnné: DB_HOST, DB_USER, DB_PASS, DB_NAME');
  await Log.error('[SQL]', 'Restartuj terminál nebo spusť: source ~/.bashrc');
  process.exit(1);
}

Log.info('[SQL]', 'Používám systémové proměnné pro připojení k databázi.');
sql_setup = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME
};


const pool = mysql.createPool({
  host: sql_setup.host,
  user: sql_setup.user,
  password: sql_setup.password,
  database: sql_setup.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

function _truncateLog(data, maxLines = 10, maxJsonLength = 500) {
  if (typeof data === 'string') {
    const lines = data.split('\n');
    if (lines.length > maxLines) {
      const head = lines.slice(0, 2).join('\n');
      const tail = lines.slice(-3).join('\n');
      return `${head}\n...\n${tail}`;
    }
    return data;
  }

  try {
    const jsonString = JSON.stringify(data);
    if (jsonString.length > maxJsonLength) {
      return `${jsonString.substring(0, maxJsonLength)}...`;
    }
    return jsonString;
  } catch (e) {
    return String(data);
  }
}

async function executeQuery(queryPath, params = []) {
  const query = QueryUtils.getQuery(queryPath);

  if (!query) {
    const error = `Query not found: ${queryPath}`;
    await Log.error('[SQL]', error);
    throw new Error(error);
  }

  try {
    const [rows] = await pool.execute(query, params);
    return rows;
  } catch (err) {
    const errorDetails = `${err.message}${err.code ? ` (code: ${err.code})` : ''}${err.errno ? ` (errno: ${err.errno})` : ''}`;
    await Log.error('[SQL]', `Query failed: ${queryPath} - ${errorDetails}`);
    await Log.error('[SQL]', `SQL: ${_truncateLog(query)}`);
    await Log.error('[SQL]', `Params: ${_truncateLog(params)}`);
    await Log.error('[SQL]', `Error: ${err.message}`);
    if (err.code) await Log.error('[SQL]', `Error code: ${err.code}`);
    if (err.errno) await Log.error('[SQL]', `Error number: ${err.errno}`);
    if (err.sqlState) await Log.error('[SQL]', `SQL State: ${err.sqlState}`);
    if (err.sql) await Log.error('[SQL]', `SQL Query: ${_truncateLog(err.sql)}`);
    throw err;
  }
}

async function safeQueryFirst(queryPath, params = []) {
  try {
    const rows = await executeQuery(queryPath, params);
    if (!rows || !rows.length || !rows[0]) {
      // Don't log warning for queries where empty result is normal
      const quietQueries = ['system.getUICommand', 'system.getVariable'];
      if (!quietQueries.includes(queryPath)) {
        await Log.info('[SQL]', `safeQueryFirst ${queryPath} returned no results`);
      }
      return false;
    }
    return rows[0];
  } catch (err) {
    const errorDetails = `${err.message}${err.code ? ` (code: ${err.code})` : ''}${err.errno ? ` (errno: ${err.errno})` : ''}`;
    await Log.error('[SQL]', `safeQueryFirst ${queryPath} exception: ${errorDetails}`);
    if (err.code) await Log.error('[SQL]', `Error code: ${err.code}`);
    if (err.errno) await Log.error('[SQL]', `Error number: ${err.errno}`);
    if (err.sqlState) await Log.error('[SQL]', `SQL State: ${err.sqlState}`);
    
    // Re-throw function-not-found errors to ensure fail-fast behavior
    if (err.message.includes('is not a function') || err.message.includes('Query not found')) {
      throw err;
    }
    
    return false;
  }
}

async function safeQueryAll(queryPath, params = []) {
  try {
    const rows = await executeQuery(queryPath, params);
    const resultCount = rows ? rows.length : 0;
    if (resultCount === 0) {
      await Log.warn('[SQL]', `safeQueryAll ${queryPath} returned 0 rows`);
    }
    return rows || [];
  } catch (err) {
    const errorDetails = `${err.message}${err.code ? ` (code: ${err.code})` : ''}${err.errno ? ` (errno: ${err.errno})` : ''}`;
    await Log.error('[SQL]', `safeQueryAll ${queryPath} exception: ${errorDetails}`);
    if (err.code) await Log.error('[SQL]', `Error code: ${err.code}`);
    if (err.errno) await Log.error('[SQL]', `Error number: ${err.errno}`);
    if (err.sqlState) await Log.error('[SQL]', `SQL State: ${err.sqlState}`);
    
    // Re-throw function-not-found errors to ensure fail-fast behavior
    if (err.message.includes('is not a function') || err.message.includes('Query not found')) {
      throw err;
    }
    
    return [];
  }
}

async function safeExecute(queryPath, params = []) {
  try {
    const result = await executeQuery(queryPath, params);

    if (result !== false) {
      if (result.affectedRows === 0) {
        await Log.warn('[SQL]', `safeExecute ${queryPath} affected 0 rows`);
      }
      return true;
    } else {
      await Log.warn('[SQL]', `safeExecute ${queryPath} returned false`);
      return false;
    }
  } catch (err) {
    const errorDetails = `${err.message}${err.code ? ` (code: ${err.code})` : ''}${err.errno ? ` (errno: ${err.errno})` : ''}`;
    await Log.error('[SQL]', `safeExecute ${queryPath} exception: ${errorDetails}`);
    if (err.code) await Log.error('[SQL]', `Error code: ${err.code}`);
    if (err.errno) await Log.error('[SQL]', `Error number: ${err.errno}`);
    if (err.sqlState) await Log.error('[SQL]', `SQL State: ${err.sqlState}`);
    
    // Re-throw function-not-found errors to ensure fail-fast behavior
    if (err.message.includes('is not a function') || err.message.includes('Query not found')) {
      throw err;
    }
    
    return false;
  }
}

export async function testConnection() {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    Log.info('[SQL]', 'Database connection test successful');
    return true;
  } catch (err) {
    await Log.error('[SQL]', `Database connection test failed: ${err.message}`);
    return false;
  }
}

export async function closeConnection() {
  try {
    await pool.end();
    Log.info('[SQL]', 'Database connection pool closed');
    return true;
  } catch (err) {
    await Log.error('[SQL]', `Error closing database connection: ${err.message}`);
    return false;
  }
}

export async function transaction(callback) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await callback(connection);
    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

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

export const db = new QueryBuilder(safeQueryFirst, safeQueryAll, safeExecute);

export async function initializeDatabase() {
  try {
    const connectionOk = await testConnection();
    if (!connectionOk) {
      throw new Error('Database connection failed');
    }

    const modulesOk = db.validateSQLModules();
    if (!modulesOk) {
      throw new Error('SQL modules validation failed');
    }

    const stats = getConnectionStats();
    Log.debug('[SQL]', 'Database initialized:', stats);
    Log.debug('[SQL]', 'QueryBuilder stats:', db.getStats());

    Log.info('[SQL]', 'Database initialization successful');
    return true;
  } catch (err) {
    await Log.error('[SQL]', `Database initialization failed: ${err.message}`);
    return false;
  }
}

export { SQL } from './sql/queries/index.js';
export { testConnection as testDB, closeConnection as closeDB };

export async function verifyMsg(groupId, messageHash) {
  Log.debug('[SQL]', `Checking message duplicate: group ${groupId}, hash ${messageHash.substring(0, 8)}...`);

  try {
    const result = await safeQueryFirst('quotes.findByHash', [messageHash]);

    if (result) {
      Log.debug('[SQL]', `Found duplicate message with hash ${messageHash.substring(0, 8)} (ID: ${result.id})`);
      return { c: 1, id: result.id };
    }

    Log.debug('[SQL]', `No duplicate found for hash ${messageHash.substring(0, 8)}`);
    return { c: 0 };
  } catch (err) {
    await Log.error('[SQL]', `verifyMsg error: ${err.message}`);
    return { c: 0 };
  }
}
