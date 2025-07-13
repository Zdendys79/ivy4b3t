/**
 * Název souboru: iv_worker.js - KOMPLETNĚ PŘEPRACOVANÁ LOGIKA
 * Umístění: ~/ivy/iv_worker.js
 *
 * Popis: Správná implementace podle specifikace:
 * 1. Vyber uživatele
 * 2. Losování akcí na kole štěstí
 * 3. Otevření prohlížeče a potřebných záložek
 * 4. Heartbeat + UI příkazy
 * 5. Dokončení akce → návrat na krok 2 (opakované losování)
 * 6. Po vyprázdnění kola → account_delay/account_sleep
 * 7. Zavření prohlížeče
 * 8. Čekání 1-5 minut s heartBeat každých 30s
 */

import fs from 'fs';
import path from 'path';
import os from 'node:os';
import puppeteer from 'puppeteer';

import { db } from './iv_sql.js'
import { FBBot } from './iv_fb.class.js';
import { UtioBot } from './iv_utio.class.js';
import { UIBot } from './iv_ui.class.js';
import { getRandomAction, initInvasiveLock, clearInvasiveLock } from './iv_wheel.js';
import { runAction, getActionRequirements } from './iv_actions.js';
import { Log } from './iv_log.class.js';
import { IvMath } from './iv_math.class.js';
import { handleNewAccountBlock, detectAccountBlock } from './hostname_block_handler.js';

import * as wait from './iv_wait.js';
import * as support from './iv_support.js';
import { enableDebugger, setDebugContext } from './iv_interactive_debugger.js';

const isLinux = process.platform === 'linux';
const hostname = os.hostname();

const DEBUG_KEEP_BROWSER_OPEN = process.env.DEBUG_KEEP_BROWSER_OPEN === 'true';

// Globální tracking aktivních browser instances pro graceful shutdown
let activeBrowsers = new Set();

/**
 * HLAVNÍ TICK FUNKCE - implementuje celý cyklus podle specifikace
 */
export async function tick() {
  // 🐛 Interactive debugger is always enabled
  enableDebugger(true);
  Log.info('[WORKER]', '🐛 Interactive debugging ENABLED - errors will pause for analysis');

  try {

    // 🎯 KROK 1: HEARTBEAT + UI PŘÍKAZY (před výběrem uživatele)
    Log.debug('[WORKER]', '🔍 Krok 1: Kontrola heartBeat a UI příkazů...');

    const uiResult = await checkUICommandsAndHeartbeat(null);
    if (uiResult.hasUICommand) {
      // VARIANTA A: UI příkaz před výběrem uživatele
      Log.info('[WORKER]', 'VARIANTA A: UI příkaz před výběrem uživatele');

      const uiUser = uiResult.requestedUser;
      if (!uiUser) {
        await Log.warn('[WORKER]', 'UI příkaz neobsahuje platného uživatele');
        await waitWithHeartbeat(1); // Krátké čekání
        return;
      }

      // Otevři prohlížeč pro UI uživatele a proveď UI akci
      const uiContinueWithActions = await executeUICommand(uiUser, uiResult.uiCommand);

      if (uiContinueWithActions) {
        // A1: Pokračuj s akcemi na kole štěstí pro tohoto uživatele
        Log.info(`[${uiUser.id}]`, 'A1: Pokračuji s akcemi na kole štěstí po UI příkazu');
        await executeUserActionCycle(uiUser, uiResult.browser, uiResult.context, uiResult.browserClosed);
      }
      // A2: Pokud byl prohlížeč uzavřen, funkce už skončila v executeUICommand

      return;
    }

    // 🎯 KROK 2: KONTROLA HOSTNAME OCHRANY
    Log.debug('[WORKER]', '🔍 Krok 2a: Kontrola hostname ochrany proti lavině banů...');
    
    const hostname = os.hostname();
    const hostnameBlock = await db.isHostnameBlocked(hostname);
    
    if (hostnameBlock) {
      await Log.warn('[WORKER]', `🚫 Hostname ${hostname} je zablokován do ${hostnameBlock.blocked_until}`);
      await Log.warn('[WORKER]', `🔒 Důvod: ${hostnameBlock.blocked_reason}`);
      await Log.warn('[WORKER]', `⏱️ Zbývá: ${hostnameBlock.remaining_minutes} minut`);
      
      // Systémový log
      await db.logSystemEvent(
        'HOSTNAME_PROTECTION',
        'WARN',
        `Hostname ${hostname} is blocked - preventing account access`,
        {
          blocked_until: hostnameBlock.blocked_until,
          blocked_reason: hostnameBlock.blocked_reason,
          blocked_user_id: hostnameBlock.blocked_user_id,
          remaining_minutes: hostnameBlock.remaining_minutes
        }
      );
      
      // Čekat s heartbeat
      await waitWithHeartbeat(5); // 5 minut
      return;
    }

    Log.debug('[WORKER]', '✅ Hostname ochrana OK - pokračuji ve výběru uživatele');

    // 🎯 KROK 2b: VÝBĚR UŽIVATELE (pouze pokud není UI příkaz)
    Log.debug('[WORKER]', '🔍 Krok 2b: Hledám dostupného uživatele s akcemi...');

    // Zjisti aktuální Git větev
    const gitInfo = await support.getGitInfo();
    const isMainBranch = gitInfo.branch === 'main';

    let user;
    if (isMainBranch) {
      Log.info('[WORKER]', '🌿 MAIN větev detekována - používám rotační výběr uživatele.');
      user = await db.getOldestReadyUser(hostname);
    } else {
      Log.info('[WORKER]', '🚀 Produkční větev - používám standardní výběr uživatele s akcemi.');
      user = await db.getUserWithAvailableActions(hostname);
    }

    if (!user || !user.id || !user.name || !user.surname) {
      Log.info('[WORKER]', '❌ Krok 2: Nebyl nalezen žádný uživatel s dostupnými akcemi');
      if (user) {
        Log.warn('[WORKER]', `Problémový uživatel: ${JSON.stringify(user)}`);
      }
      await showAccountLockStats();

      // 🎯 KROK 9: ČEKÁNÍ 1-5 MINUT S HEARTBEAT
      await waitWithHeartbeat();
      return;
    }

    Log.success(`[${user.id}]`, `🚀 Krok 2: Vybrán uživatel ${user.name} ${user.surname}`);

    // V MAIN větvi rovnou posuneme čas, aby se uživatelé střídali
    if (isMainBranch) {
        await db.updateUserWorktime(user.id, 15);
        Log.info(`[${user.id}]`, '🌿 MAIN větev: Čas aktivity uživatele posunut o 15 minut pro zajištění rotace.');
    }

    // 🎯 KROK 3-8: CELÝ UŽIVATELSKÝ CYKLUS
    await executeUserActionCycle(user);

  } catch (err) {
    await Log.errorInteractive('[WORKER]', err);

    // 🎯 KROK 9: ČEKÁNÍ PO CHYBĚ
    await waitWithHeartbeat(2); // 2 minuty po chybě
  }
}

