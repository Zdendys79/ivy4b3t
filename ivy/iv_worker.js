/**
 * Název souboru: iv_worker.js
 * Umístění: ~/ivy/iv_worker.js
 *
 * Popis: Hlavní smyčka robota s optimalizovaným otevíráním záložek.
 *        Otevírá Facebook/UTIO pouze když je to potřeba pro konkrétní akci.
 *        Upraveno pro použití nové UtioBot třídy.
 */

import fs from 'fs';
import path from 'path';
import os from 'node:os';
import puppeteer from 'puppeteer';
import * as wait from './iv_wait.js';
import * as db from './iv_sql.js';
import { FacebookBot } from './iv_fb.class.js';
import { UtioBot } from './iv_utio.class.js';
import * as ui from './iv_ui.js';
import * as support from './iv_support.js';
import { getRandomAction } from './iv_wheel.js';
import { runAction, getActionRequirements } from './iv_actions.js';
import { Log } from './iv_log.class.js';

const isLinux = process.platform === 'linux';
const hostname = os.hostname();
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
  let utioBot = null;

  // Inicializuj UTIO pouze pokud je potřeba
  if (requirements.needsUtio) {
    Log.info(`[${user.id}]`, 'Inicializuji UTIO pro akci...');
    utioBot = new UtioBot(context);

    if (!(await utioBot.init())) {
      throw new Error('Inicializace UTIO selhala');
    }

    if (!(await utioBot.openUtio(user))) {
      throw new Error('Login na UTIO selhal');
    }

    Log.success(`[${user.id}]`, 'UTIO úspěšně inicializováno a přihlášeno');
  }

  // Inicializuj Facebook pouze pokud je potřeba
  if (requirements.needsFacebook) {
    Log.info(`[${user.id}]`, 'Inicializuji Facebook pro akci...');
    fbBot = new FacebookBot(context);
    await fbBot.init();
    const fbStatus = await fbBot.openFB(user);

    // Použij novou detekci, ale jako fallback zachovej původní chování
    if (fbStatus === 'account_locked') {
      await db.lockAccount(user.id);
      throw new Error('Účet je zablokován.');
    }

    // Pokud je fbStatus objekt s detailními informacemi (nová detekce)
    if (typeof fbStatus === 'object' && fbStatus.locked) {
      const lockReason = fbStatus.reason || 'Nespecifikovaný problém';
      const lockType = fbStatus.type || 'UNKNOWN';

      // Pokud existují nové funkce, použij je, jinak fallback na staré
      if (typeof db.lockAccountWithReason === 'function') {
        await db.lockAccountWithReason(user.id, lockReason, lockType, hostname);

        if (typeof db.logAccountIssue === 'function') {
          await db.logAccountIssue(user.id, lockReason, lockType, {
            detection_method: 'enhanced_facebook_detection',
            timestamp: new Date().toISOString(),
            hostname: hostname
          }, hostname);
        }
      } else {
        // Fallback na původní metodu
        await db.lockAccount(user.id);
      }

      Log.error(`[${user.id}] Účet zablokován: ${lockReason} (${lockType})`);
      throw new Error(`Účet je zablokován: ${lockReason}`);
    }

    if (!['still_loged', 'now_loged'].includes(fbStatus)) {
      // Podobný fallback pro neúspěšné přihlášení
      if (typeof db.lockAccountWithReason === 'function') {
        await db.lockAccountWithReason(user.id, 'Neúspěšné přihlášení', 'LOGIN_FAILED', hostname);
      } else {
        await db.lockAccount(user.id);
      }
      throw new Error('Login na FB selhal');
    }

    Log.success(`[${user.id}]`, 'Facebook úspěšně inicializován a přihlášen');
  }

  return { fbBot, utioBot };
}

async function showAccountLockStats() {
  try {
    const stats = await db.getAccountLockStats();
    const recentLocks = await db.getRecentAccountLocks();

    if (!stats || stats.length === 0) {
      Log.info('[STATS]', 'Žádné statistiky zablokování účtů k dispozici');
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
  const { fbBot, utioBot } = await initializeRequiredServices(user, context, requirements);

  // Proveď akci - předej oba bot objekty pro zpětnou kompatibilitu
  const success = await runAction(user, fbBot, actionCode, utioBot);
  if (!success) {
    Log.warn(`[${user.id}]`, `Akce ${actionCode} NEPROVEDENA.`);
    await pauseOnError(browser, browserClosed);
    return;
  }

  const randMin = Math.floor(Math.random() * (max - min + 1)) + min;
  await db.updateUserActionPlan(user.id, actionCode, randMin);
  Log.success(`[${user.id}]`, `Akce ${actionCode} dokončena, další za ${randMin} minut.`);
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

export async function tick() {
  const user = await db.getUserForNextAction();
  if (!user) {
    if (Date.now() >= nextWorktime) {
      Log.info('[WORKER]', 'Žádný uživatel k práci.');
      await showAccountLockStats();
      nextWorktime = Date.now() + 5 * 60 * 1000;
    }
    return;
  }

  Log.info(`[${user.id}]`, `Spouštím akci pro ${user.name} ${user.surname}`);

  let browser, context, browserClosed;
  try {
    ({ browser, context, browserClosed } = await prepareBrowser(user));
    await support.closeBlankTabs(context);

    const uiCommand = await ui.checkUI(user.id);
    if (uiCommand) {
      await ui.handleUICommand(uiCommand, user.id, browser);
      return;
    }

    await executeUserAction(user, browser, context, browserClosed);

  } catch (err) {
    Log.error(`[${user.id}]`, err);
    await pauseOnError(browser, browserClosed);
  } finally {
    await cleanupBrowser(browser, browserClosed);
  }
}
