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
async function performUtioPost(user, fbBot, group, utioBot) {
  try {
    Log.info(`[${user.id}]`, '📋 Zahajuji UTIO post proces...');

    // NOVÉ - Předběžné ověření před začátkem operace pomocí FB modulu
    const readinessCheck = await fbSupport.verifyFBReadinessForUtio(user, group, fbBot);

    if (!readinessCheck.ready) {
      await Log.error(`[${user.id}]`, `❌ Předběžné ověření selhalo: ${readinessCheck.reason}`);

      if (readinessCheck.critical) {
        // Označ skupinu jako nedostupnou v user_groups
        try {
          await db.markGroupAsUnavailable(user.id, group.id, readinessCheck.reason);
          Log.info(`[${user.id}]`, `🚫 Skupina ${group.nazev} označena jako nedostupná`);
        } catch (dbErr) {
          Log.warn(`[${user.id}]`, `Nepodařilo se označit skupinu jako nedostupnou: ${dbErr.message}`);
        }
        return false; // Kritická chyba
      }

      if (readinessCheck.shouldNavigate) {
        Log.info(`[${user.id}]`, '🔄 Pokusím se opravit navigaci...');
        const navigated = await fbBot.openGroup(group);
        if (!navigated) {
          await Log.error(`[${user.id}]`, 'Oprava navigace selhala');
          return false;
        }

        // Znovu ověř po opravě
        const recheckResult = await fbSupport.verifyFBReadinessForUtio(user, group, fbBot);
        if (!recheckResult.ready) {
          await Log.error(`[${user.id}]`, `I po opravě není připraveno: ${recheckResult.reason}`);
          return false;
        }
      }
    }

    Log.info(`[${user.id}]`, '📤 Získávám zprávu z UTIO...');

    // Volání původní funkce s novým ověřením
    const message = await support.pasteMsg(user, group, fbBot, utioBot);
    if (!message) {
      await Log.warn(`[${user.id}]`, 'Nepodařilo se získat zprávu z UTIO.');
      return false;
    }

    Log.success(`[${user.id}]`, '✅ UTIO zpráva úspěšně publikována!');
    return true;

  } catch (err) {
    await Log.error(`[${user.id}] performUtioPost`, err);
    return false;
  }
}

/**
 * Provede opakované UTIO postování do skupin určitého typu
 * @param {Object} user - Uživatelská data
 * @param {Object} fbBot - FBBot instance
 * @param {Object} utioBot - UtioBot instance
 * @param {string} groupType - Typ skupiny ('g', 'gv', 'p')
 * @returns {Promise<number>} Počet úspěšných postů
 */
