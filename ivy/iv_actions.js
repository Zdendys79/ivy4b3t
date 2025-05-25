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
import * as wait from './iv_wait.js';
import { IvMath } from './iv_math.class.js';

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
  const isNight = new Date().getHours() < 2 || new Date().getHours() >= 20;
  const minutes = isNight
    ? IvMath.parabolicRandReverse(420, 600)  // noční režim: 7-10 hodin (delší časy)
    : IvMath.rand(180, 480); // denní režim: 3-8 hodin
  await db.updateUserWorktime(user.id, minutes); // nastavit next_worktime
  await db.systemLog("account_delay", `Čekání uživatele: ${minutes} minut.`, { user_id: user.id });
  return true;
}

async function accountSleep(user) {
  console.log(`[${user.id}] Spouštím sleep režim.`);
  const minutes = IvMath.parabolicRand(24*60, 72*60);
  const hours = `${Math.floor(minutes/60)}:${Math.floor(minutes%60).toString().padStart(2, '0')}`;
  await db.updateUserWorktime(user.id, minutes); // nastavit next_worktime
  await db.systemLog("account_sleep", `Sleep na ${hours} hodin.`, { user_id: user.id });
  await db.userLog(user, 'account_sleep', hours, `Sleep mode aktivován.`);
  return true;
}
