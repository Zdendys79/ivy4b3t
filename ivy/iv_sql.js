/**
 * Název souboru: iv_sql.js
 * Umístění: ~/ivy/iv_sql.js
 *
 * Popis: Poskytuje funkce pro komunikaci s databází MariaDB pomocí předdefinovaných SQL dotazů.
 * Používá connection pool. Obsahuje obalové metody safeQueryFirst, safeQueryAll, safeExecute.
 */

import os from 'node:os';
import fs from 'node:fs';
import mysql from 'mysql2/promise';
import rawQueries from './sql/iv_sql_queries.js';
import { Log } from './iv_log.class.js';

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
  let success = false;
  let count = 0;
  let results = false;
  do {
    try {
      const [rows] = await pool.execute(queries[query_id], data);
      results = rows;
      success = true;
    } catch (err) {
      Log.error('[SQL]', new Error(`[${count}] sql.query "${query_id}" failed\n${queries[query_id]}\n${err.message}`));
      await new Promise(resolve => setTimeout(resolve, 5000));
      count++;
    }
  } while (!success && count < 3);
  return success ? results : false;
}

async function safeQueryFirst(query_id, params = []) {
  try {
    const rows = await query(query_id, params);
    if (!rows || !rows.length || !rows[0]) return false;
    return rows[0];
  } catch (err) {
    Log.error('[SQL][safeQueryFirst]', err);
    return false;
  }
}

async function safeQueryAll(query_id, params = []) {
  try {
    const rows = await query(query_id, params);
    return rows || [];
  } catch (err) {
    Log.error('[SQL][safeQueryAll]', err);
    return [];
  }
}

async function safeExecute(query_id, params = []) {
  try {
    await query(query_id, params);
    return true;
  } catch (err) {
    Log.error('[SQL][safeExecute]', err);
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
export const setWorktimeToTomorow = user_id => safeExecute("update_worktime_to_tomorow", [user_id]);
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
export const logUserAction = (account_id, action_code, reference_id, text) => safeExecute('insert_to_action_log', [account_id, action_code, reference_id, text]);
export const systemLog = (title, text, data = {}) => safeExecute('insert_to_system_log', [os.hostname(), title, text, JSON.stringify(data)]);
export const userLog = (user, action_code, reference_id, text) => logUserAction(user.id, action_code, reference_id, text);
export const updateQuoteNextSeen = (quote_id, days) => safeExecute('update_quote_next_seen', [days, quote_id]);

export const getReferenceSleepTime = user_id => safeQueryFirst('get_reference_sleep_time', [user_id, user_id])
  .then(row => row && row.time ? new Date(row.time) : false);

export async function heartBeat(user_id, group_id, version_code) {
  const data = [hostname, user_id, group_id, version_code, user_id, group_id, version_code];
  return await safeExecute("heartbeat", data);
}

export async function updateUserWorktime(user, worktime) {
  const update1 = await safeExecute("update_user_worktime", [worktime, user.id]);
  const log = await userLog(user, 4, worktime, `Updated worktime +${worktime} minutes.`);
  return update1 && log;
}

// debug functions
export const resetQuotePostDebug = () => safeExecute('reset_quote_post_debug');

