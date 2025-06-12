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

  /**
   * Vyhledá <span> elementy podle obsahu textu.
   * @param {string} text - hledaný text
   * @param {object} options - volby (match: startsWith|exact|contains)
   * @returns {Promise<ElementHandle[]>}
   */
  async _findByText(text, options = {}) {
    try {
      if (!this.page || typeof this.page.$x !== 'function') {
        Log.warn('[FB] _findByText selhalo: this.page není platná nebo nepodporuje $x.');
        return [];
      }

      const { match = 'startsWith' } = options;
      let xpath;

      if (match === 'startsWith') {
        xpath = `//span[starts-with(normalize-space(string(.)), "${text}")]`;
      } else if (match === 'exact') {
        xpath = `//span[normalize-space(string(.)) = "${text}"]`;
      } else {
        xpath = `//span[contains(normalize-space(string(.)), "${text}")]`;
      }

      console.log(`XPath dotaz: ${xpath}`);
      const found = await this.page.$x(xpath);
      console.log(`Počet nalezených: ${found.length}`);
      return found;

    } catch (err) {
      Log.warn('[FB] _findByText selhalo:', err);
      return [];
    }
  }


  /**
   * Čeká na <span> s textem podle dané strategie (např. startsWith)
   * Vhodné pro použití v Promise.race().
   */
  async _waitForText(text, options = {}) {
    try {
      if (!this.page || !this.page.waitForSelector) {
        Log.warn('[FB] _waitForText selhalo: this.page není připraven.');
        return null;
      }

      const { match = 'startsWith', timeout = 5000 } = options;

      let xpath;
      if (match === 'startsWith') {
        xpath = `//span[starts-with(normalize-space(string(.)), "${text}")]`;
      } else if (match === 'exact') {
        xpath = `//span[normalize-space(string(.)) = "${text}"]`;
      } else {
        xpath = `//span[contains(normalize-space(string(.)), "${text}")]`;
      }

      const selector = `xpath/${xpath}`;
      return await this.page.waitForSelector(selector, { timeout });
    } catch (err) {
      Log.warn('[FB] _waitForText selhalo:', err);
      return null;
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

  async _typeLikeHuman(text) {
    const el = await this.page.evaluateHandle(() => document.activeElement);
    const chars = text.split('');

    for (let i = 0; i < chars.length; i++) {
      const char = chars[i];

      // 📉 5–10 % šance na překlep
      if (Math.random() < 0.07 && /[a-zá-ž]/i.test(char)) {
        const typo = String.fromCharCode(char.charCodeAt(0) + 1); // např. o -> p
        await el.type(typo);
        await new Promise(resolve => setTimeout(resolve, wait.type()));

        await el.press('Backspace'); // oprava
        await new Promise(resolve => setTimeout(resolve, wait.type()));
      }

      await el.type(char);
      await new Promise(resolve => setTimeout(resolve, wait.type()));

      // ⌛️ Pauza po některých slovech
      if (char === ' ' && Math.random() < 0.4) {
        await wait.pauseBetweenWords();
      }
    }

    // Log.info(`[FB] Text napsán: ${text}`);
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
      await this._typeLikeHuman(text);
      Log.info(`[FB] Text vložen: ${text}`);
      return true;

    } catch (err) {
      Log.error(`[FB] Chyba při psaní příspěvku: ${err}`);
      return false;
    }
  }

  async clickSendButton() {
    try {
      if (!this.page || this.page.isClosed()) {
        Log.error('[FB] clickSendButton() selhal: this.page není připraven.');
        return false;
      }

      await this.bringToFront();
      await wait.delay(1000);

      Log.info('[FB] Čekám na aktivaci tlačítka po napsání textu...');

      // Čekáme na změny v DOM
      await wait.delay(2000);

      // Pokusíme se najít tlačítka několikrát
      const maxAttempts = 3;
      let attempt = 0;

      while (attempt < maxAttempts) {
        attempt++;
        Log.info(`[FB] Pokus ${attempt}/${maxAttempts} - hledám aktivní tlačítko...`);

        const candidates = await this.findActiveSendButtons();

        if (candidates.length > 0) {
          const bestCandidate = this.selectBestCandidate(candidates);

          if (bestCandidate) {
            Log.info(`[FB] Nalezeno aktivní tlačítko: "${bestCandidate.text}"`);

            const clickSuccess = await this.performClick(bestCandidate.element);
            if (clickSuccess) {
              return true;
            }
          }
        }

        // Krátké čekání před dalším pokusem
        await wait.delay(2000);
      }

      Log.warn('[FB] Nepodařilo se najít aktivní tlačítko po všech pokusech.');

      // Fallback - zkusíme kliknout na jakékoli tlačítko s textem z naší konfigurace
      return await this.fallbackClick();

    } catch (err) {
      Log.error(`[FB] clickSendButton() chyba:`, err);
      return false;
    }
  }

  async fallbackClick() {
    Log.info('[FB] Spouštím fallback klikání...');

    try {
      // Jednoduchý fallback - najdi všechny span elementy a klikni na první "Přidat"
      const spans = await this.page.$$('span');

      for (const span of spans) {
        try {
          const text = await this.page.evaluate(el => el.textContent.trim(), span);

          if (text === 'Přidat' || text === 'Zveřejnit') {
            Log.info(`[FB] Fallback našel: "${text}"`);

            // Zkusíme kliknout
            await span.click();
            await wait.delay(3000);

            // Kontrola - pokud span zmizelo, pravděpodobně se to povedlo
            const stillExists = await this.page.evaluate(el => {
              return document.contains(el);
            }, span).catch(() => false);

            if (!stillExists) {
              Log.success('[FB] Fallback kliknutí bylo úspěšné!');
              return true;
            }
          }
        } catch (spanErr) {
          // Pokračujeme na další span
        }
      }

      Log.warn('[FB] Fallback klikání nenašlo vhodné tlačítko.');
      return false;

    } catch (err) {
      Log.error('[FB] Fallback klikání selhalo:', err);
      return false;
    }
  }

  async findActiveSendButtons() {
    const candidates = [];

    try {
      Log.info('[FB] Hledám tlačítka pomocí standardních selektorů...');

      // Strategie 1: Hledání všech span elementů a filtrování podle textu
      const allSpans = await this.page.$$('span');
      Log.info(`[FB] Nalezeno ${allSpans.length} span elementů.`);

      for (const span of allSpans) {
        try {
          const context = await this.page.evaluate(el => {
            if (!el) return null;

            const text = el.textContent.trim();
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            const button = el.closest('button, div[role="button"], [onclick], [tabindex]');

            return {
              text: text,
              visible: rect.width > 0 && rect.height > 0,
              enabled: !el.hasAttribute('disabled') &&
                !el.hasAttribute('aria-disabled') &&
                style.pointerEvents !== 'none',
              hasButton: !!button,
              buttonDisabled: button ? (
                button.hasAttribute('disabled') ||
                button.hasAttribute('aria-disabled') ||
                button.getAttribute('aria-disabled') === 'true' ||
                window.getComputedStyle(button).pointerEvents === 'none'
              ) : false,
              hasActionText: text.includes('k příspěvku') || text.includes('příspěvku'),
              opacity: parseFloat(style.opacity || 1),
              display: style.display,
              visibility: style.visibility,
              buttonAriaLabel: button ? button.getAttribute('aria-label') : null
            };
          }, span);

          if (context && this.isTargetText(context.text) && this.isValidCandidate(context)) {
            candidates.push({ element: span, context, text: context.text });
            Log.info(`[FB] Nalezen kandidát: "${context.text}" (enabled: ${context.enabled}, buttonDisabled: ${context.buttonDisabled})`);
          }
        } catch (evalErr) {
          // Tichá chyba - element už neexistuje
        }
      }

      // Strategie 2: Hledání buttonů s aria-label
      const buttons = await this.page.$$('button, div[role="button"]');
      Log.info(`[FB] Nalezeno ${buttons.length} button elementů.`);

      for (const button of buttons) {
        try {
          const context = await this.page.evaluate(el => {
            if (!el) return null;

            const ariaLabel = el.getAttribute('aria-label') || '';
            const text = el.textContent.trim();
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);

            return {
              text: ariaLabel || text,
              ariaLabel: ariaLabel,
              innerText: text,
              visible: rect.width > 0 && rect.height > 0,
              enabled: !el.hasAttribute('disabled') &&
                !el.hasAttribute('aria-disabled') &&
                el.getAttribute('aria-disabled') !== 'true' &&
                style.pointerEvents !== 'none',
              hasButton: true,
              buttonDisabled: el.hasAttribute('disabled') ||
                el.hasAttribute('aria-disabled') ||
                el.getAttribute('aria-disabled') === 'true',
              hasActionText: (ariaLabel + text).includes('k příspěvku') || (ariaLabel + text).includes('příspěvku'),
              opacity: parseFloat(style.opacity || 1),
              display: style.display,
              visibility: style.visibility
            };
          }, button);

          if (context &&
            (this.isTargetText(context.ariaLabel) || this.isTargetText(context.innerText)) &&
            this.isValidCandidate(context)) {
            candidates.push({ element: button, context, text: context.ariaLabel || context.innerText });
            Log.info(`[FB] Nalezen button kandidát: "${context.text}" (aria: "${context.ariaLabel}")`);
          }
        } catch (evalErr) {
          // Tichá chyba
        }
      }

      // Strategie 3: Pokročilé hledání v compose area
      const composeSelectors = [
        '[data-testid*="composer"] button',
        '[data-pagelet="composer"] button',
        '.composer button',
        '[role="dialog"] button',
        '[data-testid*="post"] button'
      ];

      for (const selector of composeSelectors) {
        try {
          const elements = await this.page.$$(selector);
          for (const element of elements) {
            try {
              const context = await this.page.evaluate(el => {
                const text = el.textContent.trim();
                const ariaLabel = el.getAttribute('aria-label') || '';
                const rect = el.getBoundingClientRect();
                const style = window.getComputedStyle(el);

                return {
                  text: text || ariaLabel,
                  ariaLabel: ariaLabel,
                  visible: rect.width > 0 && rect.height > 0,
                  enabled: !el.hasAttribute('disabled') &&
                    !el.hasAttribute('aria-disabled') &&
                    style.pointerEvents !== 'none',
                  hasButton: true,
                  buttonDisabled: false,
                  hasActionText: false,
                  opacity: parseFloat(style.opacity || 1),
                  display: style.display,
                  visibility: style.visibility
                };
              }, element);

              if (context && this.isTargetText(context.text) && this.isValidCandidate(context)) {
                // Kontrola, zda už není v candidates
                const exists = candidates.some(c => c.text === context.text);
                if (!exists) {
                  candidates.push({ element, context, text: context.text });
                  Log.info(`[FB] Nalezen compose kandidát: "${context.text}"`);
                }
              }
            } catch (evalErr) {
              // Tichá chyba
            }
          }
        } catch (selectorErr) {
          Log.debug(`[FB] Selector "${selector}" selhal: ${selectorErr.message}`);
        }
      }

      Log.info(`[FB] Celkem nalezeno ${candidates.length} kandidátů na tlačítka.`);
      return candidates;

    } catch (err) {
      Log.error(`[FB] Chyba při hledání tlačítek: ${err}`);
      return [];
    }
  }

  isTargetText(text) {
    if (!text) return false;
    const normalizedText = text.trim().toLowerCase();
    const targets = CONFIG.submit_texts.map(t => t.toLowerCase());
    return targets.includes(normalizedText);
  }

  isValidCandidate(context) {
    return (
      context.visible &&
      context.enabled &&
      !context.buttonDisabled &&
      context.hasButton &&
      !context.hasActionText &&
      context.opacity > 0.3 &&
      context.display !== 'none' &&
      context.visibility !== 'hidden'
    );
  }
  isValidCandidate(context) {
    return (
      context.visible &&
      context.enabled &&
      !context.buttonDisabled &&
      context.hasButton &&
      !context.hasActionText &&
      context.opacity > 0.5 &&
      context.display !== 'none' &&
      context.visibility !== 'hidden'
    );
  }

  selectBestCandidate(candidates) {
    // Prioritizujeme kandidáty podle preferencí
    const priorities = ['Přidat', 'Zveřejnit', 'Post', 'Publikovat', 'Hotovo'];

    for (const priority of priorities) {
      const matching = candidates.filter(c => c.text === priority);
      if (matching.length > 0) {
        // Vrátíme poslední matching element (často je to ten správný)
        return matching[matching.length - 1];
      }
    }

    // Fallback - vrátíme poslední dostupný kandidát
    return candidates.length > 0 ? candidates[candidates.length - 1] : null;
  }

  async performClick(element) {
    try {
      // Dvojitá kontrola před kliknutím
      const stillValid = await this.page.evaluate(el => {
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        const button = el.closest('button, div[role="button"], [onclick], [tabindex]');

        return rect.width > 0 &&
          rect.height > 0 &&
          style.pointerEvents !== 'none' &&
          (!button || !button.hasAttribute('disabled'));
      }, element);

      if (!stillValid) {
        Log.warn('[FB] Element už není platný pro kliknutí.');
        return false;
      }

      // Scroll element into view
      await this.page.evaluate(el => {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, element);

      await wait.delay(500);

      // Zkusíme několik metod kliknutí
      const clickMethods = [
        // Metoda 1: Běžné kliknutí
        async () => {
          await element.click();
          Log.info('[FB] Použito běžné kliknutí.');
        },
        // Metoda 2: JavaScript kliknutí
        async () => {
          await this.page.evaluate(el => el.click(), element);
          Log.info('[FB] Použito JavaScript kliknutí.');
        },
        // Metoda 3: Kliknutí na parent button
        async () => {
          await this.page.evaluate(el => {
            const button = el.closest('button, div[role="button"]');
            if (button) button.click();
          }, element);
          Log.info('[FB] Použito kliknutí na parent button.');
        }
      ];

      for (const [index, clickMethod] of clickMethods.entries()) {
        try {
          await clickMethod();
          await wait.delay(2000);

          // Kontrola úspěchu - hledáme zda se objevilo nějaké potvrzení nebo zmizely elementy
          const success = await this.page.evaluate(() => {
            // Hledáme indikátory úspěšného odeslání
            const indicators = [
              document.querySelector('[data-testid="toast"]'), // Toast notifikace
              document.querySelector('.feedback'), // Feedback message
              !document.querySelector('span:contains("Přidat")'), // Tlačítko zmizelo
            ];
            return indicators.some(Boolean);
          });

          if (success) {
            Log.success(`[FB] Kliknutí metodou ${index + 1} bylo úspěšné.`);
            return true;
          }

        } catch (clickErr) {
          Log.warn(`[FB] Metoda kliknutí ${index + 1} selhala: ${clickErr.message}`);
        }
      }

      Log.warn('[FB] Všechny metody kliknutí selhaly.');
      return false;

    } catch (err) {
      Log.error(`[FB] Chyba při klikání: ${err}`);
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
