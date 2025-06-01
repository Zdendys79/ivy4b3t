/**
 * Název souboru: iv_worker.js
 * Umístění: ~/ivy/iv_worker.js
 *
 * Popis: Hlavní pracovní smyčka robota – vybírá uživatele, připravuje prostředí,
 *       přihlašuje do UTIO a Facebooku, volí a spouští akce z “kola štěstí”,
 *       ukládá výsledky a provádí úklid.
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
import { getRandomActionCode } from './iv_wheel.js';
import { runAction } from './iv_actions.js';

const isLinux = process.platform === 'linux';
let nextWorktime = 0;

/**
 * Ošetří případný UI příkaz z tabulky a vrátí true, pokud byl zpracován.
 * @returns {Promise<boolean>}
 */
async function handleUICommand() {
  const uiCommand = await db.getUICommand();
  if (!uiCommand) return false;

  console.log('UI příkaz detekován – zpracovávám...');
  await ui.solveUICommand(uiCommand);
  return true;
}

/**
 * Kontroluje, zda nastal čas spustit další cyklus.
 * @returns {boolean}
 */
function shouldRunNow() {
  return Date.now() >= nextWorktime;
}

/**
 * Připraví a vrátí instanci prohlížeče a context pro daného uživatele.
 * Zajistí odstranění případného zámku profilu a spuštění Puppeteer.
 * @param {Object} user – objekt uživatele s vlastností id
 * @returns {Promise<{ browser: import('puppeteer').Browser, context: import('puppeteer').BrowserContext }>}
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
    console.warn('Browser se odpojil, počkám minutu...');
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
 * Přihlásí se na UTIO a poté na Facebook.
 * Pokud se účet zablokuje nebo heslo nesedí, označí účet v DB jako zablokovaný.
 * @param {Object} user – objekt uživatele s vlastnostmi u_login, u_pass a id
 * @param {import('puppeteer').BrowserContext} context
 * @returns {Promise<FacebookBot>}
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
 * @param {Object} user – objekt uživatele s vlastnostmi id
 * @param {FacebookBot} fbBot
 * @returns {Promise<void>}
 */
async function executeUserAction(user, fbBot) {
  await db.initUserActionPlan(user.id);
  const actions = await db.getUserActions(user.id);

  if (!actions.length) {
    console.log(`[${user.id}] Žádné dostupné akce.`);
    return;
  }

  const actionCode = await getRandomActionCode(user);
  if (!actionCode) {
    console.warn(`[${user.id}] Nebyl nalezen action_code.`);
    return;
  }

  console.log(`[${user.id}] Vybrána akce: ${actionCode}`);
  const result = await runAction(user, fbBot, actionCode);

  // Získání definice pouze pro vybraný actionCode
  const defRow = await db.getActionDefinition(actionCode);
  if (!defRow) {
    console.warn(`[${user.id}] Definice akce ${actionCode} nenalezena.`);
    return;
  }

  const randMin =
    Math.floor(Math.random() * (defRow.max_minutes - defRow.min_minutes + 1)) +
    defRow.min_minutes;
  await db.updateUserActionPlan(user.id, actionCode, randMin);

  console.log(
    `[${user.id}] Akce ${actionCode} dokončena (${result}); další za ${randMin} minut.`
  );
}

/**
 * Ukončí instanci prohlížeče, pokud není již zavřená.
 * @param {import('puppeteer').Browser} browser
 * @param {boolean} browserClosed
 * @returns {Promise<void>}
 */
async function cleanupBrowser(browser, browserClosed) {
  if (!browserClosed) {
    await browser.close();
  }
}

/**
 * Nastaví následující čas spuštění na 30–60 sekund do budoucna.
 */
function updateNextWorktime() {
  nextWorktime = Date.now() + Math.random() * 30000 + 30000;
}

/**
 * Hlavní pracovní smyčka – zpracuje UI příkaz, přihlásí uživatele, provede akci a poté úklid.
 */
export async function tick() {
  try {
    if (await handleUICommand()) {
      return;
    }

    if (!shouldRunNow()) {
      console.log('Čekám na další cyklus.');
      return;
    }

    const user = await db.getUser();
    if (!user) {
      throw new Error('Žádný vhodný uživatel.');
    }

    const { browser, context, browserClosed } = await prepareBrowser(user);
    const fbBot = await loginToUtioAndFacebook(user, context);
    await executeUserAction(user, fbBot);
    await wait.delay(wait.timeout());
    await cleanupBrowser(browser, browserClosed);
    updateNextWorktime();
  } catch (err) {
    const type = err?.name || typeof err;
    const message = err?.message || String(err);
    const stack = err?.stack ? '\n' + err.stack : '';
    console.error(`[iv_worker] Chyba při zpracování uživatele [${type}]: ${message}${stack}`);
    await wait.delay(30 * wait.timeout());
  }
}
