// iv_fb.class.js – Refaktorovaná verze

import * as wait from './iv_wait.js';
import { Log } from './iv_log.class.js';
import path from 'path';
import fs from 'fs';

const CONFIG_PATH = path.resolve('./config.json');
const CONFIG = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));

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
    Log.info(`[FB] Screenshot uložen: ${filename}`);
  }

  // 🧩 Vnitřní helpery pro zjednodušení

  async _findByText(text, options = {}) {
    try {
      const xpath = `//span[starts-with(normalize-space(text()), "${text}")]`;
      const elems = await this.page.$x(xpath);
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
    Log.info(`[FB] Kliknuto na "${text}".`);
    return true;
  }

  async _typeActive(text) {
    const el = await this.page.evaluateHandle(() => document.activeElement);
    await el.type(text);
    Log.info(`[FB] Text napsán: ${text}`);
  }

  async openFB(user) {
    try {
      await this.bringToFront();
      await this.page.goto('https://facebook.com', { waitUntil: 'domcontentloaded' });
      await wait.delay(10000, false);
      Log.info(`[FB] Stránka Facebook načtena.`);
    } catch (err) {
      Log.error(`[FB] Chyba při načítání stránky: ${err}`);
      return false;
    }

    if (await this.isAccountLocked()) {
      Log.error(`[FB] Účet je zablokovaný.`);
      return 'account_locked';
    }

    if (await this.isProfileLoaded(user)) {
      Log.info(`[FB] Uživatel ${user.id} ${user.name} ${user.surname} je stále přihlášen.`);
      return 'still_loged';
    }

    Log.info(`[FB] Přihlašuji uživatele...`);
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
      await wait.delay(15 * wait.timeout());

      if (await this.isProfileLoaded(user)) {
        Log.success(`[FB] Uživatel ${user.id} ${user.name} ${user.surname} je nyní přihlášen.`);
        return 'now_loged';
      } else {
        Log.warn(`[FB] Uživatel není přihlášen na FB.`);
        return false;
      }
    } catch (err) {
      Log.error(`[FB] Chyba při loginu: ${err}`);
      return false;
    }
  }

  async acceptCookies() {
    try {
      const [cookieBtn] = await this._findByText('Přijmout všechno');
      if (cookieBtn) {
        await cookieBtn.click();
        await wait.delay(wait.timeout());
        Log.info(`[FB] Cookie banner odkliknut.`);
      } else {
        Log.info(`[FB] Cookie banner nenalezen.`);
      }
    } catch (err) {
      console.warn(`[FB] Cookie banner error: ${err}`);
    }
  }

  async isAccountLocked() {
    return await this._checkTexts("váš účet jsme uzamkli", "Účet byl zablokován");
  }

  async newThing() {
    try {
      const promises = CONFIG.new_post_texts.map(text => {
        const xpath = `//span[starts-with(normalize-space(text()), "${text}")]`;
        const selector = `xpath/${xpath}`;
        return this.page.waitForSelector(selector, { timeout: 5000 })
          .then(handle => ({ handle, text }))
          .catch(() => null);
      });

      const result = await Promise.race(promises);
      if (result && result.handle) {
        this.newThingElement = result.handle;
        Log.info('[FB]', `Element pro psaní příspěvku nalezen: "${result.text}"`);
        return true;
      }

      throw new Error('Žádný z možných textů nebyl nalezen.');
    } catch (err) {
      Log.error('[FB] newThing()', err);
      await this.debugFindText();
      return false;
    }
  }

  async clickNewThing() {
    try {
      if (!this.newThingElement) throw `newThingElement není definován.`;
      await this.bringToFront();
      await this.newThingElement.click();
      await wait.delay(3 * wait.timeout());
      Log.info(`[FB] Kliknuto na pole pro psaní příspěvku.`);
      return true;
    } catch (err) {
      Log.error(`[FB] Klik na newThingElement selhal: ${err}`);
      return false;
    }
  }

  async pasteStatement(text) {
    try {
      if (!text) throw `Prázdný text pro příspěvek.`;

      await wait.delay(10 * wait.timeout());
      await this._typeActive(text);
      Log.info(`[FB] Text vložen: ${text}`);

      for (const sendText of CONFIG.submit_texts) {
        const xpath = `//span[contains(normalize-space(.), "${sendText}")]`;
        const selector = `xpath/${xpath}`;

        try {
          await this.page.waitForSelector(selector, {
            timeout: 5000,
            visible: true
          });

          const buttons = await this.page.$$(selector);
          for (const button of buttons) {
            const isClickable = await this.page.evaluate(el => {
              const style = window.getComputedStyle(el);
              return (
                style.visibility !== 'hidden' &&
                style.display !== 'none' &&
                style.pointerEvents !== 'none'
              );
            }, button);

            if (isClickable) {
              await button.click();
              await wait.delay(15 * wait.timeout());

              const stillVisible = await this._findByText(sendText);
              if (stillVisible.length === 0) {
                Log.info(`[FB] Příspěvek úspěšně vložen kliknutím na "${sendText}".`);
                return true;
              } else {
                Log.warn(`[FB] Tlačítko "${sendText}" stále viditelné, něco se nepovedlo.`);
              }
            }
          }
        } catch (err) {
          Log.warn(`[FB] Tlačítko "${sendText}" zatím neaktivní nebo nenalezeno.`);
        }
      }

      throw new Error(`Tlačítko pro odeslání příspěvku se neaktivovalo.`);

    } catch (err) {
      Log.error(`[FB] Chyba při vkládání příspěvku: ${err}`);
      return false;
    }
  }

  async clickSendButton(buttonText = "Zveřejnit") {
    try {
      await this._clickByText(buttonText);
      await wait.delay(15 * wait.timeout());

      const stillVisible = await this._findByText(buttonText);
      if (stillVisible.length > 0) throw new Error(`Tlačítko "${buttonText}" je stále na obrazovce.`);

      Log.info('[FB]', `Kliknuto na tlačítko "${buttonText}".`);
      return true;
    } catch (err) {
      Log.error(`[FB] clickSendButton("${buttonText}")`, err);
      await this.debugFindText();
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
          await wait.delay(3 * wait.timeout());
          await this.page.evaluate(el => { el.click({ clickCount: 2 }); }, done);
          await wait.delay(15 * wait.timeout());
          Log.info(`[FB] Výchozí okruh uživatelů nastaven.`);
        } else {
          throw `SPAN "${t2}" nenalezen.`;
        }
      } else {
        throw `SPAN "${t1}" nenalezen.`;
      }
      return true;
    } catch (err) {
      Log.error(`[FB] Chyba v defaultRange: ${err}`);
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
      await wait.delay(2 * wait.timeout());
      Log.info(`[FB] Skupina otevřena: ${fbGroupUrl}`);
      return true;
    } catch (err) {
      Log.error(`[FB] Chyba při otevírání skupiny ${group.fb_id}: ${err}`);
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
        Log.error(`[FB] Counter "${label}" nenalezen: ${err}`);
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
      Log.error(`[FB] Chyba při parsování counter value: ${err}`);
      return 0;
    }
  }

  async addMeToGroup() {
    try {
      await this._clickByText("Přidat se ke skupině", wait.timeout());
      await wait.delay(15 * wait.timeout());
      Log.info(`[FB] Přidání do skupiny úspěšné.`);
      return true;
    } catch (err) {
      Log.error(`[FB] Chyba při přidávání do skupiny: ${err}`);
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
        Log.info(`[FB] Kliknuto na tlačítko "To se mi líbí".`);
        await wait.delay(5 * wait.timeout());
        return true;
      } catch (err) {
        Log.error(`[FB] Chyba při klikání na "To se mi líbí": ${err}`);
        return false;
      }
    } else {
      Log.info(`[FB] Kliknutí na "To se mi líbí" přeskočeno (náhodné).`);
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
      Log.info(`[FB] Tlačítko "Zveřejnit" stále nalezeno!`);
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
      Log.info(`[FB] Text "Forgot Account?" nalezen.`);
      return true;
    }
    return false;
  }

  async loginFailedCs() {
    const found = await this._findByText("Nepamatujete si svůj účet?", { timeout: 1500 });
    if (found.length) {
      Log.info(`[FB] Text "Nepamatujete si svůj účet?" nalezen.`);
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
      Log.info(`[FB] Screenshot uložen: ${filename}`);
    } catch (err) {
      Log.error(`[FB] Chyba při ukládání screenshotu: ${err}`);
    }
  }

  async getScreenshotForDatabase() {
    try {
      const image = await this.page.screenshot({ type: 'png' });
      return image;
    } catch (err) {
      Log.error(`[FB] Screenshot pro DB selhal: ${err}`);
      return null;
    }
  }

  // Pokračování třídy FacebookBot

  async isSellGroup() {
    const found = await this._findByText("Prodat", { timeout: 3500 });
    if (found.length) {
      Log.info(`[FB] Skupina je prodejní.`);
      return true;
    }
    return false;
  }

  async clickDiscus() {
    try {
      await this._clickByText("Diskuze");
      return true;
    } catch (err) {
      Log.error(`[FB] Chyba v clickDiscus: ${err}`);
      return false;
    }
  }

  async joinToGroup() {
    try {
      await this._clickByText("Přidat se ke skupině");
      return true;
    } catch (err) {
      Log.error(`[FB] Chyba v joinToGroup: ${err}`);
      return false;
    }
  }

  async testXPath(selector) {
    try {
      const found = await this.page.$x(selector, { visible: true, timeout: 2000 });
      Log.info(`[FB] XPath ${selector} – nalezeno: ${found.length}`);
      if (!found.length) throw `Element pro XPath ${selector} nenalezen.`;
      return found[0];
    } catch (err) {
      Log.error(`[FB] Chyba v testXPath: ${err}`);
      return false;
    }
  }

  async debugFindText() {
    Log.info('[DEBUG]', 'Ladění vyhledávání textu spuštěno. Zadej text pro hledání nebo "x" pro ukončení.');

    const readline = await import('node:readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true
    });

    const ask = (prompt) => new Promise(resolve => rl.question(prompt, resolve));

    while (true) {
      const input = await ask('🔍 Text pro _findByText(): ');
      if (input.trim().toLowerCase() === 'x') break;

      try {
        const elements = await this._findByText(input.trim(), { timeout: 3000 });
        Log.info('[DEBUG]', `Nalezeno ${elements.length} prvků pro "${input.trim()}".`);

        for (let i = 0; i < elements.length; i++) {
          const text = await this.page.evaluate(el => el.innerText, elements[i]);
          Log.info(`[${i + 1}]`, text.replace(/\n/g, ' '));
        }
      } catch (err) {
        Log.error('[DEBUG]', err);
      }
    }

    rl.close();
    Log.info('[DEBUG]', 'Ladění vyhledávání textu ukončeno.');
  }

}
