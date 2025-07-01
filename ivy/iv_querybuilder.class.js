/**
 * Název souboru: iv_querybuilder.class.js
 * Umístění: ~/ivy/iv_querybuilder.class.js
 *
 * Popis: Moderní QueryBuilder třída pro databázové operace
 * Poskytuje vysokoúrovňové API pro všechny databázové funkce
 */

import os from 'node:os';

import { SQL } from './sql/queries/index.js';
import { Log } from './iv_log.class.js';
import { isDebugMode } from './iv_debug.js';

const hostname = os.hostname();

export class QueryBuilder {
  constructor(safeQueryFirst, safeQueryAll, safeExecute) {
    this.SQL = SQL;
    this.safeQueryFirst = safeQueryFirst;
    this.safeQueryAll = safeQueryAll;
    this.safeExecute = safeExecute;
  }

  // =========================================================
  // USERS - Správa uživatelů
  // =========================================================

  async getUser(hostname = hostname) {
    return await this.safeQueryFirst('users.getByHostname', [hostname]);
  }

  async getUserById(id) {
    return await this.safeQueryFirst('users.getById', [id]);
  }

  async getUsersByHostname(hostname = hostname) {
    return await this.safeQueryAll('users.getAllByHostname', [hostname]);
  }

  async lockUser(id) {
    return await this.safeExecute('users.lock', [id]);
  }

  async unlockUser(id) {
    return await this.safeExecute('users.unlock', [id]);
  }

  async updateUserWorktime(userId, minutes) {
    return await this.safeExecute('users.updateWorktime', [minutes, userId]);
  }

  // =========================================================
  // ACTIONS - Správa akcí a plánování
  // =========================================================

  async getUserActions(userId) {
    return await this.safeQueryAll('actions.getUserActions', [userId, userId]);
  }

  async getUserActionsWithLimits(userId) {
    return await this.safeQueryAll('actions.getUserActionsWithLimitsSimple', [userId, userId]);
  }

  async logAction(accountId, actionCode, referenceId, text) {
    return await this.safeExecute('actions.logAction', [accountId, actionCode, referenceId, text]);
  }

  async updateActionPlan(userId, actionCode, minutes) {
    return await this.safeExecute('actions.updatePlan', [minutes, userId, actionCode]);
  }

  async initUserActionPlan(userId) {
    return await this.safeExecute('actions.initPlan', [userId]);
  }

  // =========================================================
  // LIMITS - Správa limitů a kvót
  // =========================================================

  async getUserLimit(userId, groupType) {
    return await this.safeQueryFirst('limits.getUserLimit', [userId, groupType]);
  }

  async getUserAllLimitsWithUsage(userId) {
    return await this.safeQueryAll('limits.getUserAllLimitsWithUsage', [userId, userId]);
  }

  async countPostsInTimeframe(userId, groupType, hours) {
    return await this.safeQueryFirst('limits.countPostsInTimeframe', [userId, groupType, hours]);
  }

  async upsertUserGroupLimit(userId, groupType, maxPosts, timeWindowHours) {
    return await this.safeExecute('limits.upsertLimit', [userId, groupType, maxPosts, timeWindowHours]);
  }

  async getMaxPostsForGroupType(userId, groupType) {
    const result = await this.safeQueryFirst('user_limits.getGroupTypeLimit', [userId, groupType]);
    return result ? result.max_posts : 0;
  }

  async canUserPost(userId, groupType) {
    const limit = await this.getUserLimit(userId, groupType);
    if (!limit) return false;

    const postCount = await this.safeQueryFirst('limits.countPostsInTimeframe', [
      userId, groupType, limit.time_window_hours
    ]);

    const currentPosts = postCount ? postCount.post_count : 0;
    return currentPosts < limit.max_posts;
  }

  // =========================================================
  // GROUPS - Správa Facebook skupin
  // =========================================================

  async getGroupById(id) {
    return await this.safeQueryFirst('groups.getById', [id]);
  }

  async getAvailableGroups(groupType, userId) {
    return await this.safeQueryAll('groups.getAvailableByType', [groupType, userId]);
  }

  async updateGroupLastSeen(groupId) {
    return await this.safeExecute('groups.updateLastSeen', [groupId]);
  }

  async updateGroupNextSeen(groupId, minutes) {
    return await this.safeExecute('groups.updateNextSeen', [groupId, minutes]);
  }

  // =========================================================
  // SYSTEM - Systémové funkce
  // =========================================================

  async heartbeat(userId = 0, groupId = 0, version = 'unknown') {
    return await this.safeExecute('system.heartbeat', [
      hostname, userId, groupId, version, userId, groupId, version
    ]);
  }

  async getVersionCode() {
    return await this.safeQueryFirst('system.getVersionCode');
  }

  async getUICommand(hostname = hostname) {
    return await this.safeQueryFirst('system.getUICommand', [hostname]);
  }

  async uiCommandSolved(id) {
    return await this.safeExecute('system.uiCommandSolved', [id]);
  }

  async uiCommandAccepted(id) {
    return await this.safeExecute('system.uiCommandAccepted', [id]);
  }

  async loadUrl() {
    return await this.safeQueryFirst('system.loadUrl');
  }

  async useUrl(url) {
    return await this.safeExecute('system.useUrl', [url]);
  }

  async getRandomReferer() {
    return await this.safeQueryFirst('system.getRandomReferer');
  }

  // =========================================================
  // QUOTES - Správa citátů a zpráv
  // =========================================================

