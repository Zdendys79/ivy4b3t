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
import * as fb from './iv_fb.js';
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

/**
 * Jeden tick hlavní smyčky: polling UI, výběr uživatele a provedení akce.
 */
export async function tick() {
  // 1) Poll UI commands
  const uiCommand = await db.getUICommand();
  if (uiCommand) {
    console.log('UI příkaz detekován – zpracovávám...');
    await ui.solveUICommand(uiCommand);
    return;
  }

  // 2) Wait for next work cycle
  const now = Date.now();
  if (now < next_worktime) {
    console.log('Čekám na další cyklus.');
    return;
  }

  try {
    // 3) Check neighborhood lock
    const recent = await db.getRecentlyLogedUserFromMyNeighborhood();
    if (!recent) throw new Error('Jiný uživatel je stále aktivní.');

    // 4) Fetch user to work
    const user = await db.getUser();
    if (!user) throw new Error('Žádný vhodný uživatel.');

    // 5) Cleanup old Chromium lock
    const profileDir = `Profile${user.id}`;
    const userDataDir = isLinux ? '/home/remotes/Chromium' : './profiles';
    const lockFile = path.join(userDataDir, profileDir, 'SingletonLock');
    try {
      fs.unlinkSync(lockFile);
      console.log(`SingletonLock pro ${profileDir} odstraněn.`);
    } catch (err) {
      if (err.code !== 'ENOENT') console.warn(`Chyba při mazání SingletonLock: ${err.message}`);
    }

    // 6) Launch browser
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

    // Override permissions
    const context = browser.defaultBrowserContext();
    for (const origin of ['https://www.facebook.com', 'https://m.facebook.com', 'https://utio.b3group.cz']) {
      await context.overridePermissions(origin, []);
    }

    console.log(`\n---\nZahajuji práci pro uživatele ${user.name} (${user.id})`);

    // 7) UTIO login
    await utio.newUtioTab(context);
    if (!(await utio.openUtio(user.u_login, user.u_pass))) {
      throw new Error('Login na UTIO selhal.');
    }

    // 8) Facebook login
    await fb.newFbTab(context);
    const fbStatus = await fb.openFB(user);
    if (fbStatus === 'account_locked') {
      await db.lockAccount(user.id);
      throw new Error('Účet je zablokován.');
    }
    if (!['still_loged', 'now_loged'].includes(fbStatus)) {
      await db.lockAccount(user.id);
      throw new Error('Login na FB selhal.');
    }
    await db.userLogedToFB(user.id);

    // 9) Pre-actions
    await support.closeBlankTabs(context);

    console.log('Uživatel úspěšně přihlášen a připraven.');

    // 10) Wheel of Fortune – initialize and select action
    await db.initUserActionPlan(user.id);
    const actions = await db.getUserActions(user.id);
    if (!actions.length) {
      console.log(`[${user.id}] Žádné dostupné akce.`);
    } else {
      const actionCode = await getRandomActionCode(user);
      console.log(`[${user.id}] Vybrána akce: ${actionCode}`);
      const result = await runAction(user, actionCode);
      // Schedule next execution
      const [def] = await db.getActionDefinitions(actionCode);
      const randMin = Math.floor(Math.random() * (def.max_minutes - def.min_minutes + 1)) + def.min_minutes;
      await db.updateUserActionPlan(user.id, actionCode, randMin);
      console.log(`[${user.id}] Akce ${actionCode} dokončena (${result}); další za ${randMin} minut.`);
    }

    // 11) Delay and cleanup browser
    await wait.delay(wait.timeout());
    if (!browserClosed) await browser.close();
    next_worktime = Date.now() + Math.random() * 30000 + 30000;

  } catch (err) {
    console.error('Chyba při zpracování uživatele:', err);
    await wait.delay(30 * wait.timeout());
  }
}
