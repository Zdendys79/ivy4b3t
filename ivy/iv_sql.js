/**
 * Název souboru: iv_sql.js (kompletně přepracovaná verze)
 * Umístění: ~/ivy/iv_sql.js
 *
 * Popis: Modernizovaná databázová vrstva s modulárními SQL dotazy
 * Používá pouze novou modulární strukturu, žádné legacy dotazy
 */

import os from 'node:os';
import fs from 'node:fs';
import mysql from 'mysql2/promise';
import { SQL, QueryUtils } from './sql/queries/index.js';
import { Log } from './iv_log.class.js';
import { isDebugMode } from './iv_debug.js';

const hostname = os.hostname();
const sql_setup = JSON.parse(fs.readFileSync('./sql/sql_config.json'));

const pool = mysql.createPool({
  host: sql_setup.host,
  user: sql_setup.user,
  password: sql_setup.password,
  database: sql_setup.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// =========================================================
// CORE DATABASE FUNCTIONS
// =========================================================

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
// MODERN QUERY BUILDER
// =========================================================

export class QueryBuilder {
  constructor() {
    this.SQL = SQL;
  }

  // Users
  async getUser(hostname = hostname) {
    return await safeQueryFirst('users.getByHostname', [hostname]);
  }

  async getUserById(id) {
    return await safeQueryFirst('users.getById', [id]);
  }

  async lockUser(id) {
    return await safeExecute('users.lock', [id]);
  }

  async unlockUser(id) {
    return await safeExecute('users.unlock', [id]);
  }

  // Actions
  async getUserActions(userId) {
    return await safeQueryAll('actions.getUserActions', [userId, userId]);
  }

  async getUserActionsWithLimits(userId) {
    // Dočasně použijeme zjednodušenou verzi kvůli SQL syntaxi problémům
    return await safeQueryAll('actions.getUserActionsWithLimitsSimple', [userId, userId]);
  }

  async logAction(accountId, actionCode, referenceId, text) {
    return await safeExecute('actions.logAction', [accountId, actionCode, referenceId, text]);
  }

  async updateActionPlan(userId, actionCode, minutes) {
    return await safeExecute('actions.updatePlan', [minutes, userId, actionCode]);
  }

  // Limits
  async getUserLimit(userId, groupType) {
    return await safeQueryFirst('limits.getUserLimit', [userId, groupType]);
  }

  async getUserAllLimitsWithUsage(userId) {
    return await safeQueryAll('limits.getUserAllLimitsWithUsage', [userId, userId]);
  }

  async canUserPost(userId, groupType) {
    const limit = await this.getUserLimit(userId, groupType);
    if (!limit) return false;

    // Použijeme existující dotaz countPostsInTimeframe
    const postCount = await safeQueryFirst('limits.countPostsInTimeframe', [
      userId, groupType, limit.time_window_hours
    ]);

    const currentPosts = postCount ? postCount.post_count : 0;
    return currentPosts < limit.max_posts;
  }

  // Groups
  async getGroupById(id) {
    return await safeQueryFirst('groups.getById', [id]);
  }

  async getAvailableGroups(groupType, userId) {
    return await safeQueryAll('groups.getAvailableByType', [groupType, userId]);
  }

  // System
  async heartbeat(userId = 0, groupId = 0, version = 'unknown') {
    return await safeExecute('system.heartbeat', [
      hostname, userId, groupId, version, userId, groupId, version
    ]);
  }

  async getVersionCode() {
    return await safeQueryFirst('system.getVersionCode');
  }
}

// Instance query builderu pro přímé použití
export const db = new QueryBuilder();

// =========================================================
// MODERNIZED EXPORTS (bez legacy závislostí)
// =========================================================

// Základní systémové funkce
export const getUser = () => safeQueryFirst('users.getByHostname', [hostname]);
export const getUserById = user_id => safeQueryFirst('users.getById', [user_id]);
export const getUsersByHostname = () => safeQueryAll('users.getAllByHostname', [hostname]);

// Action system
export const getUserActions = user_id => safeQueryAll('actions.getUserActions', [user_id, user_id]);
export const getUserActionsWithLimits = user_id => safeQueryAll('actions.getUserActionsWithLimitsSimple', [user_id, user_id]);
export const updateUserActionPlan = (user_id, action_code, randMinutes) =>
  safeExecute('actions.updatePlan', [randMinutes, user_id, action_code]);
export const initUserActionPlan = (user_id) => safeExecute('actions.initPlan', [user_id]);
export const logUserAction = (account_id, action_code, reference_id, text) =>
  safeExecute('actions.logAction', [account_id, action_code, reference_id, text]);

// Group limits
export const getUserGroupLimit = (user_id, group_type) =>
  safeQueryFirst('limits.getUserLimit', [user_id, group_type]);
export const getUserAllLimitsWithUsage = (user_id) =>
  safeQueryAll('limits.getUserAllLimitsWithUsage', [user_id, user_id]);
export const countUserPostsInTimeframe = (user_id, group_type, hours) =>
  safeQueryFirst('limits.countPostsInTimeframe', [user_id, group_type, hours]);
export const upsertUserGroupLimit = (user_id, group_type, max_posts, time_window_hours) =>
  safeExecute('limits.upsertLimit', [user_id, group_type, max_posts, time_window_hours]);

// User management
export const lockAccount = (user_id) => safeExecute('users.lock', [user_id]);
export const updateUserWorktime = async (user, minutes) => {
  const user_id = typeof user === 'object' ? user.id : user;
  const result = await safeExecute('users.updateWorktime', [minutes, user_id]);

  if (result) {
    const hours = Math.round(minutes / 60 * 100) / 100;
    const action_code = minutes > 1440 ? 'account_sleep' : 'account_delay';
    const text = `${action_code === 'account_sleep' ? 'Sleep' : 'Delay'} na ${hours}h`;
    await logUserAction(user_id, action_code, minutes.toString(), text);
  }

  return result;
};

// Groups
export const getGroupById = (group_id) => safeQueryFirst('groups.getById', [group_id]);
export const getAvailableGroupsByType = (group_type, user_id) =>
  safeQueryAll('groups.getAvailableByType', [group_type, user_id]);
export const updateGroupLastSeen = (group_id) => safeExecute('groups.updateLastSeen', [group_id]);
export const updateGroupNextSeen = (group_id, minutes) =>
  safeExecute('groups.updateNextSeen', [group_id, minutes]);

// System functions
export const heartBeat = async (user_id = 0, group_id = 0, version_code = 'unknown') => {
  return await safeExecute('system.heartbeat', [
    hostname, user_id, group_id, version_code, user_id, group_id, version_code
  ]);
};

export const getVersionCode = () => safeQueryFirst('system.getVersionCode');
export const getUICommand = () => safeQueryFirst('system.getUICommand', [hostname]);
export const uICommandSolved = id => safeExecute('system.uiCommandSolved', [id]);
export const uICommandAccepted = id => safeExecute('system.uiCommandAccepted', [id]);

// Quotes (používá tabulku quotes místo statements)
export const getRandomQuote = (user_id) => safeQueryFirst('quotes.getRandomForUser', [user_id]);
export const updateQuoteNextSeen = (quote_id, days = 7) =>
  safeExecute('quotes.markAsUsed', [days, quote_id]);

// Logging
export const systemLog = async (title, text, data = {}) => {
  return await safeExecute('logs.insertSystemLog', [
    hostname, title, text, JSON.stringify(data)
  ]);
};

export const userLog = async (user, action_code, reference_id, text) => {
  const user_id = typeof user === 'object' ? user.id : user;
  return await logUserAction(user_id, action_code, reference_id, text);
};

// URLs and utilities
export const loadUrl = () => safeQueryFirst('system.loadUrl');
export const useUrl = (url) => safeExecute('system.useUrl', [url]);
export const getRandomReferer = () => safeQueryFirst('system.getRandomReferer');

// =========================================================
// ENHANCED FUNCTIONS (nové funkce s modernější logikou)
// =========================================================

/**
 * Moderní verze canUserPostToGroupType s lepší logikou
 */
export async function canUserPostToGroupType(userId, groupType) {
  return await db.canUserPost(userId, groupType);
}

/**
 * Kombinovaná funkce pro získání uživatele s akcemi
 */
export async function getUserWithAvailableActions() {
  const debugMode = isDebugMode();

  try {
    // Najdi uživatele s akcemi
    const user = await db.getUser();
    if (!user) return null;

    // Získej jeho akce
    const actions = await db.getUserActions(user.id);
    if (!actions.length) {
      if (debugMode) {
        Log.warn('[SQL]', `User ${user.id} selected but has no actions available`);
      }
      return null;
    }

    if (debugMode) {
      Log.debug('[SQL]', `User ${user.id} has ${actions.length} actions: ${actions.map(a => a.action_code).join(', ')}`);
    }

    return { user, actions };

  } catch (err) {
    if (debugMode) {
      Log.error('[SQL][DEBUG]', `getUserWithAvailableActions error: ${err.message}`);
    }
    return null;
  }
}

/**
 * Debug funkce pro diagnostiku problémů s uživateli
 */
export async function debugUserSelectionIssue(hostname) {
  const debugMode = isDebugMode();

  try {
    const allUsers = await safeQueryAll('users.getAllByHostname', [hostname]);
    const activeUsers = allUsers.filter(u => !u.locked);
    const readyUsers = activeUsers.filter(u => !u.next_worktime || new Date(u.next_worktime) <= new Date());

    const results = {
      total_users: allUsers.length,
      active_users: activeUsers.length,
      ready_users: readyUsers.length,
      user_details: []
    };

    for (const user of readyUsers.slice(0, 5)) { // Check first 5 ready users
      const actions = await db.getUserActions(user.id);
      results.user_details.push({
        id: user.id,
        name: `${user.name} ${user.surname}`,
        next_worktime: user.next_worktime,
        available_actions: actions.length,
        action_codes: actions.map(a => a.action_code)
      });
    }

    if (debugMode) {
      Log.debug('[SQL]', 'User selection debug:', results);
    }

    return results;

  } catch (err) {
    if (debugMode) {
      Log.error('[SQL][DEBUG]', `debugUserSelectionIssue error: ${err.message}`);
    }
    return null;
  }
}

// Přidat na konec souboru iv_sql.js, před export { SQL }

/**
 * Kontrola duplicity zprávy podle MD5 hash
 */
export async function verifyMsg(groupId, messageHash) {
  const debugMode = isDebugMode();

  try {
    if (debugMode) {
      Log.debug('[SQL]', `Checking message duplicate: group ${groupId}, hash ${messageHash.substring(0, 8)}...`);
    }

    // Pouze porovnáváme hash z parametru s hashem v databázi
    const result = await safeQueryFirst('quotes.findByHash', [messageHash]);

    if (result) {
      if (debugMode) {
        Log.debug('[SQL]', `Found duplicate message with hash ${messageHash.substring(0, 8)} (ID: ${result.id})`);
      }

      return { c: 1, id: result.id };
    }

    if (debugMode) {
      Log.debug('[SQL]', `No duplicate found for hash ${messageHash.substring(0, 8)}`);
    }

    return { c: 0 };

  } catch (err) {
    Log.error('[SQL]', `verifyMsg error: ${err.message}`);
    return { c: 0 };
  }
}

export async function storeMessage(userId, text, groupId = null) {
  const debugMode = isDebugMode();

  try {
    if (debugMode) {
      Log.debug('[SQL]', `Storing message: user ${userId}, text length: ${text.length}`);
    }

    // Hash se automaticky vygeneruje triggerem quotes_before_insert
    const result = await safeExecute('quotes.insertQuote', [
      userId,
      text,
      null // author
    ]);

    if (debugMode) {
      Log.debug('[SQL]', `Message stored successfully`);
    }

    return result;

  } catch (err) {
    Log.error('[SQL]', `storeMessage error: ${err.message}`);
    return false;
  }
}

// Export the SQL modules for direct access
export { SQL } from './sql/queries/index.js';