/**
 * KROK 3-8: Celý cyklus akcí pro uživatele
 */
async function executeUserActionCycle(user, existingBrowser = null, existingContext = null, existingBrowserClosed = false) {
  let browser = existingBrowser;
  let context = existingContext;
  let browserClosed = existingBrowserClosed;
  let fbBot = null;
  let utioBot = null;
  let actionCount = 0;
  let consecutive_failures = 0; // Sledování po sobě jdoucích neúspěchů

  try {
    await db.initUserActionPlan(user.id);
    
    // Inicializuj invasive lock pro tohoto uživatele
    initInvasiveLock();

    // 🎯 HLAVNÍ SMYČKA AKCÍ PRO UŽIVATELE
    while (true) {
      // Kontrola po sobě jdoucích neúspěchů
      if (consecutive_failures >= 5) {
        await Log.error(`[${user.id}]`, `🚨 SYSTÉM: ${consecutive_failures} neúspěšných akcí za sebou - naplánován account_delay`);
        await runAction(user, 'account_delay', { fbBot: null, utioBot: null });
        await db.logSystemEvent(
          'CONSECUTIVE_FAILURES', 
          'ERROR',
          `${consecutive_failures} consecutive failures for user ${user.id} - account_delay scheduled.`,
          { userId: user.id, failures: consecutive_failures },
          user.id
        );
        consecutive_failures = 0; // Reset po penalizaci
        break; // Ukonči cyklus pro tohoto uživatele
      }

      // 🎯 KROK 3: ZÍSKÁNÍ DOSTUPNÝCH AKCÍ
      const actions = await db.getUserActions(user.id);
      Log.debug(`[${user.id}]`, `Krok 3: Dostupné akce: ${actions.map(a => a.action_code).join(', ') || 'Žádné'}`);

      // 🎯 KROK 7: KONTROLA UKONČUJÍCÍCH AKCÍ
      const hasNormalActions = actions.some(a => !['account_delay', 'account_sleep'].includes(a.action_code));

      if (!hasNormalActions) {
        Log.info(`[${user.id}]`, 'Krok 7: Kolo štěstí vyprázdněno, vybírám ukončující akci');

        const endingActions = actions.filter(a => ['account_delay', 'account_sleep'].includes(a.action_code));
        if (endingActions.length === 0) {
          Log.info(`[${user.id}]`, 'Žádné ukončující akce k dispozici, končím cyklus');
          break;
        }

        // Vyber jednu z ukončujících akcí
        const picked = await getRandomAction(endingActions, user.id);
        if (picked) {
          await executeEndingAction(user, picked);
        }
        break;
      }

      if (!actions.length) {
        Log.info(`[${user.id}]`, 'Žádné akce k dispozici, končím cyklus');
        break;
      }

      // 🎯 KROK 4: LOSOVÁNÍ AKCE NA KOLE ŠTĚSTÍ
      const picked = await getRandomAction(actions, user.id);
      if (!picked) {
        await Log.warn(`[${user.id}]`, 'Krok 4: Kolo štěstí vrátilo null, pravděpodobně vyčerpané limity');
        await wait.delay(IvMath.randInterval(10000, 20000)); // Krátká pauza před dalším pokusem
        continue; // Zkus znovu, možná se uvolní jiné akce
      }

      const actionCode = picked.code;
      Log.info(`[${user.id}]`, `Krok 4: Vylosována akce #${actionCount + 1}: ${actionCode}`);

      // 🎯 KROK 5: OTEVŘENÍ PROHLÍŽEČE A POTŘEBNÝCH ZÁLOŽEK (jen při první akci)
      if (!browser) {
        Log.info(`[${user.id}]`, 'Krok 5: Otevírám prohlížeč...');
        ({ browser, context, browserClosed } = await prepareBrowser(user));
        await support.closeBlankTabs(context);
      }

      // Inicializace potřebných služeb pro akci
      const requirements = await getActionRequirements(actionCode);
      ({ fbBot, utioBot } = await initializeRequiredServices(
        user, context, requirements, fbBot, utioBot
      ));

      // 🎯 KROK 6: PROVEDENÍ AKCE
      Log.info(`[${user.id}]`, `Krok 6: Provádím akci ${actionCode}...`);

      const success = await runAction(user, actionCode, { fbBot, utioBot }, picked);
      if (!success) {
        await Log.warnInteractive(`[${user.id}]`, `Akce ${actionCode} NEPROVEDENA`);
        consecutive_failures++;
      } else {
        Log.success(`[${user.id}]`, `Akce ${actionCode} úspěšně dokončena`);
        consecutive_failures = 0; // Reset při úspěchu
      }

      // 🚨 HOSTNAME OCHRANA: Kontrola, zda nebyl účet mezitím zablokován
      if (fbBot) {
        const blockInfo = await detectAccountBlock(fbBot, user);
        if (blockInfo && blockInfo.locked) {
          await Log.error(`[${user.id}]`, `🚨 DETEKOVÁN NOVÝ BAN: ${blockInfo.reason}`);
          
          // Zablokovat účet v databázi
          await db.lockAccountWithReason(user.id, blockInfo.reason, blockInfo.type, os.hostname());
          
          // Zablokovat hostname
          await handleNewAccountBlock(user, blockInfo.reason, blockInfo.type);
          
          throw new Error(`Account blocked during operation: ${blockInfo.reason}`);
        }
      }

      // Pro post_utio akce zkontroluj, zda ještě nebylo dosaženo 1/3 limitu
      const shouldRepeat = await db.shouldRepeatUtioAction(user.id, actionCode);
      
      if (shouldRepeat) {
        // Nenastavuj čas do budoucna - nech akci dostupnou pro okamžité opakování
        Log.info(`[${user.id}]`, `Akce ${actionCode} zůstává dostupná pro opakování (nevyčerpán 1/3 limit)`);
      } else {
        // Standardní chování - nastav čas pro další spuštění
        const randMin = Math.floor(Math.random() * (picked.max_minutes - picked.min_minutes + 1)) + picked.min_minutes;
        await db.updateActionPlan(user.id, actionCode, randMin);
        Log.info(`[${user.id}]`, `Akce ${actionCode} nastavena na opakování za ${randMin} minut`);
      }

      actionCount++;

      // 🎯 KROK 7: HEARTBEAT + UI PŘÍKAZY (po akci) - VARIANTA B
      const uiResult = await checkUICommandsAndHeartbeat(user);
      if (uiResult.hasUICommand) {
        if (uiResult.requestedUser && uiResult.requestedUser.id === user.id) {
          // B: Stejný uživatel → proveď UI akci a pokračuj
          Log.info(`[${user.id}]`, 'VARIANTA B: UI příkaz pro stejného uživatele');

          const uiContinue = await executeUICommandForCurrentUser(user, browser, context, fbBot, utioBot, uiResult.uiCommand);
          if (!uiContinue) {
            // Prohlížeč byl uzavřen nebo chyba
            break;
          }
        } else {
          // B: Jiný uživatel → skoč na krok 9
          Log.info(`[${user.id}]`, 'VARIANTA B: UI příkaz pro jiného uživatele, ukončuji cyklus');
          break;
        }
      }

      // Kontrola, zda se prohlížeč nezavřel
      if (browserClosed) {
        await Log.warn(`[${user.id}]`, 'Prohlížeč se zavřel, ukončuji cyklus');
        break;
      }

      // Krátká pauza mezi akcemi pro přirozenější chování
      await wait.delay(IvMath.randInterval(2000, 5000));

      // 🔄 NÁVRAT NA KROK 3: Opakované losování
      Log.debug(`[${user.id}]`, 'Návrat na krok 3: Opakované losování akcí...');
    }

    Log.success(`[${user.id}]`, `Cyklus dokončen. Provedeno ${actionCount} akcí.`);

  } catch (err) {
    await Log.error(`[${user.id}] executeUserActionCycle`, err);
    await pauseOnError(browser, browserClosed);
  } finally {
    // 🎯 KROK 8: ZAVŘENÍ PROHLÍŽEČE A CLEANUP
    await cleanupUserSession(user, browser, fbBot, utioBot, browserClosed);
  }
}

