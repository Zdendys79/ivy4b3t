/**
 * Název souboru: iv_action_stats.class.js
 * Umístění: ~/ivy/libs/iv_action_stats.class.js
 *
 * Popis: Třída pro statistiky a analýzu akcí
 * - Získává statistiky akcí pro uživatele
 * - Poskytuje doporučení
 * - Analyzuje limity
 */

import { db } from '../iv_sql.js';
import { Log } from './iv_log.class.js';

export class ActionStats {
  /**
   * Získá detailní statistiky akcí pro uživatele
   * @param {number} userId - ID uživatele
   * @returns {Promise<Object|null>} - Statistiky akcí
   */
  async getStats(userId) {
    try {
      const actionsWithLimits = await db.getUserActionsWithLimits(userId);
      const allLimitsUsage = await db.getUserAllLimitsWithUsage(userId);

      if (!actionsWithLimits) {
        await Log.warn('[ACTION_STATS]', `Nepodařilo se získat akce pro uživatele ${userId}`);
        return null;
      }

      const postUtioActions = actionsWithLimits.filter(a => a.action_code.startsWith('post_utio_'));
      const otherActions = actionsWithLimits.filter(a => !a.action_code.startsWith('post_utio_'));

      const stats = {
        user_id: userId,
        total_actions: actionsWithLimits.length,
        available_actions: actionsWithLimits.filter(a => a.effective_weight > 0).length,
        blocked_by_limits: actionsWithLimits.filter(a => a.effective_weight === 0).length,

        post_utio_actions: {
          total: postUtioActions.length,
          available: postUtioActions.filter(a => a.effective_weight > 0).length,
          blocked: postUtioActions.filter(a => a.effective_weight === 0).length
        },

        other_actions: {
          total: otherActions.length,
          available: otherActions.filter(a => a.effective_weight > 0).length,
          blocked: otherActions.filter(a => a.effective_weight === 0).length
        },

        limits_usage: allLimitsUsage ? allLimitsUsage.map(limit => ({
          group_type: limit.group_type,
          usage_percent: limit.usage_percent,
          current_posts: limit.current_posts,
          max_posts: limit.max_posts,
          remaining_posts: limit.remaining_posts,
          max_posts_per_cycle: limit.max_posts_per_cycle
        })) : [],

        blocked_actions: actionsWithLimits
          .filter(a => a.effective_weight === 0)
          .map(a => a.action_code)
      };

      Log.debug('[ACTION_STATS]', `Stats for user ${userId}:`, stats);
      return stats;

    } catch (err) {
      await Log.error('[ACTION_STATS]', `Chyba při získávání statistik pro uživatele ${userId}: ${err.message}`);
      return null;
    }
  }

  /**
   * Zkontroluje zda má uživatel dostupné akce k provedení
   * @param {number} userId - ID uživatele
   * @returns {Promise<boolean>} - True pokud má dostupné akce
   */
  async hasAvailableActions(userId) {
    try {
      const stats = await this.getStats(userId);
      return stats && stats.available_actions > 0;
    } catch (err) {
      await Log.error('[ACTION_STATS]', `Chyba při kontrole dostupných akcí pro uživatele ${userId}: ${err.message}`);
      return false;
    }
  }

  /**
   * Získá doporučení pro akce podle aktuálního stavu limitů
   * @param {number} userId - ID uživatele
   * @returns {Promise<Object|null>} - Doporučení pro uživatele
   */
  async getRecommendations(userId) {
    try {
      const stats = await this.getStats(userId);
      if (!stats) return null;

      const recommendations = {
        user_id: userId,
        can_take_action: stats.available_actions > 0,
        recommendations: []
      };

      // Doporučení pro post_utio akce
      if (stats.limits_usage) {
        for (const limit of stats.limits_usage) {
          if (limit.remaining_posts > 0) {
            const cycleRecommendation = Math.min(
              Math.floor(limit.max_posts / 3),
              limit.remaining_posts
            );

            recommendations.recommendations.push({
              action_type: `post_utio_${limit.group_type.toLowerCase()}`,
              recommended_posts_this_cycle: cycleRecommendation,
              reason: `${limit.remaining_posts} postů zbývá z ${limit.max_posts} denního limitu`
            });
          } else if (limit.current_posts >= limit.max_posts) {
            recommendations.recommendations.push({
              action_type: `post_utio_${limit.group_type.toLowerCase()}`,
              recommended_posts_this_cycle: 0,
              reason: `Denní limit ${limit.max_posts} postů již dosažen`
            });
          }
        }
      }

      // Doporučení pro ostatní akce
      if (stats.other_actions.available > 0) {
        recommendations.recommendations.push({
          action_type: 'other_actions',
          available_count: stats.other_actions.available,
          reason: 'Jiné akce bez limitů dostupné'
        });
      }

      return recommendations;

    } catch (err) {
      await Log.error('[ACTION_STATS]', `Chyba při získávání doporučení pro uživatele ${userId}: ${err.message}`);
      return null;
    }
  }
}