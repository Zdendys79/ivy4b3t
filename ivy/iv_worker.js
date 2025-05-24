/**
 * Název souboru: iv_worker.js
 * Umístění: ~/ivy/iv_worker.js
 *
 * Popis: Hlavní pracovní smyčka klienta systému Ivy4B3T.
 *         Provádí výběr uživatele, login do UTIO a Facebooku, následné akce a simuluje činnost účtů.
 */

import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import UserAgentOverride from 'puppeteer-extra-plugin-stealth/evasions/user-agent-override/index.js';
import * as wait from './iv_wait.js';
import * as db from './iv_sql.js';
import * as fb from './iv_fb.js';
import * as utio from './iv_utio.js';
import * as support from './iv_support.js';

puppeteer.use(UserAgentOverride({ referer: await support.randomReferer(), locale: 'cs-CZ,cs' }));
puppeteer.use(StealthPlugin());

const is_linux = process.platform === "linux";
let next_worktime = Date.now() - 10;

export async function tick() {
    const ui_command = await db.getUICommand();
    if (ui_command) {
        console.log("UI příkaz detekován – bude zpracován později.");
        return;
    }

    const currentTime = Date.now();
    if (currentTime < next_worktime) {
        console.log("Čekám na další cyklus.");
        return;
    }

    try {
        const recent = await db.getRecentlyLogedUserFromMyNeighborhood();
        if (!recent) throw `Jiný uživatel je přihlášen.`;

        const user = await db.getUser();
        if (!user) throw `Žádný vhodný uživatel.`;

        const profileDir = `Profile${user.id}`;
        const userProfilePath = path.join('/home/remotes/Chromium', profileDir);
        const singletonLockPath = path.join(userProfilePath, 'SingletonLock');

        try {
            fs.unlinkSync(singletonLockPath);
            console.log(`SingletonLock pro ${profileDir} smazán.`);
        } catch (err) {
            if (err.code !== 'ENOENT') {
                console.warn(`Mazání SingletonLock selhalo: ${err.message}`);
            }
        }

        const app_setup = {
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
                '--user-data-dir=/home/remotes/Chromium'
            ]
        };


        const browser = await puppeteer.launch(app_setup);

        let browserClosed = false;
        browser.on('disconnected', async () => {
            browserClosed = true;
            console.warn(`[${user.id}] Prohlížeč byl ručně zavřen. Pauza 1 minuta.`);
            await wait.delay(60000);
        });

        const context = browser.defaultBrowserContext();
        await context.overridePermissions("https://www.facebook.com", []);
        await context.overridePermissions("https://m.facebook.com", []);
        await context.overridePermissions("https://utio.b3group.cz", []);

        console.log("\n---\nZahajuji práci pro uživatele:", user.name, user.surname);

        await utio.newUtioTab(context);
        const utio_ok = await utio.openUtio(user.u_login, user.u_pass);
        if (!utio_ok) throw `Login na UTIO selhal.`;

        await fb.newFbTab(context);
        const fb_status = await fb.openFB(user);
        if (fb_status === 'account_locked') {
            await db.lockAccount(user.id);
            throw `Účet je zablokován.`;
        }

        await support.closeBlankTabs(context);

        if (fb_status !== 'still_loged' && fb_status !== 'now_loged') {
            await db.lockAccount(user.id);
            throw `Login na FB selhal.`;
        }

        await db.userLogedToFB(user.id);
        await fb.clickLike?.();
        await support.raise(user);

        console.log("Uživatel úspěšně přihlášen a připraven.");

        await wait.delay(wait.timeout());

        if (!browserClosed) await browser.close();
        next_worktime = Date.now() + Math.random() * 30000 + 30000;

    } catch (err) {
        console.error("Chyba při zpracování uživatele:", err);
        await wait.delay(30 * wait.timeout());
    }
}

