/**
 * Název souboru: iv_wheel.js (přepracovaná verze)
 * Umístění: ~/ivy/iv_wheel.js
 *
 * Popis: Vylepšené kolo štěstí s integrovanou kontrolou limitů uživatele.
 * Klíčové změny:
 * - Používá databázový dotaz s filtry místo post-processing
 * - Respektuje user_group_limits přímo v SQL
 * - Lepší logování a statistiky
 * - Podpora pro opakované akce
 */

import * as db from './iv_sql.js';
import { Log } from './iv_log.class.js';
import { isDebugMode } from './iv_debug.js';

export class Wheel {
  constructor(activities) {
    // activities = [{ code, weight, min_minutes, max_minutes, effective_weight }]
    this.activities = activities;
    // Používej effective_weight místo weight pro respektování limitů
    this.totalWeight = activities.reduce((sum, a) => sum + (a.effective_weight || a.weight || 0), 0);
  }

  pick() {
    if (this.totalWeight === 0) return null;

    let r = Math.random() * this.totalWeight;
    for (const a of this.activities) {
      const weight = a.effective_weight || a.weight || 0;
      if (weight > 0 && r < weight) return a.code;
      r -= weight;
    }

    // Fallback na první dostupnou akci
    const availableActivities = this.activities.filter(a => (a.effective_weight || a.weight || 0) > 0);
    return availableActivities.length ? availableActivities[0].code : null;
  }

  getStats() {
    const totalActions = this.activities.length;
    const availableActions = this.activities.filter(a => (a.effective_weight || a.weight || 0) > 0).length;
    const blockedActions = totalActions - availableActions;

    return {
      total: totalActions,
      available: availableActions,
      blocked: blockedActions,
      total_weight: this.totalWeight
    };
  }
}

/**
 * Hlavní funkce pro získání náhodné akce s respektováním limitů
 * @param {Array} availableActions - Seznam akcí z databáze (DEPRECATED - používá se jen pro zpětnou kompatibilitu)
 * @param {number} userId - ID uživatele
 * @returns {Promise<Object|null>} - Vybraná akce nebo null
 */
export async function getRandomAction(availableActions = null, userId = null) {
  const debugMode = isDebugMode();

  if (!userId) {
    Log.warn('[WHEEL]', 'Nebylo zadáno userId - nemohu zkontrolovat limity');
    return null;
  }

  try {
    // Získej akce přímo z databáze s aplikovanými limity
    const actionsWithLimits = await db.getUserActionsWithLimits(userId);

    if (!actionsWithLimits || !actionsWithLimits.length) {
      Log.warn('[WHEEL]', `Žádné dostupné akce pro uživatele ${userId}`);
      return null;
    }

    // Sestavíme kolo s effective_weight
    const wheelItems = actionsWithLimits.map(def => ({
      code: def.action_code,
      weight: def.weight,
      effective_weight: def.effective_weight,
      min_minutes: def.min_minutes,
      max_minutes: def.max_minutes,
      repeatable: def.repeatable
    }));

    const wheel = new Wheel(wheelItems);
    const stats = wheel.getStats();

    if (debugMode) {
      Log.debug('[WHEEL]', `User ${userId} wheel stats:`, stats);

      const postUtioActions = wheelItems.filter(item => item.code.startsWith('post_utio_'));
      const blockedPostUtio = postUtioActions.filter(item => item.effective_weight === 0);

      if (blockedPostUtio.length > 0) {
        Log.debug('[WHEEL]', `Blocked post_utio actions: ${blockedPostUtio.map(a => a.code).join(', ')}`);
      }
    }

    const pickedCode = wheel.pick();
    if (!pickedCode) {
      Log.warn('[WHEEL]', `Kolo štěstí nevrátilo žádnou akci pro uživatele ${userId}`);
      return null;
    }

    // Najdi a vrať vybraný objekt
    const selected = wheelItems.find(item => item.code === pickedCode);
    if (!selected) {
      Log.error('[WHEEL]', `Vybraná akce ${pickedCode} nebyla nalezena v seznamu`);
      return null;
    }

    Log.info('[WHEEL]', `Vybrána akce: ${selected.code} (weight: ${selected.weight}, effective: ${selected.effective_weight})`);

    return {
      code: selected.code,
      weight: selected.weight,
      min_minutes: selected.min_minutes,
      max_minutes: selected.max_minutes,
      repeatable: selected.repeatable
    };

  } catch (err) {
    Log.error('[WHEEL]', `Chyba při výběru akce pro uživatele ${userId}: ${err.message}`);
    return null;
  }
}

