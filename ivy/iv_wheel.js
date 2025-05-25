/**
 * File: ivy/iv_wheel.js
 * Path: ivy/iv_wheel.js
 * Purpose: Wheel of Fortune – výběr náhodné aktivity na základě vah v tabulce action_definitions.
 */
import * as db from './iv_sql.js';

export class Wheel {
  constructor(activities) {
    // activities = [{ code, weight }]
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
  const activities = defs.map(def => ({
    code: def.action_code,
    weight: def.weight
  }));
  const wheel = new Wheel(activities);
  return wheel.pick();
}
