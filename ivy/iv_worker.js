/**
 * File: ivy/iv_worker.js
 * Path: ivy/iv_worker.js
 * Purpose: Hlavní smyčka robota – vybírá uživatele a spouští akce podle "kola štěstí".
 */
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import UserAgentOverride from 'puppeteer-extra-plugin-stealth/evasions/user-agent-override/index.js';
import * as wait from './iv_wait.js';
import * as db from './iv_sql.js';
import { FacebookBot } from './iv_fb.class.js';
import * as ui from './iv_ui.js';
import * as utio from './iv_utio.js';
import * as support from './iv_support.js';
import { getRandomActionCode } from './iv_wheel.js';
import { runAction } from './iv_actions.js';

// Configure puppeteer plugins
(async () => {
  puppeteer.use(UserAgentOverride({ referer: await support.randomReferer(), locale: 'cs-CZ,cs' }));
  puppeteer.use(StealthPlugin());
})();

const isLinux = process.platform === 'linux';
let next_worktime = Date.now() - 10;

export async function tick() {
  const uiCommand = await db.getUICommand();
  if (uiCommand) {
    console.log('UI příkaz detekován – zpracovávám...');
    await ui.solveUICommand(uiCommand);
    return;
  }

  const now = Date.now();
  if (now < next_worktime) {
    console.log('Čekám na další cyklus.');
    return;
  }

  try {
    const user = await db.getUser();
    if (!user) throw new Error('Žádný vhodný uživatel.');

    const profileDir = `Profile${user.id}`;
    const userDataDir = isLinux ? '/home/remotes/Chromium' : './profiles';
    const lockFile = path.join(userDataDir, profileDir, 'SingletonLock');
    try {
      fs.unlinkSync(lockFile);
      console.log(`SingletonLock pro ${profileDir} odstraněn.`);
    } catch (err) {
      if (err.code !== 'ENOENT') console.warn(`Chyba při mazání SingletonLock: ${err.message}`);
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
    browser.on('disconnected', async () => {
      browserClosed = true;
      console.warn(`[${user.id}] Prohlížeč zavřen, pauza 1 minuta.`);
      await wait.delay(60000);
    });

    const context = browser.defaultBrowserContext();
    for (const origin of ['https://www.facebook.com', 'https://m.facebook.com', 'https://utio.b3group.cz']) {
      await context.overridePermissions(origin, []);
    }

    console.log(`\n---\nZahajuji práci pro uživatele ${user.name} (${user.id})`);

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

    console.log('Uživatel úspěšně přihlášen a připraven.');

    await db.initUserActionPlan(user.id);
    const actions = await db.getUserActions(user.id);
    if (!actions.length) {
      console.log(`[${user.id}] Žádné dostupné akce.`);
    } else {
      const actionCode = await getRandomActionCode(user);
      console.log(`[${user.id}] Vybrána akce: ${actionCode}`);
      const result = await runAction(user, fbBot, actionCode);
      const [def] = await db.getActionDefinitions(actionCode);
      const randMin = Math.floor(Math.random() * (def.max_minutes - def.min_minutes + 1)) + def.min_minutes;
      await db.updateUserActionPlan(user.id, actionCode, randMin);
      console.log(`[${user.id}] Akce ${actionCode} dokončena (${result}); další za ${randMin} minut.`);
    }

    await wait.delay(wait.timeout());
    if (!browserClosed) await browser.close();
    next_worktime = Date.now() + Math.random() * 30000 + 30000;

  } catch (err) {
    console.error('Chyba při zpracování uživatele:', err);
    await wait.delay(30 * wait.timeout());
  }
}
