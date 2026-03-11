/**
 * QueryBuilder mixin: Limits
 * Správa limitů a kvót - getUserLimit, canUserPost, etc.
 */

export const LimitsMixin = {

  async getUserLimit(userId, groupType) {
    return await this.safeQueryFirst('limits.getUserLimit', [userId, groupType]);
  },

  async getUserAllLimitsWithUsage(userId) {
    return await this.safeQueryAll('limits.getUserAllLimitsWithUsage', [userId, userId]);
  },

  async countPostsInTimeframe(userId, groupType, hours) {
    return await this.safeQueryFirst('limits.countPostsInTimeframe', [userId, groupType, hours]);
  },

  async upsertUserGroupLimit(userId, groupType, maxPosts, timeWindowHours) {
    return await this.safeExecute('limits.upsertLimit', [userId, groupType, maxPosts, timeWindowHours]);
  },

  async getMaxPostsForGroupType(userId, groupType) {
    const result = await this.safeQueryFirst('user_limits.getGroupTypeLimit', [userId, groupType]);
    return result ? result.max_posts : 0;
  },

  async canUserPost(userId, groupType) {
    const limit = await this.getUserLimit(userId, groupType);
    if (!limit) return false;

    const postCount = await this.safeQueryFirst('limits.countPostsInTimeframe', [
      userId, groupType, limit.time_window_hours
    ]);

    const currentPosts = postCount ? postCount.post_count : 0;
    return currentPosts < limit.max_posts;
  },

  async canUserPostToGroupType(userId, groupType) {
    return await this.canUserPost(userId, groupType.toUpperCase());
  },

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
  },

  async shouldRepeatUtioAction(userId, actionCode) {
    if (!actionCode.startsWith('post_utio_')) {
      return false; // Není UTIO akce
    }

    const groupType = actionCode.replace('post_utio_', '').toUpperCase();
    const limitInfo = await this.getUserCycleLimitInfo(userId, groupType);

    // Opakuj akci, pokud ještě nejsou vyčerpány posty pro tento cyklus
    return limitInfo.posts_available_this_cycle > 0;
  }

};