/**
 * Provede ukončující akci (account_delay/account_sleep)
 */
async function executeEndingAction(user, picked) {
  try {
    Log.info(`[${user.id}]`, `Provádím ukončující akci: ${picked.code}`);

    // Ukončující akce nepotřebují prohlížeč
    const success = await runAction(user, picked.code, { fbBot: null, utioBot: null });

    if (success) {
      const randMin = Math.floor(Math.random() * (picked.max_minutes - picked.min_minutes + 1)) + picked.min_minutes;
      await db.updateActionPlan(user.id, picked.code, randMin);
      Log.success(`[${user.id}]`, `Ukončující akce ${picked.code} dokončena, další za ${randMin} minut`);
    }
  } catch (err) {
    await Log.error(`[${user.id}] executeEndingAction`, err);
  }
}

/**
 * HEARTBEAT + UI PŘÍKAZY - nová verze
 */
async function checkUICommandsAndHeartbeat(currentUser) {
  const result = {
    hasUICommand: false,
    requestedUser: null,
    uiCommand: null,
    browser: null,
    context: null,
    browserClosed: false
  };

  try {
    // Odeslání heartBeat
    await db.heartBeat(currentUser?.id || 0, 0, 'IVY4B3T');

    // Kontrola UI příkazů
    const uiBot = new UIBot();
    const uiCommand = await uiBot.checkForCommand();

    if (uiCommand) {
      Log.info('[WORKER]', `🎮 UI REŽIM: Nalezen příkaz ${uiCommand.command}`);

      result.hasUICommand = true;
      result.uiCommand = uiCommand;

      // Zjisti, zda UI příkaz požadoval konkrétního uživatele
      result.requestedUser = await extractRequestedUserFromUICommand(uiCommand);

      // Pro UI příkazy před výběrem uživatele může být potřeba otevřít prohlížeč
      if (!currentUser && result.requestedUser) {
        // Připrav prohlížeč pro UI uživatele
        const browserData = await prepareBrowser(result.requestedUser);
        result.browser = browserData.browser;
        result.context = browserData.context;
        result.browserClosed = browserData.browserClosed;
      }
    }

    return result;

  } catch (err) {
    await Log.error('[WORKER]', `Chyba při kontrole UI příkazů: ${err.message}`);
    return result;
  }
}

