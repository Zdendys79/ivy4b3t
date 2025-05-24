/**
 * Název souboru: iv_fb.js
 * Umístění: ~/ivy/iv_fb.js
 *
 * Popis: Interaguje s Facebookem přes Puppeteer. Zajišťuje přihlašování, vkládání příspěvků,
 *         získávání údajů o skupinách, klikání na prvky a kontrolu různých stavů účtu.
 */

import * as wait from './iv_wait.js';

let new_thing_element;
let fb = false; // browser page

export async function newFbTab(context) {
  fb = await context.newPage();
  fb.setDefaultNavigationTimeout(15000);
}

export async function openFB(user) {
    const cookie = 'button[data-cookiebanner]:first-child';
    const username = '#email';
    const password = '#pass';
    const login = 'button[name="login"]';

    try {
        await fb.bringToFront();
        await fb.goto('https://facebook.com', { waitUntil: "domcontentloaded" });
        await wait.delay(10000, false);
    } catch (err) {
        console.error(`FB opening failed:\n${err}`);
        return false;
    }

    // 🔒 Kontrola blokace účtu
    try {
        if (await accoutLocked() || await accoutBlock()) {
            console.error(`Account locked/block!`);
            return 'account_locked';
        }
    } catch {}

    // ✅ Test přihlášení pomocí 'Váš profil'
    try {
        await fb.waitForSelector('[aria-label="Váš profil"]', { timeout: 5000 });
        console.log(`User [${user.id}] ${user.name} ${user.surname} is still logged (via profile div).`);
        return 'still_loged';
    } catch {
        console.log('User not logged in – attempting login.');
    }

    // 🍪 Cookie banner
    try {
        await fb.waitForSelector(cookie, { timeout: 3000 });
        await fb.click(cookie);
        await fb.waitForTimeout(wait.timeout());
    } catch {
        console.warn(`FB cookie banner not found or skipped.`);
    }

    // 🔐 Přihlášení
    try {
        await fb.waitForSelector(username, { timeout: 5000 });
        await fb.type(username, user.fb_login, { delay: wait.type() });

        await fb.waitForSelector(password, { timeout: 5000 });
        await fb.type(password, user.fb_pass, { delay: wait.type() });

        await fb.click(login);
        await fb.waitForTimeout(15 * wait.timeout());
    } catch (err) {
        console.error(`Login to FB failed:\n${err}`);
        return false;
    }

    // 🔁 Ověření úspěšného přihlášení
    try {
        await fb.waitForSelector('[aria-label="Váš profil"]', { timeout: 7000 });
        console.log(`User [${user.id}] ${user.name} ${user.surname} is now logged in.`);
        return 'now_loged';
    } catch {
        console.error('Login appears to have failed – profile element not found.');
    }

    return false;
}

export async function pressEscape() {
    await fb.keyboard.press('Escape');
    await fb.waitForTimeout(5 * wait.timeout());
}

export async function rollDown(y = 300, h = 500) {
    // rolldown
    await fb.mouse.wheel({ deltaY: Math.round(Math.random() * h + y) })

}

export async function pasteMessage(message) {
    if (message.constructor != Array) {
        console.error(`Wrong type of "message"!`)
        return false;
    }
    try {
        await fb.bringToFront();
        await fb.waitForTimeout(wait.timeout());
        await fb.keyboard.down('Control', { delay: wait.type() });
        await fb.keyboard.press('KeyV', { delay: wait.type() });
        await fb.keyboard.up('Control', { delay: wait.type() });
        await fb.waitForTimeout(20 * wait.timeout());
    } catch (err) {
        console.error(`Pasting message error!\n${err}`);
        return false;
    }

    return (await clickSendButton("Zveřejnit"));

}

export async function addButton(button_text) {
    return await fb.$x(`//span[contains(text(), "${button_text}")]`, { visible: true, timeout: wait.timeout() });
}

