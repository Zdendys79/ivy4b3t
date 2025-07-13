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

import { db } from './iv_sql.js'
import { Log } from './iv_log.class.js';

// Jednoduchá proměnná pro invasive lock (pouze timestamp)
// Program pracuje vždy jen s jedním uživatelem v jednom okamžiku
let invasiveLock = null;

/**
 * Inicializuje invasive lock na začátku práce s uživatelem
 */
export function initInvasiveLock() {
  invasiveLock = null;
  Log.debug('[WHEEL]', 'Invasive lock inicializován');
}

/**
 * Nastaví invasive lock
 */
export function setInvasiveLock(cooldownMs) {
  invasiveLock = Date.now() + cooldownMs;
  Log.debug('[WHEEL]', `Invasive lock nastaven do ${new Date(invasiveLock).toLocaleTimeString()}`);
}

/**
 * Zkontroluje zda je aktivní invasive lock
 */
export function hasInvasiveLock() {
  if (!invasiveLock) {
    return { hasLock: false, reason: 'Žádný invasive lock' };
  }

  const now = Date.now();
  if (now >= invasiveLock) {
    return { hasLock: false, reason: 'Invasive lock vypršel' };
  }

  const remainingMs = invasiveLock - now;
  return {
    hasLock: true,
    remainingMs: remainingMs,
    remainingSeconds: Math.ceil(remainingMs / 1000),
    lockUntil: invasiveLock,
    reason: `Invasive lock aktivní - zbývá ${Math.ceil(remainingMs / 1000)}s`
  };
}

/**
 * Vymaže invasive lock na konci práce s uživatelem
 */
export function clearInvasiveLock() {
  invasiveLock = null;
  Log.debug('[WHEEL]', 'Invasive lock vymazán');
}

/**
 * Zkontroluje zda je akce invazní (dle databáze action_definitions)
 */
async function isInvasiveAction(actionCode) {
  try {
    const actionDef = await db.safeQueryFirst('actions.getDefinitionByCode', [actionCode]);
    return actionDef?.invasive === 1 || actionDef?.invasive === true;
  } catch (err) {
    await Log.warn('[WHEEL]', `Chyba při kontrole invasive pro ${actionCode}: ${err.message}`);
    // Fallback na statický seznam
    const invasiveActions = ['post_utio_g', 'post_utio_gv', 'post_utio_p', 'quote_post', 'comment_post'];
    return invasiveActions.includes(actionCode);
  }
}


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

  if (!userId) {
    await Log.warn('[WHEEL]', 'Nebylo zadáno userId - nemohu zkontrolovat limity');
    return null;
  }

  try {
    // Zkontroluj invasive lock v paměti
    const lockStatus = hasInvasiveLock();
    
    if (lockStatus.hasLock) {
      Log.info('[WHEEL]', `User ${userId}: ${lockStatus.reason}`);
    }

    // Získej akce přímo z databáze s aplikovanými limity
    const actionsWithLimits = await db.getUserActionsWithLimits(userId);

    if (!actionsWithLimits || !actionsWithLimits.length) {
      await Log.warn('[WHEEL]', `Žádné dostupné akce pro uživatele ${userId}`);
      return null;
    }

    // Sestavíme kolo s effective_weight a označíme invazní akce z databáze
    let wheelItems = actionsWithLimits.map(def => ({
        code: def.action_code,
        weight: def.weight,
        effective_weight: def.effective_weight,
        min_minutes: def.min_minutes,
        max_minutes: def.max_minutes,
        repeatable: def.repeatable,
        is_invasive: def.invasive === 1 || def.invasive === true
    }));

    // Filtruj invazní akce během invasive lock
    if (lockStatus.hasLock) {
      const originalItems = [...wheelItems];
      wheelItems = wheelItems.filter(item => !item.is_invasive);
      
      const filteredCount = originalItems.length - wheelItems.length;
      if (filteredCount > 0) {
        Log.info('[WHEEL]', `User ${userId}: Odstraněno ${filteredCount} invazních akcí kvůli aktivnímu zámku (zbývá ${lockStatus.remainingSeconds}s)`);
      }
    }

    const wheel = new Wheel(wheelItems);
    const stats = wheel.getStats();

    Log.debug('[WHEEL]', `User ${userId} wheel stats:`, stats);

    const postUtioActions = wheelItems.filter(item => item.code.startsWith('post_utio_'));
    const blockedPostUtio = postUtioActions.filter(item => item.effective_weight === 0);

    if (blockedPostUtio.length > 0) {
      Log.debug('[WHEEL]', `Blocked post_utio actions: ${blockedPostUtio.map(a => a.code).join(', ')}`);
    }

    const pickedCode = wheel.pick();
    if (!pickedCode) {
      await Log.warn('[WHEEL]', `Kolo štěstí nevrátilo žádnou akci pro uživatele ${userId}`);
      return null;
    }

    // Najdi a vrať vybraný objekt
    const selected = wheelItems.find(item => item.code === pickedCode);
    if (!selected) {
      await Log.error('[WHEEL]', `Vybraná akce ${pickedCode} nebyla nalezena v seznamu`);
      return null;
    }

    Log.info('[WHEEL]', `Vybrána akce: ${selected.code} (weight: ${selected.weight}, effective: ${selected.effective_weight})`);

    return {
      code: selected.code,
      weight: selected.weight,
      min_minutes: selected.min_minutes,
      max_minutes: selected.max_minutes,
      repeatable: selected.repeatable,
      invasive: selected.is_invasive
    };

  } catch (err) {
    await Log.error('[WHEEL]', `Chyba při výběru akce pro uživatele ${userId}: ${err.message}`);
    return null;
  }
}

/**
 * Získá detailní statistiky akcí pro uživatele
 * @param {number} userId - ID uživatele
 * @returns {Promise<Object|null>} - Statistiky akcí
 */
export async function getActionStats(userId) {

  try {
    const actionsWithLimits = await db.getUserActionsWithLimits(userId);
    const allLimitsUsage = await db.getUserAllLimitsWithUsage(userId);

    if (!actionsWithLimits) {
      await Log.warn('[WHEEL]', `Nepodařilo se získat akce pro uživatele ${userId}`);
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

    Log.debug('[WHEEL]', `Action stats for user ${userId}:`, stats);

    return stats;

  } catch (err) {
    await Log.error('[WHEEL]', `Chyba při získávání statistik pro uživatele ${userId}: ${err.message}`);
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
    await Log.error('[WHEEL]', `Chyba při kontrole dostupných akcí pro uživatele ${userId}: ${err.message}`);
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
    await Log.error('[WHEEL]', `Chyba při získávání doporučení pro uživatele ${userId}: ${err.message}`);
    return null;
  }
}

/**
 * Zpětná kompatibilita - stará funkce pro filtrování akcí
 * @deprecated Používej getRandomAction s userId
 */
async function filterPostUtioActions(userId, actions) {
  await Log.warn('[WHEEL]', 'filterPostUtioActions je deprecated - používej getRandomAction s userId');

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
    await Log.error('[WHEEL]', `Chyba při filtrování akcí: ${err.message}`);
    return actions;
  }
}
