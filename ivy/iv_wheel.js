/**
 * Název souboru: iv_wheel.js
 * Umístění: ~/ivy/iv_wheel.js
 *
 * Popis: Wheel of Fortune – výběr náhodné aktivity na základě váhy
 *        (vrátí objekt { code, weight, min_minutes, max_minutes }).
 */
import * as db from './iv_sql.js';

class Wheel {
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

export async function getRandomActionCode(user) {
  // Načteme všechny definice (včetně weight, min_minutes, max_minutes)
  const defs = await db.getActionDefinitions();

  // DEBUG: výpis načtených definic
  console.log('--- DEBUG: action_definitions ---');
  defs.forEach(d => {
    console.log(
      `  code=${d.action_code}, weight=${d.weight}, ` +
      `min=${d.min_minutes}, max=${d.max_minutes}`
    );
  });
  console.log('--- konec DEBUG ---');

  // Připravíme pole objektů s váhami a intervaly
  const wheelItems = defs.map(def => ({
    code: def.action_code,
    weight: def.weight,
    min_minutes: def.min_minutes,
    max_minutes: def.max_minutes
  }));

  if (!wheelItems.length) {
    console.warn('[iv_wheel] Žádné aktivní definice akcí.');
    return null;
  }

  // Vybereme náhodně podle váhy
  const wheel = new Wheel(wheelItems);
  const pickedCode = wheel.pick();

  // Najdeme a vrátíme celou „item“ (máme i min/max)
  return wheelItems.find(item => item.code === pickedCode) || null;
}
