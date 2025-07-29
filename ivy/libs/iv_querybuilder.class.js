/**
 * Název souboru: iv_querybuilder.class.js
 * Umístění: ~/ivy/iv_querybuilder.class.js
 *
 * Popis: Moderní QueryBuilder třída pro databázové operace
 * Poskytuje vysokoúrovňové API pro všechny databázové funkce
 */

import os from 'node:os';

import { SQL } from '../sql/queries/index.js';
import { Log } from './iv_log.class.js';

const hostname = os.hostname();

export class QueryBuilder {
  constructor(safeQueryFirst, safeQueryAll, safeExecute) {
    this.SQL = SQL;
    this.safeQueryFirst = safeQueryFirst;
    this.safeQueryAll = safeQueryAll;
    this.safeExecute = safeExecute;
    this._lastUICommand = null; // Pro tracking změn UI příkazů
  }

  // =========================================================
  // USERS - Správa uživatelů
  // =========================================================

  async getUser(host = hostname) {
    return await this.safeQueryFirst('users.getByHostname', [host]);
  }

  async getUserWithAvailableActions(host = hostname) {
    return await this.safeQueryFirst('users.getWithAvailableActions', [host]);
  }

  async getOldestReadyUser(host = hostname) {
    return await this.safeQueryFirst('users.getOldestReadyForHost', [host]);
  }

  async getUserById(id) {
    return await this.safeQueryFirst('users.getById', [id]);
  }

  async getUsersByHostname(host = hostname) {
    return await this.safeQueryAll('users.getAllByHostname', [host]);
  }

  async lockUser(id) {
    return await this.safeExecute('users.lock', [id]);
  }

  async unlockUser(id) {
    return await this.safeExecute('users.unlock', [id]);
  }

  async lockAccount(id) {
    return await this.lockUser(id);
  }

  async lockAccountWithReason(id, reason, lockType, hostname) {
    return await this.safeExecute('users.lockWithReason', [reason, lockType, id]);
  }

  async updateUserWorktime(userId, minutes) {
    return await this.safeExecute('users.updateWorktime', [minutes, userId]);
  }

  async updateUserDayCount(userId) {
    return await this.safeExecute('users.updateDayCount', [userId, userId]);
  }

  async setUserLimit(userId, dayLimit) {
    return await this.safeExecute('users.setLimit', [dayLimit, userId]);
  }

  async updateUserAddGroup(user, groupId) {
    const userId = typeof user === 'object' ? user.id : user;
    return await this.safeExecute('users.updateLastAddGroup', [userId]);
  }

  // =========================================================
  // ACTIONS - Správa akcí a plánování
  // =========================================================

  async getUserActions(userId) {
    return await this.safeQueryAll('actions.getUserActions', [userId, userId]);
  }

  async getUserActionsWithLimits(userId) {
    return await this.safeQueryAll('actions.getUserActionsWithLimitsSimple', [userId, userId], true);
  }

  // News post dotazy
  async getAvailableNewsUrl() {
    return await this.safeQueryFirst('news.getAvailableUrl');
  }

  async markNewsUrlAsUsed(urlId) {
    return await this.safeExecute('news.markUrlAsUsed', [urlId]);
  }

  async logAction(accountId, actionCode, referenceId, text) {
    return await this.safeExecute('actions.logAction', [accountId, actionCode, referenceId, text]);
  }

  async logUserAction(accountId, actionCode, referenceId, text) {
    return await this.logAction(accountId, actionCode, referenceId, text);
  }

  async getUserLastJoinGroup(accountId) {
    return await this.safeQueryFirst('actions.getUserLastJoinGroup', [accountId]);
  }

  async updateActionPlan(userId, actionCode, minutes) {
    return await this.safeExecute('actions.updatePlan', [minutes, userId, actionCode]);
  }

  async initUserActionPlan(userId) {
    return await this.safeExecute('actions.initPlan', [userId]);
  }

