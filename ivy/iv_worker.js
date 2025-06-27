/**
 * Název souboru: iv_worker.js
 * Umístění: ~/ivy/iv_worker.js
 *
 * Popis: Hlavní smyčka robota s optimalizovaným otevíráním záložek.
 *        Otevírá Facebook/UTIO pouze když je to potřeba pro konkrétní akci.
 */

import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import * as wait from './iv_wait.js';
import * as db from './iv_sql.js';
import { FacebookBot } from './iv_fb.class.js';
import * as ui from './iv_ui.js';
import * as utio from './iv_utio.js';
import * as support from './iv_support.js';
import { getRandomAction } from './iv_wheel.js';
import { runAction, getActionRequirements } from './iv_actions.js';
import { Log } from './iv_log.class.js';

const isLinux = process.platform === 'linux';
let nextWorktime = 0;

const DEBUG_KEEP_BROWSER_OPEN = process.env.DEBUG_KEEP_BROWSER_OPEN === 'true';

async function pauseOnError(browser, browserClosed) {
  Log.warn('[WORKER]', 'Nastal error – čekám na uzavření prohlížeče nebo 10 minut.');
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
    fs.unlinkSync(lockFile);
    Log.info('[WORKER]', `SingletonLock pro ${profileDir} odstraněn.`);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      Log.warn('[WORKER]', `Chyba při mazání SingletonLock: ${err.message}`);
    }
  }

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: [
      '--suppress-message-center-popups',
      '--disable-notifications',
      '--disable-infobars',
      '--start-maximized',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      `--profile-directory=${profileDir}`,
      `--user-data-dir=${userDataDir}`
    ]
  });

  let browserClosed = false;
  browser.on('disconnected', () => {
    browserClosed = true;
    Log.warn('[WORKER]', 'Prohlížeč se odpojil.');
  });

  const context = browser.defaultBrowserContext();
  for (const origin of [
    'https://www.facebook.com',
    'https://m.facebook.com',
    'https://utio.b3group.cz'
  ]) {
    await context.overridePermissions(origin, []);
  }

  return { browser, context, browserClosed };
}

async function initializeRequiredServices(user, context, requirements) {
  let fbBot = null;
  let utioInitialized = false;

  // Inicializuj UTIO pouze pokud je potřeba
  if (requirements.needsUtio) {
    Log.info(`[${user.id}]`, 'Inicializuji UTIO pro akci...');
    await utio.newUtioTab(context);
    if (!(await utio.openUtio(user.u_login, user.u_pass))) {
      throw new Error('Login na UTIO selhal.');
    }
    utioInitialized = true;
  }

  // Inicializuj Facebook pouze pokud je potřeba
  if (requirements.needsFacebook) {
    Log.info(`[${user.id}]`, 'Inicializuji Facebook pro akci...');
    fbBot = new FacebookBot(context);
    await fbBot.init();
    const fbStatus = await fbBot.openFB(user);

    // Použij novou detekci zablokovaných účtů
    if (fbStatus === 'account_locked' || (typeof fbStatus === 'object' && fbStatus.locked)) {
      let lockReason = 'Nespecifikovaný problém';
      let lockType = 'UNKNOWN';
      
      if (typeof fbStatus === 'object') {
        lockReason = fbStatus.reason || lockReason;
        lockType = fbStatus.type || lockType;
      } else {
        // Fallback pro starou detekci
        lockReason = 'Účet je zablokován (starší detekce)';
        lockType = 'ACCOUNT_LOCKED';
      }

      // Zablokuj účet s důvodem a typem
      await db.lockAccountWithReason(user.id, lockReason, lockType, hostname);
      
      // Přidej záznam do systémového logu
      await db.logAccountIssue(user.id, lockReason, lockType, {
        detection_method: 'enhanced_facebook_detection',
        timestamp: new Date().toISOString(),
        hostname: hostname
      }, hostname);

      Log.error(`[${user.id}] Účet zablokován: ${lockReason} (${lockType})`);
      throw new Error(`Účet je zablokován: ${lockReason}`);
    }

    if (!['still_loged', 'now_loged'].includes(fbStatus)) {
      await db.lockAccountWithReason(user.id, 'Neúspěšné přihlášení', 'LOGIN_FAILED', hostname);
      throw new Error('Login na FB selhal.');
    }

    await db.userLogedToFB(user.id);
  }

  // Zavři prázdné záložky pouze když něco otevíráme
  if (requirements.needsFacebook || requirements.needsUtio) {
    await support.closeBlankTabs(context);
  }

  return { fbBot, utioInitialized };
}

