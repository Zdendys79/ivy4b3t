/**
 * Název souboru: loginuser.js
 * Umístění: ~/ivy/loginuser.js
 *
 * Popis: Pomocný skript pro ruční přihlášení uživatele přímo z konzole na vzdálené ploše VM.
 *        Aktualizováno pro použití nových iv_ modulů a architektury tříd.
 */

import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'readline';
import puppeteer from 'puppeteer';

import { db } from './iv_sql.js'
import { FBBot } from './libs/iv_fb.class.js';
import { Log } from './libs/iv_log.class.js';

import { Wait } from './libs/iv_wait.class.js';

const isLinux = process.platform === 'linux';
const hostname = os.hostname();
let browser;
let selectedUser = null;

// Graceful shutdown
process.on('SIGTERM', async () => {
  Log.info('[LOGINUSER]', 'Získán SIGTERM, zavírám browser...');
  if (browser) {
    await browser.close();
  }
  Log.info('[LOGINUSER]', 'Process ukončen');
  process.exit(0);
});

process.on('SIGINT', async () => {
  Log.info('[LOGINUSER]', 'Získán SIGINT (Ctrl+C), zavírám browser...');
  if (browser) {
    await browser.close();
  }
  Log.info('[LOGINUSER]', 'Process ukončen');
  process.exit(0);
});

(async () => {
  try {
    // Načti dostupné uživatele na tomto hostu
    Log.info('[LOGINUSER]', `Načítám uživatele pro host: ${hostname}`);

    const users = await db.getUsersByHostname();
    if (!users || users.length === 0) {
      throw new Error(`Na tomto hostu (${hostname}) nejsou žádní uživatelé.`);
    }

    // Zobraz seznam dostupných uživatelů
    console.log('\n=== DOSTUPNÍ UŽIVATELÉ ===');
    users.forEach(user => {
      const workTime = user.next_worktime ? new Date(user.next_worktime).toISOString().replace('T', ' ').substring(0, 19) + ' UTC' : 'N/A';
      console.log(`${user.id} - ${user.name} ${user.surname} / ${user.e_mail || user.fb_login} (limit: ${user.day_limit}, next_worktime: ${workTime})`);
    });
    console.log('');

    // Vyber uživatele
    const userId = await promptForUserId();
    if (!userId || userId <= 0) {
      throw new Error('Neplatné ID uživatele');
    }

    selectedUser = await db.getUserById(userId);
    if (!selectedUser) {
      throw new Error(`Uživatel s ID ${userId} nebyl nalezen`);
    }

    const currentTime = new Date();
    Log.info('[LOGINUSER]', `Aktuální čas: ${currentTime.getHours()}:${('0' + currentTime.getMinutes()).slice(-2)}`);
    Log.info('[LOGINUSER]', `Vybraný uživatel: [${selectedUser.id}] ${selectedUser.name} ${selectedUser.surname} (limit: ${selectedUser.day_limit})`);

    // Nastav worktime na zítra (zruší automatické spuštění)
    await db.updateUserWorktime(selectedUser, 24 * 60); // 24 hodin = zítra
    Log.success('[LOGINUSER]', 'Worktime nastaven na zítra - automatické spuštění zrušeno');

    // Zaloguj ruční přihlášení
    await db.userLog(selectedUser, 'manual_login', '', 'Uživatel ručně přihlášen (loginuser.js)');

    // Spusť browser s profilem uživatele
    browser = await launchBrowserForUser(selectedUser);

    // Inicializuj FBBot
    const context = browser.defaultBrowserContext();
    const fbBot = new FBBot(context);

    if (!await fbBot.init()) {
      throw new Error('Inicializace FBBot selhala');
    }

    // Přihlas se na FB
    Log.info('[LOGINUSER]', 'Přihlašuji se na FB...');
    const loginSuccess = await fbBot.openFB(selectedUser);

    if (loginSuccess) {
      Log.success('[LOGINUSER]', `Uživatel ${selectedUser.name} ${selectedUser.surname} úspěšně přihlášen na FB!`);
      await db.userLogedToFB(selectedUser.id);
    } else {
      await Log.error('[LOGINUSER]', 'Přihlášení na FB selhalo');
    }

    // Počkej hodinu (nebo dokud uživatel browser nezavře)
    Log.info('[LOGINUSER]', 'Browser je otevřený. Čekám hodinu nebo dokud browser nezavřete...');
    Log.info('[LOGINUSER]', 'Pro předčasné ukončení použijte Ctrl+C');

    await Promise.race([
      Wait.toMinutes(60, '1 hodina timeout'), // 1 hodina
      new Promise(resolve => browser.on('disconnected', resolve))
    ]);

    Log.info('[LOGINUSER]', 'Časový limit vypršel nebo browser byl zavřen');

  } catch (err) {
    await Log.error('[LOGINUSER]', `Chyba: ${err.message}`);
    console.error(err);
  } finally {
    if (browser) {
      try {
        await browser.close();
        Log.info('[LOGINUSER]', 'Browser úspěšně zavřen');
      } catch (err) {
        await Log.warn('[LOGINUSER]', `Chyba při zavírání browseru: ${err.message}`);
      }
    }

    // Ukonči proces
    process.exit(0);
  }
})();

