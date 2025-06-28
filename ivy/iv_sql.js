/**
 * Název souboru: iv_sql.js (modernizovaná verze)
 * Umístění: ~/ivy/iv_sql.js
 *
 * Popis: Modernizovaná databázová vrstva s modulárními SQL dotazy
 * Podporuje jak novou modulární strukturu, tak zpětnou kompatibilitu
 */

import os from 'node:os';
import fs from 'node:fs';
import mysql from 'mysql2/promise';
import { SQL, LEGACY_QUERIES } from './sql/queries/index.js';
import { Log } from './iv_log.class.js';
import { isDebugMode } from './iv_debug.js';

const hostname = os.hostname();
const sql_setup = JSON.parse(fs.readFileSync('./sql/sql_config.json'));

// Kombinuj nové modulární dotazy s legacy soubory
const queries = {
  ...LEGACY_QUERIES,                                           // Legacy dotazy pro zpětnou kompatibilitu
  group: fs.readFileSync('./sql/iv_group.sql').toString(),     // Zachovat soubory .sql
  user: fs.readFileSync('./sql/iv_user.sql').toString(),       // Zachovat soubory .sql
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

// =========================================================
// CORE DATABASE FUNCTIONS
// =========================================================

async function query(query_id, data = []) {
  const debugMode = isDebugMode();

  if (debugMode) {
    Log.debug('[SQL]', `Executing query: ${query_id} with params: ${JSON.stringify(data)}`);
  }

  try {
    const [rows] = await pool.execute(queries[query_id], data);

    if (debugMode) {
      Log.debug('[SQL]', `Query ${query_id} successful, affected rows: ${rows.affectedRows || rows.length || 0}`);
    }

    return rows;

  } catch (err) {
    if (debugMode) {
      Log.error('[SQL][DEBUG]', `Query failed: ${query_id}`);
      Log.error('[SQL][DEBUG]', `SQL: ${queries[query_id]}`);
      Log.error('[SQL][DEBUG]', `Params: ${JSON.stringify(data)}`);
      Log.error('[SQL][DEBUG]', `Error: ${err.message}`);
      if (err.code) Log.error('[SQL][DEBUG]', `Error code: ${err.code}`);
      if (err.sqlState) Log.error('[SQL][DEBUG]', `SQL State: ${err.sqlState}`);
    } else {
      Log.error('[SQL]', `Query ${query_id} failed: ${err.code || err.message}`);
    }

    return false;
  }
}

async function safeQueryFirst(query_id, params = []) {
  const debugMode = isDebugMode();

  try {
    if (debugMode) {
      Log.debug('[SQL]', `safeQueryFirst: ${query_id}`);
    }

    const rows = await query(query_id, params);
    if (!rows || !rows.length || !rows[0]) {
      if (debugMode) {
        Log.debug('[SQL]', `safeQueryFirst ${query_id} returned no results`);
      }
      return false;
    }

    if (debugMode) {
      Log.debug('[SQL]', `safeQueryFirst ${query_id} returned 1 row`);
    }

    return rows[0];
  } catch (err) {
    if (debugMode) {
      Log.error('[SQL][DEBUG]', `safeQueryFirst ${query_id} exception: ${err.message}`);
    } else {
      Log.error('[SQL]', `safeQueryFirst ${query_id} failed`);
    }
    return false;
  }
}

async function safeQueryAll(query_id, params = []) {
  const debugMode = isDebugMode();

  try {
    if (debugMode) {
      Log.debug('[SQL]', `safeQueryAll: ${query_id}`);
    }

    const rows = await query(query_id, params);
    const resultCount = rows ? rows.length : 0;

    if (debugMode) {
      Log.debug('[SQL]', `safeQueryAll ${query_id} returned ${resultCount} rows`);
    }

    return rows || [];
  } catch (err) {
    if (debugMode) {
      Log.error('[SQL][DEBUG]', `safeQueryAll ${query_id} exception: ${err.message}`);
    } else {
      Log.error('[SQL]', `safeQueryAll ${query_id} failed`);
    }
    return [];
  }
}

async function safeExecute(query_id, params = []) {
  const debugMode = isDebugMode();

  try {
    if (debugMode) {
      Log.debug('[SQL]', `safeExecute: ${query_id}`);
    }

    const result = await query(query_id, params);

    if (result !== false) {
      if (debugMode) {
        Log.debug('[SQL]', `safeExecute ${query_id} successful`);
      }
      return true;
    } else {
      if (debugMode) {
        Log.error('[SQL][DEBUG]', `safeExecute ${query_id} returned false`);
      } else {
        Log.error('[SQL]', `safeExecute ${query_id} failed`);
      }
      return false;
    }
  } catch (err) {
    if (debugMode) {
      Log.error('[SQL][DEBUG]', `safeExecute ${query_id} exception: ${err.message}`);
    } else {
      Log.error('[SQL]', `safeExecute ${query_id} failed`);
    }
    return false;
  }
}

// =========================================================
// MODERN QUERY BUILDER (volitelné)
// =========================================================

/**
 * Moderní query builder pro přímý přístup k modulárním dotazům
 */
export class QueryBuilder {
  constructor() {
    this.SQL = SQL;
  }

  // Users
  async getUser(hostname = hostname) {
    return await safeQueryFirst(SQL.users.getByHostname, [hostname]);
  }

  async getUserById(id) {
    return await safeQueryFirst(SQL.users.getById, [id]);
  }

  async lockUser(id) {
    return await safeExecute(SQL.users.lock, [id]);
  }

  async unlockUser(id) {
    return await safeExecute(SQL.users.unlock, [id]);
  }

  // Actions
  async getUserActions(userId) {
    return await safeQueryAll(SQL.actions.getUserActions, [userId, userId]);
  }

  async logAction(accountId, actionCode, referenceId, text) {
    return await safeExecute(SQL.actions.logAction, [accountId, actionCode, referenceId, text]);
  }

  async updateActionPlan(userId, actionCode, minutes) {
    return await safeExecute(SQL.actions.updatePlan, [minutes, userId, actionCode]);
  }

  // Limits
  async getUserLimit(userId, groupType) {
    return await safeQueryFirst(SQL.limits.getUserLimit, [userId, groupType]);
  }

  async canUserPost(userId, groupType) {
    const limit = await this.getUserLimit(userId, groupType);
    if (!limit) return false;

    const result = await safeQueryFirst(SQL.limits.canUserPost, [
      userId, groupType, limit.time_window_hours, userId, groupType
    ]);

    return result?.can_post === 1;
  }

  // Groups
  async getGroupById(id) {
    return await safeQueryFirst(SQL.groups.getById, [id]);
  }

  async getAvailableGroups(groupType, userId) {
    return await safeQueryAll(SQL.groups.getAvailableByType, [groupType, userId]);
  }

  // System
  async heartbeat(userId = 0, groupId = 0, version = 'unknown') {
    return await safeExecute(SQL.system.heartbeat, [
      hostname, userId, groupId, version, userId, groupId, version
    ]);
  }

  async getVersionCode() {
    return await safeQueryFirst(SQL.system.getVersionCode);
  }
}

// Instance query builderu pro přímé použití
export const db = new QueryBuilder();

// =========================================================
// LEGACY EXPORTS (zachovat pro zpětnou kompatibilitu)
// =========================================================

// Základní systémové funkce
export const getUser = () => safeQueryFirst("user", [hostname]);
export const getUserById = user_id => safeQueryFirst(SQL.users.getById, [user_id]);
export const getUsersByHostname = () => safeQueryAll(SQL.users.getByHostname, [hostname]);

// Action system
export const getUserActions = user_id => safeQueryAll(SQL.actions.getUserActions, [user_id, user_id]);
export const updateUserActionPlan = (user_id, action_code, randMinutes) =>
  safeExecute(SQL.actions.updatePlan, [randMinutes, user_id, action_code]);
export const initUserActionPlan = (user_id) => safeExecute(SQL.actions.initPlan, [user_id]);
export const logUserAction = (account_id, action_code, reference_id, text) =>
  safeExecute(SQL.actions.logAction, [account_id, action_code, reference_id, text]);

// Group limits
export const getUserGroupLimit = (user_id, group_type) =>
  safeQueryFirst(SQL.limits.getUserLimit, [user_id, group_type]);
export const countUserPostsInTimeframe = (user_id, group_type, hours) =>
  safeQueryFirst(SQL.limits.countPostsInTimeframe, [user_id, group_type, hours]);
export const upsertUserGroupLimit = (user_id, group_type, max_posts, time_window_hours) =>
  safeExecute(SQL.limits.upsertLimit, [user_id, group_type, max_posts, time_window_hours]);

// User management
export const lockAccount = (user_id) => safeExecute(SQL.users.lock, [user_id]);
export const updateUserWorktime = async (user, minutes) => {
  const user_id = typeof user === 'object' ? user.id : user;
  const result = await safeExecute(SQL.users.updateWorktime, [minutes, user_id]);

  if (result) {
    const hours = Math.round(minutes / 60 * 100) / 100;
    const action_code = minutes > 1440 ? 'account_sleep' : 'account_delay';
    const text = `${action_code === 'account_sleep' ? 'Sleep' : 'Delay'} na ${hours}h`;
    await logUserAction(user_id, action_code, minutes.toString(), text);
  }

  return result;
};

// Groups
export const getGroupById = (group_id) => safeQueryFirst(SQL.groups.getById, [group_id]);
export const getAvailableGroupsByType = (group_type, user_id) =>
  safeQueryAll(SQL.groups.getAvailableByType, [group_type, user_id]);
export const updateGroupLastSeen = (group_id) => safeExecute(SQL.groups.updateLastSeen, [group_id]);
export const updateGroupNextSeen = (group_id, minutes) =>
  safeExecute(SQL.groups.updateNextSeen, [group_id, minutes]);

// System functions
export const heartBeat = async (user_id = 0, group_id = 0, version_code = 'unknown') => {
  return await safeExecute(SQL.system.heartbeat, [
    hostname, user_id, group_id, version_code, user_id, group_id, version_code
  ]);
};

export const getVersionCode = () => safeQueryFirst(SQL.system.getVersionCode);
export const getUICommand = () => safeQueryFirst(SQL.system.getUICommand, [hostname]);
export const uICommandSolved = id => safeExecute(SQL.system.uiCommandSolved, [id]);
export const uICommandAccepted = id => safeExecute(SQL.system.uiCommandAccepted, [id]);

// Quotes
export const getRandomQuote = (user_id) => safeQueryFirst(SQL.quotes.getRandom, [user_id]);
export const updateQuoteNextSeen = (quote_id, days) =>
  safeExecute(SQL.quotes.updateNextSeen, [days, quote_id]);

// Logging
export const systemLog = async (title, text, data = {}) => {
  return await safeExecute(SQL.logs.insertSystemLog, [
    hostname, title, text, JSON.stringify(data)
  ]);
};

export const userLog = async (user, action_code, reference_id, text) => {
  const user_id = typeof user === 'object' ? user.id : user;
  return await logUserAction(user_id, action_code, reference_id, text);
};

// URLs and utilities
export const loadUrl = () => safeQueryFirst(SQL.system.loadUrl);
export const useUrl = (url) => safeExecute(SQL.system.useUrl, [url]);
export const getRandomReferer = () => safeQueryFirst(SQL.system.getRandomReferer);

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
    const allUsers = await safeQueryAll(SQL.users.getByHostname, [hostname]);
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

// Export the SQL modules for direct access
export { SQL } from './sql/queries/index.js';