/**
 * VARIANTA A: Provedení UI příkazu před výběrem uživatele
 */
async function executeUICommand(user, uiCommand) {
  let browser = null;
  let context = null;
  let browserClosed = false;
  let fbBot = null;

  try {
    Log.info(`[${user.id}]`, `Otevírám prohlížeč pro UI příkaz: ${uiCommand.command}`);

    // Otevři prohlížeč s profilem uživatele
    ({ browser, context, browserClosed } = await prepareBrowser(user));
    await support.closeBlankTabs(context);

    // Inicializuj pouze FB (UI příkazy obvykle potřebují jen FB)
    fbBot = new FBBot(context, user.id);
    if (!await fbBot.init()) {
      throw new Error('FB initialization failed for UI command');
    }

    // Set debug context for interactive debugger (always enabled)
    if (fbBot.page) {
      setDebugContext(user, fbBot.page);
    }

    const fbStatus = await fbBot.openFB(user);

    // NOVÁ LOGIKA - Error detection po otevření FB
    if (!fbStatus || fbStatus === 'account_locked') {
      const { waitForUserIntervention } = await import('./iv_wait.js');
      const { ErrorReportBuilder } = await import('./iv_ErrorReportBuilder.class.js');

      await Log.warn(`[${user.id}]`, `🚨 Problem with FB: ${fbStatus}`);

      // 60s countdown s možností stisknout 'a'
      const userWantsAnalysis = await waitForUserIntervention(
        `FB Error: ${fbStatus}`,
        60
      );

      if (userWantsAnalysis) {
        // Hlubší analýza - uložit do tabulky
        const reportBuilder = new ErrorReportBuilder();
        reportBuilder.initializeReport(
          user,
          null,
          'ACCOUNT_LOCKED',
          `FB status: ${fbStatus}`,
          fbBot.page?.url() || 'unknown'
        );

        // Pokud má PageAnalyzer, přidej analýzu
        if (fbBot.pageAnalyzer) {
          try {
            const analysis = await fbBot.pageAnalyzer.analyzeFullPage();
            reportBuilder.addPageAnalysis(analysis);
          } catch (err) {
            reportBuilder.addNotes(`Analýza selhala: ${err.message}`);
          }
        }

        const reportId = await reportBuilder.saveReport();
        Log.info(`[${user.id}]`, `📊 Error report uložen s ID: ${reportId}`);
      }

      // Program pokračuje dál (s chybou nebo bez)
      throw new Error('FB login failed for UI command');
    }

    if (!fbStatus || !['still_loged', 'now_loged'].includes(fbStatus)) {
      throw new Error('FB login failed for UI command');
    }

    Log.success(`[${user.id}]`, 'FB úspěšně otevřen pro UI příkaz');

    // Proveď UI příkaz s timeoutem 5 minut
    const uiBot = new UIBot();
    let uiSuccess = false;

    try {
      // UI akce s timeoutem
      const uiPromise = uiBot.processCommand(uiCommand);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('UI command timeout')), 5 * 60 * 1000)
      );

      uiSuccess = await Promise.race([uiPromise, timeoutPromise]);

      if (uiSuccess) {
        Log.success(`[${user.id}]`, `UI příkaz ${uiCommand.command} dokončen, pokračuji s akcemi`);
      } else {
        await Log.warn(`[${user.id}]`, `UI příkaz ${uiCommand.command} selhal`);
      }
    } finally {
      await uiBot.close();
    }

    // A1: Po UI příkazu pokračuj s akcemi na kole štěstí (timeout 5 minut)
    return !browserClosed; // Pokračuj pouze pokud se prohlížeč nezavřel

  } catch (err) {
    await Log.error(`[${user.id}] executeUICommand`, err);

    // A2: Pokud byl prohlížeč uzavřen nebo chyba, cleanup a restart
    if (fbBot) {
      try { await fbBot.close(); } catch (e) { }
    }

    await cleanupBrowser(browser, browserClosed);
    return false; // Neporačuj s akcemi
  }

  // Ponech prohlížeč otevřený pro následující akce
  // browser, context, fbBot zůstávají aktivní
}