export async function clickSendButton(button_text) {
    try { // Click Send button?
        const add_button = await addButton(button_text);
        if (!add_button.length) throw (`Send button not find!`);
        await fb.evaluate(el => { el.click({ clickCount: 1 }); }, add_button[add_button.length - 1]);
        await fb.waitForTimeout(15 * wait.timeout());
        if (await addButton(button_text).length > 0) throw (`Send button still on screen!`);
        return true;
    } catch (err) {
        console.error(`Add button not work!\n${err}`);
        await fb.waitForTimeout(2 * wait.timeout());
        return false;
    }
}

export async function pasteStatement(statement = false) {
    try {
        if (statement) {
            await fb.waitForTimeout(10 * wait.timeout());
            const el = await fb.evaluateHandle(() => document.activeElement);
            await defaultRange();
            await el.type(`${statement}`);
            //const add_button = await fb.$x(`//span[contains(text(), "Přidat")]`, { visible: true, timeout: wait.timeout() });
            const add_button = await addButton("Přidat");
            if (!add_button.length) throw (`Send button not find!`);
            await fb.waitForTimeout(3 * wait.timeout());
            await fb.evaluate(el => { el.click({ clickCount: 2 }); }, add_button[add_button.length - 1]);
            await fb.waitForTimeout(15 * wait.timeout());
            await defaultRange();
            if (await addButton("Přidat").length > 0) throw (`Send button still on screen!`);
            return true;
        } else {
            return false;
        }
    } catch (err) {
        console.error(`Typing of statement failed!\n${err}`);
        return false;
    }
}

export async function pasteCode() {
    const el = await fb.evaluateHandle(() => document.activeElement);
    await el.type(`${generate(4)}`);
    await fb.waitForTimeout(wait.timeout());
}

export async function openGroup(group) {
    await fb.bringToFront()
    let fb_group_url = "https://facebook.com/"
    fb_group_url += group.typ == "P" ? "" : "groups/";
    fb_group_url += group.fb_id;
    fb_group_url += group.sell ? "/buy_sell_discussion" : "";
    try {
        //console.log(`Going to group ID:${group.id}  ${fb_group_url}`)
        const acceptBeforeUnload = dialog =>
            dialog.type() === "beforeunload" && dialog.accept();
        await fb.goto(fb_group_url, { waitUntil: 'networkidle2' });
        await fb.on("dialog", acceptBeforeUnload);
        await fb.waitForTimeout(2 * wait.timeout());
        return true;
    } catch (err) {
        console.error(`Group ID:${group.id} ${fb_group_url} failed!`, err)
        return false;
    }
}

export async function readUserCounter() {
    // 1,6 tis. členů|sledujících
    await fb.bringToFront();
    let fails = true;
    try {
        let t1 = "členů";
        const [counter] = await fb.$x(`//span[contains(., "${t1}")]`, { visible: true, timeout: 3500 });
        if (!counter) throw (`Counter with ${t1} not found.`)
        return (getCounterValue(await fb.evaluate(el => { return el.textContent; }, counter)));
    } catch (err) {
        console.error(`Member counter fails!\n`, err);
    }
    try {
        let t2 = "sledujících";
        const [counter] = await fb.$x(`//span[contains(., "${t2}")]`, { visible: true, timeout: 3500 });
        if (!counter) throw (`Counter with ${t2} not found.`)
        return (getCounterValue(await fb.evaluate(el => { return el.textContent; }, counter)));
    } catch (err) {
        console.error(`Member counter fails!\n`, err);
    }
    return 0;
}

function getCounterValue(str) {
    //const str = "Soukromá skupina . 2.6 tis. členů";
    try {
        let regex = /[+-]?\d+(\.\d+)?/g;
        let [floats] = str.replace(",", ".").match(regex).map(function (v) { return parseFloat(v); });
        if (str.indexOf("tis.") > -1) floats *= 1000;
        return floats;
    }
    catch (err) {
        console.error(`Counter value not find! ${err}`)
        return 0;
    }
}

