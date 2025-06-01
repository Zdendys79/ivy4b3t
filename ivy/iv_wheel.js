/**
 * Soubor: iv_wheel.js
 * Umístění: ~/ivy/iv_wheel.js
 *
 * Purpose: Wheel of Fortune – výběr náhodné aktivity
 *          pouze z aktuálně dostupných akcí (tj. z getUserActions).
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

export async function getRandomAction(user) {
  // 1) Nejdřív zjistíme, jaké akce jsou pro tohoto uživatele skutečně NAPŘ. "dostupné"
  const availableRows = await db.getUserActions(user.id);
  // DEBUG: vypíše např. ["comment","quote_post",…], ale NE "account_delay"/"account_sleep"
  console.log(`--- DEBUG: getUserActions pro user.id=${user.id} ---`);
  console.log(availableRows.map(r => r.action_code).join(', ') || 'Žádné');
  console.log('--- konec DEBUG ---');

  // 2) Načteme kompletní seznam definic (abychom znali váhy a intervaly)
  const defs = await db.getActionDefinitions();
  // DEBUG: všechny aktivní definice (včetně těch, které teď NEPOUŽIJEME)
  console.log('--- DEBUG: action_definitions ---');
  defs.forEach(d => {
    console.log(
      `  code=${d.action_code}, weight=${d.weight}, ` +
      `min=${d.min_minutes}, max=${d.max_minutes}`
    );
  });
  console.log('--- konec DEBUG ---');

  // 3) Z defs vybereme jen ty řádky, které jsou v availableRows
  const filteredDefs = defs.filter(def =>
    availableRows.some(a => a.action_code === def.action_code)
  );

  if (!filteredDefs.length) {
    console.warn('[iv_wheel] Žádné “dostupné” definice na výběr.');
    return null;
  }

  // 4) Sestavíme “kolo” jen z této podmnožiny
  const wheelItems = filteredDefs.map(def => ({
    code: def.action_code,
    weight: def.weight,
    min_minutes: def.min_minutes,
    max_minutes: def.max_minutes
  }));

  const wheel = new Wheel(wheelItems);
  const pickedCode = wheel.pick();

  // 5) Najdeme tu definici z wheelItems a vrátíme celý objekt
  return wheelItems.find(item => item.code === pickedCode) || null;
}
