/**
 * Název souboru: iv_actions.js
 * Umístění: ~/ivy/iv_actions.js
 *
 * Popis: Obsahuje jednotlivé akce, které může uživatel vykonat v rámci "kola štěstí".
 * Každá akce odpovídá hodnotě `action_code` z tabulky `action_definitions`.
 */

import * as db from './iv_sql.js';
import * as wait from './iv_wait.js';
import { IvMath } from './iv_math.class.js';

export async function runAction(user, fbBot, action_code) {
  switch (action_code) {
    case 'group_post':
      return await groupPost(user, fbBot);

    case 'timeline_post':
      return await timelinePost(user, fbBot);

    case 'comment':
      return await comment(user, fbBot);

    case 'react':
      return await react(user, fbBot);

    case 'share_post':
      return await sharePost(user, fbBot);

    case 'messenger_check':
      return await messengerCheck(user, fbBot);

    case 'messenger_reply':
      return await messengerReply(user, fbBot);

    case 'account_delay':
      return await accountDelay(user);

    case 'account_sleep':
      return await accountSleep(user);

    case 'quote_post':
      return await quotePost(user, fbBot);

    default:
      console.warn(`[${user.id}] Neznámý action_code: ${action_code}`);
      return false;
  }
}

// --- Implementované akce ---

async function accountDelay(user) {
  console.log(`[${user.id}] Spouštím delay režim.`);
  const isNight = new Date().getHours() < 2 || new Date().getHours() >= 20;
  const minutes = isNight
    ? IvMath.parabolicRandReverse(420, 600)  // noční režim: 7-10 hodin
    : IvMath.randInterval(180, 480); // denní režim: 3-8 hodin
  await db.updateUserWorktime(user, minutes);
  await db.systemLog("account_delay", `Čekání uživatele: ${minutes} minut.`, { user_id: user.id });
  await db.userLog(user, 'account_delay', minutes, `Delay mode aktivován.`);
  return true;
}

async function accountSleep(user) {
  console.log(`[${user.id}] Spouštím sleep režim.`);
  const minutes = IvMath.parabolicRand(24*60, 72*60);
  const hours = `${Math.floor(minutes/60)}:${Math.floor(minutes%60).toString().padStart(2, '0')}`;
  await db.updateUserWorktime(user.id, minutes);
  await db.systemLog("account_sleep", `Sleep na ${hours} hodin.`, { user_id: user.id });
  await db.userLog(user, 'account_sleep', hours, `Sleep mode aktivován.`);
  return true;
}

async function quotePost(user, fbBot) {
  try {
    const quote = await db.getRandomQuote(user.id);
    if (!quote) {
      console.warn(`[${user.id}] Žádný vhodný citát k dispozici.`);
      return false;
    }

    // 1) Nový prvek – vyvolat postovací dialog
    await fbBot.newThing();
    
    // 2) Vložit text citátu
    const postText = `${quote.text}${quote.author ? `\n– ${quote.author}` : ''}`;
    await fbBot.pasteStatement(postText);
    
    // 3) Kliknout „Zveřejnit“
    await fbBot.clickSendButton('Zveřejnit');

    // 4) Zapsat úspěšný log do DB
    await db.logUserAction(user.id, 'quote_post', quote.id, postText);
    await db.updateQuoteNextSeen(quote.id, 30);

    console.log(`[${user.id}] Citát zveřejněn.`);
    return true;

  } catch (err) {
    // Jediný try/catch: zachytí jakoukoli chybu z newThing/pasteStatement/clickSendButton
    console.error(`[${user.id}] quotePost selhalo: ${err.message}`);
    return false;
  }
}

// --- Šablony ostatních akcí ---
// --- NEimplementované akce ---

async function groupPost(user, fbBot) {
  console.warn(`[${user.id}] Akce group_post zatím není implementována.`);
  return false;
}

async function timelinePost(user, fbBot) {
  console.warn(`[${user.id}] Akce timeline_post zatím není implementována.`);
  return false;
}

async function comment(user, fbBot) {
  console.warn(`[${user.id}] Akce comment zatím není implementována.`);
  return false;
}

async function react(user, fbBot) {
  console.warn(`[${user.id}] Akce react zatím není implementována.`);
  return false;
}

async function sharePost(user, fbBot) {
  console.warn(`[${user.id}] Akce share_post zatím není implementována.`);
  return false;
}

async function messengerCheck(user, fbBot) {
  console.warn(`[${user.id}] Akce messenger_check zatím není implementována.`);
  return false;
}

async function messengerReply(user, fbBot) {
  console.warn(`[${user.id}] Akce messenger_reply zatím není implementována.`);
  return false;
}