export async function addMeToGroup() {
    try { // Click addMe button?
        const add = await fb.$x(`//span[contains(text(), "Přidat se ke skupině")]`, { visible: true, timeout: wait.timeout() });
        if (add.length) {
        } else {
            throw (`Xpath results is empty.`);
        }
        await fb.waitForTimeout(2 * wait.timeout());
        await fb.evaluate(el => { el.click({ clickCount: 2 }); }, add[add.length - 1]);
        console.error(`Button "addMeToGroup" clicked.`);
        await fb.waitForTimeout(15 * wait.timeout());
        return true;
    } catch (err) {
        console.error(`Click "addMeToGroup" button failed!`, err);
        return false;
    }

}

export async function clickLike() {
    if (Math.floor(Math.random() * 10) < 1) {
        try { // Click Like button?
            const likes = await fb.$x(`//span[contains(text(), "To se mi líbí")]`, { visible: true, timeout: wait.timeout() });
            if (likes.length) {
                await fb.waitForTimeout(2 * wait.timeout());
                const randomLike = Math.floor(Math.random() * likes.length);
                await fb.evaluate(el => { el.click({ clickCount: 1 }); }, likes[randomLike]);
                console.error(`Button "like" clicked.`);
                await fb.waitForTimeout(5 * wait.timeout());
                return true;
            } else {
                throw (`Xpath results for like is empty.`);
            }
        } catch (err) {
            console.error(`Click "like" button failed!`, err);
            return false;
        }
    }
    else {
        // console.log(`Don't panic! Clicking on LIKE is randomly ignored. :-D`);
        return true;
    }
}


export async function contentNotAvailable() {
    let t1 = "Obsah teď není dostupný"
    let t2 = "Přejít do kanálu";
    try {
        await fb.waitForXPath(`//span[contains(text(), "${t1}")]`, { timeout: 2500 })
        console.log(`Text "${t1}" found!`)
        await fb.waitForXPath(`//span[contains(text(), "${t2}")]`, { timeout: 2500 })
        console.log(`Text "${t2}" found!`)
        return true;
    } catch {
        return false;
    }
}

export async function stillIn() {
    let t = ["Nevyřízený příspěvek", "obsah ke schválení", "čeká na schválení"];
    let is = false;
    try {
        for (let i = 0; i++; i < t.length) {
            if (await fb.waitForXPath(`//span[contains(., "${t[i]}")]`, { timeout: 2500 })) {
                is = true;
            }
        }
    } catch { }
    return is;
}

export async function membershipApplication() {
    try {
        if (await fb.waitForXPath(`//span[contains(., "Vaše žádost o členství se vyřizuje")]`, { timeout: 2500 })) {
            return true;
        }
    } catch { }
    return false;
}

export async function stillSendButton() {
    await fb.bringToFront()
    let t = "Zveřejnit"
    try { // Damn, still wrong!
        let add = await fb.$x(`//span[contains(., "${t}")]`, { timeout: wait.timeout() })
        console.error(`Send button 'Zveřejnit' still found!`)
        return true;
    } catch {
        return false;
    }
}

export async function requestCannotBeCompleted() {
    let t = ["Zveřejnit", "Žádost se nedaří dokončit"]
    try {
        if (await fb.waitForXPath(`//span[contains(., "${t[0]}")]`, { visible: true, timeout: 1500 })
            && await fb.waitForXPath(`//div[contains(., "${t[1]}")]`, { visible: true, timeout: 1500 })) {
            console.log(`Text '${t[1]}' found!`)
            return true;
        } else {
            return false;
        }
    } catch {
        return false;
    }
}

export async function tryAgainLater() {
    let t = ["Zveřejnit", "Můžete to zkusit později"]
    try {
        if (await fb.waitForXPath(`//span[contains(text(), "${t[0]}")]`, { visible: true, timeout: 1500 })
            && await fb.waitForXPath(`//*[contains(text(), "${t[1]}")]`, { visible: true, timeout: 1500 })) {
            console.log(`Text "${t[1]}" found!`)
            return true;
        } else {
            return false;
        }
    } catch {
        return false;
    }
}

export async function problemWithURL() {
    let t = ["Zveřejnit", "problém se zadanou adresou"]
    try {
        if (await fb.waitForXPath(`//span[contains(text(), "${t[0]}")]`, { visible: true, timeout: 1500 })
            && await fb.waitForXPath(`//*[contains(text(), "${t[1]}")]`, { visible: true, timeout: 1500 })) {
            console.log(`Text "${t[1]}" found!`)
            return true;
        } else {
            return false;
        }
    } catch {
        return false;
    }
}

