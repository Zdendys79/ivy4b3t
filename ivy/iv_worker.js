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
  
  // END: Interruptible čekání s kontrolou UI příkazů
  await Wait.forNextWorkerCycle(config.wait_max_minutes);
}

/**
 * Kontrola restart_needed flagu
 * @returns {Promise<boolean>} true pokud má ukončit worker
 */
async function checkRestartNeeded() {
  if (global.systemState.restart_needed) {
    Log.info('[WORKER]', 'Heartbeat detekoval změnu verze. Ukončuji aplikaci pro restart.');
    process.exit(1);
  }
  return false;
}

/**
 * Zpracování UI příkazů
 * @returns {Promise<boolean>} true pokud byl zpracován UI příkaz
 */
async function handleUICommands() {
  if (global.uiCommandCache) {
    const uiCommand = global.uiCommandCache;
    // Vyčistit cache po načtení
    global.uiCommandCache = null;
    
    const user = await userSelector.getUserForUICommand(uiCommand);
    if (!user) {
      await Log.warn('[WORKER]', 'UI příkaz neobsahuje platného uživatele');
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
    return true; // Skip to END
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
    return; // Skip to END
  }

  Log.success(`[${user.id}]`, `Vybrán uživatel ${user.name} ${user.surname}`);

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
    if (global.uiCommandCache && global.uiCommandCache.user_id === user.id) {
      const postUICommand = global.uiCommandCache;
      // Vyčistit cache po načtení
      global.uiCommandCache = null;
      const uiBot = new UIBot();
      await uiBot.handleUICommandComplete(postUICommand, user, browser, context);
    }
  } else if (wheelResult.stoppedByRestart) {
    Log.info('[WORKER]', 'Wheel ukončen kvůli restart_needed. Ukončuji worker.');
    await browserManager.closeBrowser(browser);
    return;
  } else {
    await browserManager.closeBrowser(browser);
  }
}

/**
 * Zpracování chyb workeru
 * @param {Error} err - Chyba
 * @returns {Promise<void>}
 */
async function handleWorkerError(err) {
  const userChoice = await Log.errorInteractive('[WORKER]', err);
  if (userChoice === 'quit') {
    Log.info('[WORKER]', 'Ukončuji na požádání uživatele...');
    process.exit(99);
  }
  // Error recovery wait will be handled in END
}







/**
 * Graceful shutdown všech aktivních browser instances
 */
export async function shutdownAllBrowsers() {
  await browserManager.shutdownAll();
}