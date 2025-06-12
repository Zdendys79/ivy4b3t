/**
 * Soubor: iv_wheel.js
 * Umístění: ~/ivy/iv_wheel.js
 *
 * Purpose: Wheel of Fortune – výběr náhodné aktivity pouze z
 *          toho, co vrací getUserActions (obsahuje už i weight, min/max).
 */

import * as db from './iv_sql.js';

export class Wheel {
  constructor(activities) {
    // activities = [{ code, weight, min_minutes, max_minutes }]
    this.activities = activities;
    this.totalWeight = activities.reduce((sum, a) => sum + a.weight, 0);
  }

  pick() {
    let r = Math.random() * this.totalWeight;
    for (const a of this.activities) {
      if (r < a.weight) return a.code;
      r -= a.weight;
    }
    return this.activities.length ? this.activities[0].code : null;
  }
}

/**
 * Vrátí objekt { code, weight, min_minutes, max_minutes }
 * náhodně vybraný z těch řádků, které skutečně vrátí getUserActions(user.id).
 */
export async function getRandomAction(user) {
  // 1) getUserActions nyní vrací i min_minutes, max_minutes
  const availableRows = await db.getUserActions(user.id);

  if (!availableRows.length) {
    console.warn('[iv_wheel] Žádné “dostupné” definice na výběr.');
    return null;
  }

  // 2) Sestavíme „kolo“ přímo z availableRows
  const wheelItems = availableRows.map(def => ({
    code: def.action_code,
    weight: def.weight,
    min_minutes: def.min_minutes,
    max_minutes: def.max_minutes
  }));

  const wheel = new Wheel(wheelItems);
  const pickedCode = wheel.pick();

  // 3) Najdeme a vrátíme vybraný objekt
  return wheelItems.find(item => item.code === pickedCode) || null;
}
