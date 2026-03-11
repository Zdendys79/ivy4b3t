/**
 * QueryBuilder mixin: User-Group Blocking
 * Per-user group blocking systém
 */

export const UserGroupBlockMixin = {

  async isUserGroupBlocked(userId, groupId) {
    const result = await this.safeQueryFirst('userGroupBlocking.isUserGroupBlocked', [userId, groupId]);
    return result || null;
  },

  async blockUserGroup(userId, groupId, reason, days) {
    const blockedUntil = new Date();
    blockedUntil.setDate(blockedUntil.getDate() + days);
    // Používáme stávající dotaz, ale s logikou pro výpočet data
    return await this.safeExecute('userGroupBlocking.blockUserGroup', [blockedUntil, reason, userId, groupId]);
  },

  async getAvailableGroupsForUserBlocking(userId, groupType) {
    return await this.safeQueryAll('userGroupBlocking.getAvailableGroupsForUser', [userId, groupType]);
  },

  async getUserGroupBlockStats(userId) {
    return await this.safeQueryFirst('userGroupBlocking.getUserGroupBlockStats', [userId]);
  },

  async cleanExpiredUserGroupBlocks() {
    return await this.safeExecute('userGroupBlocking.unblockExpiredUserGroups');
  }

};
