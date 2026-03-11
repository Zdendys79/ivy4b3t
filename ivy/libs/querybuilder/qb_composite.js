/**
 * QueryBuilder mixin: Composite Methods
 * Kombinované metody, debug, utility - advanced methods that combine multiple domains
 */

import os from 'node:os';

import { Log } from '../iv_log.class.js';

const hostname = os.hostname();

export const CompositeMixin = {

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
  },

  /**
   * User log wrapper function
   */
  async userLog(user, actionCode, referenceId, text) {
    const userId = typeof user === 'object' ? user.id : user;
    return await this.logAction(userId, actionCode, referenceId, text);
  },

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
  },

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
  },

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
  },

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
  },

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
  },

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

};