  async getDefinitionByCode(actionCode) {
    return await this.safeQueryFirst('actions.getDefinitionByCode', [actionCode]);
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

  async canUserPostToGroupType(userId, groupType) {
    return await this.canUserPost(userId, groupType.toUpperCase());
  }

  async getUserCycleLimitInfo(userId, groupType) {
    const groupTypeUpper = groupType.toUpperCase();

    // Nejdřív získej basic limit info pro time_window_hours
    const limitBasic = await this.safeQueryFirst('limits.getUserLimit', [userId, groupTypeUpper]);
    if (!limitBasic) {
      return { max_posts_per_cycle: 0, posts_available_this_cycle: 0, current_posts: 0 };
    }

    // Pak použij getUserLimitUsageDetailed s správným time_window_hours
    const result = await this.safeQueryFirst('limits.getUserLimitUsageDetailed', [
      userId, groupTypeUpper, limitBasic.time_window_hours, userId, groupTypeUpper
    ]);
    return result || { max_posts_per_cycle: 0, posts_available_this_cycle: 0, current_posts: 0 };
  }

  async shouldRepeatUtioAction(userId, actionCode) {
    if (!actionCode.startsWith('post_utio_')) {
      return false; // Není UTIO akce
    }

    const groupType = actionCode.replace('post_utio_', '').toUpperCase();
    const limitInfo = await this.getUserCycleLimitInfo(userId, groupType);

    // Opakuj akci, pokud ještě nejsou vyčerpány posty pro tento cyklus
    return limitInfo.posts_available_this_cycle > 0;
  }

  // =========================================================
  // BEHAVIORAL PROFILES - Pokročilé lidské chování
  // =========================================================

  async getBehavioralProfile(userId) {
    const result = await this.safeQueryFirst('behavioral_profiles.getUserProfile', [userId]);
    if (!result) {
      // Vytvoř default profil pokud neexistuje
      await this.safeExecute('behavioral_profiles.createDefaultProfile', [userId]);
      return await this.safeQueryFirst('behavioral_profiles.getUserProfile', [userId]);
    }
    return result;
  }

  async updateBehavioralMood(userId, mood, energyLevel) {
    return await this.safeExecute('behavioral_profiles.updateMoodAndEnergy', [
      mood, energyLevel, userId
    ]);
  }

  // ODSTRANĚNO: logEmotionalState - emoce jsou v profilu, ne v logu

  // ODSTRANĚNO: getCurrentEmotion - emoce jsou v profilu

  // ODSTRANĚNO: saveBehaviorPattern - robot neukládá vlastní vzory
  // ODSTRANĚNO: getCachedBehaviorPattern - žádná cache vzorů

  async initializeBehavioralProfiles() {
    return await this.safeExecute('behavioral_profiles.initializeAllProfiles');
  }

  // =========================================================
  // GROUPS - Správa FB skupin
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
    return await this.safeExecute('groups.updateNextSeen', [minutes, groupId]);
  }

  // =========================================================
  // VARIABLES - Správa systémových proměnných
  // =========================================================

  async getVariable(name) {
    const result = await this.safeQueryFirst('system.getVariable', [name]);
    return result ? result.value : null;
  }

  async setVariable(name, value) {
    return await this.safeExecute('system.setVariable', [name, value]);
  }

  // =========================================================
  // SYSTEM - Systémové funkce
  // =========================================================

  async heartBeat(userId = 0, groupId = 0, version = 'unknown') {
    return await this.safeExecute('system.heartBeat', [
      hostname, userId, groupId, version, userId, groupId, version
    ]);
  }

  async heartBeatExtended(params) {
    const { hostname, version, userId, action, actionStartedAt } = params;
    
    // Konvertovat timestamp na DATETIME nebo NULL
    let actionStartedAtFormatted = null;
    if (actionStartedAt) {
      actionStartedAtFormatted = new Date(actionStartedAt).toISOString().slice(0, 19).replace('T', ' ');
    }
    
    // Porovnat s předchozím stavem pro detekci změn
    const currentState = `${userId || 'null'}_${action || 'null'}_${actionStartedAtFormatted || 'null'}`;
    if (this._lastHeartbeatState !== currentState) {
      this._lastHeartbeatState = currentState;
      if (userId || action) {
        const { Log } = await import('./iv_log.class.js');
        await Log.info('[HEARTBEAT]', `State changed: User ${userId || 'none'}, Action: ${action || 'none'}`);
      }
    }
    
    // Aktualizovat heartbeat
    await this.safeExecute('system.heartBeatExtended', [
      hostname, userId, version, action, actionStartedAtFormatted, userId, version, action, actionStartedAtFormatted
    ]);
    
    // Získat UI příkaz a verzi z databáze
    const uiCommand = await this.getUICommand();
    const dbVersion = await this.getVersionCode();
    
    return {
      uiCommand,
      dbVersion: dbVersion?.code || null
    };
  }

  async getVersionCode() {
    return await this.safeQueryFirst('system.getVersionCode');
  }

