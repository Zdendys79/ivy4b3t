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
 * Vypočítá maximální počet příspěvků pro jeden cyklus (1/3 denního limitu)
 * @param {number} userId - ID uživatele
 * @param {string} groupType - Typ skupiny (G, GV, P, Z)
 * @returns {Promise<number>} - Maximální počet postů pro cyklus
 */
async function calculateMaxPostsPerCycle(userId, groupType) {
  try {
    const limit = await db.getUserGroupLimit(userId, groupType);
    if (!limit) {
      Log.warn(`[${userId}]`, `Žádné limity nalezeny pro typ ${groupType}`);
      return 1; // Fallback na 1 post
    }

    // Spočítej současné využití
    const postCount = await db.countUserPostsInTimeframe(userId, groupType, limit.time_window_hours);
    const currentPosts = postCount ? postCount.post_count : 0;
    const remainingPosts = Math.max(0, limit.max_posts - currentPosts);

    // Maximálně 1/3 denního limitu v jednom cyklu
    const maxPerCycle = Math.floor(limit.max_posts / 3);
    const postsForThisCycle = Math.min(maxPerCycle, remainingPosts);

    Log.debug(`[${userId}]`, `Limit calculation: current=${currentPosts}/${limit.max_posts}, remaining=${remainingPosts}, maxPerCycle=${maxPerCycle}, thiscycle=${postsForThisCycle}`);

    return Math.max(1, postsForThisCycle); // Minimum 1 post pokud je to možné
  } catch (err) {
    Log.error(`[${userId}] calculateMaxPostsPerCycle`, err);
    return 1;
  }
}

/**
 * Hlavní funkce pro UTIO postování s podporou opakování
 * @param {Object} user - Uživatelská data
 * @param {Object} fbBot - FacebookBot instance
 * @param {string} groupType - Typ skupiny (G, GV, P, Z)
 * @param {Object} utioBot - UtioBot instance
 * @returns {Promise<boolean>} - True pokud byla alespoň jedna akce úspěšná
 */