async function performRepeatedUtioPost(user, fbBot, utioBot, groupType) {
  try {
    Log.info(`[${user.id}]`, `🔁 Začínám opakované UTIO postování pro typ: ${groupType}`);

    // Získej informace o limitech pro tento typ skupiny
    const limitInfo = await db.getUserCycleLimitInfo(user.id, groupType);
    const maxPosts = limitInfo.posts_available_this_cycle || 0;
    
    Log.info(`[${user.id}]`, `📊 Dostupné posty v tomto cyklu: ${maxPosts} (limit: ${limitInfo.max_posts_per_cycle}, použito: ${limitInfo.current_posts})`);
    
    if (maxPosts === 0) {
      await Log.warn(`[${user.id}]`, `Žádné dostupné posty pro typ ${groupType} - limit vyčerpán`);
      return 0;
    }

    let successfulPosts = 0;
    let consecutiveFailures = 0;
    const MAX_CONSECUTIVE_FAILURES = 5;

    for (let attempt = 1; attempt <= maxPosts; attempt++) {
      Log.info(`[${user.id}]`, `📝 Post ${attempt}/${maxPosts} pro typ ${groupType}`);

      // Zkontroluj limit před každým postem
      const stillCanPost = await db.canUserPostToGroupType(user.id, groupType);
      if (!stillCanPost) {
        await Log.warn(`[${user.id}]`, `Limit dosažen během cyklu po ${successfulPosts} úspěšných postech`);
        break;
      }

      // Najdi dostupné skupiny tohoto typu
      const availableGroups = await getAvailableGroups(user.id, groupType);
      if (!availableGroups.length) {
        await Log.warn(`[${user.id}]`, `Žádné dostupné skupiny typu ${groupType} pro další post`);
        break;
      }

      // Vyber náhodnou skupinu
      const selectedGroup = availableGroups[Math.floor(Math.random() * availableGroups.length)];
      Log.info(`[${user.id}]`, `🎲 Vybrána skupina: ${selectedGroup.nazev || selectedGroup.name} (${selectedGroup.fb_id})`);

      try {
        // NOVÉ - Předběžné ověření před otevřením skupiny
        const preGroupCheck = await fbSupport.verifyFBReadiness(user, fbBot, {
          requireSpecificGroup: null,
          requirePostingCapability: false,
          allowWarnings: true,
          includeDetailedAnalysis: false
        });

        if (!preGroupCheck.ready && preGroupCheck.critical) {
          await Log.error(`[${user.id}]`, `Kritická chyba před otevřením skupiny: ${preGroupCheck.reason}`);
          break; // Ukonči celý cyklus
        }

        // Otevři skupinu
        try {
          await fbBot.openGroup(selectedGroup);
          await wait.delay(wait.timeout() * 2);

          // NOVÁ LOGIKA - Kontrola po otevření skupiny
          if (fbBot.pageAnalyzer) {
            const quickCheck = await fbBot.pageAnalyzer.quickStatusCheck();

            // 🚨 DETEKCE ŽÁDOSTI O ČLENSTVÍ
            const pageContent = await fbBot.page.content().catch(() => '');
            const membershipDetected = await detectMembershipRequest(user, selectedGroup, pageContent);
            
            if (membershipDetected) {
              await Log.warn(`[${user.id}]`, `🚫 Skupina ${selectedGroup.nazev} vyžaduje schválení členství - přeskakuji`);
              continue; // Přejdi na další skupinu
            }

            if (quickCheck.hasErrors) {
              const { waitForUserIntervention } = await import('./iv_wait.js');
              const { ErrorReportBuilder } = await import('./iv_ErrorReportBuilder.class.js');

              await Log.warn(`[${user.id}]`, `🚨 Group error detected: ${selectedGroup.fb_id}`);

              // 60s countdown s možností stisknout 'a'
              const userWantsAnalysis = await waitForUserIntervention(
                `Group Error: ${selectedGroup.nazev}`,
                60
              );

              if (userWantsAnalysis) {
                // Hlubší analýza - uložit do tabulky
                const reportBuilder = new ErrorReportBuilder();
                reportBuilder.initializeReport(
                  user,
                  selectedGroup,
                  'GROUP_ERROR',
                  `Error after opening group: ${selectedGroup.nazev}`,
                  fbBot.page?.url() || 'unknown'
                );

                try {
                  const analysis = await fbBot.pageAnalyzer.analyzeFullPage({
                    includeGroupAnalysis: true,
                  });
                  reportBuilder.addPageAnalysis(analysis);
                } catch (err) {
                  reportBuilder.addNotes(`Group analýza selhala: ${err.message}`);
                }

                const reportId = await reportBuilder.saveReport();
                Log.info(`[${user.id}]`, `📊 Group error report uložen s ID: ${reportId}`);
              }

              // Program pokračuje i s chybou (podle původní logiky)
              await Log.warn(`[${user.id}]`, 'Pokračuji přes group error...');
            }
          }

        } catch (groupErr) {
          await Log.error(`[${user.id}]`, `Chyba při práci se skupinou ${selectedGroup.fb_id}: ${groupErr.message}`);

          // Error i při pokusu o otevření skupiny
          const { ErrorReportBuilder } = await import('./iv_ErrorReportBuilder.class.js');

          const reportBuilder = new ErrorReportBuilder();
          const reportId = await reportBuilder.saveBasicReport(
            user,
            'GROUP_OPEN_ERROR',
            `Failed to open group: ${groupErr.message}`,
            `group_${selectedGroup.fb_id}`
          );

          Log.info(`[${user.id}]`, `📊 Basic error report uložen s ID: ${reportId}`);

          continue; // Pokračuj s další skupinou (původní logika)
        }
        // NOVÉ - Ověření po otevření skupiny
        const postGroupCheck = await verifyActionReadiness(user, fbBot, `post_utio_${groupType}`, {
          targetGroup: selectedGroup
        });

        if (!postGroupCheck.ready) {
          await Log.warn(`[${user.id}]`, `Skupina ${selectedGroup.fb_id} není připravena: ${postGroupCheck.reason}`);

          if (postGroupCheck.critical) {
            continue; // Zkus další skupinu
          }

          await Log.warn(`[${user.id}]`, 'Pokračuji přes varování...');
        }

        // Získej zprávu z UTIO a publikuj ji
        const postSuccess = await performUtioPost(user, fbBot, selectedGroup, utioBot);

        if (postSuccess) {
          successfulPosts++;
          consecutiveFailures = 0; // Reset při úspěchu

          // Aktualizuj statistiky
          await support.updatePostStats(selectedGroup, user, `post_utio_${groupType}`);

          Log.success(`[${user.id}]`, `✅ Post ${attempt} úspěšný! Celkem: ${successfulPosts}/${attempt}`);
        } else {
          consecutiveFailures++;
          await Log.warn(`[${user.id}]`, `❌ Post ${attempt} neúspěšný (${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES} po sobě)`);
          
          // Kontrola počtu neúspěšných pokusů za sebou
          if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
            await Log.error(`[${user.id}]`, `🚨 SYSTÉM: ${MAX_CONSECUTIVE_FAILURES} neúspěšných skupin za sebou - naplánován account_delay`);
            
            // Naordinovat account_delay akci
            const delayMinutes = 60 + Math.random() * 180; // 1-4 hodiny jako u běžného account_delay
            await db.updateUserWorktime(user.id, delayMinutes);
            
            // Systémový log pro monitoring
            try {
              await db.logSystemEvent(
                `consecutive_group_failures_${groupType}`, 
                'WARN',
                `${MAX_CONSECUTIVE_FAILURES} consecutive failures in post_utio_${groupType} action - account_delay scheduled for ${Math.round(delayMinutes)}min`,
                { groupType: groupType, delayMinutes: Math.round(delayMinutes), maxFailures: MAX_CONSECUTIVE_FAILURES },
                user.id
              );
            } catch (logErr) {
              await Log.warn(`[${user.id}]`, `Nepodařilo se zalogovat systémovou událost: ${logErr.message}`);
            }
            
            await Log.warn(`[${user.id}]`, `⏳ Account delay nastaven na ${Math.round(delayMinutes)} minut kvůli opakovaným neúspěchům`);
            
            // Ukončit celou akci
            break;
          }
        }

      } catch (groupErr) {
        consecutiveFailures++;
        await Log.error(`[${user.id}]`, `Chyba při práci se skupinou ${selectedGroup.fb_id}: ${groupErr.message} (${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES} po sobě)`);
        
        // Kontrola počtu neúspěšných pokusů za sebou i u výjimek
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          await Log.error(`[${user.id}]`, `🚨 SYSTÉM: ${MAX_CONSECUTIVE_FAILURES} chyb při skupinách za sebou - naplánován account_delay`);
          
          // Naordinovat account_delay akci
          const delayMinutes = 60 + Math.random() * 180; // 1-4 hodiny
          await db.updateUserWorktime(user.id, delayMinutes);
          
          // Systémový log pro monitoring
          try {
            await db.logSystemEvent(
              `consecutive_group_errors_${groupType}`, 
              'ERROR',
              `${MAX_CONSECUTIVE_FAILURES} consecutive errors in post_utio_${groupType} action - account_delay scheduled for ${Math.round(delayMinutes)}min`,
              { groupType: groupType, delayMinutes: Math.round(delayMinutes), maxFailures: MAX_CONSECUTIVE_FAILURES },
              user.id
            );
          } catch (logErr) {
            await Log.warn(`[${user.id}]`, `Nepodařilo se zalogovat systémovou událost: ${logErr.message}`);
          }
          
          await Log.warn(`[${user.id}]`, `⏳ Account delay nastaven na ${Math.round(delayMinutes)} minut kvůli opakovaným chybám`);
          
          // Ukončit celou akci
          break;
        }
        
        continue; // Pokračuj s další skupinou
      }

      // Pauza mezi posty s neinvazivní aktivitou
      if (attempt < maxPosts) {
        const pauseTime = 10000 + Math.random() * 80000; // 10-90s
        Log.info(`[${user.id}]`, `⏱️ Pauza ${Math.round(pauseTime / 1000)}s před dalším postem s neinvazivní aktivitou...`);
        
        // Neinvazivní aktivita během pauzy
        await performNonInvasiveActivity(user, fbBot, pauseTime);
      }
    }

    Log.info(`[${user.id}]`, `🏁 Cyklus ${groupType} dokončen. Úspěšných postů: ${successfulPosts}`);
    return successfulPosts;

  } catch (err) {
    await Log.error(`[${user.id}] performRepeatedUtioPost`, err);
    return 0;
  }
}

