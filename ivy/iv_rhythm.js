/**
 * Název souboru: iv_rhythm.js
 * Umístění: ~/ivy/iv_rhythm.js
 *
 * Popis: Plánovač uživatelských akcí.
 * Spravuje plánování aktivit na základě tabulek `action_definitions` a `user_action_plan`.
 */

import { db } from './iv_sql.js'

export async function getAvailableActions(user) {
  const rows = await db.getAvailableActions(user.id);
  if (!rows || rows.length === 0) return [];
  return rows.map(r => r.action_code);
}

export async function setNextAction(user, action_code, delay_ms) {
  const nextTime = new Date(Date.now() + delay_ms);
  await db.insertToActionPlan(user.id, action_code, nextTime);
}

export async function planDefaultActions(user) {
  const defs = await db.getActionDefinitions();
  for (const def of defs) {
    const delay = randMinutes(def.min_minutes, def.max_minutes);
    await setNextAction(user, def.action_code, delay);
  }
}

export async function runAllAvailableActions(user) {
  const availableCodes = await getAvailableActions(user);
  if (availableCodes.length === 0) return [];

  const defs = await db.getActionDefinitions();
  const results = [];

  for (const def of defs) {
    if (!availableCodes.includes(def.action_code)) continue;

    const delay = randMinutes(def.min_minutes, def.max_minutes);
    if (!def.repeatable) {
      await setNextAction(user, def.action_code, delay);
    } else {
      const repeatCount = 1 + Math.floor(Math.random() * 2); // 1–2 opakování
      for (let i = 0; i < repeatCount; i++) {
        await setNextAction(user, def.action_code, delay + i * 5 * 60000); // 5min odstup
      }
    }
    results.push(def.action_code);
  }

  return results;
}

function randMinutes(min, max) {
  return (min + Math.random() * (max - min)) * 60000;
}