async function postUtioByType(user, fbBot, groupType, utioBot) {
  try {
    Log.info(`[${user.id}]`, `🎯 Spouštím UTIO postování do skupin typu ${groupType}`);

    // Zkontroluj dostupnost UTIO
    if (!utioBot || !utioBot.isReady()) {
      Log.error(`[${user.id}]`, 'UtioBot není k dispozici pro postování');
      return false;
    }

    // Zkontroluj základní možnost postování
    const canPost = await db.canUserPostToGroupType(user.id, groupType);
    if (!canPost) {
      Log.warn(`[${user.id}]`, `Dosažen celkový limit příspěvků pro skupiny typu ${groupType}`);
      return false;
    }

    // Spočítej kolik postů můžeme udělat v tomto cyklu
    const maxPostsThisCycle = await calculateMaxPostsPerCycle(user.id, groupType);
    if (maxPostsThisCycle <= 0) {
      Log.warn(`[${user.id}]`, `Žádné příspěvky povoleny pro typ ${groupType} v tomto cyklu`);
      return false;
    }

    Log.info(`[${user.id}]`, `📊 Plánuji až ${maxPostsThisCycle} příspěvků typu ${groupType} v tomto cyklu`);

    let successfulPosts = 0;
    let attempts = 0;
    const maxAttempts = maxPostsThisCycle * 2; // Umožní několik neúspěšných pokusů

    while (successfulPosts < maxPostsThisCycle && attempts < maxAttempts) {
      attempts++;

      Log.info(`[${user.id}]`, `📝 Pokus ${attempts}: Hledám skupinu pro post ${successfulPosts + 1}/${maxPostsThisCycle}`);

      // Znovu zkontroluj limit před každým postem (možná už byl dosažen)
      const stillCanPost = await db.canUserPostToGroupType(user.id, groupType);
      if (!stillCanPost) {
        Log.warn(`[${user.id}]`, `Limit dosažen během cyklu po ${successfulPosts} úspěšných postech`);
        break;
      }

      // Najdi dostupné skupiny tohoto typu
      const availableGroups = await getAvailableGroups(user.id, groupType);
      if (!availableGroups.length) {
        Log.warn(`[${user.id}]`, `Žádné dostupné skupiny typu ${groupType} pro další post`);
        break;
      }

      // Vyber náhodnou skupinu
      const selectedGroup = availableGroups[Math.floor(Math.random() * availableGroups.length)];
      Log.info(`[${user.id}]`, `🎲 Vybrána skupina: ${selectedGroup.nazev || selectedGroup.name} (${selectedGroup.fb_id})`);

      try {
        // Otevři skupinu
        await fbBot.openGroup(selectedGroup);
        await wait.delay(wait.timeout() * 2);

        // Získej zprávu z UTIO a publikuj ji
        const postSuccess = await performUtioPost(user, fbBot, selectedGroup, utioBot);

        if (postSuccess) {
          successfulPosts++;

          // Zaloguj akci
          const actionCode = `post_utio_${groupType.toLowerCase()}`;
          await db.logUserAction(user.id, actionCode, selectedGroup.id,
            `UTIO post ${successfulPosts}/${maxPostsThisCycle} do ${groupType}: ${selectedGroup.nazev || selectedGroup.name}`);

          // Aktualizuj čas posledního použití skupiny
          if (typeof db.updateGroupLastSeen === 'function') {
            await db.updateGroupLastSeen(selectedGroup.id);
          }
          if (typeof db.updateGroupNextSeen === 'function') {
            await db.updateGroupNextSeen(selectedGroup.id, IvMath.randInterval(120, 480));
          }

          Log.success(`[${user.id}]`, `✅ Post ${successfulPosts}/${maxPostsThisCycle} úspěšně publikován do ${selectedGroup.nazev || selectedGroup.name}`);

          // Pokud máme více postů, počkej mezi nimi
          if (successfulPosts < maxPostsThisCycle) {
            const pauseBetweenPosts = IvMath.randInterval(60, 180); // 1-3 minuty mezi posty
            Log.info(`[${user.id}]`, `⏱️ Pauza ${pauseBetweenPosts}s před dalším postem...`);
            await wait.delay(pauseBetweenPosts * 1000);
          }
        } else {
          Log.warn(`[${user.id}]`, `❌ Nepodařilo se poslat UTIO zprávu do skupiny ${selectedGroup.nazev || selectedGroup.name}`);
        }

      } catch (err) {
        Log.error(`[${user.id}]`, `Chyba při pokusu ${attempts}: ${err.message}`);
      }
    }

    // Shrnutí výsledků
    if (successfulPosts > 0) {
      Log.success(`[${user.id}]`, `🎉 Cyklus UTIO ${groupType} dokončen: ${successfulPosts}/${maxPostsThisCycle} úspěšných postů za ${attempts} pokusů`);
      return true;
    } else {
      Log.warn(`[${user.id}]`, `😞 Žádné úspěšné posty v cyklu ${groupType} za ${attempts} pokusů`);
      return false;
    }

  } catch (err) {
    Log.error(`[${user.id}] postUtioByType(${groupType})`, err);
    return false;
  }
}

/**
 * Získá dostupné skupiny pro daný typ a uživatele
 * @param {number} userId - ID uživatele
 * @param {string} groupType - Typ skupiny
 * @returns {Promise<Array>} - Seznam dostupných skupin
 */
async function getAvailableGroups(userId, groupType) {
  try {
    // Pokud existuje specifická funkce pro typ skupiny, použij ji
    if (typeof db.getAvailableGroupsByType === 'function') {
      return await db.getAvailableGroupsByType(groupType, userId);
    }

    // Fallback na obecnou funkci
    if (typeof db.getAvailableGroups === 'function') {
      const allGroups = await db.getAvailableGroups(userId);
      return allGroups.filter(g => g.group_type === groupType || g.typ === groupType);
    }

    Log.warn(`[${userId}]`, 'Žádná funkce pro získání skupin není dostupná');
    return [];
  } catch (err) {
    Log.error(`[${userId}] getAvailableGroups`, err);
    return [];
  }
}

