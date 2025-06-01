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

/**
 * Vrátí  objekt { code, weight, min_minutes, max_minutes }
 * náhodně vybraný ze seznamu skutečně dostupných akcí pro daného uživatele.
 * Pokud nejsou k dispozici žádné jiné akce než account_delay/account_sleep,
 * ty se vyřadí.
 */
export async function getRandomAction(user) {
  // 1) Zjistíme, jaké akce jsou uživateli skutečně dostupné
  const availableRows = await db.getUserActions(user.id);
  console.log(`--- DEBUG: getUserActions pro user.id=${user.id} ---`);
  console.log(availableRows.map(r => r.action_code).join(', ') || 'Žádné');
  console.log('--- konec DEBUG ---');

  // 2) Načteme všechny aktivní definice, abychom znali váhy a intervaly
  const defs = await db.getActionDefinitions();
  console.log('--- DEBUG: action_definitions ---');
  defs.forEach(d => {
    console.log(
      `  code=${d.action_code}, weight=${d.weight}, ` +
      `min=${d.min_minutes}, max=${d.max_minutes}`
    );
  });
  console.log('--- konec DEBUG ---');

  // 3) Ze všech definic vybereme jen ty, jejichž action_code je v availableRows
  const filteredDefs = defs.filter(def =>
    availableRows.some(a => a.action_code === def.action_code)
  );

  if (!filteredDefs.length) {
    console.warn('[iv_wheel] Žádné “dostupné” definice na výběr.');
    return null;
  }

  // 4) Sestavíme "kolo" jen z filtrovaných definic
  const wheelItems = filteredDefs.map(def => ({
    code: def.action_code,
    weight: def.weight,
    min_minutes: def.min_minutes,
    max_minutes: def.max_minutes
  }));

  const wheel = new Wheel(wheelItems);
  const pickedCode = wheel.pick();

  // 5) Vraťeme celý objekt (obsahuje i min/max) pro vybraný code
  return wheelItems.find(item => item.code === pickedCode) || null;
}