/**
 * Získá detailní statistiky akcí pro uživatele
 * @param {number} userId - ID uživatele
 * @returns {Promise<Object|null>} - Statistiky akcí
 */
export async function getActionStats(userId) {
  const debugMode = isDebugMode();

  try {
    const actionsWithLimits = await db.getUserActionsWithLimits(userId);
    const allLimitsUsage = await db.getUserAllLimitsWithUsage(userId);

    if (!actionsWithLimits) {
      Log.warn('[WHEEL]', `Nepodařilo se získat akce pro uživatele ${userId}`);
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

      limits_usage: allLimitsUsage.map(limit => ({
        group_type: limit.group_type,
        usage_percent: limit.usage_percent,
        current_posts: limit.current_posts,
        max_posts: limit.max_posts,
        remaining_posts: limit.remaining_posts,
        max_posts_per_cycle: limit.max_posts_per_cycle
      })),

      blocked_actions: actionsWithLimits
        .filter(a => a.effective_weight === 0)
        .map(a => a.action_code)
    };

    if (debugMode) {
      Log.debug('[WHEEL]', `Action stats for user ${userId}:`, stats);
    }

    return stats;

  } catch (err) {
    Log.error('[WHEEL]', `Chyba při získávání statistik pro uživatele ${userId}: ${err.message}`);
    return null;
  }
}

/**
 * Zkontroluje zda má uživatel dostupné akce k provedení
 * @param {number} userId - ID uživatele
 * @returns {Promise<boolean>} - True pokud má dostupné akce
 */
export async function hasAvailableActions(userId) {
  try {
    const stats = await getActionStats(userId);
    return stats && stats.available_actions > 0;
  } catch (err) {
    Log.error('[WHEEL]', `Chyba při kontrole dostupných akcí pro uživatele ${userId}: ${err.message}`);
    return false;
  }
}

/**
 * Získá doporučení pro akce podle aktuálního stavu limitů
 * @param {number} userId - ID uživatele
 * @returns {Promise<Object|null>} - Doporučení pro uživatele
 */
export async function getActionRecommendations(userId) {
  try {
    const stats = await getActionStats(userId);
    if (!stats) return null;

    const recommendations = {
      user_id: userId,
      can_take_action: stats.available_actions > 0,
      recommendations: []
    };

    // Doporučení pro post_utio akce
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
    Log.error('[WHEEL]', `Chyba při získávání doporučení pro uživatele ${userId}: ${err.message}`);
    return null;
  }
}

/**
 * Zpětná kompatibilita - stará funkce pro filtrování akcí
 * @deprecated Používej getRandomAction s userId
 */
async function filterPostUtioActions(userId, actions) {
  Log.warn('[WHEEL]', 'filterPostUtioActions je deprecated - používej getRandomAction s userId');

  try {
    const filteredActions = [];

    for (const action of actions) {
      if (action.action_code.startsWith('post_utio_')) {
        const groupType = action.action_code.replace('post_utio_', '').toUpperCase();
        const canPost = await db.canUserPostToGroupType(userId, groupType);

        if (canPost) {
          filteredActions.push(action);
        }
      } else {
        filteredActions.push(action);
      }
    }

    return filteredActions;
  } catch (err) {
    Log.error('[WHEEL]', `Chyba při filtrování akcí: ${err.message}`);
    return actions;
  }
}