  async getRandomQuote(userId) {
    return await this.safeQueryFirst('quotes.getRandomForUser', [userId]);
  }

  async updateQuoteNextSeen(quoteId, days = 7) {
    return await this.safeExecute('quotes.markAsUsed', [days, quoteId]);
  }

  async verifyMessage(groupId, messageHash) {
    return await this.safeQueryFirst('quotes.findByHash', [messageHash]);
  }

  async storeMessage(userId, text, author = null) {
    return await this.safeExecute('quotes.insertQuote', [userId, text, author]);
  }

  // =========================================================
  // LOGGING - Logování a audit
  // =========================================================

  async systemLog(title, text, data = {}) {
    return await this.safeExecute('logs.insertSystemLog', [
      hostname, title, text, JSON.stringify(data)
    ]);
  }

  async logActionQuality(qualityData) {
    return await this.safeExecute('action_quality.insert', [
      qualityData.user_id,
      qualityData.action_code,
      qualityData.success ? 1 : 0,
      qualityData.details,
      qualityData.verification_used ? 1 : 0
    ]);
  }

  // =========================================================
  // METRICS & HASHES - Metriky a hashe
  // =========================================================

  async saveSystemMetrics(metrics) {
    return await this.safeExecute('system_metrics.insert', [
      JSON.stringify(metrics),
      metrics.timestamp
    ]);
  }

  async saveMessageHash(groupId, messageHash, preview) {
    return await this.safeExecute('message_hashes.insert', [
      groupId,
      messageHash,
      preview,
      new Date().toISOString()
    ]);
  }

  // =========================================================
  // COMPOSITE METHODS - Kombinované metody
  // =========================================================

  /**
   * Kombinovaná funkce pro získání uživatele s akcemi
   */
  async getUserWithAvailableActions() {
    const debugMode = isDebugMode();

    try {
      const user = await this.getUser();
      if (!user) return null;

      const actions = await this.getUserActions(user.id);
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
   * Komplexní funkce pro update worktime s logováním
   */
  async updateUserWorktimeWithLogging(user, minutes) {
    const userId = typeof user === 'object' ? user.id : user;
    const result = await this.updateUserWorktime(userId, minutes);

    if (result) {
      const hours = Math.round(minutes / 60 * 100) / 100;
      const actionCode = minutes > 1440 ? 'account_sleep' : 'account_delay';
      const text = `${actionCode === 'account_sleep' ? 'Sleep' : 'Delay'} na ${hours}h`;
      await this.logAction(userId, actionCode, minutes.toString(), text);
    }

    return result;
  }

  /**
   * User log wrapper function
   */
  async userLog(user, actionCode, referenceId, text) {
    const userId = typeof user === 'object' ? user.id : user;
    return await this.logAction(userId, actionCode, referenceId, text);
  }

  /**
   * Debug funkce pro diagnostiku problémů s uživateli
   */
  async debugUserSelectionIssue(hostname = hostname) {
    const debugMode = isDebugMode();

    try {
      const allUsers = await this.getUsersByHostname(hostname);
      const activeUsers = allUsers.filter(u => !u.locked);
      const readyUsers = activeUsers.filter(u => !u.next_worktime || new Date(u.next_worktime) <= new Date());

      const results = {
        total_users: allUsers.length,
        active_users: activeUsers.length,
        ready_users: readyUsers.length,
        user_details: []
      };

      for (const user of readyUsers.slice(0, 5)) {
        const actions = await this.getUserActions(user.id);
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

  /**
   * Pokročilá verifikace zprávy s detailním logováním
   */
  async verifyMessageAdvanced(groupId, messageHash) {
    const debugMode = isDebugMode();

    try {
      if (debugMode) {
        Log.debug('[SQL]', `Checking message duplicate: group ${groupId}, hash ${messageHash.substring(0, 8)}...`);
      }

      const result = await this.verifyMessage(groupId, messageHash);

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
      Log.error('[SQL]', `verifyMessageAdvanced error: ${err.message}`);
      return { c: 0 };
    }
  }

  /**
   * Store message s pokročilým logováním
   */
  async storeMessageAdvanced(userId, text, groupId = null) {
    const debugMode = isDebugMode();

    try {
      if (debugMode) {
        Log.debug('[SQL]', `Storing message: user ${userId}, text length: ${text.length}`);
      }

      const result = await this.storeMessage(userId, text, null);

      if (debugMode) {
        Log.debug('[SQL]', `Message stored successfully`);
      }

      return result;

    } catch (err) {
      Log.error('[SQL]', `storeMessageAdvanced error: ${err.message}`);
      return false;
    }
  }

  // =========================================================
  // UTILITY METHODS - Pomocné metody
  // =========================================================

  /**
   * Získá statistiky o QueryBuilder usage
   */
  getStats() {
    return {
      className: 'QueryBuilder',
      sqlModules: Object.keys(this.SQL).length,
      methods: Object.getOwnPropertyNames(Object.getPrototypeOf(this))
        .filter(name => name !== 'constructor' && typeof this[name] === 'function').length
    };
  }

  /**
   * Ověří dostupnost všech SQL modulů
   */
  validateSQLModules() {
    const requiredModules = ['users', 'actions', 'groups', 'limits', 'system', 'quotes', 'logs'];
    const missing = requiredModules.filter(module => !this.SQL[module]);
    
    if (missing.length > 0) {
      Log.error('[QueryBuilder]', `Missing SQL modules: ${missing.join(', ')}`);
      return false;
    }
    
    return true;
  }
}