/**
 * Název souboru: iv_sql.js
 * Umístění: ~/ivy/iv_sql.js
 *
 * Popis: Poskytuje funkce pro komunikaci s databází MariaDB pomocí předdefinovaných SQL dotazů.
 * Používá connection pool. Obsahuje obalové metody s podmíněným logováním podle debug režimu.
 */

import os from 'node:os';
import fs from 'node:fs';
import mysql from 'mysql2/promise';
import rawQueries from './sql/iv_sql_queries.js';
import { Log } from './iv_log.class.js';
import { isDebugMode } from './iv_debug.js';

const hostname = os.hostname();
const sql_setup = JSON.parse(fs.readFileSync('./sql/sql_config.json'));

const queries = {
  ...rawQueries,
  group: fs.readFileSync('./sql/iv_group.sql').toString(),
  user: fs.readFileSync('./sql/iv_user.sql').toString(),
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

async function query(query_id, data = []) {
  const debugMode = isDebugMode();
  let success = false;
  let count = 0;
  let results = false;

  if (debugMode) {
    Log.debug('[SQL]', `Executing query: ${query_id} with params: ${JSON.stringify(data)}`);
  }

  do {
    try {
      const [rows] = await pool.execute(queries[query_id], data);
      results = rows;
      success = true;

      if (debugMode) {
        Log.debug('[SQL]', `Query ${query_id} successful, affected rows: ${rows.affectedRows || rows.length || 0}`);
      }
    } catch (err) {
      count++;

      if (debugMode) {
        // Debug režim - podrobné informace
        Log.error('[SQL][DEBUG]', `Attempt ${count}/3 failed for query: ${query_id}`);
        Log.error('[SQL][DEBUG]', `SQL: ${queries[query_id]}`);
        Log.error('[SQL][DEBUG]', `Params: ${JSON.stringify(data)}`);
        Log.error('[SQL][DEBUG]', `Error: ${err.message}`);
        if (err.code) Log.error('[SQL][DEBUG]', `Error code: ${err.code}`);
        if (err.sqlState) Log.error('[SQL][DEBUG]', `SQL State: ${err.sqlState}`);
      } else {
        // Ostrý režim - jen základní info
        Log.error('[SQL]', `Query ${query_id} failed (attempt ${count}/3): ${err.code || err.message}`);
      }

      if (count < 3) {
        await new Promise(resolve => setTimeout(resolve, 1000 * count)); // 1s, 2s, 3s
      }
    }
  } while (!success && count < 3);

  if (!success) {
    if (debugMode) {
      Log.error('[SQL][DEBUG]', `Query ${query_id} completely failed after 3 attempts`);
    } else {
      Log.error('[SQL]', `Query ${query_id} failed permanently`);
    }
  }

  return success ? results : false;
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

// Exportované funkce
export const getActionDefinitions = () => safeQueryAll('get_action_definitions');
export const getAvailableActions = user_id => safeQueryAll('get_available_actions', [user_id]);
export const insertToActionPlan = (user_id, action_code, next_time) => safeExecute('insert_to_action_plan', [user_id, action_code, next_time]);
export const getUser = () => safeQueryFirst("user", [hostname]);
export const getUserById = user_id => safeQueryFirst("user_by_id", [user_id]);
export const getUICommand = () => safeQueryFirst("get_ui_command", [hostname]);
export const uICommandSolved = id => safeExecute("ui_command_solved", [id]);
export const uICommandAccepted = id => safeExecute("ui_command_accepted", [id]);
export const getRandomReferer = () => safeQueryFirst("get_random_referer");
export const getRecentlyLogedUserFromMyNeighborhood = () => safeQueryFirst("get_recently_loged_user_from_neighborhood", [hostname, 30]);
export const lockAccount = (user_id) => safeExecute("lock_account", [user_id]);
export const userLogedToFB = (user_id) => safeExecute("update_user_loged_to_fb", [hostname, user_id, user_id]);
export const getVersionCode = () => safeQueryFirst("get_version_code");
export const updateUserNextStatement = (user, hours) => safeExecute('update_user_next_statement', [hours, user.id]);
export const updateUserAddGroup = (user, group_id) => safeExecute('update_user_add_group', [user.id]);
export const setUserLimit = (user, new_limit, old_limit) => safeExecute('set_user_limit', [new_limit, user.id]);
export const loadUrl = () => safeQueryFirst('load_url');
export const useUrl = (url) => safeExecute('use_url', [url]);
export const getStatement = () => safeQueryFirst('select_statement');
export const verifyMsg = (group_id, md5) => safeQueryFirst('verify_posted_data', [group_id, md5]);
export const getGroupById = (group_id) => safeQueryFirst('group_by_id', [group_id]);
export const getRandomQuote = (user_id) => safeQueryFirst('get_random_quote', [user_id]);
export const getUserActions = user_id => safeQueryAll('get_user_actions', [user_id, user_id]);
export const updateUserActionPlan = (user_id, action_code, randMinutes) => safeExecute('update_user_action_plan', [randMinutes, user_id, action_code]);
export const initUserActionPlan = (user_id) => safeExecute('init_user_action_plan', [user_id]);
export const updateQuoteNextSeen = (quote_id, days) => safeExecute('update_quote_next_seen', [days, quote_id]);

/**
 * Loguje uživatelskou akci do action_log tabulky
 * @param {Object|number} user - Uživatelský objekt nebo ID
 * @param {string} action_code - Kód akce (account_sleep, account_delay, atd.)
 * @param {string|number} reference_id - Reference ID
 * @param {string} text - Popis akce
 */
export const userLog = async (user, action_code, reference_id, text) => {
  const user_id = typeof user === 'object' ? user.id : user;
  return await logUserAction(user_id, action_code, reference_id, text);
};

export const getReferenceSleepTime = user_id => safeQueryFirst('get_reference_sleep_time', [user_id, user_id])
  .then(row => row && row.time ? new Date(row.time) : false);

// Speciální funkce s vlastním logováním
export async function logUserAction(account_id, action_code, reference_id, text) {
  const debugMode = isDebugMode();

  if (debugMode) {
    Log.debug('[SQL]', `logUserAction: user=${account_id}, action=${action_code}, ref=${reference_id}`);
  }

  const result = await safeExecute('insert_to_action_log', [account_id, action_code, reference_id, text]);

  if (result) {
    if (debugMode) {
      Log.success('[SQL]', `Action logged: ${action_code} for user ${account_id}`);
    } else {
      Log.info('[SQL]', `Action logged: ${action_code}`);
    }
  } else {
    if (debugMode) {
      Log.error('[SQL][DEBUG]', `Failed to log action: ${action_code} for user ${account_id}`);
    } else {
      Log.error('[SQL]', `Failed to log action: ${action_code}`);
    }
  }

  return result;
}

export async function systemLog(title, text, data = {}) {
  const debugMode = isDebugMode();

  if (debugMode) {
    Log.debug('[SQL]', `systemLog: ${title}`);
  }

  const result = await safeExecute('insert_to_system_log', [os.hostname(), title, text, JSON.stringify(data)]);

  if (!result && debugMode) {
    Log.error('[SQL][DEBUG]', `Failed to write system log: ${title}`);
  }

  return result;
}

export async function heartBeat(user_id, group_id, version_code) {
  const debugMode = isDebugMode();
  const data = [hostname, user_id, group_id, version_code, user_id, group_id, version_code];

  if (debugMode) {
    Log.debug('[SQL]', `Heartbeat: user=${user_id}, group=${group_id}, version=${version_code}`);
  }

  return await safeExecute("heartbeat", data);
}

/**
 * Aktualizace worktime s logováním
 * @param {Object|number} user - Uživatel nebo user ID
 * @param {number} minutes - Počet minut
 */
export async function updateUserWorktime(user, minutes) {
  const user_id = typeof user === 'object' ? user.id : user;

  // Aktualizuj worktime v fb_users
  const result = await safeExecute('update_user_worktime', [minutes, user_id]);

  // Loguj akci podle délky pauzy
  if (result) {
    const hours = Math.round(minutes / 60 * 100) / 100;
    const action_code = minutes > 1440 ? 'account_sleep' : 'account_delay'; // > 24h = sleep
    const text = `${action_code === 'account_sleep' ? 'Sleep' : 'Delay'} na ${hours}h`;

    await logUserAction(user_id, action_code, minutes.toString(), text);
  }

  return result;
}

// Debug functions
export const resetQuotePostDebug = () => {
  const debugMode = isDebugMode();
  if (debugMode) {
    Log.debug('[SQL]', 'Resetting quote_post debug');
  }
  return safeExecute('reset_quote_post_debug');
};

// Enhanced function for getting production version with better logging
export async function getProductionVersionCode() {
  const debugMode = isDebugMode();

  if (debugMode) {
    Log.debug('[SQL]', 'Getting production version code');
  }

  const result = await safeQueryFirst("get_version_code");

  if (debugMode) {
    if (result) {
      Log.debug('[SQL]', `Production version: ${result.code}`);
    } else {
      Log.error('[SQL][DEBUG]', 'Failed to get production version code');
    }
  }

  return result || { code: 'unknown' };
}

// Group limits funkce
export const getUserGroupLimit = (user_id, group_type) => safeQueryFirst('get_user_group_limit', [user_id, group_type]);
export const countUserPostsInTimeframe = (user_id, group_type, hours) => safeQueryFirst('count_user_posts_in_timeframe', [user_id, group_type, hours]);
export const getAvailableGroupsByType = (group_type, user_id) => safeQueryAll('get_available_groups_by_type', [group_type, user_id]);
export const upsertUserGroupLimit = (user_id, group_type, max_posts, time_window_hours) => safeExecute('upsert_user_group_limit', [user_id, group_type, max_posts, time_window_hours]);
export const getUserAllLimits = (user_id) => safeQueryAll('get_user_all_limits', [user_id]);

/**
 * Zkontroluje, zda může uživatel přidat příspěvek do skupiny daného typu
 * @param {number} user_id - ID uživatele
 * @param {string} group_type - Typ skupiny (G, GV, P, Z)
 * @returns {Promise<boolean>} - true pokud může přidat příspěvek
 */
export async function canUserPostToGroupType(user_id, group_type) {
  const debugMode = isDebugMode();

  try {
    // Získej limity pro tento typ skupiny
    const limit = await getUserGroupLimit(user_id, group_type);
    if (!limit) {
      if (debugMode) {
        Log.warn('[SQL][DEBUG]', `Žádné limity nalezeny pro user ${user_id}, group_type ${group_type}`);
      }
      return false;
    }

    // Spočítej aktuální příspěvky v časovém okně
    const postCount = await countUserPostsInTimeframe(user_id, group_type, limit.time_window_hours);
    if (!postCount) {
      if (debugMode) {
        Log.error('[SQL][DEBUG]', `Nepodařilo se spočítat příspěvky pro user ${user_id}, group_type ${group_type}`);
      }
      return false;
    }

    const currentPosts = postCount.post_count || 0;
    const canPost = currentPosts < limit.max_posts;

    if (debugMode) {
      Log.debug('[SQL]', `canUserPostToGroupType: user=${user_id}, type=${group_type}, posts=${currentPosts}/${limit.max_posts}, window=${limit.time_window_hours}h, canPost=${canPost}`);
    }

    return canPost;

  } catch (err) {
    if (debugMode) {
      Log.error('[SQL][DEBUG]', `canUserPostToGroupType error: ${err.message}`);
    } else {
      Log.error('[SQL]', `canUserPostToGroupType failed for user ${user_id}, type ${group_type}`);
    }
    return false;
  }
}

/**
 * Zablokuje účet s důvodem a typem problému
 * @param {number} userId - ID uživatele
 * @param {string} reason - Důvod zablokování
 * @param {string} type - Typ problému (VIDEOSELFIE, ACCOUNT_LOCKED, atd.)
 * @param {string} hostname - Hostname serveru
 */
export const lockAccountWithReason = (userId, reason, type, hostname) =>
  safeExecute('lock_account_with_reason', [userId, reason, type, hostname]);

/**
 * Přidá záznam o detekci problému do log_s
 * @param {number} userId - ID uživatele
 * @param {string} reason - Důvod problému
 * @param {string} type - Typ problému
 * @param {Object} details - Dodatečné detaily (JSON)
 * @param {string} hostname - Hostname serveru
 */
export const logAccountIssue = (userId, reason, type, details, hostname) =>
  safeExecute('log_account_issue', [userId, reason, type, JSON.stringify(details), hostname]);

/**
 * Získá statistiky zablokovaných účtů podle typu problému
 */
export const getLockedAccountsStats = () =>
  safeQueryAll('get_locked_accounts_stats');

/**
 * Získá seznam zablokovaných účtů s detaily
 * @param {number} limit - Limit počtu záznamů
 */
export const getLockedAccountsDetails = (limit = 50) =>
  safeQueryAll('get_locked_accounts_details', [limit]);

/**
 * Odemkne účet a přidá záznam do logu
 * @param {number} userId - ID uživatele
 * @param {string} hostname - Hostname serveru
 * @param {string} note - Poznámka k odemčení
 */
export const unlockAccountWithLog = (userId, hostname, note = 'Manual unlock') =>
  safeExecute('unlock_account_with_log', [userId, hostname, note]);

/**
 * Zkontroluje, zda je účet zablokován a vrátí detaily
 * @param {number} userId - ID uživatele
 */
export const checkAccountLockStatus = (userId) =>
  safeQueryFirst('check_account_lock_status', [userId]);

/**
 * Získá počet zablokovaných účtů podle typu za posledních X dní
 * @param {number} days - Počet dní zpět
 */
export const getRecentLocksByType = (days = 7) =>
  safeQueryAll('get_recent_locks_by_type', [days]);
