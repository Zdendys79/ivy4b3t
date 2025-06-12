/**
 * Název souboru: iv_actions.js
 * Umístění: ~/ivy/iv_actions.js
 *
 * Popis: Obsahuje jednotlivé akce, které může uživatel vykonat v rámci "kola štěstí".
 * Každá akce odpovídá hodnotě `action_code` z tabulky `action_definitions`.
 */

import * as db from './iv_sql.js';
import { IvMath } from './iv_math.class.js';
import { Log } from './iv_log.class.js';

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
      Log.warn(`[${user.id}]`, `Neznámý action_code: ${action_code}`);
      return false;
  }
}

// --- Implementované akce ---

async function accountDelay(user) {
  Log.info(`[${user.id}]`, 'Spouštím delay režim.');
  const isNight = new Date().getHours() < 2 || new Date().getHours() >= 20;
  const minutes = isNight
    ? IvMath.parabolicRandReverse(420, 600)
    : IvMath.randInterval(180, 480);

  await db.updateUserWorktime(user, minutes);
  await db.systemLog('account_delay', `Čekání uživatele: ${minutes} minut.`, { user_id: user.id });
  await db.userLog(user, 'account_delay', minutes, `Delay mode aktivován.`);
  return true;
}

async function accountSleep(user) {
  Log.info(`[${user.id}]`, 'Spouštím sleep režim.');
  const minutes = IvMath.parabolicRand(24 * 60, 72 * 60);
  const hours = `${Math.floor(minutes / 60)}:${Math.floor(minutes % 60).toString().padStart(2, '0')}`;
  await db.updateUserWorktime(user.id, minutes);
  await db.systemLog('account_sleep', `Sleep na ${hours} hodin.`, { user_id: user.id });
  await db.userLog(user, 'account_sleep', hours, `Sleep mode aktivován.`);
  return true;
}

async function quotePost(user, fbBot) {
  try {
    const quote = await db.getRandomQuote(user.id);
    if (!quote) {
      Log.warn(`[${user.id}]`, 'Žádný vhodný citát k dispozici.');
      return false;
    }

    await fbBot.newThing();
    await fbBot.clickNewThing();
    const postText = `${quote.text}${quote.author ? `\n– ${quote.author}` : ''}`;
    await fbBot.pasteStatement(postText);
    const success = await fbBot.clickSendButton();
    if (!success) {
      Log.error(`[FB] Příspěvek se nepodařilo odeslat.`);
      return false;
    }
    Log.success(`[FB] Citát zveřejněn.`);

    await db.logUserAction(user.id, 'quote_post', quote.id, postText);
    await db.updateQuoteNextSeen(quote.id, 30);

    return true;

  } catch (err) {
    Log.error(`[${user.id}] quotePost`, err);
    return false;
  }
}

// --- Šablony neimplementovaných akcí ---

async function groupPost(user, fbBot) {
  Log.warn(`[${user.id}]`, 'Akce group_post zatím není implementována.');
  return false;
}

async function timelinePost(user, fbBot) {
  Log.warn(`[${user.id}]`, 'Akce timeline_post zatím není implementována.');
  return false;
}

async function comment(user, fbBot) {
  Log.warn(`[${user.id}]`, 'Akce comment zatím není implementována.');
  return false;
}

async function react(user, fbBot) {
  Log.warn(`[${user.id}]`, 'Akce react zatím není implementována.');
  return false;
}

async function sharePost(user, fbBot) {
  Log.warn(`[${user.id}]`, 'Akce share_post zatím není implementována.');
  return false;
}

async function messengerCheck(user, fbBot) {
  Log.warn(`[${user.id}]`, 'Akce messenger_check zatím není implementována.');
  return false;
}

async function messengerReply(user, fbBot) {
  Log.warn(`[${user.id}]`, 'Akce messenger_reply zatím není implementována.');
  return false;
}
