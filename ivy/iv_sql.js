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

const hostname = os.hostname();
const sql_setup = JSON.parse(fs.readFileSync('./sql/_sql.json'));

// Sloučení načítaných souborů do dotazového objektu
const queries = {
  ...rawQueries,
  group: fs.readFileSync('./sql/iv_group.sql').toString(),
  user: fs.readFileSync('./sql/iv_user.sql').toString(),
};

// Inicializace připojení k databázi
const pool = mysql.createPool({
  host: sql_setup.host,
  user: sql_setup.user,
  password: sql_setup.password,
  database: sql_setup.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Obecná dotazovací funkce
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
      console.error(`[${count}] sql.query "${query_id}" failed\n${queries[query_id]}\n${err}`);
      await new Promise(resolve => setTimeout(resolve, 5000));
      count++;
    }
  } while (!success && count < 3);
  return success ? results : false;
}

// Wrappery
async function safeQueryFirst(query_id, params = []) {
  try {
    const rows = await query(query_id, params);
    if (!rows || !rows.length || !rows[0]) return false;
    return rows[0];
  } catch (err) {
    console.error(`[safeQueryFirst] ${query_id} failed:\n${err}`);
    return false;
  }
}

async function safeQueryAll(query_id, params = []) {
  try {
    const rows = await query(query_id, params);
    return rows || [];
  } catch (err) {
    console.error(`[safeQueryAll] ${query_id} failed:\n${err}`);
    return [];
  }
}

async function safeExecute(query_id, params = []) {
  try {
    await query(query_id, params);
    return true;
  } catch (err) {
    console.error(`[safeExecute] ${query_id} failed:\n${err}`);
    return false;
  }
}

// Exportované funkce využívající wrappery
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
export const getProductionVersionCode = () => safeQueryFirst("get_production_version_code");
export const updateUserNextStatement = (user, hours) => safeExecute('update_user_next_statement', [hours, user.id]);
export const updateUserAddGroup = (user, group_id) => safeExecute('update_user_add_group', [user.id]);
export const setUserLimit = (user, new_limit, old_limit) => safeExecute('set_user_limit', [new_limit, user.id]);
export const loadUrl = () => safeQueryFirst('load_url');
export const useUrl = (url) => safeExecute('use_url', [url]);
export const getStatement = () => safeQueryFirst('select_statement');
export const verifyMsg = (group_id, md5) => safeQueryFirst('verify_posted_data', [group_id, md5]);
export const getGroupById = (group_id) => safeQueryFirst('group_by_id', [group_id]);

export const getReferenceSleepTime = user_id => safeQueryFirst('get_reference_sleep_time', [user_id, user_id])
  .then(row => row && row.time ? new Date(row.time) : false);

export async function heartBeat(user_id, group_id, version_code) {
  const data = [hostname, user_id, group_id, version_code, user_id, group_id, version_code];
  return await safeExecute("heartbeat", data);
}

export async function systemLog(title, msg, data) {
  const payload = [hostname, title, msg, JSON.stringify(data)];
  return await safeExecute("insert_to_system_log", payload);
}

export async function userLog(user, type_id = 0, d = "", msg = "") {
  const data = [user.id, type_id, d, user.name, user.surname, user.id, msg];
  return await safeExecute("insert_to_user_log", data);
}

export async function updateUserWorktime(user, worktime) {
  const update1 = await safeExecute("update_user_worktime", [worktime, user.id]);
  const log = await userLog(user, 4, worktime, `Updated worktime +${worktime} minutes.`);
  return update1 && log;
}
