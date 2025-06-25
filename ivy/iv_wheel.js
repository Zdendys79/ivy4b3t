/**
 * Soubor: iv_wheel.js
 * Umístění: ~/ivy/iv_wheel.js
 *
 * Purpose: Wheel of Fortune s kontrolou limitů pro post_utio akce.
 *          Vyfiltruje akce, které překračují individuální limity uživatele.
 */

import * as db from './iv_sql.js';
import { Log } from './iv_log.class.js';

export class Wheel {
  constructor(activities) {
    // activities = [{ code, weight, min_minutes, max_minutes }]
    this.activities = activities;
    this.totalWeight = activities.reduce((sum, a) => sum + a.weight, 0);
  }

  pick() {
    if (this.totalWeight === 0) return null;

    let r = Math.random() * this.totalWeight;
    for (const a of this.activities) {
      if (r < a.weight) return a.code;
      r -= a.weight;
    }
    return this.activities.length ? this.activities[0].code : null;
  }
}

/**
 * Filtruje post_utio akce podle limitů uživatele
 * @param {number} userId - ID uživatele
 * @param {Array} actions - Dostupné akce z databáze
 * @returns {Promise<Array>} - Filtrované akce respektující limity
 */
async function filterPostUtioActions(userId, actions) {
  const filteredActions = [];

  for (const action of actions) {
    // Zkontroluj jestli je to post_utio akce
    if (action.action_code.startsWith('post_utio_')) {
      // Extrahuj typ skupiny z action_code (post_utio_g -> G)
      const groupType = action.action_code.replace('post_utio_', '').toUpperCase();

      // Zkontroluj limit pro tento typ skupiny
      const canPost = await db.canUserPostToGroupType(userId, groupType);

      if (canPost) {
        filteredActions.push(action);
        Log.debug('[WHEEL]', `Post UTIO akce ${action.action_code} povolena pro user ${userId}`);
      } else {
        Log.debug('[WHEEL]', `Post UTIO akce ${action.action_code} blokována limitem pro user ${userId}`);
      }
    } else {
      // Pro ostatní akce není kontrola limitů potřeba
      filteredActions.push(action);
    }
  }

  return filteredActions;
}

/**
 * Vrátí objekt { code, weight, min_minutes, max_minutes }
 * náhodně vybraný z předaných akcí s respektováním limitů.
 */
export async function getRandomAction(availableActions, userId = null) {
  if (!availableActions || !availableActions.length) {
    Log.warn('[WHEEL]', 'Žádné dostupné akce na výběr.');
    return null;
  }

  let filteredActions = availableActions;

  // Pokud máme userId, filtruj post_utio akce podle limitů
  if (userId) {
    filteredActions = await filterPostUtioActions(userId, availableActions);
  }

  if (!filteredActions.length) {
    Log.warn('[WHEEL]', `Všechny akce jsou blokovány limity pro user ${userId}.`);
    return null;
  }

  // Sestavíme „kolo" z filtrovaných dat
  const wheelItems = filteredActions.map(def => ({
    code: def.action_code,
    weight: def.weight,
    min_minutes: def.min_minutes,
    max_minutes: def.max_minutes
  }));

  const wheel = new Wheel(wheelItems);
  const pickedCode = wheel.pick();

  // Najdeme a vrátíme vybraný objekt
  const selected = wheelItems.find(item => item.code === pickedCode) || null;

  if (selected) {
    Log.info('[WHEEL]', `Vybrána akce: ${selected.code} (weight: ${selected.weight})`);
  }

  return selected;
}

/**
 * Získá statistiky dostupných akcí pro daného uživatele
 * @param {number} userId - ID uživatele
 * @returns {Promise<Object>} - Statistiky akcí
 */
export async function getActionStats(userId) {
  try {
    const allActions = await db.getUserActions(userId);
    const filteredActions = await filterPostUtioActions(userId, allActions);

    const stats = {
      total_actions: allActions.length,
      available_actions: filteredActions.length,
      blocked_by_limits: allActions.length - filteredActions.length,
      post_utio_actions: {
        total: allActions.filter(a => a.action_code.startsWith('post_utio_')).length,
        available: filteredActions.filter(a => a.action_code.startsWith('post_utio_')).length
      },
      other_actions: {
        total: allActions.filter(a => !a.action_code.startsWith('post_utio_')).length,
        available: filteredActions.filter(a => !a.action_code.startsWith('post_utio_')).length
      }
    };

    return stats;
  } catch (err) {
    Log.error('[WHEEL] getActionStats', err);
    return null;
  }
}
