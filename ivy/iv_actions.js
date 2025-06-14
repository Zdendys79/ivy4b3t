/**
 * Název souboru: iv_actions.js
 * Umístění: ~/ivy/iv_actions.js
 *
 * Popis: Obsahuje jednotlivé akce a funkci pro určení jejich požadavků.
 * Každá akce odpovídá hodnotě `action_code` z tabulky `action_definitions`.
 */

import * as db from './iv_sql.js';
import * as wait from './iv_wait.js';
import { IvMath } from './iv_math.class.js';
import { Log } from './iv_log.class.js';
import { isDebugMode } from './iv_debug.js';

/**
 * Určuje požadavky konkrétní akce na služby (Facebook, UTIO)
 * @param {string} actionCode - kód akce
 * @returns {object} - {needsFacebook: boolean, needsUtio: boolean}
 */
export function getActionRequirements(actionCode) {
  const requirements = {
    needsFacebook: false,
    needsUtio: false
  };

  switch (actionCode) {
    // Akce vyžadující Facebook
    case 'group_post':
    case 'timeline_post':
    case 'comment':
    case 'react':
    case 'share_post':
    case 'messenger_check':
    case 'messenger_reply':
    case 'quote_post':
      requirements.needsFacebook = true;
      break;

    // Akce vyžadující UTIO
    case 'group_post': // vyžaduje i UTIO pro získání zprávy
      requirements.needsUtio = true;
      break;

    // Akce nevyžadující ani Facebook ani UTIO
    case 'account_delay':
    case 'account_sleep':
      // Tyto akce nepotřebují ani Facebook ani UTIO
      break;

    default:
      Log.warn('[ACTIONS]', `Neznámý action_code pro požadavky: ${actionCode}`);
      // Bezpečnostní fallback - otevřeme vše
      requirements.needsFacebook = true;
      requirements.needsUtio = true;
      break;
  }

  return requirements;
}

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

    Log.info(`[${user.id}]`, 'Začínám psát citát...');

    // Lidské chování - najdeme pole pro psaní
    await fbBot.newThing();
    await wait.delay(wait.timeout()); // krátká pauza

    await fbBot.clickNewThing();
    await wait.delay(wait.timeout() * 2); // čekáme než se otevře editor

    // Připravíme text
    const postText = `${quote.text}${quote.author ? `\n– ${quote.author}` : ''}`;
    Log.info(`[${user.id}]`, 'Píšu text citátu...');

    // Napíšeme text (už je v něm lidské chování - překlepy, pauzy)
    await fbBot.pasteStatement(postText);

    // Lidské chování - přečteme si co jsme napsali a možná něco opravíme
    Log.info(`[${user.id}]`, 'Kontroluji napsaný text...');
    await wait.delay(2000 + Math.random() * 3000); // 2-5 sekund čtení

    // Občas si rozmyslíme a chvíli váhám před odesláním
    if (Math.random() < 0.3) { // 30% šance na váhání
      Log.info(`[${user.id}]`, 'Chvíli váhám...');
      await wait.delay(3000 + Math.random() * 5000); // 3-8 sekund váhání
    }

    Log.info(`[${user.id}]`, 'Odesílám příspěvek...');
    const success = await fbBot.clickSendButton();

    if (!success) {
      Log.error(`[${user.id}]`, 'Nepodařilo se odeslat příspěvek.');
      return false;
    }

    Log.success(`[${user.id}]`, 'Citát byl úspěšně zveřejněn!');

    // Uložíme do databáze
    await db.logUserAction(user.id, 'quote_post', quote.id, postText);
    await db.updateQuoteNextSeen(quote.id, 30);

    // Lidské chování - chvíli si prohlédneme výsledek
    Log.info(`[${user.id}]`, 'Prohlížím si zveřejněný příspěvek...');
    await wait.delay(5000 + Math.random() * 10000); // 5-15 sekund

    // DEBUG REŽIM podle config.json
    if (isDebugMode()) {
      Log.info(`[DEBUG]`, 'Debug režim (main): čekám 60 sekund pro kontrolu...');
      await wait.delay(60000);
    } else {
      Log.info(`[RELEASE]`, 'Release režim (public): pokračuji normálně...');
    }

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
