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
import { enableDebugger } from './iv_interactive_debugger.js';
import { handleNewAccountBlock, detectAccountBlock } from './hostname_block_handler.js';
import { getIvyConfig } from './libs/iv_config.class.js';
import { BrowserManager } from './libs/iv_browser_manager.class.js';
import { UserSelector } from './libs/iv_user_selector.class.js';
import { HostnameProtection } from './libs/iv_hostname_protection.class.js';

import { Wait } from './libs/iv_wait.class.js';

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
    // Kontrola restart_needed
    if (await checkRestartNeeded()) return;
    
    // Zpracování UI příkazů
    if (await handleUICommands()) return;
    
    // Kontrola hostname ochrany
    if (await checkHostnameProtection()) return;
    
    // Výběr a zpracování uživatele
    await processUserWork();

  } catch (err) {
    await handleWorkerError(err);
  }
}

/**
 * Kontrola restart_needed flagu
 * @returns {Promise<boolean>} true pokud má ukončit worker
 */
async function checkRestartNeeded() {
  if (global.systemState.restart_needed) {
    Log.info('[WORKER]', 'Heartbeat detekoval změnu verze. Ukončuji worker.');
    return true;
  }
  return false;
}

/**
 * Zpracování UI příkazů
 * @returns {Promise<boolean>} true pokud byl zpracován UI příkaz
 */
async function handleUICommands() {
  const uiCommand = await UIBot.quickCheck();
  
  if (uiCommand) {
    const user = await userSelector.getUserForUICommand(uiCommand);
    if (!user) {
      await Log.warn('[WORKER]', 'UI příkaz neobsahuje platného uživatele');
      await waitWithHeartbeat(1);
      return true;
    }

    const { instance: browser, context } = await browserManager.openForUser(user);
    
    const uiBot = new UIBot();
    await uiBot.handleUICommandComplete(uiCommand, user, browser, context);
    return true;
  }
  
  return false;
}

/**
 * Kontrola hostname ochrany
 * @returns {Promise<boolean>} true pokud je hostname blokován
 */
async function checkHostnameProtection() {
  if (await hostnameProtection.isBlocked()) {
    await waitWithHeartbeat(5);
    return true;
  }
  return false;
}

/**
 * Zpracování práce uživatele
 * @returns {Promise<void>}
 */
async function processUserWork() {
  const user = await userSelector.selectUser();
  if (!user) {
    await userSelector.showAccountLockStats();
    await waitWithHeartbeat();
    return;
  }

  Log.success(`[${user.id}]`, `🚀 Vybrán uživatel ${user.name} ${user.surname}`);

  const { instance: browser, context } = await browserManager.openForUser(user);
  
  const wheelResult = await runWheelOfFortune(user, browser, context);
  
  await handleWheelResult(wheelResult, user, browser, context);
}

/**
 * Zpracování výsledku wheel
 * @param {Object} wheelResult - Výsledek wheel
 * @param {Object} user - Uživatel
 * @param {Object} browser - Browser instance
 * @param {Object} context - Context
 * @returns {Promise<void>}
 */
async function handleWheelResult(wheelResult, user, browser, context) {
  if (wheelResult.stoppedByUI) {
    const postUICommand = await UIBot.quickCheck();
    
    if (postUICommand && postUICommand.user_id === user.id) {
      const uiBot = new UIBot();
      await uiBot.handleUICommandComplete(postUICommand, user, browser, context);
    }
  } else if (wheelResult.stoppedByRestart) {
    Log.info('[WORKER]', 'Wheel ukončen kvůli restart_needed. Ukončuji worker.');
    await browserManager.closeBrowser(browser);
    return;
  } else {
    await browserManager.closeBrowser(browser);
    
    const fbPauseSeconds = 60 + Math.random() * 120; // 60-180 sekund
    await Wait.toSeconds(fbPauseSeconds, 'Pauza po zavření FB');
  }
}

/**
 * Zpracování chyb workeru
 * @param {Error} err - Chyba
 * @returns {Promise<void>}
 */
async function handleWorkerError(err) {
  const userChoice = await Log.errorInteractive('[WORKER]', err);
  if (userChoice === 'quit' || userChoice === true) {
    Log.info('[WORKER]', 'Ukončuji na požádání uživatele...');
    process.exit(99);
  }
  await waitWithHeartbeat(2);
}




/**
 * Čekání bez heartBeat (heartbeat běží asynchronně)
 */
async function waitWithHeartbeat(waitMinutes = null) {
  const waitTime = waitMinutes || IvMath.randInterval(config.wait_min_minutes, config.wait_max_minutes);
  const waitMs = waitTime * 60 * 1000;

  Log.info('[WORKER]', `Čekám ${waitTime} minut...`);

  await Wait.toSeconds(waitMs / 1000, 'Čekání na další cyklus');

  Log.info('[WORKER]', 'Čekání dokončeno, spouštím nový cyklus');
}


/**
 * Graceful shutdown všech aktivních browser instances
 */
export async function shutdownAllBrowsers() {
  await browserManager.shutdownAll();
}