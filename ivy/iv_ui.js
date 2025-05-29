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

let pause = 10;
let browser;
let fbBot;
let currentCommand;
let interval_ui_user;

export async function solveUICommand(command) {
    const data = JSON.parse(command.data);
    let result = false;
    switch (command.command) {
        case 'print':
            console.log("Print command received:");
            console.log(data.message);
            await db.uICommandAccepted(command.id);
            result = true;
            break;
        case 'restart':
            console.log("Restart command received!");
            await db.uICommandAccepted(command.id);
            await restartHost(command);
            break;
        case 'pause':
            console.log("Pause command received for duration:", data.min);
            await db.uICommandAccepted(command.id);
            result = await pauseCommand(data.min);
            break;
        case 'call_user':
            console.log("Call user command received for user_id:", data);
            result = await callUser(command);
            break;
        case 'user_group':
            console.log("User and group command received:", data);
            await openGroup(command);
            break;
        default:
            console.log("Unknown command type:", command.command);
    }
    if (result) {
        await db.uICommandSolved(command.id);
    } else {
        console.error("UI command has not been solved!");
    }
}

async function pauseCommand(min) {
    console.log("Pause command received for duration:", min);
    await db.uICommandAccepted(currentCommand.id);

    let remainingSeconds = min * 60;
    const interval = setInterval(() => {
        remainingSeconds -= 6;
        if (remainingSeconds > 0) {
            console.log(`${remainingSeconds} seconds remaining`);
        } else {
            clearInterval(interval);
            console.log("Pause completed.");
        }
    }, 6000);

    await new Promise(resolve => setTimeout(resolve, min * 60000));
}

async function callUser(command) {
    currentCommand = command;
    const data = JSON.parse(command.data);
    console.log(`UI command triggered - Selected user: ${data.user_id}, getting data from database.`);
    await db.uICommandAccepted(command.id);
    const user = await db.getUserById(data.user_id);
    if (!browser) {
        await openBrowser(data.user_id);
        await fbBot.openFB(user);
    }

    const newCommand = await Promise.race([
        new Promise(resolve => {
            let remainingTime = 200;
            interval_ui_user = setInterval(async () => {
                remainingTime--;
                console.log(`${remainingTime * 6} seconds remaining`);
                const commandCheck = await checkForNewCommand();
                if (commandCheck || remainingTime <= 0) {
                    resolve(commandCheck);
                }
            }, 6000);
        }),
        new Promise(resolve => {
            browser.on('disconnected', () => {
                console.log("Browser closed early.");
                resolve(null);
            });
        })
    ]);
    clearInterval(interval_ui_user);

    await db.uICommandSolved(command.id);

    if (newCommand) {
        if (newCommand.user_id !== command.user_id) {
            await browser.close();
            browser = null;
            fbBot = null;
        }
        await solveUICommand(newCommand);
    } else {
        console.log(`UI command resolved, continuing work.`);
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
    console.log(`UI command triggered - Selected user: ${data.user_id}, selected group: ${data.group_id}`);
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

    const newCommand = await Promise.race([
        new Promise(resolve => {
            let remainingTime = 200;
            interval_ui_user = setInterval(async () => {
                remainingTime--;
                console.log(`${remainingTime * 6} seconds remaining`);
                const commandCheck = await checkForNewCommand();
                if (commandCheck || remainingTime <= 0) {
                    resolve(commandCheck);
                }
            }, 6000);
        }),
        new Promise(resolve => {
            browser.on('disconnected', () => {
                console.log("Browser closed early.");
                resolve(null);
            });
        })
    ]);
    clearInterval(interval_ui_user);
    await db.uICommandSolved(command.id);

    if (newCommand) {
        if (newCommand.user_id !== command.user_id) {
            await browser.close();
            browser = null;
            fbBot = null;
        }
        await solveUICommand(newCommand);
    } else {
        console.log(`UI command [${command.id}] '${command.command}' resolved, continuing work.`);
    }
    if (browser) {
        await browser.close();
        browser = null;
        fbBot = null;
    }
    return true;
}

async function checkForNewCommand() {
    const newCommand = await db.getUICommand();
    if (newCommand && newCommand.id !== currentCommand.id) {
        console.log("New UI command received, ending current command.");
        currentCommand = newCommand;
        return newCommand;
    }
    return null;
}

async function restartHost(command) {
    await closeBrowser();
    const title = "UI command";
    await db.systemLog(title, "The UI ordered a restart of the program!", command.data);
    await db.uICommandSolved(command.id);
    console.log(title);
    console.log("Exiting the program!");
    process.kill(process.pid, 'SIGTERM');

    process.on('SIGTERM', async () => {
        console.log('Process terminated');
        process.exit(1);
    });
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