/**
 * Získá dostupné skupiny pro zadaný typ
 * @param {number} userId - ID uživatele
 * @param {string} groupType - Typ skupiny
 * @returns {Promise<Array>} Seznam dostupných skupin
 */
async function getAvailableGroups(userId, groupType) {
  try {
    // NOVÁ LOGIKA: Použij per-user group blocking systém
    const groups = await getAvailableGroupsForUser(userId, groupType.toUpperCase());
    
    Log.debug(`[${userId}]`, `Per-user blocking: nalezeno ${groups.length} dostupných skupin typu ${groupType}`);
    
    return groups;
  } catch (err) {
    await Log.error(`[${userId}] getAvailableGroups`, err);
    
    // Fallback na původní metodu při chybě
    try {
      return await db.getAvailableGroups(groupType.toUpperCase(), userId);
    } catch (fallbackErr) {
      await Log.error(`[${userId}] getAvailableGroups fallback`, fallbackErr);
      return [];
    }
  }
}

/**
 * HLAVNÍ FUNKCE - Spouští konkrétní akci na základě action_code
 * @param {Object} user - Uživatelské data
 * @param {string} actionCode - Kód akce k provedení
 * @param {Object} context - Kontext s instancemi botů
 * @returns {Promise<boolean>} True pokud byla akce úspěšná
 */
