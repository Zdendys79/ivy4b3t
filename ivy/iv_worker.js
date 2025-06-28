/**
 * Název souboru: iv_worker.js
 * Umístění: ~/ivy/iv_worker.js
 *
 * Popis: Hlavní smyčka robota s optimalizovaným otevíráním záložek a UIBot integrací.
 *        Kontroluje UI příkazy a přepíná do UI režimu podle potřeby.
 *        Otevírá Facebook/UTIO pouze když je to potřeba pro konkrétní akci.
 */

import fs from 'fs';
import path from 'path';
import os from 'node:os';
import puppeteer from 'puppeteer';
import * as wait from './iv_wait.js';
import * as db from './iv_sql.js';
import { FacebookBot } from './iv_fb.class.js';
import { UtioBot } from './iv_utio.class.js';
import { UIBot } from './iv_ui.class.js';
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

  try {
    // Inicializuj UTIO pouze pokud je potřeba
    if (requirements.needsUtio) {
      Log.info(`[${user.id}]`, 'Inicializuji UTIO pro akci...');
      utioBot = new UtioBot(context);

      if (!await utioBot.init()) {
        Log.error(`[${user.id}]`, 'Inicializace UTIO selhala');
        throw new Error('UTIO initialization failed');
      }

      if (!await utioBot.openUtio(user)) {
        Log.error(`[${user.id}]`, 'Přihlášení do UTIO selhalo');
        throw new Error('UTIO login failed');
      }

      Log.success(`[${user.id}]`, 'UTIO úspěšně inicializováno a přihlášeno');
    }

    // Inicializuj Facebook pouze pokud je potřeba
    if (requirements.needsFacebook) {
      Log.info(`[${user.id}]`, 'Inicializuji Facebook pro akci...');
      fbBot = new FacebookBot(context);

      if (!await fbBot.init()) {
        Log.error(`[${user.id}]`, 'Inicializace Facebook selhala');
        throw new Error('Facebook initialization failed');
      }

      const fbStatus = await fbBot.openFB(user);
      if (!fbStatus || !['still_loged', 'now_loged'].includes(fbStatus)) {
        // Fallback pro neúspěšné přihlášení
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

  } catch (err) {
    // Cleanup při chybě
    if (fbBot) {
      try {
        await fbBot.close();
      } catch (cleanupErr) {
        Log.warn('[WORKER]', `Chyba při cleanup FacebookBot: ${cleanupErr.message}`);
      }
    }

    if (utioBot) {
      try {
        await utioBot.close();
      } catch (cleanupErr) {
        Log.warn('[WORKER]', `Chyba při cleanup UtioBot: ${cleanupErr.message}`);
      }
    }

    throw err;
  }
}

async function showAccountLockStats() {
  try {
    // Zkontroluj dostupnost funkcí před jejich voláním
    if (typeof db.getAccountLockStats === 'function') {
      const stats = await db.getAccountLockStats();

      if (stats && stats.length > 0) {
        stats.forEach(stat => {
          Log.info('[STATS]', `${stat.lock_type}: ${stat.count} celkem (${stat.last_24h} za 24h, ${stat.last_7d} za 7d)`);
        });
      } else {
        Log.info('[STATS]', 'Žádné statistiky zablokování účtů k dispozici');
      }
    }

    if (typeof db.getRecentAccountLocks === 'function') {
      const recentLocks = await db.getRecentAccountLocks();

      if (recentLocks && recentLocks.length > 0) {
        Log.info('[STATS]', '=== Nedávná zablokování ===');
        recentLocks.forEach(lock => {
          Log.info('[STATS]', `${lock.lock_date}: ${lock.lock_type} - ${lock.daily_count}x`);
        });
      }
    }

    // Fallback - zobrazit základní info pokud pokročilé funkce nejsou dostupné
    if (typeof db.getAccountLockStats !== 'function' && typeof db.getRecentAccountLocks !== 'function') {
      Log.info('[STATS]', 'Pokročilé statistiky nejsou k dispozici - používám základní informace');
      // Můžeme přidat základní dotaz na počet zablokovaných účtů
      if (typeof db.getLockedUsersCount === 'function') {
        const lockedCount = await db.getLockedUsersCount();
        Log.info('[STATS]', `Aktuálně zablokovaných účtů: ${lockedCount}`);
      }
    }

  } catch (err) {
    Log.error('[STATS]', `Chyba při načítání statistik: ${err.message}`);
  }
}

async function executeUserAction(user, browser, context, browserClosed) {
  try {
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

    // Cleanup bot objektů
    if (fbBot) {
      try {
        await fbBot.close();
      } catch (err) {
        Log.warn('[WORKER]', `Chyba při cleanup FacebookBot: ${err.message}`);
      }
    }

    if (utioBot) {
      try {
        await utioBot.close();
      } catch (err) {
        Log.warn('[WORKER]', `Chyba při cleanup UtioBot: ${err.message}`);
      }
    }

  } catch (err) {
    Log.error(`[${user.id}] executeUserAction`, err);
    throw err;
  }
}

async function cleanupBrowser(browser, browserClosed) {
  if (DEBUG_KEEP_BROWSER_OPEN) {
    Log.info('[WORKER]', 'Debug režim: prohlížeč NEBUDE zavřen.');
    return;
  }

  if (browserClosed) {
    Log.info('[WORKER]', 'Prohlížeč již byl uzavřen.');
    return;
  }

  try {
    // Dej browseru čas na dokončení operací
    await wait.delay(2000, false);

    // Pokus o graceful shutdown s timeoutem
    const closePromise = browser.close();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Browser close timeout')), 30000)
    );

    await Promise.race([closePromise, timeoutPromise]);
    Log.info('[WORKER]', 'Prohlížeč úspěšně uzavřen.');

  } catch (err) {
    Log.warn('[WORKER]', `Chyba při uzavírání prohlížeče: ${err.message}`);

    // Force kill pokud graceful shutdown selhal
    try {
      const pages = await browser.pages();
      for (const page of pages) {
        await page.close();
      }
      await browser.close();
      Log.info('[WORKER]', 'Prohlížeč force-uzavřen.');
    } catch (forceErr) {
      Log.error('[WORKER]', `Force close také selhal: ${forceErr.message}`);
    }
  }
}