/**
 * VARIANTA B: Provedení UI příkazu pro aktuálního uživatele
 */
async function executeUICommandForCurrentUser(user, browser, context, fbBot, utioBot, uiCommand) {
  try {
    Log.info(`[${user.id}]`, `Provádím UI příkaz pro aktuálního uživatele: ${uiCommand.command}`);

    // Použij stávající FB connection
    const uiBot = new UIBot();
    let uiSuccess = false;

    try {
      // UI akce s timeoutem 5 minut (stejně jako varianta A)
      const uiPromise = uiBot.processCommand(uiCommand);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('UI command timeout')), 5 * 60 * 1000)
      );

      uiSuccess = await Promise.race([uiPromise, timeoutPromise]);

      if (uiSuccess) {
        Log.success(`[${user.id}]`, `UI příkaz ${uiCommand.command} dokončen`);
      } else {
        await Log.warn(`[${user.id}]`, `UI příkaz ${uiCommand.command} selhal`);
      }
    } catch (err) {
      if (err.message === 'UI command timeout') {
        await Log.warn(`[${user.id}]`, `UI příkaz ${uiCommand.command} vypršel (5 minut)`);
      } else {
        await Log.error(`[${user.id}]`, `UI příkaz ${uiCommand.command} chyba: ${err.message}`);
      }
    } finally {
      await uiBot.close();
    }

    // ČEKÁNÍ 5 MINUT po dokončení UI příkazu (stejně jako varianta A)
    Log.info(`[${user.id}]`, 'Čekám 5 minut po dokončení UI příkazu...');
    await wait.delay(5 * 60 * 1000); // 5 minut

    // Kontrola, zda se prohlížeč nezavřel během UI akce nebo čekání
    if (!browser || !browser.isConnected()) {
      await Log.warn(`[${user.id}]`, 'Prohlížeč se zavřel během/po UI příkazu');
      return false; // Způsobí restart cyklu
    }

    Log.info(`[${user.id}]`, 'Pokračuji s akcemi na kole štěstí po UI příkazu');
    return true; // Pokračuj s akcemi

  } catch (err) {
    await Log.error(`[${user.id}] executeUICommandForCurrentUser`, err);
    return false; // Nepokračuj - způsobí restart
  }
}