  async getUICommand() {
    const result = await this.safeQueryFirst('system.getUICommand', [hostname]);
    
    // Log pouze při změně UI příkazu (nový ID nebo změna stavu)
    const currentUICommand = result ? `${result.id}:${result.command}` : null;
    if (currentUICommand !== this._lastUICommand) {
      this._lastUICommand = currentUICommand;
      
      if (result) {
        const { Log } = await import('./iv_log.class.js');
        await Log.info('[UI_COMMAND]', `UI command found: ${result.command} (ID: ${result.id})`);
      } else if (this._lastUICommand !== null) {
        const { Log } = await import('./iv_log.class.js');
        await Log.info('[UI_COMMAND]', `No UI commands found`);
      }
    }
    
    return result;
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

  // updateQuoteNextSeen je duplicitní s quotes.markAsUsed - použij markQuoteAsUsed() místo toho

  async markQuoteAsUsed(quoteId, userId, days = 30) {
    // Zaznamenat použití citátu uživatelem do action_log
    const logResult = await this.logAction(userId, 'quote_post', quoteId.toString(), `Quote ${quoteId} used by user ${userId}`);
    
    // Nastavit globální cooldown na 30 dnů (aby se citáty neopakovaly)
    const cooldownResult = await this.safeExecute('quotes.markAsUsed', [days, quoteId]);
    
    return logResult && cooldownResult;
  }

  async verifyMessage(groupId, messageHash) {
    return await this.safeQueryFirst('quotes.findByHash', [messageHash]);
  }

  async verifyMsg(groupId, messageHash) {
    return await this.verifyMessage(groupId, messageHash);
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

  // Removed saveSystemMetrics - table system_metrics no longer exists

  // Removed saveMessageHash - table message_hashes no longer exists

  // =========================================================
  // COMPOSITE METHODS - Kombinované metody
  // =========================================================

  /**
   * REMOVED: Duplicitní metoda getUserWithAvailableActions byla odstraněna
   * Použije se implementace na řádku 32-34 která správně volá SQL dotaz
   */

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
  async debugUserSelectionIssue(host = hostname) {

    try {
      const allUsers = await this.getUsersByHostname(host);
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

      Log.debug('[SQL]', 'User selection debug:', results);

      return results;

    } catch (err) {
      await Log.error('[SQL][DEBUG]', `debugUserSelectionIssue error: ${err.message}`);
      
      // Re-throw function-not-found errors to ensure fail-fast behavior
      if (err.message.includes('is not a function') || err.message.includes('Query not found')) {
        throw err;
      }
      
      return null;
    }
  }

  /**
   * Pokročilá verifikace zprávy s detailním logováním
   */
  async verifyMessageAdvanced(groupId, messageHash) {

    try {
        Log.debug('[SQL]', `Checking message duplicate: group ${groupId}, hash ${messageHash.substring(0, 8)}...`);

      const result = await this.verifyMessage(groupId, messageHash);

      if (result) {
          Log.debug('[SQL]', `Found duplicate message with hash ${messageHash.substring(0, 8)} (ID: ${result.id})`);
        return { c: 1, id: result.id };
      }

        Log.debug('[SQL]', `No duplicate found for hash ${messageHash.substring(0, 8)}`);

      return { c: 0 };

    } catch (err) {
      await Log.error('[SQL]', `verifyMessageAdvanced error: ${err.message}`);
      
      // Re-throw function-not-found errors to ensure fail-fast behavior
      if (err.message.includes('is not a function') || err.message.includes('Query not found')) {
        throw err;
      }
      
      return { c: 0 };
    }
  }

  /**
   * Store message s pokročilým logováním
   */
  async storeMessageAdvanced(userId, text, groupId = null) {

    try {
        Log.debug('[SQL]', `Storing message: user ${userId}, text length: ${text.length}`);

      const result = await this.storeMessage(userId, text, null);

        Log.debug('[SQL]', `Message stored successfully`);

      return result;

    } catch (err) {
      await Log.error('[SQL]', `storeMessageAdvanced error: ${err.message}`);
      
      // Re-throw function-not-found errors to ensure fail-fast behavior
      if (err.message.includes('is not a function') || err.message.includes('Query not found')) {
        throw err;
      }
      
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
  async validateSQLModules() {
    const requiredModules = ['users', 'actions', 'groups', 'limits', 'system', 'quotes', 'logs'];
    const missing = requiredModules.filter(module => !this.SQL[module]);

    if (missing.length > 0) {
      await Log.error('[QueryBuilder]', `Missing SQL modules: ${missing.join(', ')}`);
      return false;
    }

    return true;
  }

  // =========================================================
  // HOSTNAME PROTECTION - Ochrana proti lavině banů
  // =========================================================

  async isHostnameBlocked(hostname) {
    try {
      const variableName = `hostname_block_${hostname}`;
      const result = await this.safeQueryFirst('system.getVariable', [variableName]);
      
      if (!result || !result.value) {
        return null;
      }

      const blockData = JSON.parse(result.value);
      const blockedUntil = new Date(blockData.blocked_until);
      const now = new Date();

      // If block has expired, remove it
      if (blockedUntil <= now) {
        await this.safeExecute('system.deleteVariable', [variableName]);
        return null;
      }

      // Add remaining minutes calculation
      const remainingMinutes = Math.ceil((blockedUntil - now) / 1000 / 60);
      
      return {
        hostname: hostname,
        blocked_until: blockData.blocked_until,
        blocked_reason: blockData.blocked_reason,
        blocked_user_id: blockData.blocked_user_id,
        remaining_minutes: remainingMinutes
      };
    } catch (err) {
      console.error('Error checking hostname block:', err);
      return null;
    }
  }

  async blockHostname(hostname, userId, reason, minutes = 60) {
    try {
      const blockedUntil = new Date(Date.now() + minutes * 60 * 1000);
      const blockedUntilStr = blockedUntil.toISOString().slice(0, 19).replace('T', ' ');
      
      const blockData = {
        hostname: hostname,
        blocked_until: blockedUntilStr,
        blocked_reason: reason,
        blocked_user_id: userId,
        created_at: new Date().toISOString().slice(0, 19).replace('T', ' ')
      };

      const variableName = `hostname_block_${hostname}`;
      const result = await this.safeExecute('system.setVariable', [
        variableName,
        JSON.stringify(blockData),
        'json'
      ]);

      return result && result.affectedRows > 0;
    } catch (err) {
      console.error('Error blocking hostname:', err);
      return false;
    }
  }

  async unblockHostname(hostname) {
    try {
      const variableName = `hostname_block_${hostname}`;
      const result = await this.safeExecute('system.deleteVariable', [variableName]);
      return result && result.affectedRows > 0;
    } catch (err) {
      console.error('Error unblocking hostname:', err);
      return false;
    }
  }

  async getActiveHostnameBlocks() {
    try {
      const results = await this.safeQueryAll('system.getVariablesByPrefix', ['hostname_block_']);
      const activeBlocks = [];

      for (const row of results || []) {
        try {
          const blockData = JSON.parse(row.value);
          const blockedUntil = new Date(blockData.blocked_until);
          const now = new Date();

          if (blockedUntil > now) {
            const remainingMinutes = Math.ceil((blockedUntil - now) / 1000 / 60);
            activeBlocks.push({
              hostname: blockData.hostname,
              blocked_until: blockData.blocked_until,
              blocked_reason: blockData.blocked_reason,
              blocked_user_id: blockData.blocked_user_id,
              remaining_minutes: remainingMinutes
            });
          } else {
            // Remove expired block
            await this.safeExecute('system.deleteVariable', [row.name]);
          }
        } catch (parseErr) {
          console.error('Error parsing hostname block data:', parseErr);
        }
      }

      return activeBlocks;
    } catch (err) {
      console.error('Error getting active hostname blocks:', err);
      return [];
    }
  }

  async cleanExpiredHostnameBlocks() {
    try {
      const results = await this.safeQueryAll('system.getVariablesByPrefix', ['hostname_block_']);
      let cleanedCount = 0;

      for (const row of results || []) {
        try {
          const blockData = JSON.parse(row.value);
          const blockedUntil = new Date(blockData.blocked_until);
          const now = new Date();

          if (blockedUntil <= now) {
            await this.safeExecute('system.deleteVariable', [row.name]);
            cleanedCount++;
          }
        } catch (parseErr) {
          console.error('Error parsing hostname block data:', parseErr);
          // Remove invalid entries
          await this.safeExecute('system.deleteVariable', [row.name]);
          cleanedCount++;
        }
      }

      return { affectedRows: cleanedCount };
    } catch (err) {
      console.error('Error cleaning expired hostname blocks:', err);
      return { affectedRows: 0 };
    }
  }

  // =========================================================
  // USER-GROUP BLOCKING - Per-user group blocking systém
  // =========================================================

  async isUserGroupBlocked(userId, groupId) {
    const result = await this.safeQueryFirst('user_group_blocking.isUserGroupBlocked', [userId, groupId]);
    return result || null;
  }

  async blockUserGroup(userId, groupId, blockedUntil, reason) {
    return await this.safeExecute('user_group_blocking.blockUserGroup', [
      blockedUntil, reason, userId, groupId
    ]);
  }

  async getAvailableGroupsForUserBlocking(userId, groupType) {
    return await this.safeQueryAll('user_group_blocking.getAvailableGroupsForUser', [userId, groupType]);
  }

  async getUserGroupBlockStats(userId) {
    return await this.safeQueryFirst('user_group_blocking.getUserGroupBlockStats', [userId]);
  }

  async cleanExpiredUserGroupBlocks() {
    return await this.safeExecute('user_group_blocking.unblockExpiredUserGroups');
  }

  // =========================================================
  // SYSTEM LOG METHODS - Systémový log
  // =========================================================

  /**
   * Vloží záznam do systémového logu
   */
  async logSystemEvent(eventType, eventLevel, message, details = null, userId = null, processId = null) {
    const hostname = os.hostname();
    
    return await this.safeExecute('system.insertSystemLog', [
      hostname,
      eventType,
      eventLevel,
      message,
      details ? JSON.stringify(details) : null,
      userId,
      processId || process.pid
    ]);
  }

  /**
   * Získá systémové logy pro aktuální hostname
   */
  async getSystemLogs(hours = 24, limit = 100) {
    const hostname = os.hostname();
    
    return await this.safeQueryAll('system.getSystemLogs', [hostname, hours, limit]);
  }

  /**
   * Získá všechny systémové logy ze všech hostnames
   */
  async getAllSystemLogs(hours = 24, limit = 100) {
    return await this.safeQueryAll('system.getAllSystemLogs', [hours, limit]);
  }

  /**
   * Získá statistiky systémového logu
   */
  async getSystemLogStats(hours = 24) {
    return await this.safeQueryAll('system.getSystemLogStats', [hours]);
  }

  /**
   * Vyčistí staré systémové logy
   */
  async cleanOldSystemLogs(days = 30) {
    return await this.safeExecute('system.cleanOldSystemLogs', [days]);
  }

  // =========================================================
  // GROUP DETAILS - Removed - tables group_details and discovered_group_links no longer exist
  // =========================================================

  // =========================================================
  // REFACTORED METHODS - Nové metody pro refaktorovanou logiku
  // =========================================================

  async getRecentJoinGroupAction(userId, actionCode) {
    return this.safeQueryFirst('actions.getRecentJoinGroupAction', [userId, actionCode]);
  }

  async blockUserGroup(userId, groupId, reason, days) {
    const blockedUntil = new Date();
    blockedUntil.setDate(blockedUntil.getDate() + days);
    // Používáme stávající dotaz, ale s logikou pro výpočet data
    return await this.safeExecute('user_group_blocking.blockUserGroup', [blockedUntil, reason, userId, groupId]);
  }

  async getSingleAvailableGroup(userId, groupType) {
    return this.safeQueryFirst('groups.getSingleAvailableGroup', [userId, groupType]);
  }

  /**
   * Extrahuje fb_id z Facebook group URL
   * @param {string} url - Facebook group URL
   * @returns {string|null} - Čisté fb_id nebo null
   */
  extractFbIdFromUrl(url) {
    try {
      // Vzory: https://www.facebook.com/groups/123456789/
      //        https://facebook.com/groups/groupname/
      //        /groups/123456789
      const match = url.match(/\/groups\/([^\/\?#]+)/);
      return match ? match[1] : null;
    } catch (err) {
      return null;
    }
  }

  // Removed saveDiscoveredLinks and saveGroupExplorationDetails - tables no longer exist

  // =========================================================
  // USER_GROUPS - Správa členství uživatelů ve skupinách
  // =========================================================

  /**
   * Uloží žádost o členství uživatele ve skupině
   * @param {number} userId - ID uživatele
   * @param {number} groupId - ID skupiny
   * @param {string} note - Poznámka k žádosti
   * @returns {Promise<boolean>} True pokud bylo úspěšné
   */
  async insertUserGroupMembership(userId, groupId, note = 'Žádost o členství') {
    const query = `
      INSERT INTO user_groups (user_id, group_id, type, note, time) 
      VALUES (?, ?, 1, ?, NOW())
      ON DUPLICATE KEY UPDATE 
        type = VALUES(type),
        note = VALUES(note), 
        time = NOW()
    `;
    
    try {
      const result = await this.safeExecute(query, [userId, groupId, note]);
      return result && result.affectedRows > 0;
    } catch (error) {
      await Log.error('[DB]', `Chyba při ukládání členství uživatele ${userId} ve skupině ${groupId}: ${error.message}`);
      return false;
    }
  }
}
