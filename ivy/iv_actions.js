/**
 * Název souboru: iv_actions.js
 * Umístění: ~/ivy/iv_actions.js
 *
 * Popis: Obsahuje jednotlivé akce včetně nových typů post_utio pro různé typy skupin.
 *        Každá akce odpovídá hodnotě `action_code` z tabulky `action_definitions`.
 *        Přepracováno pro opakování akcí s respektováním user_group_limits.
 */

import * as wait from './iv_wait.js';
import * as support from './iv_support.js';
import * as fbSupport from './iv_fb_support.js';
import { groupExploreAction } from './iv_group_explore_action.js';
import { setInvasiveLock, initInvasiveLock, clearInvasiveLock } from './iv_wheel.js';
import { db } from './iv_sql.js'
import fs from 'fs/promises';
import { Log } from './iv_log.class.js';
import { getAvailableGroupsForUser, detectMembershipRequest } from './user_group_escalation.js';

/**
 * Určuje požadavky konkrétní akce na služby (FB, UTIO)
 * @param {string} actionCode - kód akce
 * @returns {object} - {needsFB: boolean, needsUtio: boolean}
 */
export async function getActionRequirements(actionCode) {
  const requirements = {
    needsFB: false,
    needsUtio: false
  };

  switch (actionCode) {
    // Akce vyžadující POUZE FB (bez UTIO)
    case 'group_post':        // Příspěvky do zájmových skupin (bez UTIO)
    case 'timeline_post':
    case 'comment':
    case 'react':
    case 'messenger_check':
    case 'messenger_reply':
    case 'quote_post':
    case 'group_explore':
      requirements.needsFB = true;
      break;

    // Akce vyžadující FB + UTIO
    case 'post_utio_g':       // UTIO post do běžných skupin
    case 'post_utio_gv':      // UTIO post do vlastních skupin
    case 'post_utio_p':       // UTIO post do prodejních skupin
      requirements.needsFB = true;
      requirements.needsUtio = true;
      break;

    // Akce nevyžadující ani FB ani UTIO
    case 'account_delay':
    case 'account_sleep':
      // Tyto akce nepotřebují žádné služby
      break;

    default:
      await Log.warn('[ACTIONS]', `Neznámý action_code: ${actionCode}`);
      break;
  }

  return requirements;
}

/**
 * Ověří připravenost před spuštěním jakékoliv akce
 * @param {Object} user - Uživatelské data
 * @param {Object} fbBot - FBBot instance
 * @param {string} actionCode - Kód akce
 * @param {Object} options - Další možnosti
 * @returns {Promise<Object>} Výsledek ověření
 */
async function verifyActionReadiness(user, fbBot, actionCode, options = {}) {
  try {
    Log.info(`[${user.id}]`, `🔍 Ověřuji připravenost pro akci: ${actionCode}`);

    const actionRequirements = await getActionRequirements(actionCode);

    // Pokud akce nevyžaduje FB, není co ověřovat
    if (!actionRequirements.needsFB) {
      return {
        ready: true,
        reason: 'Akce nevyžaduje FB'
      };
    }

    // Základní ověření FB pomocí nového modulu
    const verificationOptions = {
      requireSpecificGroup: options.targetGroup || null,
      requirePostingCapability: actionCode.includes('post') || actionCode.includes('comment'),
      allowWarnings: actionCode === 'react' || actionCode === 'messenger_check', // Méně kritické akce
      includeDetailedAnalysis: actionCode.includes('utio') // Detailní analýza pro UTIO operace
    };

    const readinessResult = await fbSupport.verifyFBReadiness(user, fbBot, verificationOptions);

    if (!readinessResult.ready) {
      await Log.warn(`[${user.id}]`, `⚠️ Akce ${actionCode} není připravena: ${readinessResult.reason}`);
    } else {
      Log.success(`[${user.id}]`, `✅ Akce ${actionCode} je připravena`);
    }

    return readinessResult;

  } catch (err) {
    await Log.error(`[${user.id}]`, `Chyba při ověřování akce ${actionCode}: ${err.message}`);
    return {
      ready: false,
      reason: `Chyba při ověřování: ${err.message}`,
      critical: true
    };
  }
}

