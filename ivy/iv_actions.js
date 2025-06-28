/**
 * Název souboru: iv_actions.js
 * Umístění: ~/ivy/iv_actions.js
 *
 * Popis: Obsahuje jednotlivé akce včetně nových typů post_utio pro různé typy skupin.
 *        Každá akce odpovídá hodnotě `action_code` z tabulky `action_definitions`.
 *        Aktualizováno pro použití nové UtioBot třídy.
 */

import * as db from './iv_sql.js';
import * as wait from './iv_wait.js';
import * as support from './iv_support.js';
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
    // Akce vyžadující POUZE Facebook (bez UTIO)
    case 'group_post':        // Příspěvky do zájmových skupin (bez UTIO)
    case 'timeline_post':
    case 'comment':
    case 'react':
    case 'messenger_check':
    case 'messenger_reply':
    case 'quote_post':
      requirements.needsFacebook = true;
      break;

    // Akce vyžadující FACEBOOK + UTIO
    case 'post_utio_g':       // UTIO post do běžných skupin
    case 'post_utio_gv':      // UTIO post do vlastních skupin
    case 'post_utio_p':       // UTIO post do prodejních skupin
      requirements.needsFacebook = true;
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

/**
 * Spustí konkrétní akci
 * @param {Object} user - Uživatelská data
 * @param {Object} fbBot - FacebookBot instance
 * @param {string} action_code - Kód akce
 * @param {Object} utioBot - UtioBot instance (optional)
 * @returns {Promise<boolean>} True pokud byla akce úspěšná
 */
