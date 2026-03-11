/**
 * QueryBuilder mixin: Actions
 * Správa akcí a plánování - getUserActions, logAction, news, etc.
 */

export const ActionsMixin = {

  async getUserActions(userId) {
    return await this.safeQueryAll('actions.getUserActions', [userId, userId]);
  },

  async getUserActionsWithLimits(userId) {
    return await this.safeQueryAll('actions.getUserActionsWithLimitsSimple', [userId, userId], true);
  },

  // News post dotazy
  async getAvailableNewsUrl() {
    return await this.safeQueryFirst('news.getAvailableUrl');
  },

  async markNewsUrlAsUsed(urlId) {
    return await this.safeExecute('news.markUrlAsUsed', [urlId]);
  },

  async logAction(accountId, actionCode, referenceId, text) {
    return await this.safeExecute('actions.logAction', [accountId, actionCode, referenceId, text]);
  },

  async logUserAction(accountId, actionCode, referenceId, text) {
    return await this.logAction(accountId, actionCode, referenceId, text);
  },

  async getUserLastJoinGroup(accountId) {
    return await this.safeQueryFirst('actions.getUserLastJoinGroup', [accountId]);
  },

  async updateActionPlan(userId, actionCode, minutes) {
    return await this.safeExecute('actions.updatePlan', [minutes, userId, actionCode]);
  },

  async initUserActionPlan(userId) {
    return await this.safeExecute('actions.initPlan', [userId]);
  },

  async getDefinitionByCode(actionCode) {
    return await this.safeQueryFirst('actions.getDefinitionByCode', [actionCode]);
  },

  async getRecentJoinGroupAction(userId, actionCode) {
    return this.safeQueryFirst('actions.getRecentJoinGroupAction', [userId, actionCode]);
  }

};