/**
 * Provede skutečné postování UTIO zprávy s předběžným ověřením
 * @param {Object} user - Uživatelská data
 * @param {Object} fbBot - FBBot instance
 * @param {Object} group - Skupina kam postovat
 * @param {Object} utioBot - UtioBot instance
 * @returns {Promise<boolean>} - True pokud byl post úspěšný
 */
async function handleSingleUtioPost(user, fbBot, utioBot, groupType) {
  const actionCode = `post_utio_${groupType}`;
  const joinActionCode = `join_group_${groupType}`;

  // Fáze 1: Výběr a analýza skupiny
  const group = await db.getSingleAvailableGroup(user.id, groupType.toUpperCase());
  if (!group) {
    await Log.warn(`[${user.id}]`, `Žádné dostupné skupiny typu '${groupType}' pro akci ${actionCode}.`);
    await db.logSystemEvent('ACTION_ERROR', 'WARN', `No available groups for ${actionCode}`, { userId: user.id, groupType }, user.id);
    // Zde by se mohla dočasně zablokovat akce v kole štěstí, ale prozatím jen logujeme.
    return false; // Neúspěch
  }

  Log.info(`[${user.id}]`, `Vybrána skupina: ${group.nazev} (${group.fb_id})`);

  try {
    await fbBot.openGroup(group);
    fbBot.initializeAnalyzer(); // INICIALIZACE ANALYZÁTORU ZDE
    const analysis = await fbBot.pageAnalyzer.analyzeFullPage({ forceRefresh: true });

    // Fáze 2: Rozhodovací strom
    if (analysis.posting?.canInteract) {
      // Lze publikovat, pokračuj na Fázi 3
      return await performPublication(user, fbBot, utioBot, group, actionCode);
    }

    // Nelze publikovat, zkusit se přidat
    if (analysis.group?.hasJoinButton) {
      const recentJoin = await db.getRecentJoinGroupAction(user.id, joinActionCode);
      if (recentJoin) {
        await Log.info(`[${user.id}]`, `Již byla odeslána žádost o členství do skupiny typu '${groupType}' v posledních 8 hodinách. Čeká se.`);
        return true; // "Úspěch" - čekáme na schválení, nic víc neděláme
      }

      await Log.info(`[${user.id}]`, `Pokouším se přidat do skupiny ${group.nazev}...`);
      await fbBot.clickJoinGroupButton();
      await wait.delay(3000, 5000); // Počkat na reakci stránky

      const afterClickAnalysis = await fbBot.pageAnalyzer.analyzeFullPage({ forceRefresh: true });
      if (!afterClickAnalysis.group?.hasJoinButton) {
        await Log.success(`[${user.id}]`, `Úspěšně odeslána žádost o členství ve skupině ${group.nazev}.`);
        await db.logAction(user.id, joinActionCode, group.id, `Žádost o členství: ${group.nazev}`);
        return true; // Úspěch
      } else {
        await Log.error(`[${user.id}]`, `Nepodařilo se kliknout na "Přidat se" ve skupině ${group.nazev}.`);
        await db.blockUserGroup(user.id, group.id, 'Failed to click join button', 7);
        return false; // Neúspěch
      }
    }

    // Nelze publikovat a není tam tlačítko "Přidat se"
    const reason = analysis.details.join(', ') || 'Nespecifikovaný problém s oprávněním.';
    await Log.warn(`[${user.id}]`, `Skupina ${group.nazev} je problematická: ${reason}`);
    await db.blockUserGroup(user.id, group.id, reason, 30); // Blokovat na 30 dní
    return false; // Neúspěch

  } catch (err) {
    await Log.error(`[${user.id}]`, `Kompletní selhání při práci se skupinou ${group.nazev}: ${err.message}`);
    await db.blockUserGroup(user.id, group.id, err.message, 7); // Blokovat na 7 dní
    return false;
  }
}

