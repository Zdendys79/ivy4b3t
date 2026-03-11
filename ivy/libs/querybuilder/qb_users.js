/**
 * QueryBuilder mixin: Users
 * Správa uživatelů - getUser, getUserById, lock/unlock, worktime, etc.
 */

import os from 'node:os';

const hostname = os.hostname();

export const UsersMixin = {

  async getUser(host = hostname) {
    return await this.safeQueryFirst('users.getByHostname', [host]);
  },

  async getUserWithAvailableActions(host = hostname) {
    return await this.safeQueryFirst('users.getWithAvailableActions', [host]);
  },

  async getUserWithAvailableActionsRotational(host = hostname) {
    return await this.safeQueryFirst('users.getWithAvailableActionsRotational', [host]);
  },

  async getOldestReadyUser(host = hostname) {
    return await this.safeQueryFirst('users.getOldestReadyForHost', [host]);
  },

  async getUserById(id) {
    return await this.safeQueryFirst('users.getById', [id]);
  },

  async getUsersByHostname(host = hostname) {
    return await this.safeQueryAll('users.getByHostname', [host]);
  },

  async lockUser(id) {
    return await this.safeExecute('users.lock', [id]);
  },

  async unlockUser(id) {
    return await this.safeExecute('users.unlock', [id]);
  },

  async lockAccount(id) {
    return await this.lockUser(id);
  },

  async lockAccountWithReason(id, reason, lockType, hostname) {
    return await this.safeExecute('users.lockWithReason', [reason, lockType, id]);
  },

  async updateUserWorktime(userId, minutes) {
    return await this.safeExecute('users.updateWorktime', [minutes, userId]);
  },

  async updateUserDayCount(userId) {
    return await this.safeExecute('users.updateDayCount', [userId, userId]);
  },

  async setUserLimit(userId, dayLimit) {
    return await this.safeExecute('users.setLimit', [dayLimit, userId]);
  },

  async updateUserAddGroup(user, groupId) {
    const userId = typeof user === 'object' ? user.id : user;
    return await this.safeExecute('users.updateLastAddGroup', [userId]);
  }

};
