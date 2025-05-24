/**
 * Název souboru: iv_actions.js
 * Umístění: ~/ivy/iv_actions.js
 *
 * Popis: Obsahuje jednotlivé akce, které může uživatel vykonat v rámci "kola štěstí".
 * Každá akce odpovídá hodnotě `action_code` z tabulky `action_definitions`.
 *
 * Implementace probíhá postupně. Neimplementované akce logují varování.
 */

import * as db from './iv_sql.js';

export async function runAction(user, action_code) {
  switch (action_code) {
    case 'group_post':
      return await groupPost(user);

    case 'timeline_post':
      return await timelinePost(user);

    case 'comment':
      return await comment(user);

    case 'react':
      return await react(user);

    case 'share_post':
      return await sharePost(user);

    case 'messenger_check':
      return await messengerCheck(user);

    case 'messenger_reply':
      return await messengerReply(user);

    case 'account_delay':
      return await accountDelay(user);

    case 'account_sleep':
      return await accountSleep(user);

    default:
      console.warn(`Neznámý action_code: ${action_code}`);
      return false;
  }
}

// --- Šablony akcí ---

async function groupPost(user) {
  console.warn(`[${user.id}] Akce group_post zatím není implementována.`);
  return false;
}

async function timelinePost(user) {
  console.warn(`[${user.id}] Akce timeline_post zatím není implementována.`);
  return false;
}

async function comment(user) {
  console.warn(`[${user.id}] Akce comment zatím není implementována.`);
  return false;
}

async function react(user) {
  console.warn(`[${user.id}] Akce react zatím není implementována.`);
  return false;
}

async function sharePost(user) {
  console.warn(`[${user.id}] Akce share_post zatím není implementována.`);
  return false;
}

async function messengerCheck(user) {
  console.warn(`[${user.id}] Akce messenger_check zatím není implementována.`);
  return false;
}

async function messengerReply(user) {
  console.warn(`[${user.id}] Akce messenger_reply zatím není implementována.`);
  return false;
}

async function accountDelay(user) {
  console.log(`[${user.id}] Spouštím delay režim.`);
  const isNight = new Date().getHours() < 6 || new Date().getHours() >= 22;
  const minutes = isNight ? rand(420, 720) : rand(180, 480);
  await db.systemLog("account_delay", `Čekám ${minutes} minut.`, { user_id: user.id });
  await wait(minutes);
  return true;
}

async function accountSleep(user) {
  console.log(`[${user.id}] Spouštím sleep režim.`);
  const hours = rand(24, 72);
  await db.setWorktimeToTomorow(user.id); // nastavit next_worktime
  await db.systemLog("account_sleep", `Sleep na ${hours} hodin.`, { user_id: user.id });
  await db.userLog(user, 'account_sleep', hours, `Sleep mode aktivován.`);
  return true;
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function wait(minutes) {
  const ms = minutes * 60000;
  return new Promise(resolve => setTimeout(resolve, ms));
}