async function performPublication(user, fbBot, utioBot, group, actionCode) {
  Log.info(`[${user.id}]`, `Zahajuji publikaci do skupiny ${group.nazev}...`);
  
  // Zpracování doplňkových akcí před postováním
  const analysis = await fbBot.pageAnalyzer.lastAnalysis;
  if (analysis && analysis.supplementary_actions && analysis.supplementary_actions.length > 0) {
    for (const action of analysis.supplementary_actions) {
      if (action.type === 'ACCEPT_EXPERT_INVITE') {
        await Log.info(`[${user.id}]`, 'Detekována doplňková akce: Přijetí pozvánky experta.');
        await fbBot.handleAcceptExpertInvite();
      }
    }
  }

  // Fáze 3: Publikování
  const message = await support.pasteMsg(user, group, fbBot, utioBot);
  if (!message) {
    await Log.warn(`[${user.id}]`, 'Nepodařilo se získat zprávu z UTIO.');
    return false;
  }

  await db.logAction(user.id, actionCode, group.id, `Post do skupiny: ${group.nazev}`);
  await support.updatePostStats(group, user, actionCode);
  Log.success(`[${user.id}]`, `✅ Úspěšně publikováno do skupiny ${group.nazev}!`);
  return true;
}

/**
 * HLAVNÍ FUNKCE - Spouští konkrétní akci na základě action_code
 * @param {Object} user - Uživatelské data
 * @param {string} actionCode - Kód akce k provedení
 * @param {Object} context - Kontext s instancemi botů
 * @returns {Promise<boolean>} True pokud byla akce úspěšná
 */
export async function runAction(user, actionCode, context, pickedAction) {
  try {
    Log.info(`[${user.id}]`, `🎬 Spouštím akci: ${actionCode}`);

    const { fbBot, utioBot } = context;

    // Předběžné ověření připravenosti akce
    const readinessCheck = await verifyActionReadiness(user, fbBot, actionCode);
    if (!readinessCheck.ready && readinessCheck.critical) {
      await Log.error(`[${user.id}]`, `❌ Akce ${actionCode} není připravena: ${readinessCheck.reason}`);
      return false;
    }

    let result = false;

    switch (actionCode) {
      case 'post_utio_g':
        result = await handleSingleUtioPost(user, fbBot, utioBot, 'g');
        break;

      case 'post_utio_gv':
        result = await handleSingleUtioPost(user, fbBot, utioBot, 'gv');
        break;

      case 'post_utio_p':
        // result = await handleSingleUtioPost(user, fbBot, utioBot, 'p');
        await Log.warn(`[${user.id}]`, 'Akce post_utio_p není zatím plně implementována s novou logikou.');
        result = false;
        break;

      case 'quote_post':
        result = await quotePost(user, fbBot);
        break;

      case 'account_delay':
        const delayMinutes = 60 + Math.random() * 180; // 1-4 hodiny
        await db.updateUserWorktime(user.id, delayMinutes);
        Log.info(`[${user.id}]`, `⏳ Account delay: ${Math.round(delayMinutes)}min`);
        result = true;
        break;

      case 'account_sleep':
        const sleepMinutes = 1440 + Math.random() * 2880; // 1-3 dny
        await db.updateUserWorktime(user.id, sleepMinutes);
        Log.info(`[${user.id}]`, `😴 Account sleep: ${Math.round(sleepMinutes / 60)}h`);
        result = true;
        break;

      // Placeholder akce
      case 'group_post':
        result = await groupPost(user, fbBot);
        break;

      case 'timeline_post':
        result = await timelinePost(user, fbBot);
        break;

      case 'comment':
        result = await comment(user, fbBot);
        break;

      case 'react':
        result = await react(user, fbBot);
        break;

      case 'messenger_check':
        result = await messengerCheck(user, fbBot);
        break;

      case 'messenger_reply':
        result = await messengerReply(user, fbBot);
        break;

      case 'group_explore':
        result = await groupExplore(user, fbBot);
        break;

      default:
        await Log.error(`[${user.id}]`, `Neznámá akce: ${actionCode}`);
        return false;
    }

    // Logování kvality akce
    await logActionQuality(user, actionCode, result, {
      verificationUsed: readinessCheck.ready,
      preChecksPassed: readinessCheck.ready,
      reason: result ? 'Success' : 'Failed'
    });

    Log.debug('[DIAGNOSTIC]', `Picked action object in runAction: ${JSON.stringify(pickedAction)}`);
    if (result && pickedAction.invasive) {
      try {
        const config = JSON.parse(await fs.readFile('./config.json', 'utf8'));
        const cooldownMs = (config.posting_cooldown.min_seconds + 
                          Math.random() * (config.posting_cooldown.max_seconds - config.posting_cooldown.min_seconds)) * 1000;
        
        setInvasiveLock(cooldownMs);
        Log.info(`[${user.id}]`, `🔒 Invasive lock nastaven na ${Math.round(cooldownMs / 1000)}s po úspěšné akci ${actionCode}`);
      } catch (err) {
        await Log.warn(`[${user.id}]`, `Nepodařilo se nastavit invasive lock: ${err.message}`);
      }
    }

    return result;

  } catch (err) {
    await Log.error(`[${user.id}] runAction`, err);
    await logActionQuality(user, actionCode, false, {
      reason: err.message,
      verificationUsed: false,
      preChecksPassed: false
    });
    return false;
  }
}