/**
 * Extrahuje požadovaného uživatele z UI příkazu
 */
async function extractRequestedUserFromUICommand(uiCommand) {
  try {
    // Parsuj data z UI příkazu
    const commandData = JSON.parse(uiCommand.data || '{}');

    // Různé typy UI příkazů mohou mít různé způsoby specifikace uživatele
    let userId = null;

    if (commandData.user_id) {
      userId = commandData.user_id;
    } else if (commandData.account_id) {
      userId = commandData.account_id;
    } else if (commandData.id) {
      userId = commandData.id;
    }

    if (userId) {
      const user = await db.getUserById(userId);
      return user;
    }

    return null;

  } catch (err) {
    await Log.warn('[WORKER]', `Chyba při extrakci uživatele z UI příkazu: ${err.message}`);
    return null;
  }
}

/**
 * KROK 9: Čekání s pravidelným heartBeat
 */
async function waitWithHeartbeat(waitMinutes = null) {
  const waitTime = waitMinutes || IvMath.randInterval(1, 5); // 1-5 minut náhodně
  const waitMs = waitTime * 60 * 1000;
  const heartBeatInterval = 30 * 1000; // 30 sekund

  Log.info('[WORKER]', `Krok 9: Čekám ${waitTime} minut s heartBeat každých 30s...`);

  let elapsed = 0;
  while (elapsed < waitMs) {
    // Odeslání heartBeat
    try {
      await db.heartBeat(0, 0, 'IVY4B3T');
      Log.debug('[WORKER]', 'Heartbeat odeslán během čekání');
    } catch (err) {
      await Log.warn('[WORKER]', `Chyba při heartBeat: ${err.message}`);
    }

    // Čekání 30 sekund nebo do konce
    const sleepTime = Math.min(heartBeatInterval, waitMs - elapsed);
    await wait.delay(sleepTime);
    elapsed += sleepTime;

    // Logování zbývajícího času každou minutu
    if (elapsed % 60000 === 0) {
      const remainingMinutes = Math.ceil((waitMs - elapsed) / 60000);
      Log.debug('[WORKER]', `Zbývá ${remainingMinutes} minut čekání...`);
    }
  }

  Log.info('[WORKER]', 'Čekání dokončeno, spouštím nový cyklus');
}

/**
 * Inicializuje služby podle potřeby (postupně, ne vše najednou)
 */