/**
 * Spustí browser s profilem konkrétního uživatele
 * @param {Object} user - Uživatelská data
 * @returns {Promise<Browser>} Puppeteer browser instance
 */
async function launchBrowserForUser(user) {
  const profileDir = `Profile${user.id}`;
  const userDataDir = isLinux ? '/home/remotes/Chromium' : './profiles';

  // Odstraň SingletonLock pokud existuje
  const lockFile = path.join(userDataDir, profileDir, 'SingletonLock');
  try {
    fs.unlinkSync(lockFile);
    Log.info('[LOGINUSER]', `SingletonLock pro ${profileDir} odstraněn`);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      await Log.warn('[LOGINUSER]', `Chyba při mazání SingletonLock: ${err.message}`);
    }
  }

  // Získej náhodný referer
  const referer = await getRandomReferer();

  Log.info('[LOGINUSER]', `Spouštím browser s profilem: ${profileDir}`);
  Log.info('[LOGINUSER]', `Použitý referer: ${referer}`);

  const browserConfig = {
    headless: false,
    defaultViewport: null,
    args: [
      '--suppress-message-center-popups',
      '--disable-notifications',
      '--disable-infobars',
      '--disable-session-crashed-bubble',
      '--disable-restore-session-state',
      '--hide-crash-restore-bubble',
      '--disable-background-networking',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-features=TranslateUI,SessionRestore',
      '--disable-ipc-flooding-protection',
      '--disable-prompt-on-repost',
      '--disable-hang-monitor',
      '--disable-client-side-phishing-detection',
      '--disable-popup-blocking',
      '--start-maximized',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      `--user-data-dir=${userDataDir}`,
      `--profile-directory=${profileDir}`
    ]
  };

  const launchedBrowser = await puppeteer.launch(browserConfig);

  // Nastav oprávnění pro FB a UTIO
  const context = launchedBrowser.defaultBrowserContext();
  for (const origin of [
    'https://www.FB.com',
    'https://m.FB.com',
    'https://utio.b3group.cz'
  ]) {
    await context.overridePermissions(origin, []);
  }

  return launchedBrowser;
}

/**
 * Získá náhodný referer z databáze
 * @returns {Promise<string>} URL refereru
 */
async function getRandomReferer() {
  try {
    const result = await db.getRandomReferer();
    if (result && result.url) {
      return result.url;
    }
  } catch (err) {
    await Log.warn('[LOGINUSER]', `Chyba při získávání refereru z DB: ${err.message}`);
  }

  // Fallback referer
  return 'https://www.google.cz';
}

/**
 * Vyzve uživatele k zadání ID uživatele
 * @returns {Promise<number>} ID vybraného uživatele
 */
async function promptForUserId() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    rl.question('Zadejte ID uživatele: ', (answer) => {
      rl.close();
      const userId = parseInt(answer, 10);
      resolve(isNaN(userId) ? 0 : userId);
    });
  });
}