/**
 * Navigace na FB homepage
 */
async function navigateToHomepage(user, fbBot) {
  try {
    Log.info(`[${user.id}]`, 'Naviguji na FB homepage...');

    await fbBot.page.goto('https://www.FB.com/', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    await wait.delay(2000 + Math.random() * 3000);

    // Reinicializace analyzátoru pro novou stránku
    fbBot.initializeAnalyzer();

    const newUrl = fbBot.page.url();
    if (!(newUrl === 'https://www.facebook.com/' ||
      newUrl === 'https://www.facebook.com' ||
      newUrl.startsWith('https://www.facebook.com/?'))) {
      throw new Error(`Navigace neúspěšná, stále nejsme na homepage. Aktuální URL: ${newUrl}`);
    }

    Log.success(`[${user.id}]`, 'Úspěšně přešel na FB homepage');
    return true;

  } catch (err) {
    await Log.error(`[${user.id}] navigateToHomepage`, err);
    return false;
  }
}

/**
 * Quote post akce
 */
async function quotePost(user, fbBot) {
  try {
    const quote = await db.getRandomQuote(user.id);
    if (!quote) {
      await Log.warn(`[${user.id}]`, 'Žádný vhodný citát k dispozici.');
      return false;
    }

    Log.info(`[${user.id}]`, 'Začínám psát citát...');

    // Přejdi na homepage
    if (!await navigateToHomepage(user, fbBot)) {
      await Log.error(`[${user.id}]`, 'Nepodařilo se přejít na homepage před psaním citátu.');
      return false;
    }

    const postText = `${quote.text}${quote.author ? `\n– ${quote.author}` : ''}`;

    // Píšeme citát místo vkládání ze schránky
    const result = await support.writeMsg(user, postText, fbBot);

    if (!result) {
      await Log.error(`[${user.id}]`, 'Nepodařilo se napsat citát.');
      return false;
    }

    await support.updatePostStats(null, user, 'quote_post');
    await db.markQuoteAsUsed(quote.id, user.id);

    Log.success(`[${user.id}]`, `✅ Citát úspěšně publikován: "${quote.text.substring(0, 50)}..."`);
    return true;

  } catch (err) {
    await Log.error(`[${user.id}] quotePost`, err);
    return false;
  }
}

/**
 * Sleduje úspěšnost akcí a doporučuje optimalizace
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
    await db.logActionQuality(qualityData);

    // Reporting pro monitoring
    if (!success) {
      await Log.warn(`[${user.id}]`, `📊 Neúspěšná akce ${actionCode}: ${details.reason || 'Neznámý důvod'}`);
    }

  } catch (err) {
    await Log.error(`[${user.id}]`, `Chyba při logování kvality akce: ${err.message}`);
  }
}

// Placeholder funkce pro neimplementované akce
async function groupPost(user, fbBot) {
  await Log.warn(`[${user.id}]`, 'groupPost není zatím implementováno.');
  return false;
}

async function timelinePost(user, fbBot) {
  await Log.warn(`[${user.id}]`, 'timelinePost není zatím implementováno.');
  return false;
}

async function comment(user, fbBot) {
  await Log.warn(`[${user.id}]`, 'comment není zatím implementováno.');
  return false;
}

async function react(user, fbBot) {
  await Log.warn(`[${user.id}]`, 'react není zatím implementováno.');
  return false;
}

async function messengerCheck(user, fbBot) {
  await Log.warn(`[${user.id}]`, 'messengerCheck není zatím implementováno.');
  return false;
}

async function messengerReply(user, fbBot) {
  await Log.warn(`[${user.id}]`, 'messengerReply není zatím implementováno.');
  return false;
}

async function groupExplore(user, fbBot) {
  try {
    const result = await groupExploreAction.execute(user, fbBot);
    return result.success;
  } catch (err) {
    await Log.error(`[${user.id}] groupExplore`, err);
    return false;
  }
}

/**
 * Provádí neinvazivní aktivitu během pauzy mezi posty
 * @param {Object} user - Uživatelské data
 * @param {Object} fbBot - FBBot instance
 * @param {number} totalPauseTime - Celková doba pauzy v ms
 */
export async function performNonInvasiveActivity(user, fbBot, totalPauseTime) {
  try {
    Log.info(`[${user.id}]`, '🔍 Zahajuji neinvazivní aktivitu během pauzy...');
    
    // Rychlá kontrola zda je stránka úplně načtená (bez kompletní analýzy)
    try {
      const elementCount = await fbBot.page.evaluate(() => document.querySelectorAll('*').length);
      if (elementCount < 100) {
        Log.info(`[${user.id}]`, `⚠️ Stránka má málo elementů (${elementCount}) - přecházím na výchozí FB`);
        await fbBot.page.goto('https://www.facebook.com', { waitUntil: 'domcontentloaded' });
        await fbBot.wait(2000, 4000); // Krátké čekání na načtení
      }
    } catch (checkErr) {
      Log.debug(`[${user.id}]`, `Rychlá kontrola elementů selhala: ${checkErr.message}`);
    }
    
    const activities = [
      'visit_random_group',
      'visit_random_profile', 
      'scroll_feed',
      'visit_notifications'
    ];
    
    // Vyber náhodnou aktivitu
    const selectedActivity = activities[Math.floor(Math.random() * activities.length)];
    
    // Rozdělíme pauzu: 60-90% na aktivitu, zbytek na čekání
    const activityTime = Math.floor(totalPauseTime * (0.6 + Math.random() * 0.3));
    const remainingTime = totalPauseTime - activityTime;
    
    Log.info(`[${user.id}]`, `🎯 Aktivita: ${selectedActivity} (${Math.round(activityTime / 1000)}s), pak čekání ${Math.round(remainingTime / 1000)}s`);
    
    switch (selectedActivity) {
      case 'visit_random_group':
        await visitRandomGroup(user, fbBot, activityTime);
        break;
      case 'visit_random_profile':
        await visitRandomProfile(user, fbBot, activityTime);
        break;
      case 'scroll_feed':
        await scrollFeed(user, fbBot, activityTime);
        break;
      case 'visit_notifications':
        await visitNotifications(user, fbBot, activityTime);
        break;
    }
    
    // Zbytek času jen čekáme
    if (remainingTime > 1000) {
      Log.info(`[${user.id}]`, `😴 Dokončuji pauzu - zbývá ${Math.round(remainingTime / 1000)}s...`);
      await wait.delay(remainingTime);
    }
    
    Log.info(`[${user.id}]`, '✅ Neinvazivní aktivita dokončena');
    
  } catch (err) {
    await Log.warn(`[${user.id}]`, `Chyba při neinvazivní aktivitě: ${err.message} - pokračuji klasickou pauzou`);
    // Fallback na obyčejné čekání
    await wait.delay(totalPauseTime);
  }
}

/**
 * Navštíví náhodnou skupinu a trochu se v ní rozhlédne
 */
async function visitRandomGroup(user, fbBot, timeLimit) {
  try {
    let groupUrl = null;
    let source = 'databáze';

    // Priorita 1: Zkusit získat odkaz z poslední analýzy aktuální stránky
    if (fbBot.pageAnalyzer && fbBot.pageAnalyzer.lastAnalysis && fbBot.pageAnalyzer.lastAnalysis.links) {
        const groupLinks = fbBot.pageAnalyzer.lastAnalysis.links.groups;
        if (groupLinks && groupLinks.length > 0) {
            groupUrl = groupLinks[Math.floor(Math.random() * groupLinks.length)];
            source = 'aktuální stránky';
        }
    }

    // Priorita 2: Fallback na databázi, pokud se nepodařilo najít odkaz na stránce
    if (!groupUrl) {
        const groupTypes = ['G', 'GV', 'P'];
        const randomType = groupTypes[Math.floor(Math.random() * groupTypes.length)];
        const groups = await db.safeQueryAll('groups.getAvailableByTypeSimple', [randomType, 3]);
        if (!groups || groups.length === 0) {
          throw new Error('Žádné skupiny k dispozici v databázi');
        }
        const randomGroup = groups[Math.floor(Math.random() * groups.length)];
        groupUrl = `https://www.facebook.com/groups/${randomGroup.fb_id}`;
    }
    
    Log.info(`[${user.id}]`, `🎯 Navštěvuji skupinu (zdroj: ${source}): ${groupUrl}`);
    
    await fbBot.page.goto(groupUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await wait.delay(3000, 5000);
    
    // Trochu scrolluj, aby to vypadalo jako reálná aktivita
    const scrollTime = Math.min(timeLimit - 8000, 25000); // Max 25s scrollování
    if (scrollTime > 2000) {
      await scrollPageRandomly(fbBot, scrollTime);
    }
    
  } catch (err) {
    Log.info(`[${user.id}]`, `Nepodařilo se navštívit skupinu: ${err.message}`);
  }
}

/**
 * Navštíví náhodný profil (pokud možno z přátel nebo nedávných interakcí)
 */
async function visitRandomProfile(user, fbBot, timeLimit) {
  try {
    // Zkus najít odkazy na profily na aktuální stránce
    const profileLinks = await fbBot.page.$$eval('a[href*="/profile.php"], a[href*="facebook.com/"]:not([href*="/groups/"]):not([href*="/pages/"])', 
      links => links.slice(0, 5).map(link => link.href).filter(href => 
        href.includes('/profile.php') || (href.includes('facebook.com/') && !href.includes('/groups/') && !href.includes('/pages/'))
      )
    );
    
    if (profileLinks.length > 0) {
      const randomProfile = profileLinks[Math.floor(Math.random() * profileLinks.length)];
      
      Log.info(`[${user.id}]`, `👤 Navštěvuji profil...`);
      
      await fbBot.page.goto(randomProfile, { waitUntil: 'domcontentloaded', timeout: 10000 });
      await wait.delay(3000, 6000);
      
      // Krátké scrollování
      const scrollTime = Math.min(timeLimit - 9000, 10000);
      if (scrollTime > 2000) {
        await scrollPageRandomly(fbBot, scrollTime);
      }
    } else {
      throw new Error('Žádné profily nenalezeny');
    }
    
  } catch (err) {
    Log.info(`[${user.id}]`, `Nepodařilo se navštívit profil: ${err.message}`);
  }
}

/**
 * Scrolluje ve feedu
 */
async function scrollFeed(user, fbBot, timeLimit) {
  try {
    Log.info(`[${user.id}]`, `📰 Scrolluji ve feedu...`);
    
    // Jdi na homepage
    await fbBot.page.goto('https://www.facebook.com/', { waitUntil: 'domcontentloaded', timeout: 10000 });
    await wait.delay(2000);
    
    await scrollPageRandomly(fbBot, timeLimit - 2000);
    
  } catch (err) {
    Log.info(`[${user.id}]`, `Nepodařilo se scrollovat feed: ${err.message}`);
  }
}

/**
 * Navštíví notifikace
 */
async function visitNotifications(user, fbBot, timeLimit) {
  try {
    Log.info(`[${user.id}]`, `🔔 Kontroluji notifikace...`);
    
    await fbBot.page.goto('https://www.facebook.com/notifications', { waitUntil: 'domcontentloaded', timeout: 10000 });
    await wait.delay(3000, 6000);
    
    // Krátké scrollování v notifikacích
    const scrollTime = Math.min(timeLimit - 9000, 8000);
    if (scrollTime > 2000) {
      await scrollPageRandomly(fbBot, scrollTime);
    }
    
  } catch (err) {
    Log.info(`[${user.id}]`, `Nepodařilo se navštívit notifikace: ${err.message}`);
  }
}

/**
 * Pomocná funkce pro náhodné scrollování
 */
async function scrollPageRandomly(fbBot, duration) {
  try {
    const endTime = Date.now() + duration;
    
    while (Date.now() < endTime) {
      // Náhodný scroll směrem dolů
      await fbBot.page.evaluate(() => {
        const scrollAmount = Math.floor(Math.random() * 400) + 200; // 200-600px
        window.scrollBy(0, scrollAmount);
      });
      
      // Pauza mezi scrolly
      await wait.delay(1500, 4000);
    }
    
  } catch (err) {
    // Ignoruj chyby při scrollování
  }
}
