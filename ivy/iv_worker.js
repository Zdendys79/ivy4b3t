/**
 * Soubor: iv_worker.js
 * Umístění: ~/ivy/iv_worker.js
 *
 * Popis: Hlavní smyčka robota – obsahuje helper pauseOnError,
 *       který při selhání akce zastaví běh na 10 minut nebo do uzavření prohlížeče.
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
import { runAction } from './iv_actions.js';

const isLinux = process.platform === 'linux';
let nextWorktime = 0;

// Pokud DEBUG_KEEP_BROWSER_OPEN=true, prohlížeč se nezavře ani při chybě
const DEBUG_KEEP_BROWSER_OPEN = process.env.DEBUG_KEEP_BROWSER_OPEN === 'true';

/**
 * Čeká buď dokud se prohlížeč nezavře, nebo uplyne 10 minut.
 * @param {puppeteer.Browser} browser
 * @param {boolean} browserClosed – true, pokud už byl browser předchozí chybou uzavřen
 */
async function pauseOnError(browser, browserClosed) {
  console.warn('[iv_worker] Nastal error – čekám na ruční uzavření prohlížeče nebo 10 minut.');
  if (browserClosed) {
    // Pokud už byl prohlížeč uzavřen, stačí jen počkat 10 minut
    await wait.delay(10 * 60 * 1000);
    return;
  }

  // Jinak vyčkáme na událost "disconnected" nebo max. 10 minut
  await Promise.race([
    new Promise(resolve => browser.once('disconnected', resolve)),
    new Promise(resolve => setTimeout(resolve, 10 * 60 * 1000))
  ]);
}

/**
 * Vytvoří a vrátí instanci prohlížeče + context + flag browserClosed.
 */
async function prepareBrowser(user) {
  const profileDir = `Profile${user.id}`;
  const userDataDir = isLinux ? '/home/remotes/Chromium' : './profiles';
  const lockFile = path.join(userDataDir, profileDir, 'SingletonLock');

  try {
    fs.unlinkSync(lockFile);
    console.log(`SingletonLock pro ${profileDir} odstraněn.`);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.warn(`Chyba při mazání SingletonLock: ${err.message}`);
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
    console.warn('[iv_worker] Browser se odpojil.');
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

/**
 * Přihlášení na UTIO a Facebook (beze změny).
 */
async function loginToUtioAndFacebook(user, context) {
  await utio.newUtioTab(context);
  if (!(await utio.openUtio(user.u_login, user.u_pass))) {
    throw new Error('Login na UTIO selhal.');
  }

  const fbBot = new FacebookBot(context);
  await fbBot.init();
  const fbStatus = await fbBot.openFB(user);

  if (fbStatus === 'account_locked') {
    await db.lockAccount(user.id);
    throw new Error('Účet je zablokován.');
  }

  if (!['still_loged', 'now_loged'].includes(fbStatus)) {
    await db.lockAccount(user.id);
    throw new Error('Login na FB selhal.');
  }

  await db.userLogedToFB(user.id);
  await support.closeBlankTabs(context);

  return fbBot;
}

/**
 * Provádí výběr a spuštění jedné akce pro uživatele.
 * Pokud runAction vrátí false (chyba), zavolá pauseOnError.
 */
async function executeUserAction(user, fbBot, browser, browserClosed) {
  await db.initUserActionPlan(user.id);

  const actions = await db.getUserActions(user.id);
  console.log(`--- DEBUG: getUserActions pro user.id=${user.id} ---`);
  console.log(actions.map(a => a.action_code).join(', ') || 'Žádné');
  console.log('--- konec DEBUG ---');

  if (!actions.length) {
    console.log(`[${user.id}] Žádné dostupné akce.`);
    return;
  }

  const picked = await getRandomAction(user);
  if (!picked) {
    console.warn(`[${user.id}] Kolo štěstí vrátilo null (žádné definice).`);
    return;
  }

  const actionCode = picked.code;
  const min = picked.min_minutes;
  const max = picked.max_minutes;

  console.log(`[${user.id}] Vybrána akce: ${actionCode}`);
  const success = await runAction(user, fbBot, actionCode);

  if (!success) {
    // Pokud něco selhalo, počkáme do ručního zavření okna nebo 10 minut
    await pauseOnError(browser, browserClosed);
    return;
  }

  // Pokud vše proběhlo v pořádku, naplánujeme příští termín
  const randMin = Math.floor(Math.random() * (max - min + 1)) + min;
  await db.updateUserActionPlan(user.id, actionCode, randMin);

  console.log(
    `[${user.id}] Akce ${actionCode} dokončena (true); ` +
    `další za ${randMin} minut.`
  );
}

/**
 * Ukončí instanci prohlížeče, pokud NENÍ zapnutý debug mód (tj. DEBUG_KEEP_BROWSER_OPEN=false).
 */
async function cleanupBrowser(browser, browserClosed) {
  if (DEBUG_KEEP_BROWSER_OPEN) {
    console.log('[DEBUG] Debug režim: prohlížeč NEBUDE zavřen.');
    return;
  }
  if (!browserClosed) {
    await browser.close();
    console.log('[iv_worker] Prohlížeč uzavřen.');
  }
}

/**
 * Nastaví následující čas spuštění na 30–60 sekund do budoucna.
 */
function updateNextWorktime() {
  nextWorktime = Date.now() + Math.random() * 30000 + 30000;
}

/**
 * Hlavní pracovní smyčka – zpracuje UI příkaz, přihlásí uživatele, provede akci
 *               a poté úklid (nebo pauzu, pokud došlo k chybě).
 */
export async function tick() {
  try {
    // 1) zpracování UI příkazu (pokud existuje)
    const uiCommand = await db.getUICommand();
    if (uiCommand) {
      console.log('UI příkaz detekován – zpracovávám...');
      await ui.solveUICommand(uiCommand);
      return;
    }

    // 2) kontrola, jestli je čas spustit další cyklus
    if (Date.now() < nextWorktime) {
      console.log('Čekám na další cyklus.');
      return;
    }

    // 3) načtení uživatele
    const user = await db.getUser();
    if (!user) {
      throw new Error('Žádný vhodný uživatel.');
    }

    // 4) příprava prohlížeče
    const { browser, context, browserClosed } = await prepareBrowser(user);

    // 5) přihlášení UTIO + FB
    const fbBot = await loginToUtioAndFacebook(user, context);

    // 6) provedení akce s případnou pauzou při chybě
    await executeUserAction(user, fbBot, browser, browserClosed);

    // 7) krátké čekání (simulace lidské pauzy)
    await wait.delay(wait.timeout());

    // 8) úklid (nebo ponechání okna otevřeného v debug módu)
    await cleanupBrowser(browser, browserClosed);

    // 9) nastavení dalšího času spuštění
    updateNextWorktime();

  } catch (err) {
    const type = err?.name || typeof err;
    const message = err?.message || String(err);
    const stack = err?.stack ? '\n' + err.stack : '';
    console.error(`[iv_worker] Chyba v hlavní smyčce [${type}]: ${message}${stack}`);

    // Pokud došlo k chybě dřív, než se spustila akce, počkáme 10 minut
    if (!DEBUG_KEEP_BROWSER_OPEN) {
      await wait.delay(10 * 60 * 1000);
    }
  }
}
