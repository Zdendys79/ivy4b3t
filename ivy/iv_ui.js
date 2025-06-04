/**
 * Název souboru: iv_ui.js
 * Umístění: ~/ivy/iv_ui.js
 *
 * Popis: Zpracovává UI příkazy z databáze, které zadává operátor přes webové rozhraní.
 *         Realizuje příkazy jako je přihlášení uživatele, otevření skupiny, pauza, restart klienta apod.
 */

import os from 'node:os';
import * as support from './iv_support.js';
import * as wait from './iv_wait.js';
import * as db from './iv_sql.js';
import { FacebookBot } from './iv_fb.class.js';
import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import UserAgentOverride from 'puppeteer-extra-plugin-stealth/evasions/user-agent-override/index.js';
import { Log } from './iv_log.class.js';

let pause = 10;
let browser;
let fbBot;
let currentCommand;
let interval_ui_user;

export async function solveUICommand(command) {
  const data = JSON.parse(command.data);
  let result = false;

  Log.info('[UI]', `Příkaz: ${command.command}`);

  switch (command.command) {
    case 'print':
      Log.info('[UI][print]', data.message);
      await db.uICommandAccepted(command.id);
      result = true;
      break;

    case 'restart':
      Log.warn('[UI]', 'Restart command received!');
      await db.uICommandAccepted(command.id);
      await restartHost(command);
      break;

    case 'pause':
      Log.info('[UI]', `Pause command na ${data.min} minut.`);
      await db.uICommandAccepted(command.id);
      result = await pauseCommand(data.min);
      break;

    case 'call_user':
      Log.info('[UI]', `Call user: ${data}`);
      result = await callUser(command);
      break;

    case 'user_group':
      Log.info('[UI]', `User + group příkaz:`, data);
      await openGroup(command);
      break;

    default:
      Log.warn('[UI]', `Neznámý příkaz typu: ${command.command}`);
  }

  if (result) {
    await db.uICommandSolved(command.id);
  } else {
    Log.warn('[UI]', 'Příkaz nebyl úspěšně vyřešen.');
  }
}

async function pauseCommand(min) {
  await db.uICommandAccepted(currentCommand.id);

  let remainingSeconds = min * 60;
  const interval = setInterval(() => {
    remainingSeconds -= 6;
    if (remainingSeconds > 0) {
      Log.info('[UI][pause]', `${remainingSeconds} sekund zbývá`);
    } else {
      clearInterval(interval);
      Log.info('[UI][pause]', 'Pauza dokončena.');
    }
  }, 6000);

  await new Promise(resolve => setTimeout(resolve, min * 60000));
  return true;
}

async function callUser(command) {
  currentCommand = command;
  const data = JSON.parse(command.data);
  Log.info('[UI][call_user]', `Uživatel: ${data.user_id}`);
  await db.uICommandAccepted(command.id);
  const user = await db.getUserById(data.user_id);

  if (!browser) {
    await openBrowser(data.user_id);
    await fbBot.openFB(user);
  }

  const newCommand = await waitForNewCommand(command);
  await db.uICommandSolved(command.id);

  if (newCommand) {
    if (newCommand.user_id !== command.user_id) {
      await browser.close();
      browser = null;
      fbBot = null;
    }
    await solveUICommand(newCommand);
  } else {
    Log.info('[UI][call_user]', 'Ukončuji.');
  }

  if (browser) {
    await browser.close();
    browser = null;
    fbBot = null;
  }

  return true;
}

async function openGroup(command) {
  const data = JSON.parse(command.data);
  Log.info('[UI][user_group]', `user_id=${data.user_id}, group_id=${data.group_id}`);
  await db.uICommandAccepted(command.id);

  const user = await db.getUserById(data.user_id);
  const group = await db.getGroupById(data.group_id);

  if (!browser) {
    await openBrowser(data.user_id);
    await fbBot.openFB(user);
    await wait.delay(wait.timeout());
  }

  await fbBot.openGroup(group);
  await wait.delay(wait.timeout());
  currentCommand = command;

  const newCommand = await waitForNewCommand(command);
  await db.uICommandSolved(command.id);

  if (newCommand) {
    if (newCommand.user_id !== command.user_id) {
      await browser.close();
      browser = null;
      fbBot = null;
    }
    await solveUICommand(newCommand);
  } else {
    Log.info('[UI][user_group]', `Příkaz ${command.id} dokončen.`);
  }

  if (browser) {
    await browser.close();
    browser = null;
    fbBot = null;
  }

  return true;
}

async function waitForNewCommand(command) {
  return await Promise.race([
    new Promise(resolve => {
      let remainingTime = 200;
      interval_ui_user = setInterval(async () => {
        remainingTime--;
        Log.info('[UI][čekání]', `${remainingTime * 6} s zbývá`);
        const commandCheck = await checkForNewCommand();
        if (commandCheck || remainingTime <= 0) {
          resolve(commandCheck);
        }
      }, 6000);
    }),
    new Promise(resolve => {
      browser.on('disconnected', () => {
        Log.warn('[UI]', 'Prohlížeč uzavřen.');
        resolve(null);
      });
    })
  ]).finally(() => {
    clearInterval(interval_ui_user);
  });
}

async function checkForNewCommand() {
  const newCommand = await db.getUICommand();
  if (newCommand && newCommand.id !== currentCommand.id) {
    Log.info('[UI]', 'Nový UI příkaz nalezen.');
    currentCommand = newCommand;
    return newCommand;
  }
  return null;
}

async function restartHost(command) {
  await closeBrowser();
  await db.systemLog("UI command", "Požadavek na restart programu.", command.data);
  await db.uICommandSolved(command.id);
  Log.warn('[UI]', 'Ukončuji klienta kvůli restartu...');
  process.kill(process.pid, 'SIGTERM');
}

function getBrowser() {
  puppeteerExtra.use(UserAgentOverride({ referer: support.randomReferer(), locale: 'cs-CZ,cs' }));
  puppeteerExtra.use(StealthPlugin());
  return puppeteerExtra;
}

async function openBrowser(user_id) {
  const app_setup = {
    headless: false,
    defaultViewport: null,
    args: [
      '--suppress-message-center-popups',
      '--disable-notifications',
      '--disable-infobars',
      '--start-maximized',
      '--user-data-dir=/home/remotes/Chromium',
      `--profile-directory=Profile${user_id}`
    ]
  };
  const puppeteer = getBrowser();
  browser = await puppeteer.launch(app_setup);
  const context = browser.defaultBrowserContext();
  context.overridePermissions("https://www.facebook.com", ["geolocation", "notifications"]);
  context.overridePermissions("https://m.facebook.com", ["geolocation", "notifications"]);
  context.overridePermissions("https://utio.b3group.cz", ["geolocation", "notifications"]);

  fbBot = new FacebookBot(context);
  await fbBot.init();
}

async function closeBrowser() {
  if (browser) {
    await browser.close();
  }
}