/**
 * Hlavní tick funkce s UI bypass logikou
 */
export async function tick() {
  try {
    // 🎯 PRIORITA 1: Kontrola UI příkazů - přeruší běžný chod
    const uiBot = new UIBot();
    const uiCommand = await uiBot.checkForCommand();

    if (uiCommand) {
      Log.info('[WORKER]', `🎮 UI REŽIM: Nalezen příkaz ${uiCommand.command}, přepínám do UI režimu`);

      try {
        const success = await uiBot.processCommand(uiCommand);
        if (success) {
          Log.success('[WORKER]', `✅ UI příkaz ${uiCommand.command} úspěšně dokončen`);
        } else {
          Log.error('[WORKER]', `❌ UI příkaz ${uiCommand.command} selhal`);
        }
      } finally {
        await uiBot.close();
      }

      // Po UI příkazu vždy ukončujeme tento tick - zajistí čistý restart
      return;
    }

    // 🎯 PRIORITA 2: Běžný autonomní režim (pouze pokud není UI příkaz)
    Log.debug('[WORKER]', '🤖 AUTONOMNÍ REŽIM: Žádné UI příkazy, pokračuji v běžném provozu');

    if (Date.now() < nextWorktime) {
      Log.debug('[WORKER]', 'Ještě nenastal čas na další cyklus');
      return;
    }

    // ✨ VYLEPŠENÉ LOGOVÁNÍ: Před výběrem uživatele
    Log.debug('[WORKER]', '🔍 Hledám dostupného uživatele s akcemi...');

    const user = await db.getUser();
    if (!user) {
      if (Date.now() >= nextWorktime) {
        // ✨ VYLEPŠENÉ LOGOVÁNÍ: Jasné rozlišení proč nebyl uživatel nalezen
        Log.info('[WORKER]', '❌ Nebyl nalezen žádný uživatel s dostupnými akcemi');
        Log.info('[WORKER]', '   Možné důvody:');
        Log.info('[WORKER]', '   • Všichni uživatelé jsou zablokovaní');
        Log.info('[WORKER]', '   • Všichni mají nastavené pozdější next_worktime');
        Log.info('[WORKER]', '   • Žádný uživatel nemá připravené akce na kole štěstí');

        await showAccountLockStats();
        nextWorktime = Date.now() + (60 * 1000); // Zkus znovu za minutu
      }
      return;
    }

    // ✨ VYLEPŠENÉ LOGOVÁNÍ: Úspěšný výběr uživatele
    Log.info(`[${user.id}]`, `🚀 Spouštím akci pro ${user.name} ${user.surname}`);
    Log.debug(`[${user.id}]`, `   next_worktime: ${user.next_worktime || 'NULL'}`);
    Log.debug(`[${user.id}]`, `   locked: ${user.locked || 'NULL'}`);

    let browser, context, browserClosed;
    try {
      ({ browser, context, browserClosed } = await prepareBrowser(user));
      await support.closeBlankTabs(context);

      // 🔍 Další kontrola UI příkazů před spuštěním akce
      // (může se stát, že během přípravy browseru přišel nový příkaz)
      const lastMinuteUICommand = await uiBot.checkForCommand();
      if (lastMinuteUICommand) {
        Log.warn('[WORKER]', '🎮 Nový UI příkaz během přípravy - přerušuji akci a předávám UI');
        await cleanupBrowser(browser, browserClosed);

        // Zpracuj UI příkaz
        try {
          await uiBot.processCommand(lastMinuteUICommand);
        } finally {
          await uiBot.close();
        }
        return;
      }

      await executeUserAction(user, browser, context, browserClosed);

    } catch (err) {
      Log.error(`[${user.id}]`, err);
      await pauseOnError(browser, browserClosed);
    } finally {
      await cleanupBrowser(browser, browserClosed);
    }

  } catch (err) {
    Log.error('[WORKER]', `Neočekávaná chyba v hlavním cyklu: ${err.message}`);
    await wait.delay(60000); // Čekej minutu před dalším pokusem
  }
}
