/**
 * File: ivy/iv_wheel.js
 * Path: ivy/iv_wheel.js
 * Purpose: Wheel of Fortune – výběr náhodné aktivity na základě vah v tabulce action_definitions.
 */
import * as db from './iv_sql.js';

class Wheel {
  constructor(activities) {
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
 * Načte definice akcí z DB a vrátí náhodný action_code.
 * @param {{ id: number }} user - objekt uživatele
 * @returns {Promise<string>} vybraný action_code
 */
export async function getRandomActionCode(user) {
  // Načtěte všechny akce, které jsou buď repeatable, nebo jednorázové (further logic can be added)
  const defs = await db.getActionDefinitions();
  if (!defs || defs.length === 0) return null;

  // DEBUG: vypsat všechny načtené definice a jejich váhy
  console.log('--- DEBUG: action_definitions ---');
  defs.forEach(d => {
     console.log(`  code=${d.action_code}, weight=${d.weight}, min=${d.min_minutes}, max=${d.max_minutes}`);
  });
  console.log('--- konec DEBUG ---');

  const activities = defs.map(def => ({
    code: def.action_code,
    weight: def.weight
  }));
  const wheel = new Wheel(activities);
  return wheel.pick();
}
