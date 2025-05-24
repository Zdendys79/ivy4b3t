/**
 * Název souboru: iv_support.js
 * Umístění: ~/ivy/iv_support.js
 *
 * Popis: Obsahuje pomocné funkce pro práci s uživateli, skupinami, postování zpráv,
 *         zvyšování denních limitů a získávání dat z UTIO portálu.
 *         Také se stará o simulaci lidské aktivity na Facebooku.
 */

import fs from 'node:fs';
import crypto from 'node:crypto';
import * as utio from './iv_utio.js';
import * as wait from './iv_wait.js';
import * as db from './iv_sql.js';
import * as fb from './iv_fb.js';
import md5 from 'md5';

export async function addMeToGroup(user, group) {
    const today = new Date().toISOString().split('T')[0];
    if (user.last_add_group === today) return false;
    if (await fb.addMeToGroup()) {
        await db.updateUserAddGroup(user, group.id);
        return true;
    }
    return false;
}

export async function increase_user_limit(user) {
    let nowDate = new Date();
    const tzoffset = nowDate.getTimezoneOffset();
    nowDate = new Date(nowDate.getTime() + (tzoffset * 60 * 1000));
    if (user.day_limit_updated === nowDate.toISOString().split('T')[0]) return false;
    let new_limit = 1 + user.day_limit;
    if (new_limit > user.max_limit) new_limit = user.max_limit;
    if (new_limit === user.day_limit) return false;
    await db.setUserLimit(user, new_limit, user.day_limit);
    console.log(`User ${user.surname} daylimit updated to: ${new_limit}.`);
    return true;
}

export async function decrease_user_limit(user) {
    let new_limit = Math.floor(2 * user.day_limit / 3);
    if (new_limit < 3) new_limit = 3;
    await db.setUserLimit(user, new_limit, user.day_limit);
    console.log(`User ${user.surname} daylimit updated to: ${new_limit}.`);
}

export async function raise(user) {
    const now = new Date();
    const is_raising_time = user.next_statement < now;
    let log_type = 0;
    if (is_raising_time) {
        let result = false;
        if (Math.random() < 0.5) {
            result = await raise_url();
            log_type = 6;
        } else {
            result = await raise_citation();
            log_type = 5;
        }
        if (result) {
            await db.updateUserNextStatement(user, 30, log_type);
        }
        await wait.delay(20000, false);
    } else {
        console.error(`Not a Raiser time!`);
        return false;
    }
}

export async function raise_url() {
    try {
        const url = await db.loadUrl();
        if (!url) throw "URL not obtained!";
        db.useUrl(url.url);
        if (await fb.newThing(2)) {
            await fb.clickNewThing();
            await fb.pasteStatement(url.url);
        } else {
            throw `No \"new thing\" field found!`;
        }
        return true;
    } catch (err) {
        console.error(`Raise URL failed!\n${err}`);
        return false;
    }
}

export async function raise_citation() {
    try {
        const statement = await db.getStatement();
        if (!statement) throw `New statement not obtained!`;
        if (await fb.newThing(2)) {
            await fb.clickNewThing();
            await fb.pasteStatement(statement.statement);
        } else {
            throw `No \"new thing\" field found!`;
        }
        return true;
    } catch (err) {
        console.error(`Raise citation failed!\n${err}`);
        return false;
    }
}

export async function randomReferer() {
    try {
        const result = await db.getRandomReferer();
        //if (!result || result.length === 0) throw "No referer found in database!";
        const selected = result.url;
        console.log("Selected referer from DB: " + selected);
        return selected;
    } catch (err) {
        console.error("randomReferer failed:", err);
        return "https://www.google.cz";
    }
}

export async function pasteMsg(user, group) {
    let message = false;
    let cnt = 0;
    try {
        do {
            const m = await utio.getMessage(user.portal_id, group.region_id, group.district_id);
            if (await db.verifyMsg(group.id, md5(m[0]).toString())) {
                message = m;
            }
            cnt++;
        } while (!message && cnt < 5);
    } catch (err) {
        console.error(`URL from UTIO failed!\n${err}`);
        return false;
    }
    if (message && await fb.clickNewThing()) {
        let paste = await fb.pasteMessage(message);
        if (paste) return message[0];
        console.error("fb.pasteMessage failed!");
        return false;
    }
    console.error("clickNewThing or getting message failed!");
    return false;
}

export function generate(c = 6) {
    const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const signs = "/+*-$,;:#&";
    let chars_count = Math.floor(Math.random() * 2 * c / 3 + Math.floor(1 + c / 3));
    let code = "";
    let sign_not_used = true;

    for (let i = 0; i < chars_count; i++) {
        let rnd1 = Math.floor(Math.random() * chars.length);
        if ((i < (chars_count - 1)) && sign_not_used && Math.round(Math.random() * (2 + i) / chars_count)) {
            let rnd2 = Math.floor(Math.random() * signs.length);
            code += signs[rnd2];
            sign_not_used = false;
        }
        code += chars[rnd1];
    }
    return code;
}

export async function closeBlankTabs(context) {
    const pages = await context.pages();

    for (const page of pages) {
        try {
            const title = await page.title();
            const url = page.url();

            if ((title === '' || title === 'about:blank') && url === 'about:blank') {
                if (pages.length > 1) {
                    console.log("Zavírám prázdnou výchozí záložku.");
                    await page.close();
                } else {
                    console.warn("Nelze zavřít jedinou záložku – bylo by ukončeno celé Chromium.");
                }
            }
        } catch (err) {
            console.warn("Chyba při kontrole nebo zavírání záložky:", err.message);
        }
    }
}