// Přidej novou funkce pro monitoring zablokovaných účtů
async function checkAccountHealth(user) {
  try {
    const lockStatus = await db.checkAccountLockStatus(user.id);
    
    if (lockStatus && lockStatus.is_locked) {
      Log.warn(`[${user.id}] Účet je označen jako zablokovaný: ${lockStatus.lock_reason} (${lockStatus.lock_type})`);
      return false;
    }
    
    return true;
  } catch (err) {
    Log.error(`[${user.id}] Chyba při kontrole stavu účtu: ${err}`);
    return true; // V případě chyby pokračuj
  }
}

// Aktualizace hlavní tick() funkce
export async function tick() {
  try {
    const uiCommand = await db.getUICommand();
    if (uiCommand) {
      Log.info('[TICK]', 'Detekován UI příkaz – zpracovávám...');
      await ui.solveUICommand(uiCommand);
      return;
    }

    if (Date.now() < nextWorktime) {
      Log.info('[TICK]', 'Ještě nenastal čas na další cyklus.');
      return;
    }

    const user = await db.getUser(); // Už obsahuje AND locked IS NULL
    if (!user) {
      Log.info('[TICK]', 'Žádný dostupný uživatel (všichni zablokovaní nebo zaneprázdněni).');
      
      // Zkus najít zablokovaného uživatele pro debug info
      const lockedStats = await db.getLockedAccountsStats();
      if (lockedStats.length > 0) {
        Log.info('[TICK]', `Zablokované účty: ${lockedStats.map(s => `${s.lock_type}: ${s.count}`).join(', ')}`);
      }
      
      nextWorktime = Date.now() + (30 * 1000); // Zkus znovu za 30 sekund
      return;
    }

    // Dodatečná kontrola stavu účtu
    if (!(await checkAccountHealth(user))) {
      Log.warn(`[${user.id}] Přeskakujem uživatele kvůli problémům s účtem`);
      nextWorktime = Date.now() + (10 * 1000);
      return;
    }

    Log.info('[TICK]', `Zpracovávám uživatele ${user.id} ${user.name} ${user.surname}`);

    const { browser, context, browserClosed } = await prepareBrowser(user);

    try {
      await executeUserAction(user, browser, context, browserClosed);
      
      const sleepTime = await db.getReferenceSleepTime(user.id);
      nextWorktime = Date.now() + sleepTime;
      
      Log.info('[TICK]', `Další cyklus za ${Math.round(sleepTime / 1000)}s`);

    } catch (err) {
      Log.error('[TICK]', `Chyba při zpracování uživatele ${user.id}: ${err}`);
      
      // Pokud je chyba související se zablokováním, nezablokuj znovu
      if (!err.message.includes('zablokován')) {
        await pauseOnError(browser, browserClosed);
      }
      
      nextWorktime = Date.now() + (60 * 1000); // Zkus znovu za minutu
    } finally {
      if (!DEBUG_KEEP_BROWSER_OPEN && browser && !browserClosed) {
        try {
          await browser.close();
          Log.info('[TICK]', 'Prohlížeč uzavřen.');
        } catch (err) {
          Log.warn('[TICK]', `Chyba při zavírání prohlížeče: ${err}`);
        }
      }
    }

  } catch (err) {
    Log.error('[TICK]', err);
    nextWorktime = Date.now() + (5 * 60 * 1000); // Zkus znovu za 5 minut při systémové chybě
  }
}

