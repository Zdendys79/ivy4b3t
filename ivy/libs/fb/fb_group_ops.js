// fb_group_ops.js – Group operations mixin for FBBot

import { Log } from '../iv_log.class.js';
import { Wait } from '../iv_wait.class.js';
import * as fbSupport from '../../iv_fb_support.js';
import { getIvyConfig } from '../iv_config.class.js';

const config = getIvyConfig();

export const GroupOpsMixin = {

  async findDiscussionElement() {
    try {
      if (!this.pageAnalyzer) {
        throw new Error('PageAnalyzer není inicializován');
      }

      const discussionTexts = [
        config.get('cfg_discussion_text', 'Diskuze'),
        config.get('cfg_discussion_en', 'Discussion'),
        config.get('cfg_main_tab_text', 'Hlavní'),
        config.get('cfg_main_tab_en', 'Featured')
      ];

      Log.info('[FB]', `Hledám element pro diskuzi. Varianty: ${discussionTexts.join(', ')}`);

      for (const text of discussionTexts) {
        try {
          // Použij PageAnalyzer místo fbSupport.findByText
          const elementExists = await this.pageAnalyzer.elementExists(text, {
            matchType: 'exact',
            refreshCache: false
          });

          if (elementExists) {
            this.discussionText = text;
            this.discussionElement = true; // Kompatibilita s původním kódem
            Log.success('[FB]', `Element pro diskuzi "${text}" nalezen v PageAnalyzer cache`);
            return true;
          }
        } catch (e) {
          // Pokračovat s další variantou
        }
      }

      Log.info('[FB]', 'Element pro diskuzi nebyl nalezen');
      return false;
    } catch (err) {
      await Log.error('[FB] findDiscussionElement()', err);
      return false;
    }
  },

  async findJoinGroupElement() {
    try {
      if (!this.pageAnalyzer) {
        throw new Error('PageAnalyzer není inicializován');
      }

      const joinText = config.get('cfg_group_join_text', 'Přidat se ke skupině');

      Log.info('[FB]', `Hledám element pro přidání do skupiny: "${joinText}"`);

      const elementExists = await this.pageAnalyzer.elementExists(joinText, {
        matchType: 'exact',
        refreshCache: true
      });

      if (elementExists) {
        this.joinGroupText = joinText;
        this.joinGroupElement = true; // Kompatibilita s původním kódem
        Log.success('[FB]', `Element pro přidání do skupiny "${joinText}" nalezen v PageAnalyzer cache`);
        return true;
      }

      Log.info('[FB]', 'Element pro přidání do skupiny nebyl nalezen');
      return false;
    } catch (err) {
      await Log.error('[FB] findJoinGroupElement()', err);
      return false;
    }
  },

  async clickDiscus() {
    try {
      // Použij již nalezený element pokud existuje
      if (this.discussionElement) {
        try {
          // Ověř, že element je stále platný
          const elementExists = await this.page.evaluate((el) => {
            return el && el.isConnected && el.offsetParent !== null;
          }, this.discussionElement);

          if (elementExists) {
            await this.discussionElement.click();
            Log.success('[FB]', 'Úspěšně kliknuto na element pro diskuzi (z cache)');
            return true;
          } else {
            await Log.warn('[FB]', 'Element pro diskuzi již není platný, hledám znovu...');
          }
        } catch (err) {
          await Log.warn('[FB]', `Chyba při ověřování elementu pro diskuzi: ${err.message}, hledám znovu...`);
        }
      }

      // Fallback - hledej element znovu
      if (await this.findDiscussionElement()) {
        await this.discussionElement.click();
        Log.success('[FB]', 'Úspěšně kliknuto na element pro diskuzi (nově nalezený)');
        return true;
      }

      throw new Error('Element pro diskuzi nebyl nalezen');
    } catch (err) {
      Log.debug(`[FB] clickDiscus selhal: ${err.message}`);
      return false;
    }
  },

  async joinToGroup() {
    try {
      if (!this.pageAnalyzer) {
        throw new Error('PageAnalyzer není inicializován');
      }

      // Pokud už máme text z findJoinGroupElement, použij ho
      if (this.joinGroupText) {
        const success = await this.pageAnalyzer.clickElementWithText(this.joinGroupText, {
          matchType: 'exact',
          naturalDelay: true,
          waitAfterClick: true
        });

        if (success) {
          Log.success('[FB]', 'Úspěšně kliknuto na element pro přidání do skupiny pomocí PageAnalyzer');
          return true;
        }
      }

      // Pokud nemáme text, zkus najít element
      if (await this.findJoinGroupElement()) {
        const success = await this.pageAnalyzer.clickElementWithText(this.joinGroupText, {
          matchType: 'exact',
          naturalDelay: true,
          waitAfterClick: true
        });

        if (success) {
          Log.success('[FB]', 'Úspěšně kliknuto na element pro přidání do skupiny (nově nalezený)');
          return true;
        }
      }

      throw new Error('Element pro přidání do skupiny nebyl nalezen');
    } catch (err) {
      await Log.error(`[FB] Chyba v joinToGroup: ${err.message}`);
      return false;
    }
  },

  async addMeToGroup() {
    try {
      await this._clickByText("Přidat se ke skupině", 1000);
      await Wait.toSeconds(15, 'Po přihlášení');
      Log.info(`[FB] Přidání do skupiny úspěšné.`);
      return true;
    } catch (err) {
      await Log.error(`[FB] Chyba při přidávání do skupiny: ${err}`);
      return false;
    }
  },

  async isSellGroup() {
    const sellText = config.get('cfg_sell_text', "Prodat");
    const found = await fbSupport.findByText(this.page, sellText, { timeout: 3500 });
    if (found.length) {
      Log.info(`[FB] Skupina je prodejní.`);
      return true;
    }
    return false;
  },

  async handleAcceptExpertInvite() {
    try {
      const acceptText = config.get('cfg_accept_text', 'Přijmout');
      const expertText = config.get('cfg_expert_accept', 'expertem skupiny');
      Log.info('[FB]', `Hledám tlačítko "${acceptText}" pro pozvánku experta...`);
      // Hledáme tlačítko "Přijmout" v kontextu, kde se mluví o expertovi.
      const button = await this.page.waitForSelector(`xpath///div[@role='button'][.//span[text()='${acceptText}'] and ancestor::div[contains(., '${expertText}')]]`, { timeout: 5000 });

      if (button) {
        await button.click();
        await Wait.toSeconds(3, 'Počkat na reakci'); // Počkat na reakci
        Log.success('[FB]', 'Pozvánka pro experta byla přijata.');
        return true;
      }
      await Log.warn('[FB]', 'Tlačítko "Přijmout" pro pozvánku experta nenalezeno.');
      return false;
    } catch (err) {
      await Log.error(`[FB] Chyba při přijímání pozvánky experta: ${err.message}`);
      return false;
    }
  },

  async readUserCounter() {
    await this.bringToFront();
    const labels = ["členů", "sledujících"];
    for (let label of labels) {
      try {
        const counter = await fbSupport.findByText(this.page, label, { timeout: 3500 });
        if (counter && counter.length > 0) {
          const value = await this.page.evaluate(el => el.textContent, counter[0]);
          return await this.getCounterValue(value);
        }
      } catch (err) {
        await Log.error(`[FB] Counter "${label}" nenalezen: ${err}`);
      }
    }
    return 0;
  },

  async getCounterValue(str) {
    try {
      // Normalizace textu pro správné parsování
      const normalized = str
        .replace(/,/g, ".")                    // čárky → tečky
        .replace(/\s+/g, " ")                  // všechny mezery → normální mezera
        .replace(/&nbsp;/g, " ")               // explicitně &nbsp; → mezera
        .trim();

      let regex = /[+-]?\d+(\.\d+)?/g;
      let [floats] = normalized.match(regex).map(v => parseFloat(v));
      if (str.includes("tis.")) floats *= 1000;
      return floats;
    } catch (err) {
      await Log.error(`[FB] Chyba při parsování counter value: ${err}`);
      return 0;
    }
  },

  async contentNotAvailable() {
    return await this._checkTexts("Obsah teď není dostupný", "Přejít do kanálu");
  },

  async clickLike() {
    if (Math.random() < 0.1) { // 10% šance
      try {
        const likeText = config.get('cfg_like_text', "To se mi líbí");
        const likes = await fbSupport.findByText(this.page, likeText, { timeout: 5000 });
        if (!likes.length) throw `Tlačítko "${likeText}" nenalezeno.`;
        const randomLike = likes[Math.floor(Math.random() * likes.length)];
        await randomLike.click();
        Log.info(`[FB] Kliknuto na tlačítko "${likeText}".`);
        await Wait.toSeconds(5, 'Dlouhé čekání na like');
        return true;
      } catch (err) {
        await Log.error(`[FB] Chyba při klikání na lajk tlačítko: ${err}`);
        return false;
      }
    } else {
      Log.info(`[FB] Kliknutí na lajk tlačítko přeskočeno (náhodné).`);
      return true;
    }
  }
};