/**
 * Provede skutečné postování UTIO zprávy
 * @param {Object} user - Uživatelská data
 * @param {Object} fbBot - FacebookBot instance
 * @param {Object} group - Skupina kam postovat
 * @param {Object} utioBot - UtioBot instance
 * @returns {Promise<boolean>} - True pokud byl post úspěšný
 */
async function performUtioPost(user, fbBot, group, utioBot) {
  try {
    Log.info(`[${user.id}]`, '📤 Získávám zprávu z UTIO...');

    const message = await support.pasteMsg(user, group, fbBot, utioBot);
    if (!message) {
      Log.warn(`[${user.id}]`, 'Nepodařilo se získat zprávu z UTIO.');
      return false;
    }

    Log.success(`[${user.id}]`, '✅ UTIO zpráva úspěšně publikována!');
    return true;

  } catch (err) {
    Log.error(`[${user.id}] performUtioPost`, err);
    return false;
  }
}

// Export přepracované funkce
export { postUtioByType };

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

    const message = await support.pasteMsg(user, group, fbBot, utioBot);
    if (!message) {
      Log.warn(`[${user.id}]`, 'Nepodařilo se získat zprávu z UTIO.');
      return false;
    }

    Log.success(`[${user.id}]`, 'UTIO zpráva úspěšně publikována!');
    return true;

  } catch (err) {
    Log.error(`[${user.id}] performUtioPost`, err);
    return false;
  }
}

// Pro citáty - používáme writeMsg (psaní)
async function quotePost(user, fbBot) {
  try {
    const quote = await db.getRandomQuote(user.id);
    if (!quote) {
      Log.warn(`[${user.id}]`, 'Žádný vhodný citát k dispozici.');
      return false;
    }

    Log.info(`[${user.id}]`, 'Začínám psát citát...');

    const postText = `${quote.text}${quote.author ? `\n– ${quote.author}` : ''}`;

    // PÍŠEME citát místo vkládání ze schránky
    const result = await support.writeMsg(user, postText, fbBot);

    if (!result) {
      Log.error(`[${user.id}]`, 'Nepodařilo se napsat citát.');
      return false;
    }

    await db.logUserAction(user.id, 'quote_post', quote.id, `Citát: ${quote.text.substring(0, 50)}...`);
    await db.updateQuoteNextSeen(quote.id, IvMath.randInterval(7, 30));

    Log.success(`[${user.id}]`, 'Citát byl úspěšně zveřejněn!');
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

    // Publikuj obsah pomocí writeMsg (psaní textu)
    const postText = `${quote.text}${quote.author ? `\n– ${quote.author}` : ''}`;

    const result = await support.writeMsg(user, postText, fbBot);
    if (!result) {
      Log.error(`[${user.id}]`, 'Nepodařilo se napsat příspěvek do zájmové skupiny');
      return false;
    }

    // Zaloguj akci
    await db.logUserAction(user.id, 'group_post', selectedGroup.id, `Post do zájmové skupiny: ${selectedGroup.nazev || selectedGroup.name}`);

    // Aktualizuj čas posledního použití skupiny
    if (typeof db.updateGroupLastSeen === 'function') {
      await db.updateGroupLastSeen(selectedGroup.id);
    }
    if (typeof db.updateGroupNextSeen === 'function') {
      await db.updateGroupNextSeen(selectedGroup.id, IvMath.randInterval(120, 480));
    }

    // Aktualizuj databázi citátu
    if (typeof db.updateQuoteNextSeen === 'function') {
      await db.updateQuoteNextSeen(quote.id, IvMath.randInterval(7, 30));
    }

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