export async function spamDetected() {
    // detected spam?
    // Abychom komunitu chránili před spamem, máme nastavené limity na to, jak často můžete v určitém časovém úseku přidávat příspěvky
    // a komentáře nebo dělat další věci. Můžete to zkusit později.
    let t = ["Zveřejnit", "před spamem"]
    try {
        if (await fb.waitForXPath(`//span[contains(text(), "${t[0]}")]`, { visible: true, timeout: 1500 })
            && await fb.waitForXPath(`//*[contains(text(), "${t[1]}")]`, { visible: true, timeout: 1500 })) {
            console.log(`Text '${t[1]}' found!`)
            return true;
        } else {
            return false;
        }
    } catch {
        return false;
    }
}

export async function loginFailedEn() {
    //t1 = "Nepamatujete si svůj účet?"
    t = "Forgot Account?"
    try {
        await fb.waitForXPath(`//*[contains(text(), "${t}")]`, { visible: true, timeout: 1500 })
        console.err(`Text '${t}' found!`)
        return true;
    }
    catch {
        return false;
    }
}

export async function loginFailedCs() {
    t = "Nepamatujete si svůj účet?"
    try {
        await fb.waitForXPath(`//*[contains(text(), "${t}")]`, { visible: true, timeout: 1500 })
        console.err(`Text '${t}' found!`)
        return true;
    }
    catch {
        return false;
    }
}

export async function accoutLocked() {
    try {
        t = "váš účet jsme uzamkli";
        let lock = await fb.$x(`//span[contains(text(), '${t}')]`, { visible: true, timeout: 2000 })
        console.log(`lock.length=${lock.length}`);
        if (lock.length < 1) throw "Not locked!";
        console.log(`User [${user.id}] ${user.name} ${user.surname} is locked!`)
        return true;
    }
    catch (err) {
        return false;
    }
}

export async function accoutBlock() {
    try {
        t = "Účet byl zablokován"
        let block = await fb.$x(`//span[contains(text(), "${t}")]`, { visible: true, timeout: 2000 })
        console.log(`block.length=${block.length}`);
        if (block.length < 1) throw "Not blocked!";
        console.log(`User [${user.id}] ${user.name} ${user.surname} account block!`)
        return true;
    }
    catch (err) {
        return false;
    }
}

export async function newThing(i = 0) {
    t = ["Napište něco", "veřejný příspěvek", "Co se vám honí hlavou", "Podělte se se skupinou"]
    try {
        let [thing] = await fb.$x(`//span[contains(text(), '${t[i]}')]`, { visible: true, timeout: 2000 })
        if (thing) { new_thing_element = thing; } else { throw `SPAN contains "${t[i]}" not found.`; }
        return thing;
    } catch (err) {
        console.error(err)
        return false;
    }
};

export async function defaultRange() {
    t1 = "Výchozí okruh uživatelů";
    t2 = "Přátelé";
    try {
        let [range_select] = await fb.$x(`//span[contains(text(), '${t1}')]`, { visible: true, timeout: 2000 })
        if (range_select) {
            let range_friends = await fb.$x(`//span[contains(text(), '${t2}')]`, { visible: true, timeout: 2000 });
            if (range_friends.length) {
                friends = range_friends[range_friends.length - 2];
                console.log(`Friends length: ${range_friends.length}`)
                //await friends.focus();
                await friends.click();
                const add_button = await fb.$x(`//span[contains(text(), "Hotovo")]`, { visible: true, timeout: wait.timeout() });
                if (!add_button.length) throw (`Accept button not find!`);
                await fb.waitForTimeout(3 * wait.timeout());
                await fb.evaluate(el => { el.click({ clickCount: 2 }); }, add_button[add_button.length - 1]);
                await fb.waitForTimeout(15 * wait.timeout());
            } else {
                throw `SPAN contains "${t2}" not found.`;
            }
        } else {
            throw `SPAN contains "${t1}" not found.`;
        }
        return true;
    } catch (err) {
        console.error(err)
        return false;
    }
};

