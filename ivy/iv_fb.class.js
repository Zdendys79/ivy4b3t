// iv_fb.class.js – Refaktorovaná verze

import * as wait from './iv_wait.js';
import { IvChar } from './iv_char.class.js';
import fs from 'fs';

export class FacebookBot {
  constructor(context) {
    this.context = context;
    this.page = null;
    this.newThingElement = null;
  }

  async init() {
    this.page = await this.context.newPage();
    this.page.setDefaultNavigationTimeout(15000);
  }

  async bringToFront() {
    await this.page.bringToFront();
  }

  async screenshot(name) {
    const filename = `errors/${name}_${Date.now()}.png`;
    await this.page.screenshot({ path: filename });
    console.log(`[FB] Screenshot uložen: ${filename}`);
  }

  // 🧩 Vnitřní helpery pro zjednodušení

  async _findByText(text, options = {}) {
    try {
      const elems = await this.page.$x(`//span[contains(text(), "${text}")]`, {
        visible: true,
        timeout: options.timeout || 2000
      });
      return elems;
    } catch (err) {
      return [];
    }
  }

  async _checkTexts(text1, text2) {
    const t1 = await this._findByText(text1);
    const t2 = await this._findByText(text2);
    return t1.length && t2.length;
  }

  async _clickByText(text, timeout = wait.timeout()) {
    const [button] = await this._findByText(text, { timeout });
    if (!button) throw new Error(`Tlačítko "${text}" nenalezeno.`);
    await button.click();
    console.log(`[FB] Kliknuto na "${text}".`);
    return true;
  }

  async _typeActive(text) {
    const el = await this.page.evaluateHandle(() => document.activeElement);
    await el.type(text);
    console.log(`[FB] Text napsán: ${text}`);
  }

// Pokračování třídy FacebookBot

  async openFB(user) {
    try {
      await this.bringToFront();
      await this.page.goto('https://facebook.com', { waitUntil: 'domcontentloaded' });
      await wait.delay(10000, false);
      console.log(`[FB] Stránka Facebook načtena.`);
    } catch (err) {
      console.error(`[FB] Chyba při načítání stránky: ${err}`);
      return false;
    }

    if (await this.isAccountLocked()) {
      console.error(`[FB] Účet je zablokovaný.`);
      return 'account_locked';
    }

    if (await this.isProfileLoaded(user)) {
      console.log(`[FB] Uživatel ${user.id} ${user.name} ${user.surname} je stále přihlášen.`);
      return 'still_loged';
    }

    console.log(`[FB] Přihlašuji uživatele...`);
    return await this.login(user);
  }

