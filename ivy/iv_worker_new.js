/**
 * Název souboru: iv_worker.js - REFAKTOROVANÁ VERZE
 * Umístění: ~/ivy/iv_worker.js
 *
 * Popis: Zjednodušená implementace - pouze systémová logika
 * 1. Kontrola UI příkazů
 * 2. Výběr uživatele
 * 3. Otevření/zavření prohlížeče
 * 4. Rychlá kontrola FB stavu
 * 5. Orchestrace mezi moduly
 */

import fs from 'fs';
import path from 'path';
import os from 'node:os';
import puppeteer from 'puppeteer';

import { db } from './iv_sql.js'
import { Log } from './libs/iv_log.class.js';
import { IvMath } from './libs/iv_math.class.js';
import { UIBot } from './libs/iv_ui.class.js';
import { runWheelOfFortune } from './iv_wheel.js';
import { enableDebugger, setDebugContext } from './iv_interactive_debugger.js';
import { handleNewAccountBlock, detectAccountBlock } from './hostname_block_handler.js';
import { FBBot } from './libs/iv_fb.class.js';
import { getIvyConfig } from './libs/iv_config.class.js';
import { BrowserManager } from './libs/iv_browser_manager.class.js';
import { UserSelector } from './libs/iv_user_selector.class.js';
import { HostnameProtection } from './libs/iv_hostname_protection.class.js';

import * as wait from './iv_wait.js';
import * as support from './iv_support.js';

const config = getIvyConfig();
const browserManager = new BrowserManager();
const userSelector = new UserSelector();
const hostnameProtection = new HostnameProtection();

/**
 * HLAVNÍ TICK FUNKCE - zjednodušená verze
 */
export async function tick() {
  enableDebugger(true);
  Log.info('[WORKER]', '🐛 Interactive debugging ENABLED - errors will pause for analysis');

  try {
    // KROK 1: Kontrola UI příkazů
    const uiCommand = await userSelector.checkForUICommand();
    
    if (uiCommand) {
      // VARIANTA A: UI příkaz na začátku
      const user = await userSelector.getUserForUICommand(uiCommand);
      if (!user) {
        await Log.warn('[WORKER]', 'UI příkaz neobsahuje platného uživatele');
        await waitWithHeartbeat(1);
        return;
      }

      const { instance: browser, context } = await browserManager.openForUser(user);
      
      const uiBot = new UIBot();
      await uiBot.handleUICommandComplete(uiCommand, user, browser, context);
      return; // Konec cyklu
    }
    
    // KROK 2: Kontrola hostname ochrany
    if (await hostnameProtection.isBlocked()) {
      await waitWithHeartbeat(5);
      return;
    }

    // KROK 3: Výběr uživatele pro běžnou práci
    const user = await userSelector.selectUser();
    if (!user) {
      await userSelector.showAccountLockStats();
      await waitWithHeartbeat();
      return;
    }

    Log.success(`[${user.id}]`, `🚀 Vybrán uživatel ${user.name} ${user.surname}`);

    // KROK 4: Otevření FB a rychlá kontrola
    const { instance: browser, context } = await browserManager.openForUser(user);
    const fbReady = await quickFBCheck(user, context);
    
    if (!fbReady) {
      // Budoucí modul pro nefunkční FB
      await Log.error(`[${user.id}]`, 'FB není funkční - ukončuji cyklus');
      await browserManager.closeBrowser(browser);
      return;
    }
    
    // KROK 5: Předání kolu štěstí
    const wheelResult = await runWheelOfFortune(user, browser, context);
    
    // KROK 6: Kontrola UI přerušení
    if (wheelResult.stoppedByUI) {
      const postUICommand = await userSelector.checkForUICommand();
      
      if (postUICommand && postUICommand.user_id === user.id) {
        // VARIANTA B: UI příkaz pro stejného uživatele
        const uiBot = new UIBot();
        await uiBot.handleUICommandComplete(postUICommand, user, browser, context);
      }
    } else {
      // KROK 7: Zavření prohlížeče
      await browserManager.closeBrowser(browser);
    }

  } catch (err) {
    const userChoice = await Log.errorInteractive('[WORKER]', err);
    if (userChoice === 'quit' || userChoice === true) {
      Log.info('[WORKER]', 'Ukončuji na požádání uživatele...');
      process.exit(99);
    }
    await waitWithHeartbeat(2);
  }
}


/**
 * Rychlá kontrola FB stavu - používá sjednocené metody z analyzéru
 */
async function quickFBCheck(user, context) {
  try {
    const fbBot = new FBBot(context, user.id);
    if (!await fbBot.init()) {
      return false;
    }
    
    setDebugContext(user, fbBot.page);
    
    const fbOpenSuccess = await fbBot.openFB(user, false);
    if (!fbOpenSuccess) {
      return false;
    }

    // Použij sjednocené metody z analyzéru
    fbBot.initializeAnalyzer();
    return await fbBot.pageAnalyzer.quickFBCheck(user);
    
  } catch (err) {
    await Log.error(`[${user.id}]`, `Chyba při kontrole FB: ${err.message}`);
    return false;
  }
}


/**
 * Čekání s pravidelným heartBeat
 */
async function waitWithHeartbeat(waitMinutes = null) {
  const waitTime = waitMinutes || IvMath.randInterval(config.wait_min_minutes, config.wait_max_minutes);
  const waitMs = waitTime * 60 * 1000;
  const heartBeatInterval = config.heartbeat_interval;

  Log.info('[WORKER]', `Čekám ${waitTime} minut s heartBeat každých ${heartBeatInterval/1000}s...`);

  let elapsed = 0;
  while (elapsed < waitMs) {
    try {
      await db.heartBeat(0, 0, 'IVY4B3T');
      Log.debug('[WORKER]', 'Heartbeat odeslán během čekání');
    } catch (err) {
      await Log.warn('[WORKER]', `Chyba při heartBeat: ${err.message}`);
    }

    const sleepTime = Math.min(heartBeatInterval, waitMs - elapsed);
    await wait.delay(sleepTime);
    elapsed += sleepTime;

    if (elapsed % 60000 === 0) {
      const remainingMinutes = Math.ceil((waitMs - elapsed) / 60000);
      Log.debug('[WORKER]', `Zbývá ${remainingMinutes} minut čekání...`);
    }
  }

  Log.info('[WORKER]', 'Čekání dokončeno, spouštím nový cyklus');
}


/**
 * Graceful shutdown všech aktivních browser instances
 */
export async function shutdownAllBrowsers() {
  await browserManager.shutdownAll();
}