export async function clickNewThing() {
    try {
        await fb.bringToFront()
        await new_thing_element.click()
        await fb.waitForTimeout(3 * wait.timeout());
        //console.log(`New thing clicked!`)
        return true;
    } catch (err) {
        console.error(`New thing failed!\n${err}`)
        return false;
    }
};

export async function isSellGroup() {
    t = "Prodat"
    try {
        await fb.waitForXPath(`//span[contains(text(), '${t}')]`, { visible: true, timeout: 3500 })
        //console.log(`It is sell group!`)
        return true
    }
    catch {
        //console.error(`Text '${t}' NOT found!`)
        return false
    }
}

export async function clickDiscus() {
    t = "Diskuze"
    try {
        let [button] = await fb.$x(`//span[contains(text(), '${t}')]`, { visible: true, timeout: wait.timeout() })
        if (button) {
            await button.click()
            //console.log(`Button '${t}' clicked!`)
            return true;
        } else {
            throw `Button '${t}' NOT clicked!`
        }
    } catch (err) {
        console.error(err);
        return false;
    }
}

export async function joinToGroup() {
    t = "Přidat se ke skupině"
    try {
        let [button] = await fb.$x(`//span[contains(text(), '${t}')]`, { delay: wait.timeout() })
        if (button) {
            await button.click()
            //console.log(`Button '${t}' clicked!`)
            return true;
        } else {
            throw `Button '${t}' NOT clicked!`
        }
    } catch (err) {
        console.error(err);
        return false;
    }
}

export async function getScreenshot(user_id, group_id, host, spam = false) {
    const time = new Date()
    const y = ('' + time.getFullYear()).slice(-2)
    const n = ('0' + (1 * time.getMonth() + 1)).slice(-2)
    const d = ('0' + time.getDate()).slice(-2)
    const h = ('0' + time.getHours()).slice(-2)
    const m = ('0' + time.getMinutes()).slice(-2)
    const s = ('0' + time.getSeconds()).slice(-2)
    let name = spam ? "Spam" : "Fail";
    let filename = `fails/${name}_${y}${n}${d}_${h}${m}${s}_${host}_u${user_id}_g${group_id}.png`
    if (await fb.screenshot({ path: filename })) {
        console.log(`Screenshot ${filename} saved.`)
    } else {
        console.error(`Screenshot ${filename} is NOT saved!`)
    }
    await fb.waitForTimeout(5 * wait.timeout());
}

export async function getScreenshotForDatabase() {
    const image = await fb.screenshot({
        type: 'png'
    });
    return image;
}

function generate(c = 6) {
    const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const signs = "/+*-$,;:#&"
    // c is base for random generated string length.
    // one third + 1 is mandatory part (1/3*c)
    // the other two-thirds is an optional part > interval (0 - 2/3*c)
    let chars_count = Math.floor(Math.random() * 2 * c / 3 + Math.floor(1 + c / 3));
    let code = "";
    let sign_not_used = true;

    for (let i = 0; i < chars_count; i++) {
        let rnd1 = Math.floor(Math.random() * chars.length);
        // instert any sign from list when:
        // is not last char, not used before and with "random chance" increasing with each previous character
        if ((i < (chars_count - 1)) && sign_not_used && Math.round(Math.random() * (2 + i) / chars_count)) {
            rnd2 = Math.floor(Math.random() * signs.length);
            code += signs.substring(rnd2, rnd2 + 1);
            sign_not_used = false;
        }
        code += chars.substring(rnd1, rnd1 + 1);
    }
    return code;
}

export async function test_x(selector) {
    try {
        let thing = await fb.$x(selector, { visible: true, timeout: 2000 })
        //let thing = await fb.$x(selector);
        console.log(`Things count: ${thing.length}`);
        if (!thing.length) throw `ELEMENT with selector ${JSON.stringify(selector)} not found!`;
        return thing[0];
    } catch (err) {
        console.error(err)
        return false;
    }
};