async function initializeRequiredServices(user, context, requirements, existingFbBot, existingUtioBot) {
  let fbBot = existingFbBot;
  let utioBot = existingUtioBot;

  try {
    // Inicializuj UTIO pouze pokud je potřeba a ještě není
    if (requirements.needsUtio && (!utioBot || !utioBot.isReady())) {
      Log.info(`[${user.id}]`, 'Inicializuji UTIO...');

      if (utioBot) await utioBot.close();

      utioBot = new UtioBot(context);
      if (!await utioBot.init() || !await utioBot.openUtio(user)) {
        throw new Error('UTIO initialization failed');
      }

      Log.success(`[${user.id}]`, 'UTIO úspěšně inicializováno');
    }

    // Inicializuj FB pouze pokud je potřeba a ještě není
    if (requirements.needsFB && (!fbBot || !fbBot.isReady())) {
      Log.info(`[${user.id}]`, 'Inicializuji FB...');

      if (fbBot) await fbBot.close();

      fbBot = new FBBot(context, user.id);
      if (!await fbBot.init() || !await fbBot.openFB(user)) {
        throw new Error('FB page open failed');
      }

      // Set debug context for interactive debugger (always enabled)
      if (fbBot.page) {
        setDebugContext(user, fbBot.page);
      }

      // --- NOVÁ LOGIKA ZPRACOVÁNÍ STAVU STRÁNKY ---
      let analysis = await fbBot.pageAnalyzer.analyzeFullPage({ forceRefresh: true });
      Log.info(`[${user.id}]`, `Počáteční analýza stránky dokončena se stavem: ${analysis.status}`);

      // Smyčka pro řešení speciálních stavů (cookies, reklamy)
      let attempts = 0;
      while (['cookie_consent_required', 'ad_consent_required'].includes(analysis.status) && attempts < 3) {
        attempts++;
        Log.warn(`[${user.id}]`, `Vyžadován mezikrok: ${analysis.status}. Pokus ${attempts}/3.`);

        if (analysis.status === 'cookie_consent_required') {
          await fbBot.acceptCookies();
        } else if (analysis.status === 'ad_consent_required') {
          await fbBot.resolveAdConsentFlow();
        }
        
        await wait.delay(2000, 3000); // Pauza po akci
        analysis = await fbBot.pageAnalyzer.analyzeFullPage({ forceRefresh: true });
        Log.info(`[${user.id}]`, `Analýza po nápravě dokončena se stavem: ${analysis.status}`);
      }
      
      // Finální kontrola po všech pokusech
      if (analysis.status !== 'ok' && !analysis.basic.isLoggedIn) {
         // Pokud nejsme přihlášeni a stránka není OK, zkusíme se přihlásit
         Log.info(`[${user.id}]`, 'Uživatel není přihlášen, pokouším se o login...');
         const loginSuccess = await fbBot.login(user);
         if (!loginSuccess) {
            throw new Error('FB login failed after handling special screens.');
         }
      } else if (analysis.status === 'ok' && analysis.basic.isLoggedIn) {
         Log.success(`[${user.id}]`, 'Uživatel je již přihlášen a stránka je v pořádku.');
      } else if (analysis.status !== 'ok') {
        throw new Error(`FB initialization failed with final status: ${analysis.status}`);
      }

      Log.success(`[${user.id}]`, 'FB úspěšně inicializován');
    }

    return { fbBot, utioBot };

  } catch (err) {
    // Cleanup při chybě
    if (fbBot && fbBot !== existingFbBot) {
      try { await fbBot.close(); } catch (e) { }
    }
    if (utioBot && utioBot !== existingUtioBot) {
      try { await utioBot.close(); } catch (e) { }
    }
    throw err;
  }
}

/**
 * Cleanup celého uživatelského sezení
 */
async function cleanupUserSession(user, browser, fbBot, utioBot, browserClosed) {
  Log.info(`[${user.id}]`, 'Krok 8: Cleanup uživatelského sezení...');

  // Vymaž invasive lock
  clearInvasiveLock();

  // Zavři boty
  if (fbBot) {
    try {
      await fbBot.close();
      Log.debug(`[${user.id}]`, 'FBBot uzavřen');
    } catch (err) {
      await Log.warn('[WORKER]', `Chyba při cleanup FBBot: ${err.message}`);
    }
  }

  if (utioBot) {
    try {
      await utioBot.close();
      Log.debug(`[${user.id}]`, 'UtioBot uzavřen');
    } catch (err) {
      await Log.warn('[WORKER]', `Chyba při cleanup UtioBot: ${err.message}`);
    }
  }

  // Zavři prohlížeč
  await cleanupBrowser(browser, browserClosed);
}

// ==========================================
// HELPER FUNKCE (stejné jako před tím)
// ==========================================

async function pauseOnError(browser, browserClosed) {
  await Log.warn('[WORKER]', 'Nastal error – čekám na uzavření prohlížeče nebo 10 minut.');
  if (browserClosed) {
    await wait.delay(10 * 60 * 1000);
    return;
  }

  await Promise.race([
    new Promise(resolve => browser.once('disconnected', resolve)),
    new Promise(resolve => setTimeout(resolve, 10 * 60 * 1000))
  ]);
}

