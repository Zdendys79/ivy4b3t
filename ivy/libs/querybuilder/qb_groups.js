/**
 * QueryBuilder mixin: Groups
 * Správa FB skupin - getGroupById, getAvailableGroups, etc.
 */

import { Log } from '../iv_log.class.js';

export const GroupsMixin = {

  async getGroupById(id) {
    return await this.safeQueryFirst('groups.getById', [id]);
  },

  async getAvailableGroups(groupType, userId) {
    return await this.safeQueryAll('groups.getAvailableByType', [groupType, userId]);
  },

  async updateGroupLastSeen(groupId) {
    return await this.safeExecute('groups.updateLastSeen', [groupId]);
  },

  async updateGroupNextSeen(groupId, minutes) {
    return await this.safeExecute('groups.updateNextSeen', [minutes, groupId]);
  },

  async getSingleAvailableGroup(userId, groupType) {
    return this.safeQueryFirst('groups.getSingleAvailableGroup', [userId, groupType]);
  },

  /**
   * Uloží žádost o členství uživatele ve skupině
   * @param {number} userId - ID uživatele
   * @param {number} groupId - ID skupiny
   * @param {string} note - Poznámka k žádosti
   * @returns {Promise<boolean>} True pokud bylo úspěšné
   */
  async getGroupsForAudit(userId, limit = 5) {
    return await this.safeQueryAll('groups.getGroupsForAudit', [userId, limit], true);
  },

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

};