  async isProfileLoaded(user) {
    try {
      await this.page.waitForSelector('[aria-label="Váš profil"]', { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  async login(user) {
    try {
      await this.acceptCookies();

      await this.page.waitForSelector('#email', { timeout: 5000 });
      await this.page.type('#email', user.fb_login, { delay: wait.type() });

      await this.page.waitForSelector('#pass', { timeout: 5000 });
      await this.page.type('#pass', user.fb_pass, { delay: wait.type() });

      await this._clickByText('Přihlásit se');
      await this.page.waitForTimeout(15 * wait.timeout());

      if (await this.isProfileLoaded(user)) {
        console.log(`[FB] Uživatel ${user.id} ${user.name} ${user.surname} je nyní přihlášen.`);
        return 'now_loged';
      } else {
        console.error(`[FB] Přihlášení se nezdařilo – profilový element nenalezen.`);
        return false;
      }
    } catch (err) {
      console.error(`[FB] Chyba při loginu: ${err}`);
      return false;
    }
  }

  async acceptCookies() {
    try {
      const [cookieBtn] = await this._findByText('Přijmout všechno');
      if (cookieBtn) {
        await cookieBtn.click();
        await this.page.waitForTimeout(wait.timeout());
        console.log(`[FB] Cookie banner odkliknut.`);
      } else {
        console.log(`[FB] Cookie banner nenalezen.`);
      }
    } catch (err) {
      console.warn(`[FB] Cookie banner error: ${err}`);
    }
  }

  async isAccountLocked() {
    return await this._checkTexts("váš účet jsme uzamkli", "Účet byl zablokován");
  }

  async newThing(index = 0) {
    const texts = ["Napište něco", "veřejný příspěvek", "Co se vám honí hlavou", "Podělte se se skupinou"];
    try {
      const [thing] = await this._findByText(texts[index], { timeout: 2000 });
      if (thing) {
        this.newThingElement = thing;
        console.log(`[FB] Našel jsem element pro psaní příspěvku.`);
        return true;
      } else {
        throw `Element "${texts[index]}" nenalezen.`;
      }
    } catch (err) {
      console.error(`[FB] newThing error: ${err}`);
      return false;
    }
  }

  async clickNewThing() {
    try {
      if (!this.newThingElement) throw `newThingElement není definován.`;
      await this.bringToFront();
      await this.newThingElement.click();
      await this.page.waitForTimeout(3 * wait.timeout());
      console.log(`[FB] Kliknuto na pole pro psaní příspěvku.`);
      return true;
    } catch (err) {
      console.error(`[FB] Klik na newThingElement selhal: ${err}`);
      return false;
    }
  }

// Pokračování třídy FacebookBot

  async pasteStatement(text) {
    try {
      if (!text) throw `Prázdný text pro příspěvek.`;

      await this.page.waitForTimeout(10 * wait.timeout());
      await this._typeActive(text);

      console.log(`[FB] Text vložen: ${text}`);

      // Kliknout na "Přidat"
      await this._clickByText("Přidat");
      await this.page.waitForTimeout(15 * wait.timeout());

      // Znovu kontrola (jestli tam "Přidat" není)
      const stillVisible = await this._findByText("Přidat");
      if (stillVisible.length > 0) throw `Tlačítko "Přidat" je stále na obrazovce.`;

      console.log(`[FB] Příspěvek úspěšně vložen.`);
      return true;
    } catch (err) {
      console.error(`[FB] Chyba při vkládání příspěvku: ${err}`);
      return false;
    }
  }

  async clickSendButton(buttonText = "Zveřejnit") {
    try {
      await this._clickByText(buttonText);
      await this.page.waitForTimeout(15 * wait.timeout());

      const stillVisible = await this._findByText(buttonText);
      if (stillVisible.length > 0) throw `Tlačítko "${buttonText}" je stále na obrazovce.`;

      console.log(`[FB] Kliknuto na tlačítko "${buttonText}".`);
      return true;
    } catch (err) {
      console.error(`[FB] Chyba při klikání na tlačítko "${buttonText}": ${err}`);
      return false;
    }
  }

  async defaultRange() {
    const t1 = "Výchozí okruh uživatelů";
    const t2 = "Přátelé";
    try {
      const [rangeSelect] = await this._findByText(t1, { timeout: 2000 });
      if (rangeSelect) {
        const friends = await this._findByText(t2, { timeout: 2000 });
        if (friends.length) {
          await friends[friends.length - 2].click();
          const [done] = await this._findByText("Hotovo", { timeout: wait.timeout() });
          if (!done) throw `Tlačítko "Hotovo" nenalezeno.`;
          await this.page.waitForTimeout(3 * wait.timeout());
          await this.page.evaluate(el => { el.click({ clickCount: 2 }); }, done);
          await this.page.waitForTimeout(15 * wait.timeout());
          console.log(`[FB] Výchozí okruh uživatelů nastaven.`);
        } else {
          throw `SPAN "${t2}" nenalezen.`;
        }
      } else {
        throw `SPAN "${t1}" nenalezen.`;
      }
      return true;
    } catch (err) {
      console.error(`[FB] Chyba v defaultRange: ${err}`);
      return false;
    }
  }

// Pokračování třídy FacebookBot

  async openGroup(group) {
    await this.bringToFront();
    let fbGroupUrl = "https://facebook.com/";
    fbGroupUrl += group.typ === "P" ? "" : "groups/";
    fbGroupUrl += group.fb_id;
    fbGroupUrl += group.sell ? "/buy_sell_discussion" : "";

    try {
      const acceptBeforeUnload = dialog => dialog.type() === "beforeunload" && dialog.accept();
      await this.page.goto(fbGroupUrl, { waitUntil: 'networkidle2' });
      this.page.on("dialog", acceptBeforeUnload);
      await this.page.waitForTimeout(2 * wait.timeout());
      console.log(`[FB] Skupina otevřena: ${fbGroupUrl}`);
      return true;
    } catch (err) {
      console.error(`[FB] Chyba při otevírání skupiny ${group.fb_id}: ${err}`);
      return false;
    }
  }

  async readUserCounter() {
    await this.bringToFront();
    const labels = ["členů", "sledujících"];
    for (let label of labels) {
      try {
        const [counter] = await this._findByText(label, { timeout: 3500 });
        if (counter) {
          const value = await this.page.evaluate(el => el.textContent, counter);
          return this.getCounterValue(value);
        }
      } catch (err) {
        console.error(`[FB] Counter "${label}" nenalezen: ${err}`);
      }
    }
    return 0;
  }

  getCounterValue(str) {
    try {
      let regex = /[+-]?\d+(\.\d+)?/g;
      let [floats] = str.replace(",", ".").match(regex).map(v => parseFloat(v));
      if (str.includes("tis.")) floats *= 1000;
      return floats;
    } catch (err) {
      console.error(`[FB] Chyba při parsování counter value: ${err}`);
      return 0;
    }
  }

  async addMeToGroup() {
    try {
      await this._clickByText("Přidat se ke skupině", wait.timeout());
      await this.page.waitForTimeout(15 * wait.timeout());
      console.log(`[FB] Přidání do skupiny úspěšné.`);
      return true;
    } catch (err) {
      console.error(`[FB] Chyba při přidávání do skupiny: ${err}`);
      return false;
    }
  }

  async clickLike() {
    if (Math.random() < 0.1) { // 10% šance
      try {
        const likes = await this._findByText("To se mi líbí", { timeout: wait.timeout() });
        if (!likes.length) throw `Tlačítko "To se mi líbí" nenalezeno.`;
        const randomLike = likes[Math.floor(Math.random() * likes.length)];
        await randomLike.click();
        console.log(`[FB] Kliknuto na tlačítko "To se mi líbí".`);
        await this.page.waitForTimeout(5 * wait.timeout());
        return true;
      } catch (err) {
        console.error(`[FB] Chyba při klikání na "To se mi líbí": ${err}`);
        return false;
      }
    } else {
      console.log(`[FB] Kliknutí na "To se mi líbí" přeskočeno (náhodné).`);
      return true;
    }
  }

// Pokračování třídy FacebookBot

  async contentNotAvailable() {
    return await this._checkTexts("Obsah teď není dostupný", "Přejít do kanálu");
  }

  async stillSendButton() {
    const found = await this._findByText("Zveřejnit", { timeout: wait.timeout() });
    if (found.length) {
      console.log(`[FB] Tlačítko "Zveřejnit" stále nalezeno!`);
      return true;
    }
    return false;
  }

  async spamDetected() {
    return await this._checkTexts("Zveřejnit", "před spamem");
  }

  async tryAgainLater() {
    return await this._checkTexts("Zveřejnit", "Můžete to zkusit později");
  }

  async problemWithURL() {
    return await this._checkTexts("Zveřejnit", "problém se zadanou adresou");
  }

  async loginFailedEn() {
    const found = await this._findByText("Forgot Account?", { timeout: 1500 });
    if (found.length) {
      console.log(`[FB] Text "Forgot Account?" nalezen.`);
      return true;
    }
    return false;
  }

  async loginFailedCs() {
    const found = await this._findByText("Nepamatujete si svůj účet?", { timeout: 1500 });
    if (found.length) {
      console.log(`[FB] Text "Nepamatujete si svůj účet?" nalezen.`);
      return true;
    }
    return false;
  }

  async getScreenshot(name = "screenshot") {
    const time = new Date();
    const y = time.getFullYear().toString().slice(-2);
    const m = (time.getMonth() + 1).toString().padStart(2, '0');
    const d = time.getDate().toString().padStart(2, '0');
    const h = time.getHours().toString().padStart(2, '0');
    const min = time.getMinutes().toString().padStart(2, '0');
    const s = time.getSeconds().toString().padStart(2, '0');
    const filename = `errors/${name}_${y}${m}${d}_${h}${min}${s}.png`;

    try {
      await this.page.screenshot({ path: filename });
      console.log(`[FB] Screenshot uložen: ${filename}`);
    } catch (err) {
      console.error(`[FB] Chyba při ukládání screenshotu: ${err}`);
    }
  }

  async getScreenshotForDatabase() {
    try {
      const image = await this.page.screenshot({ type: 'png' });
      return image;
    } catch (err) {
      console.error(`[FB] Screenshot pro DB selhal: ${err}`);
      return null;
    }
  }

// Pokračování třídy FacebookBot

  async isSellGroup() {
    const found = await this._findByText("Prodat", { timeout: 3500 });
    if (found.length) {
      console.log(`[FB] Skupina je prodejní.`);
      return true;
    }
    return false;
  }

  async clickDiscus() {
    try {
      await this._clickByText("Diskuze");
      return true;
    } catch (err) {
      console.error(`[FB] Chyba v clickDiscus: ${err}`);
      return false;
    }
  }

  async joinToGroup() {
    try {
      await this._clickByText("Přidat se ke skupině");
      return true;
    } catch (err) {
      console.error(`[FB] Chyba v joinToGroup: ${err}`);
      return false;
    }
  }

  async testXPath(selector) {
    try {
      const found = await this.page.$x(selector, { visible: true, timeout: 2000 });
      console.log(`[FB] XPath ${selector} – nalezeno: ${found.length}`);
      if (!found.length) throw `Element pro XPath ${selector} nenalezen.`;
      return found[0];
    } catch (err) {
      console.error(`[FB] Chyba v testXPath: ${err}`);
      return false;
    }
  }
}