export async function runAction(user, fbBot, action_code, utioBot = null) {
  switch (action_code) {
    case 'group_post':
      return await groupPost(user, fbBot);

    case 'timeline_post':
      return await timelinePost(user, fbBot);

    case 'comment':
      return await comment(user, fbBot);

    case 'react':
      return await react(user, fbBot);

    case 'post_utio_g':
      return await postUtioByType(user, fbBot, 'G', utioBot);

    case 'post_utio_gv':
      return await postUtioByType(user, fbBot, 'GV', utioBot);

    case 'post_utio_p':
      return await postUtioByType(user, fbBot, 'P', utioBot);

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

// ==========================================
// 🎯 IMPLEMENTOVANÉ AKCE
// ==========================================

async function accountDelay(user) {
  Log.info(`[${user.id}]`, 'Spouštím delay režim.');
  const minutes = IvMath.randInterval(180, 480);

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

async function postUtioByType(user, fbBot, groupType, utioBot) {
  try {
    Log.info(`[${user.id}]`, `Spouštím postování UTIO zprávy do skupin typu ${groupType}`);

    // Zkontroluj dostupnost UTIO
    if (!utioBot || !utioBot.isReady()) {
      Log.error(`[${user.id}]`, 'UtioBot není k dispozici pro postování');
      return false;
    }

    // Zkontroluj, zda může uživatel přidat příspěvek do tohoto typu skupin
    let canPost = true;
    if (typeof db.canUserPostToGroupType === 'function') {
      canPost = await db.canUserPostToGroupType(user.id, groupType);
    } else {
      Log.debug(`[${user.id}]`, 'canUserPostToGroupType není implementováno - pokračuji bez kontroly limitů');
    }

    if (!canPost) {
      Log.warn(`[${user.id}]`, `Dosažen limit příspěvků pro skupiny typu ${groupType}`);
      return false;
    }

    // Najdi dostupné skupiny tohoto typu
    let availableGroups = [];
    if (typeof db.getAvailableGroupsByType === 'function') {
      availableGroups = await db.getAvailableGroupsByType(groupType, user.id);
    } else {
      Log.debug(`[${user.id}]`, 'getAvailableGroupsByType není implementováno - používám fallback');
      // Fallback na obecnou funkci pro získání skupin
      if (typeof db.getAvailableGroups === 'function') {
        const allGroups = await db.getAvailableGroups(user.id);
        availableGroups = allGroups.filter(g => g.group_type === groupType);
      }
    }

    if (!availableGroups.length) {
      Log.warn(`[${user.id}]`, `Žádné dostupné skupiny typu ${groupType}`);
      return false;
    }

    // Vyber náhodnou skupinu
    const selectedGroup = availableGroups[Math.floor(Math.random() * availableGroups.length)];
    Log.info(`[${user.id}]`, `Vybrána skupina: ${selectedGroup.nazev || selectedGroup.name} (${selectedGroup.fb_id})`);

    // Otevři skupinu
    await fbBot.openGroup(selectedGroup);
    await wait.delay(wait.timeout() * 2);

    // Získej zprávu z UTIO a publikuj ji
    const postSuccess = await performUtioPost(user, fbBot, selectedGroup, utioBot);

    if (postSuccess) {
      // Zaloguj akci
      const actionCode = `post_utio_${groupType.toLowerCase()}`;
      await db.logUserAction(user.id, actionCode, selectedGroup.id, `UTIO post do ${groupType}: ${selectedGroup.nazev || selectedGroup.name}`);

      // Aktualizuj čas posledního použití skupiny
      if (typeof db.updateGroupLastSeen === 'function') {
        await db.updateGroupLastSeen(selectedGroup.id);
      }
      if (typeof db.updateGroupNextSeen === 'function') {
        await db.updateGroupNextSeen(selectedGroup.id, IvMath.randInterval(120, 480));
      }

      Log.success(`[${user.id}]`, `Úspěšné postování UTIO zprávy do skupiny ${groupType}: ${selectedGroup.nazev || selectedGroup.name}`);
      return true;
    } else {
      Log.error(`[${user.id}]`, `Nepodařilo se poslat UTIO zprávu do skupiny ${selectedGroup.nazev || selectedGroup.name}`);
      return false;
    }

  } catch (err) {
    Log.error(`[${user.id}] postUtioByType(${groupType})`, err);
    return false;
  }
}

async function performUtioPost(user, fbBot, group, utioBot) {
  try {
    Log.info(`[${user.id}]`, 'Získávám zprávu z UTIO...');

    // Získej zprávu z UTIO pomocí iv_support.js funkce
    const message = await support.pasteMsg(user, group, fbBot, utioBot);
    if (!message) {
      Log.warn(`[${user.id}]`, 'Nepodařilo se získat zprávu z UTIO.');
      return false;
    }

    Log.info(`[${user.id}]`, 'UTIO zpráva získána, publikuji na Facebook...');

    // Zpráva už byla vložena pomocí support.pasteMsg
    // Funkce pasteMsg už obsahuje celý proces publikování včetně:
    // - otevření editoru příspěvku
    // - vložení textu
    // - odeslání
    // Pokud se dostaneme sem, znamená to že bylo vše úspěšné

    Log.success(`[${user.id}]`, 'UTIO zpráva úspěšně publikována!');
    return true;

  } catch (err) {
    Log.error(`[${user.id}] performUtioPost`, err);
    return false;
  }
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

    if (typeof db.updateQuoteNextSeen === 'function') {
      await db.updateQuoteNextSeen(quote.id, 30);
    }

    // Lidské chování - chvíli si prohlédneme výsledek
    Log.info(`[${user.id}]`, 'Prohlížím si zveřejněný příspěvek...');
    await wait.delay(5000 + Math.random() * 10000); // 5-15 sekund

    // DEBUG REŽIM podle config.json
    if (isDebugMode()) {
      Log.debug(`[${user.id}]`, 'Debug režim (main): čekám 60 sekund pro kontrolu...');
      await wait.delay(60000);
    } else {
      Log.debug(`[${user.id}]`, 'Release režim (public): pokračuji normálně...');
    }

    return true;

  } catch (err) {
    Log.error(`[${user.id}] quotePost`, err);
    return false;
  }
}

async function groupPost(user, fbBot) {
  try {
    Log.info(`[${user.id}]`, 'Spouštím postování do zájmových skupin (bez UTIO)');

    // Najdi dostupné zájmové skupiny (typ Z)
    let availableGroups = [];
    if (typeof db.getAvailableGroupsByType === 'function') {
      availableGroups = await db.getAvailableGroupsByType('Z', user.id);
    } else if (typeof db.getAvailableGroups === 'function') {
      const allGroups = await db.getAvailableGroups(user.id);
      availableGroups = allGroups.filter(g => g.group_type === 'Z');
    } else {
      Log.error(`[${user.id}]`, 'Žádná funkce pro získání skupin není dostupná');
      return false;
    }

    if (!availableGroups.length) {
      Log.warn(`[${user.id}]`, 'Žádné dostupné zájmové skupiny');
      return false;
    }

    // Vyber náhodnou skupinu
    const selectedGroup = availableGroups[Math.floor(Math.random() * availableGroups.length)];
    Log.info(`[${user.id}]`, `Vybrána zájmová skupina: ${selectedGroup.nazev || selectedGroup.name} (${selectedGroup.fb_id})`);

    // Otevři skupinu
    await fbBot.openGroup(selectedGroup);
    await wait.delay(wait.timeout() * 2);

    // Získej vlastní obsah (ne z UTIO) - například citát nebo připravený text
    const quote = await db.getRandomQuote(user.id);
    if (!quote) {
      Log.warn(`[${user.id}]`, 'Žádný vhodný obsah k postování do zájmové skupiny');
      return false;
    }

    // Publikuj obsah
    await fbBot.newThing();
    await fbBot.clickNewThing();

    const postText = `${quote.text}${quote.author ? `\n– ${quote.author}` : ''}`;
    await fbBot.pasteStatement(postText);

    // Lidské chování při postování
    await wait.delay(2000 + Math.random() * 3000);

    const success = await fbBot.clickSendButton();
    if (!success) {
      Log.error(`[${user.id}]`, 'Nepodařilo se odeslat příspěvek do zájmové skupiny');
      return false;
    }

    // Zaloguj akci
    await db.logUserAction(user.id, 'group_post', selectedGroup.id, `Post do zájmové skupiny: ${selectedGroup.nazev || selectedGroup.name}`);

    Log.success(`[${user.id}]`, `Úspěšné postování do zájmové skupiny: ${selectedGroup.nazev || selectedGroup.name}`);
    return true;

  } catch (err) {
    Log.error(`[${user.id}] groupPost`, err);
    return false;
  }
}

async function timelinePost(user, fbBot) {
  try {
    Log.info(`[${user.id}]`, 'Spouštím postování na timeline');

    // Přejdi na hlavní stránku/timeline
    await fbBot.page.goto('https://www.facebook.com/', { waitUntil: 'networkidle2' });
    await wait.delay(wait.timeout() * 2);

    // Získej obsah k postování
    const quote = await db.getRandomQuote(user.id);
    if (!quote) {
      Log.warn(`[${user.id}]`, 'Žádný vhodný obsah k postování na timeline');
      return false;
    }

    // Publikuj na timeline
    await fbBot.newThing();
    await fbBot.clickNewThing();

    const postText = `${quote.text}${quote.author ? `\n– ${quote.author}` : ''}`;
    await fbBot.pasteStatement(postText);

    // Lidské chování
    await wait.delay(3000 + Math.random() * 5000);

    const success = await fbBot.clickSendButton();
    if (!success) {
      Log.error(`[${user.id}]`, 'Nepodařilo se odeslat příspěvek na timeline');
      return false;
    }

    // Zaloguj akci
    await db.logUserAction(user.id, 'timeline_post', 0, `Timeline post: ${postText.substring(0, 50)}...`);

    Log.success(`[${user.id}]`, 'Úspěšné postování na timeline');
    return true;

  } catch (err) {
    Log.error(`[${user.id}] timelinePost`, err);
    return false;
  }
}

// ==========================================
// 🚧 ŠABLONY PRO BUDOUCÍ IMPLEMENTACI
// ==========================================

async function comment(user, fbBot) {
  Log.info(`[${user.id}]`, 'Akce "comment" ještě není implementována');
  // TODO: Implementovat komentování příspěvků
  return false;
}

async function react(user, fbBot) {
  Log.info(`[${user.id}]`, 'Akce "react" ještě není implementována');
  // TODO: Implementovat reakce na příspěvky (like, love, atd.)
  return false;
}

async function messengerCheck(user, fbBot) {
  Log.info(`[${user.id}]`, 'Akce "messenger_check" ještě není implementována');
  // TODO: Implementovat kontrolu zpráv v Messengeru
  return false;
}

async function messengerReply(user, fbBot) {
  Log.info(`[${user.id}]`, 'Akce "messenger_reply" ještě není implementována');
  // TODO: Implementovat odpovídání na zprávy v Messengeru
  return false;
}
