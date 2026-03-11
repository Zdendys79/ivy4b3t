/**
 * QueryBuilder mixin: Hostname Block
 * Ochrana proti lavině banů - isHostnameBlocked, blockHostname, etc.
 */

export const HostnameBlockMixin = {

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
  },

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
  },

  async unblockHostname(hostname) {
    try {
      const variableName = `hostname_block_${hostname}`;
      const result = await this.safeExecute('system.deleteVariable', [variableName]);
      return result && result.affectedRows > 0;
    } catch (err) {
      console.error('Error unblocking hostname:', err);
      return false;
    }
  },

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
  },

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

};