// Přidej funkci pro reporting statistik zablokovaných účtů
export async function reportLockStatistics() {
  try {
    const stats = await db.getLockedAccountsStats();
    const recentLocks = await db.getRecentLocksByType(7);
    
    Log.info('[STATS]', '=== Statistiky zablokovaných účtů ===');
    
    if (stats.length === 0) {
      Log.info('[STATS]', 'Žádné zablokované účty.');
      return;
    }
    
    stats.forEach(stat => {
      Log.info('[STATS]', `${stat.lock_type}: ${stat.count} celkem (${stat.last_24h} za 24h, ${stat.last_7d} za 7d)`);
    });
    
    if (recentLocks.length > 0) {
      Log.info('[STATS]', '=== Nedávná zablokování ===');
      recentLocks.forEach(lock => {
        Log.info('[STATS]', `${lock.lock_date}: ${lock.lock_type} - ${lock.daily_count}x`);
      });
    }
    
  } catch (err) {
    Log.error('[STATS]', `Chyba při načítání statistik: ${err}`);
  }
}

async function executeUserAction(user, browser, context, browserClosed) {
  await db.initUserActionPlan(user.id);
  const actions = await db.getUserActions(user.id);

  Log.db('[WORKER]', `getUserActions: ${actions.map(a => a.action_code).join(', ') || 'Žádné'}`);

  if (!actions.length) {
    Log.warn(`[${user.id}]`, 'Žádné dostupné akce.');
    return;
  }

  // Vyber akci pomocí kola štěstí s kontrolou limitů
  const picked = await getRandomAction(actions, user.id);
  if (!picked) {
    Log.warn(`[${user.id}]`, 'Kolo štěstí vrátilo null (možná blokováno limity).');
    return;
  }

  const actionCode = picked.code;
  const min = picked.min_minutes;
  const max = picked.max_minutes;

  Log.info(`[${user.id}]`, `Vybrána akce: ${actionCode}`);

  // Zjisti požadavky akce
  const requirements = getActionRequirements(actionCode);
  Log.info(`[${user.id}]`, `Požadavky akce: FB=${requirements.needsFacebook}, UTIO=${requirements.needsUtio}`);

  // Inicializuj pouze potřebné služby
  const { fbBot } = await initializeRequiredServices(user, context, requirements);

  // Proveď akci
  const success = await runAction(user, fbBot, actionCode);
  if (!success) {
    Log.warn(`[${user.id}]`, `Akce ${actionCode} NEPROVEDENA.`);
    await pauseOnError(browser, browserClosed);
    return;
  }

  const randMin = Math.floor(Math.random() * (max - min + 1)) + min;
  await db.updateUserActionPlan(user.id, actionCode, randMin);
  Log.success(`[${user.id}]`, `Akce ${actionCode} dokončena, další za ${randMin} minut.`);
}

export async function tick() {
  try {
    const uiCommand = await db.getUICommand();
    if (uiCommand) {
      Log.info('[TICK]', 'Detekován UI příkaz – zpracovávám...');
      await ui.solveUICommand(uiCommand);
      return;
    }

    if (Date.now() < nextWorktime) {
      Log.info('[TICK]', 'Ještě nenastal čas na další cyklus.');
      return;
    }

    const user = await db.getUser();
    if (!user) throw new Error('Žádný vhodný uživatel.');

    await runWithBrowser(user);
    updateNextWorktime();

  } catch (err) {
    Log.error('[TICK]', err);
    if (!DEBUG_KEEP_BROWSER_OPEN) {
      await wait.delay(10 * 60 * 1000);
    }
  }
}

async function cleanupBrowser(browser, browserClosed) {
  if (DEBUG_KEEP_BROWSER_OPEN) {
    Log.info('[WORKER]', 'Debug režim: prohlížeč NEBUDE zavřen.');
    return;
  }
  if (!browserClosed) {
    await browser.close();
    Log.info('[WORKER]', 'Prohlížeč uzavřen.');
  }
}

function updateNextWorktime() {
  nextWorktime = Date.now() + Math.random() * 30000 + 30000;
}

async function runWithBrowser(user) {
  const { browser, context, browserClosed } = await prepareBrowser(user);

  try {
    await executeUserAction(user, browser, context, browserClosed);
    await wait.delay(wait.timeout());
  } catch (err) {
    Log.error(`[WORKER][user:${user.id}]`, err);
    if (!DEBUG_KEEP_BROWSER_OPEN) {
      await wait.delay(10 * 60 * 1000);
    }
  } finally {
    await cleanupBrowser(browser, browserClosed);
  }
}