export async function runAction(user, actionCode, context) {
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
        result = await performRepeatedUtioPost(user, fbBot, utioBot, 'g');
        break;

      case 'post_utio_gv':
        result = await performRepeatedUtioPost(user, fbBot, utioBot, 'gv');
        break;

      case 'post_utio_p':
        result = await performRepeatedUtioPost(user, fbBot, utioBot, 'p');
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

    if (result) {
      Log.success(`[${user.id}]`, `✅ Akce ${actionCode} dokončena úspěšně`);
      
      // Nastav invasive lock pro invazní akce
      try {
        const actionDef = await db.safeQueryFirst('actions.getDefinitionByCode', [actionCode]);
        if (actionDef?.invasive) {
          const config = JSON.parse(await fs.readFile('./config.json', 'utf8'));
          const cooldownMs = (config.posting_cooldown.min_seconds + 
                            Math.random() * (config.posting_cooldown.max_seconds - config.posting_cooldown.min_seconds)) * 1000;
          
          setInvasiveLock(cooldownMs);
          Log.info(`[${user.id}]`, `🔒 Invasive lock nastaven na ${Math.round(cooldownMs / 1000)}s po úspěšné akci ${actionCode}`);
        }
      } catch (err) {
        await Log.warn(`[${user.id}]`, `Nepodařilo se nastavit invasive lock: ${err.message}`);
      }
    } else {
      await Log.warn(`[${user.id}]`, `❌ Akce ${actionCode} se nezdařila`);
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
async function performNonInvasiveActivity(user, fbBot, totalPauseTime) {
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
    
    // Rozdělíme pauzu: 20-40% na aktivitu, zbytek na čekání
    const activityTime = Math.floor(totalPauseTime * (0.2 + Math.random() * 0.2)); // 20-40%
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
    // Získej náhodné skupiny z databáze (mix různých typů)
    const groupTypes = ['G', 'GV', 'P'];
    const randomType = groupTypes[Math.floor(Math.random() * groupTypes.length)];
    const groups = await db.safeQueryAll('groups.getAvailableByTypeSimple', [randomType, 3]);
    if (!groups || groups.length === 0) {
      throw new Error('Žádné skupiny k dispozici');
    }
    
    const randomGroup = groups[Math.floor(Math.random() * groups.length)];
    const groupUrl = `https://www.facebook.com/groups/${randomGroup.fb_id}`;
    
    Log.info(`[${user.id}]`, `🎯 Navštěvuji skupinu: ${randomGroup.nazev}`);
    
    await fbBot.page.goto(groupUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await wait.delay(2000, 4000);
    
    // Trochu scrolluj
    const scrollTime = Math.min(timeLimit - 6000, 15000); // Max 15s scrollování
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