async function prepareBrowser(user) {
  const profileDir = `Profile${user.id}`;
  const userDataDir = isLinux ? '/home/remotes/Chromium' : './profiles';
  const lockFile = path.join(userDataDir, profileDir, 'SingletonLock');

  try {
    // Nejprve zkontrolujeme, zda soubor existuje, a až pak se ho pokusíme smazat.
    if (fs.existsSync(lockFile)) {
      fs.unlinkSync(lockFile);
      Log.debug('[WORKER]', `Odstraněn existující SingletonLock pro ${profileDir}.`);
    }
  } catch (err) {
    // Chybu logujeme pouze pokud to není "soubor neexistuje", což je v pořádku.
    if (err.code !== 'ENOENT') {
      await Log.warn('[WORKER]', `Chyba při mazání SingletonLock: ${err.message}`);
    }
  }

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: [
      '--suppress-message-center-popups',
      '--disable-notifications',
      '--disable-infobars',
      '--disable-session-crashed-bubble',
      '--start-maximized',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      `--profile-directory=${profileDir}`,
      `--user-data-dir=${userDataDir}`
    ]
  });

  let browserClosed = false;
  browser.on('disconnected', async () => {
    browserClosed = true;
    await Log.warn('[WORKER]', 'Prohlížeč se odpojil.');
  });

  const context = browser.defaultBrowserContext();
  for (const origin of [
    'https://www.FB.com',
    'https://m.FB.com',
    'https://utio.b3group.cz'
  ]) {
    await context.overridePermissions(origin, []);
  }

  // Přidej browser do aktivních instances pro graceful shutdown
  activeBrowsers.add(browser);

  return { browser, context, browserClosed };
}

async function cleanupBrowser(browser, browserClosed) {
  if (DEBUG_KEEP_BROWSER_OPEN) {
    Log.info('[WORKER]', 'Debug režim: prohlížeč NEBUDE zavřen.');
    return;
  }

  if (browserClosed || !browser) {
    Log.info('[WORKER]', 'Prohlížeč již byl uzavřen nebo neexistuje.');
    // Odstraň z aktivních browsers pokud tam je
    activeBrowsers.delete(browser);
    return;
  }

  try {
    await wait.delay(2000, false);

    const closePromise = browser.close();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Browser close timeout')), 30000)
    );

    await Promise.race([closePromise, timeoutPromise]);
    Log.info('[WORKER]', 'Prohlížeč úspěšně uzavřen.');

  } catch (err) {
    await Log.warn('[WORKER]', `Chyba při uzavírání prohlížeče: ${err.message}`);

    try {
      const pages = await browser.pages();
      for (const page of pages) {
        await page.close();
      }
      await browser.close();
      Log.info('[WORKER]', 'Prohlížeč force-uzavřen.');
    } catch (forceErr) {
      await Log.error('[WORKER]', `Force close také selhal: ${forceErr.message}`);
    }
  } finally {
    // Odstraň browser z aktivních instances
    activeBrowsers.delete(browser);
  }
}

/**
 * Graceful shutdown všech aktivních browser instances
 */
export async function shutdownAllBrowsers() {
  if (activeBrowsers.size === 0) {
    Log.info('[WORKER]', 'Žádné aktivní browser instances k uzavření');
    return;
  }

  Log.info('[WORKER]', `Zavírám ${activeBrowsers.size} aktivních browser instances...`);
  
  const shutdownPromises = Array.from(activeBrowsers).map(async (browser) => {
    try {
      if (browser && !browser.isConnected()) {
        Log.debug('[WORKER]', 'Browser již není připojen, přeskakuji');
        return;
      }
      
      // Zavři všechny stránky
      const pages = await browser.pages();
      for (const page of pages) {
        if (!page.isClosed()) {
          await page.close();
        }
      }
      
      // Zavři browser
      await browser.close();
      Log.debug('[WORKER]', 'Browser instance úspěšně uzavřena');
    } catch (err) {
      Log.warn('[WORKER]', `Chyba při zavírání browser instance: ${err.message}`);
    }
  });

  try {
    // Čekej max 10 sekund na zavření všech browsers
    await Promise.race([
      Promise.all(shutdownPromises),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Shutdown timeout')), 10000)
      )
    ]);
    
    Log.success('[WORKER]', 'Všechny browser instances úspěšně uzavřeny');
  } catch (err) {
    Log.warn('[WORKER]', `Timeout při zavírání browsers: ${err.message}`);
  }
  
  // Vyčisti set
  activeBrowsers.clear();
}

async function showAccountLockStats() {
  try {
    const stats = await db.getAccountLockStats();
    if (stats && stats.length > 0) {
      stats.forEach(stat => {
        Log.info('[STATS]', `${stat.lock_type}: ${stat.count} celkem (${stat.last_24h} za 24h, ${stat.last_7d} za 7d)`);
      });
    }

    const recentLocks = await db.getRecentAccountLocks();
    if (recentLocks && recentLocks.length > 0) {
      Log.info('[STATS]', '=== Nedávná zablokování ===');
      recentLocks.forEach(lock => {
        Log.info('[STATS]', `${lock.lock_date}: ${lock.lock_type} - ${lock.daily_count}x`);
      });
    }
  } catch (err) {
    await Log.error('[STATS]', `Chyba při načítání statistik: ${err.message}`);
  }
}
