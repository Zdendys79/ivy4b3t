/**
 * Název souboru: iv_actions.js
 * Umístění: ~/ivy/iv_actions.js
 *
 * Popis: Obsahuje jednotlivé akce včetně nových typů post_utio pro různé typy skupin.
 *        Každá akce odpovídá hodnotě `action_code` z tabulky `action_definitions`.
 *        Přepracováno pro opakování akcí s respektováním user_group_limits.
 */

import { db } from './iv_sql.js'
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
 * Spustí konkrétní akci s předběžným ověřením
 * @param {Object} user - Uživatelská data
 * @param {Object} fbBot - FacebookBot instance
 * @param {string} action_code - Kód akce
 * @param {Object} utioBot - UtioBot instance (optional)
 * @returns {Promise<boolean>} True pokud byla akce úspěšná
 */
export async function runAction(user, fbBot, action_code, utioBot = null) {
  try {
    Log.info(`[${user.id}]`, `🚀 Spouštím akci: ${action_code}`);

    // NOVÉ - Předběžné ověření připravenosti
    const readinessCheck = await verifyActionReadiness(user, fbBot, action_code, {
      targetGroup: null // Bude nastaveno později podle specifické akce
    });

    if (!readinessCheck.ready && readinessCheck.critical) {
      Log.error(`[${user.id}]`, `❌ Akce ${action_code} byla zrušena: ${readinessCheck.reason}`);
      return false;
    }

    if (!readinessCheck.ready) {
      Log.warn(`[${user.id}]`, `⚠️ Pokračuji s akcí ${action_code} přes varování: ${readinessCheck.reason}`);
    }

    // Spuštění konkrétní akce
    switch (action_code) {
      case 'group_post':
        return await groupPost(user, fbBot);

      case 'timeline_post':
        return await timelinePost(user, fbBot);

      case 'post_utio_g':
        return await postUtioByType(user, fbBot, 'g', utioBot);

      case 'post_utio_gv':
        return await postUtioByType(user, fbBot, 'gv', utioBot);

      case 'post_utio_p':
        return await postUtioByType(user, fbBot, 'p', utioBot);

      case 'comment':
        return await comment(user, fbBot);

      case 'react':
        return await react(user, fbBot);

      case 'messenger_check':
        return await messengerCheck(user, fbBot);

      case 'messenger_reply':
        return await messengerReply(user, fbBot);

      case 'quote_post':
        return await quotePost(user, fbBot);

      case 'account_delay':
        return await accountDelay(user);

      case 'account_sleep':
        return await accountSleep(user);

      default:
        Log.warn(`[${user.id}]`, `Neznámý action_code: ${action_code}`);
        return false;
    }

  } catch (err) {
    Log.error(`[${user.id}] runAction(${action_code})`, err);
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
 * Postuje UTIO zprávy podle typu skupiny s rozšířeným ověřením
 */
async function postUtioByType(user, fbBot, groupType, utioBot) {
  try {
    Log.info(`[${user.id}]`, `📊 Začínám UTIO post cyklus pro typ: ${groupType}`);

    // NOVÉ - Ověření UTIO dostupnosti
    if (!utioBot || !utioBot.isReady()) {
      Log.error(`[${user.id}]`, 'UTIO není k dispozici pro typ ' + groupType);
      return false;
    }

    // Zjistit kolik postů je povoleno
    const maxPostsThisCycle = await db.getMaxPostsForGroupType(user.id, groupType);

    if (!maxPostsThisCycle || maxPostsThisCycle <= 0) {
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

      // Znovu zkontroluj limit před každým postem
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
        // NOVÉ - Předběžné ověření před otevřením skupiny
        const preGroupCheck = await support.verifyFacebookReadiness(user, fbBot, {
          requireSpecificGroup: null,
          requirePostingCapability: false,
          allowWarnings: true,
          includeDetailedAnalysis: false
        });

        if (!preGroupCheck.ready && preGroupCheck.critical) {
          Log.error(`[${user.id}]`, `Kritická chyba před otevřením skupiny: ${preGroupCheck.reason}`);
          break; // Ukonči celý cyklus
        }

        // Otevři skupinu
        await fbBot.openGroup(selectedGroup);
        await wait.delay(wait.timeout() * 2);

        // NOVÉ - Ověření po otevření skupiny
        const postGroupCheck = await verifyActionReadiness(user, fbBot, `post_utio_${groupType}`, {
          targetGroup: selectedGroup
        });

        if (!postGroupCheck.ready) {
          Log.warn(`[${user.id}]`, `Skupina ${selectedGroup.fb_id} není připravena: ${postGroupCheck.reason}`);

          if (postGroupCheck.critical) {
            continue; // Zkus další skupinu
          }

          Log.warn(`[${user.id}]`, 'Pokračuji přes varování...');
        }

        // Získej zprávu z UTIO a publikuj ji
        const postSuccess = await performUtioPost(user, fbBot, selectedGroup, utioBot);

        if (postSuccess) {
          successfulPosts++;
          Log.success(`[${user.id}]`, `✅ Post ${successfulPosts}/${maxPostsThisCycle} úspěšný!`);

          // Lidské chování - pauza mezi posty
          if (successfulPosts < maxPostsThisCycle) {
            const pauseTime = 30000 + Math.random() * 60000; // 30-90 sekund
            Log.info(`[${user.id}]`, `⏱️  Pauza ${Math.round(pauseTime/1000)}s před dalším postem...`);
            await wait.delay(pauseTime);
          }
        } else {
          Log.warn(`[${user.id}]`, `⚠️ Post do ${selectedGroup.fb_id} neúspěšný`);
        }

      } catch (groupErr) {
        Log.error(`[${user.id}]`, `Chyba při práci se skupinou ${selectedGroup.fb_id}: ${groupErr.message}`);
        continue; // Pokračuj na další skupinu
      }

      // Krátká pauza mezi pokusy
      await wait.delay(2000 + Math.random() * 3000);
    }

    if (successfulPosts > 0) {
      Log.success(`[${user.id}]`, `🎯 Cyklus ${groupType} dokončen: ${successfulPosts}/${maxPostsThisCycle} úspěšných postů`);
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
 * Provede skutečné postování UTIO zprávy s předběžným ověřením
 * @param {Object} user - Uživatelská data
 * @param {Object} fbBot - FacebookBot instance
 * @param {Object} group - Skupina kam postovat
 * @param {Object} utioBot - UtioBot instance
 * @returns {Promise<boolean>} - True pokud byl post úspěšný
 */
async function performUtioPost(user, fbBot, group, utioBot) {
  try {
    Log.info(`[${user.id}]`, '📋 Zahajuji UTIO post proces...');

    // NOVÉ - Předběžné ověření před začátkem operace
    const readinessCheck = await support.verifyFacebookReadinessForUtio(user, group, fbBot);

    if (!readinessCheck.ready) {
      Log.error(`[${user.id}]`, `❌ Předběžné ověření selhalo: ${readinessCheck.reason}`);

      if (readinessCheck.critical) {
        return false; // Kritická chyba
      }

      if (readinessCheck.shouldNavigate) {
        Log.info(`[${user.id}]`, '🔄 Pokusím se opravit navigaci...');
        const navigated = await fbBot.openGroup(group);
        if (!navigated) {
          Log.error(`[${user.id}]`, 'Oprava navigace selhala');
          return false;
        }

        // Znovu ověř po opravě
        const recheckResult = await support.verifyFacebookReadinessForUtio(user, group, fbBot);
        if (!recheckResult.ready) {
          Log.error(`[${user.id}]`, `I po opravě není připraveno: ${recheckResult.reason}`);
          return false;
        }
      }
    }

    Log.info(`[${user.id}]`, '📤 Získávám zprávu z UTIO...');

    // Volání původní funkce s novým ověřením
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

async function quotePost(user, fbBot) {
  try {
    const quote = await db.getRandomQuote(user.id);
    if (!quote) {
      Log.warn(`[${user.id}]`, 'Žádný vhodný citát k dispozici.');
      return false;
    }

    Log.info(`[${user.id}]`, 'Začínám psát citát...');

    // NEJDŘÍV se vrátíme na hlavní stránku Facebooku
    // (pokud jsme například v některé skupině)
    if (!await navigateToHomepage(user, fbBot)) {
      Log.error(`[${user.id}]`, 'Nepodařilo se přejít na homepage před psaním citátu.');
      return false;
    }

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

/**
 * Naviguje na hlavní stránku Facebooku
 * @param {Object} user - Uživatelská data
 * @param {Object} fbBot - FacebookBot instance
 * @returns {Promise<boolean>} True pokud bylo úspěšné
 */
async function navigateToHomepage(user, fbBot) {
  try {
    if (!fbBot || !fbBot.isReady()) {
      Log.error(`[${user.id}]`, 'FacebookBot není připraven pro navigaci na homepage');
      return false;
    }

    const currentUrl = fbBot.page.url();

    // Pokud už jsme na homepage, nemusíme navigovat
    if (currentUrl === 'https://www.facebook.com/' ||
        currentUrl === 'https://www.facebook.com' ||
        currentUrl.startsWith('https://www.facebook.com/?')) {
      Log.info(`[${user.id}]`, 'Už jsme na Facebook homepage');
      return true;
    }

    Log.info(`[${user.id}]`, `Přecházím z ${currentUrl} na Facebook homepage...`);

    // Naviguj na hlavní stránku
    await fbBot.page.goto('https://www.facebook.com/', {
      waitUntil: 'networkidle2',
      timeout: 15000
    });

    // Krátká pauza pro načtení stránky
    await wait.delay(2000 + Math.random() * 2000);

    // Ověř, že jsme skutečně na homepage
    const newUrl = fbBot.page.url();
    if (!(newUrl === 'https://www.facebook.com/' ||
          newUrl === 'https://www.facebook.com' ||
          newUrl.startsWith('https://www.facebook.com/?'))) {
      throw new Error(`Navigace neúspěšná, stále nejsme na homepage. Aktuální URL: ${newUrl}`);
    }

    Log.success(`[${user.id}]`, 'Úspěšně přešel na Facebook homepage');
    return true;

  } catch (err) {
    Log.error(`[${user.id}] navigateToHomepage`, err);
    return false;
  }
}

/**
 * Ověří připravenost před spuštěním jakékoliv akce
 * @param {Object} user - Uživatelské data
 * @param {Object} fbBot - FacebookBot instance
 * @param {string} actionCode - Kód akce
 * @param {Object} options - Další možnosti
 * @returns {Promise<Object>} Výsledek ověření
 */
async function verifyActionReadiness(user, fbBot, actionCode, options = {}) {
  try {
    Log.info(`[${user.id}]`, `🔍 Ověřuji připravenost pro akci: ${actionCode}`);

    const actionRequirements = getActionRequirements(actionCode);

    // Pokud akce nevyžaduje Facebook, není co ověřovat
    if (!actionRequirements.needsFacebook) {
      return {
        ready: true,
        reason: 'Akce nevyžaduje Facebook'
      };
    }

    // Základní ověření Facebook
    const verificationOptions = {
      requireSpecificGroup: options.targetGroup || null,
      requirePostingCapability: actionCode.includes('post') || actionCode.includes('comment'),
      allowWarnings: actionCode === 'react' || actionCode === 'messenger_check', // Méně kritické akce
      includeDetailedAnalysis: actionCode.includes('utio') // Detailní analýza pro UTIO operace
    };

    const readinessResult = await support.verifyFacebookReadiness(user, fbBot, verificationOptions);

    if (!readinessResult.ready) {
      Log.warn(`[${user.id}]`, `⚠️ Akce ${actionCode} není připravena: ${readinessResult.reason}`);
    } else {
      Log.success(`[${user.id}]`, `✅ Akce ${actionCode} je připravena`);
    }

    return readinessResult;

  } catch (err) {
    Log.error(`[${user.id}]`, `Chyba při ověřování akce ${actionCode}: ${err.message}`);
    return {
      ready: false,
      reason: `Chyba při ověřování: ${err.message}`,
      critical: true
    };
  }
}

/**
 * Sleduje úspěšnost akcí a doporučuje optimalizace
 * @param {Object} user - Uživatelské data
 * @param {string} actionCode - Kód akce
 * @param {boolean} success - Zda byla akce úspěšná
 * @param {Object} details - Detaily o akci
 */
async function logActionQuality(user, actionCode, success, details = {}) {
  try {
    const qualityData = {
      user_id: user.id,
      action_code: actionCode,
      success: success,
      timestamp: new Date().toISOString(),
      details: JSON.stringify(details),
      verification_used: details.verificationUsed || false,
      pre_checks_passed: details.preChecksPassed || false
    };

    // Uložení do databáze pro analýzu kvality
    if (typeof db.logActionQuality === 'function') {
      await db.logActionQuality(qualityData);
    }

    // Reporting pro monitoring
    if (!success) {
      Log.warn(`[${user.id}]`, `📊 Neúspěšná akce ${actionCode}: ${details.reason || 'Neznámý důvod'}`);
    }

  } catch (err) {
    Log.error(`[${user.id}]`, `Chyba při logování kvality akce: ${err.message}`);
  }
}

// Placeholder funkce pro neimplementované akce
async function groupPost(user, fbBot) {
  Log.warn(`[${user.id}]`, 'groupPost není zatím implementováno.');
  return false;
}

async function timelinePost(user, fbBot) {
  Log.warn(`[${user.id}]`, 'timelinePost není zatím implementováno.');
  return false;
}

async function comment(user, fbBot) {
  Log.warn(`[${user.id}]`, 'comment není zatím implementováno.');
  return false;
}

async function react(user, fbBot) {
  Log.warn(`[${user.id}]`, 'react není zatím implementováno.');
  return false;
}

async function messengerCheck(user, fbBot) {
  Log.warn(`[${user.id}]`, 'messengerCheck není zatím implementováno.');
  return false;
}

async function messengerReply(user, fbBot) {
  Log.warn(`[${user.id}]`, 'messengerReply není zatím implementováno.');
  return false;
}
