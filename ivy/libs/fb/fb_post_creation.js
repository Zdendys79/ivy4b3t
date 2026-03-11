// fb_post_creation.js – Post creation mixin for FBBot

import { Log } from '../iv_log.class.js';
import { Wait } from '../iv_wait.class.js';
import * as fbSupport from '../../iv_fb_support.js';
import { getIvyConfig } from '../iv_config.class.js';

const config = getIvyConfig();

export const PostCreationMixin = {

  async newThing() {
    try {
      if (!this.pageAnalyzer) {
        throw new Error('PageAnalyzer není inicializován');
      }

      const currentUrl = this.page.url();

      // Na homepage hledáme "Co se vám honí hlavou", jinde "Napište něco"
      const isHomepage = currentUrl === 'https://www.facebook.com/' ||
                        currentUrl === 'https://www.facebook.com' ||
                        currentUrl.startsWith('https://www.facebook.com/?');

      const searchText = isHomepage ? "Co se vám honí hlavou" : "Napište něco";
      Log.info('[FB]', `Hledám element "${searchText}" (${isHomepage ? 'homepage' : 'skupina'})`);

      // Použij PageAnalyzer místo fbSupport.findByText
      const elementExists = await this.pageAnalyzer.elementExists(searchText, {
        matchType: 'startsWith',
        refreshCache: true
      });

      if (elementExists) {
        // Uložíme si informaci, že element existuje - clickNewThing() použije PageAnalyzer
        this.newThingText = searchText;
        this.newThingElement = true; // Kompatibilita s původním kódem
        Log.success('[FB]', `Element "${searchText}" nalezen v PageAnalyzer cache`);
        return true;
      }

      throw new Error(`Element "${searchText}" nebyl nalezen`);
    } catch (err) {
      await Log.error('[FB] newThing()', err);
      return false;
    }
  },

  async findPostElementWithStrategy(strategy, newPostTexts) {
    try {
      Log.debug('[FB]', `Spouštím strategii: ${strategy} pro texty: ${newPostTexts.join(', ')}`);

      // JavaScript implementace místo XPath
      for (const text of newPostTexts) {
        const matchType = strategy === 'starts-with' ? 'startsWith' : 'contains';

        // Použij fbSupport.findByText s novými JavaScript metodami
        const elements = await fbSupport.findByText(this.page, text, {
          match: matchType,
          timeout: 3000
        });

        if (elements && elements.length > 0) {
          Log.debug('[FB]', `Nalezen element pro text: "${text}" (${strategy})`);
          return { handle: elements[0], text };
        } else {
          Log.debug('[FB]', `Element nenalezen pro text: "${text}" (${strategy})`);
        }
      }

      Log.debug('[FB]', `Strategie ${strategy}: žádné elementy nenalezeny`);
      return null;
    } catch (err) {
      Log.debug('[FB]', `Strategie ${strategy} selhala: ${err.message}`);
      return null;
    }
  },

  async clickNewThing() {
    try {
      if (!this.newThingElement || !this.newThingText) {
        await Log.error('[FB]', 'newThingElement není definován. Možná selhal newThing()');
        return false;
      }

      if (!this.pageAnalyzer) {
        throw new Error('PageAnalyzer není inicializován');
      }

      Log.info('[FB]', 'Klikám na element pro psaní příspěvku...');
      await this.bringToFront();

      // Použij PageAnalyzer pro kliknutí
      const clickResult = await this.pageAnalyzer.clickElementWithText(this.newThingText, {
        matchType: 'startsWith',
        naturalDelay: true,
        waitAfterClick: true
      });

      if (clickResult) {
        Log.success('[FB]', 'Kliknuto na pole pro psaní příspěvku pomocí PageAnalyzer.');
        return true;
      } else {
        throw new Error('PageAnalyzer kliknutí selhalo');
      }
    } catch (err) {
      await Log.error('[FB]', `Klik na newThingElement selhal: ${err}`);
      return false;
    }
  },

  async pasteStatement(text, useClipboard = false) {
    try {
      if (!text) {
        await Log.error('[FB]', 'Prázdný text pro příspěvek - nelze pokračovat');
        return false;
      }

      Log.info('[FB]', `Vkládám text příspěvku (${text.length} znaků). Metoda: ${useClipboard ? 'schránka' : 'psaní po písmenech'}`);

      // Ujisti se, že má FB stránka focus před vkládáním
      await this.bringToFront();

      await Wait.toSeconds(5, 'Před vložením textu');

      if (useClipboard) {
        // Použij vkládání přes schránku (rychlejší pro UTIO a RSS)
        Log.info('[FB]', 'Pokus o vložení přes schránku...');
        const success = await this.pasteTextViaClipboard(text);
        if (!success) {
          await Log.warn('[FB]', 'Vkládání přes schránku selhalo, přepínám na psaní po písmenech');
          await this._typeLikeHuman(text);
        } else {
          Log.success('[FB]', 'Text úspěšně vložen přes schránku');
        }
      } else {
        // Použij psaní po písmenech (pro citáty a jiné akce)
        Log.info('[FB]', 'Spouštím psaní po písmenech...');
        await this._typeLikeHuman(text);
        Log.success('[FB]', 'Text úspěšně napsán po písmenech');
      }

      Log.success('[FB]', `Text vložen: "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"`);
      return true;

    } catch (err) {
      await Log.error('[FB]', `Chyba při psaní příspěvku: ${err}`);
      return false;
    }
  },

  async pasteFromClipboard() {
    try {
      if (!this.page || this.page.isClosed()) {
        await Log.error('[FB] Stránka není dostupná pro vložení ze schránky.');
        return false;
      }

      await this.bringToFront();

      // Použijeme Ctrl+V pro vložení ze schránky
      await this.page.keyboard.down('Control');
      await this.page.keyboard.press('KeyV');
      await this.page.keyboard.up('Control');

      await Wait.toSeconds(2, 'Počkáme na vložení');

      Log.info('[FB] Text vložen ze schránky pomocí Ctrl+V');
      return true;

    } catch (err) {
      await Log.error(`[FB] Chyba při vkládání ze schránky: ${err}`);
      return false;
    }
  },

  async pasteTextViaClipboard(text) {
    try {
      if (!text) throw `Prázdný text pro vložení.`;

      // Ujisti se, že má stránka focus pro přístup ke schránce
      await this.bringToFront();
      await Wait.toSeconds(0.5);

      // Zkopíruj text do schránky
      await this.page.evaluate((textToCopy) => {
        return navigator.clipboard.writeText(textToCopy);
      }, text);

      await Wait.toSeconds(1);

      // Vloží text pomocí Ctrl+V
      const success = await this.pasteFromClipboard();

      if (success) {
        Log.info(`[FB] Text vložen pomocí schránky: ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`);
      }

      return success;

    } catch (err) {
      await Log.error(`[FB] Chyba při vkládání textu pomocí schránky: ${err}`);
      return false;
    }
  },

  async writeMessage(text, useClipboard = false) {
    try {
      Log.info('[FB]', `Začínám psaní zprávy (${text.length} znaků)...`);

      // 1. Najdi pole pro psaní příspěvku
      if (!await this.newThing()) {
        await Log.error('[FB]', 'Nepodařilo se najít pole pro psaní příspěvku');
        return false;
      }

      // 2. Klikni na pole pro psaní příspěvku
      if (!await this.clickNewThing()) {
        await Log.error('[FB]', 'Nepodařilo se kliknout na pole pro psaní příspěvku');
        return false;
      }

      // 3. Vloži text příspěvku
      if (!await this.pasteStatement(text, useClipboard)) {
        await Log.error('[FB]', 'Nepodařilo se vložit text příspěvku');
        return false;
      }

      // 4. Odešli příspěvek
      if (!await this.clickSendButton()) {
        await Log.error('[FB]', 'Nepodařilo se odeslat příspěvek');
        return false;
      }

      Log.success('[FB]', 'Zpráva úspěšně napsána a odeslána!');
      return true;

    } catch (err) {
      await Log.error('[FB] writeMessage', err);
      return false;
    }
  },

  async clickSendButton() {
    try {
      if (!this.page || this.page.isClosed()) {
        await Log.error('[FB] Stránka není dostupná.');
        return false;
      }

      if (!this.pageAnalyzer) {
        throw new Error('PageAnalyzer není inicializován');
      }

      await this.bringToFront();

      Log.info('[FB] Kontrolujem napsaný text...');
      await Wait.toSeconds(2, 'Čekání na aktivaci tlačítka/reakci');

      Log.info('[FB] Čekám než se tlačítko aktivuje...');
      await Wait.toSeconds(5, 'Náhodná pauza 2-5s');

      Log.info('[FB] Klikám na tlačítko "Zveřejnit"');

      const submitTexts = config.get('cfg_submit_texts', ["Zveřejnit", "Přidat"]);

      // Zkus jednotlivé texty přes PageAnalyzer
      for (const submitText of submitTexts) {
        const success = await this.pageAnalyzer.clickElementWithText(submitText, {
          matchType: 'exact',
          timeout: 3000,
          waitAfterClick: true,
          naturalDelay: true
        });

        if (success) {
          Log.success(`[FB] Příspěvek odeslán pomocí PageAnalyzer: "${submitText}"`);
          return true;
        }
      }

      await Log.warn('[FB] Žádné odeslací tlačítko nenalezeno');
      return false;

    } catch (err) {
      await Log.error(`[FB] Chyba při odesílání:`, err);
      return false;
    }
  },

  async findActiveSendButtons() {
    const candidates = [];
    const submitTexts = config.get('cfg_submit_texts', ["Přidat", "Zveřejnit"]);

    try {
      Log.info('[FB] Hledám tlačítka pomocí standardních selektorů...');

      // Strategie 1: Hledání všech span elementů pomocí JavaScript evaluation
      const allSpans = await this.page.evaluate(() => {
        return Array.from(document.querySelectorAll('span')).map((span, index) => ({
          index,
          text: span.textContent?.trim() || '',
          isVisible: span.offsetParent !== null
        }));
      });
      Log.info(`[FB] Nalezeno ${allSpans.length} span elementů.`);

      for (const spanInfo of allSpans) {
        try {
          if (!spanInfo.isVisible) continue;

          const context = await this.page.evaluate((spanIndex) => {
            const allSpans = document.querySelectorAll('span');
            const el = allSpans[spanIndex];
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
              buttonAriaLabel: button ? button.getAttribute('aria-label') : null,
              spanIndex: spanIndex
            };
          }, spanInfo.index);

          if (context && this.isTargetText(context.text, submitTexts) && this.isValidCandidate(context)) {
            candidates.push({ element: null, context, text: context.text, spanIndex: spanInfo.index });
            Log.info(`[FB] Nalezen kandidát: "${context.text}" (enabled: ${context.enabled}, buttonDisabled: ${context.buttonDisabled})`);
          }
        } catch (evalErr) {
          // Tichá chyba - element už neexistuje
        }
      }

      // Strategie 2: Hledání buttonů pomocí JavaScript evaluation
      const buttons = await this.page.evaluate(() => {
        return Array.from(document.querySelectorAll('button, div[role="button"]')).map((button, index) => ({
          index,
          ariaLabel: button.getAttribute('aria-label') || '',
          text: button.textContent?.trim() || '',
          isVisible: button.offsetParent !== null
        }));
      });
      Log.info(`[FB] Nalezeno ${buttons.length} button elementů.`);

      for (const buttonInfo of buttons) {
        try {
          if (!buttonInfo.isVisible) continue;

          const context = await this.page.evaluate((buttonIndex) => {
            const allButtons = document.querySelectorAll('button, div[role="button"]');
            const el = allButtons[buttonIndex];
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
              visibility: style.visibility,
              buttonIndex: buttonIndex
            };
          }, buttonInfo.index);

          if (context &&
            (this.isTargetText(context.ariaLabel, submitTexts) || this.isTargetText(context.innerText, submitTexts)) &&
            this.isValidCandidate(context)) {
            candidates.push({ element: null, context, text: context.ariaLabel || context.innerText, buttonIndex: buttonInfo.index });
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
          const elements = await this.page.evaluate((sel) => {
            return Array.from(document.querySelectorAll(sel)).map((el, index) => ({
              index,
              text: el.textContent?.trim() || '',
              ariaLabel: el.getAttribute('aria-label') || '',
              isVisible: el.offsetParent !== null
            }));
          }, selector);
          for (const elementInfo of elements) {
            try {
              if (!elementInfo.isVisible) continue;

              const context = await this.page.evaluate((sel, elementIndex) => {
                const allElements = document.querySelectorAll(sel);
                const el = allElements[elementIndex];
                if (!el) return null;

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
                  visibility: style.visibility,
                  elementIndex: elementIndex
                };
              }, selector, elementInfo.index);

              if (context && this.isTargetText(context.text, submitTexts) && this.isValidCandidate(context)) {
                // Kontrola, zda už není v candidates
                const exists = candidates.some(c => c.text === context.text);
                if (!exists) {
                  candidates.push({ element: null, context, text: context.text, elementIndex: elementInfo.index, selector });
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
      await Log.error(`[FB] Chyba při hledání tlačítek: ${err}`);
      return [];
    }
  },

  isTargetText(text, submitTexts) {
    if (!text) return false;
    const normalizedText = text.trim().toLowerCase();
    const targets = submitTexts.map(t => t.toLowerCase());
    return targets.includes(normalizedText);
  },

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
  },

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
  },

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
        await Log.warn('[FB] Element už není platný pro kliknutí.');
        return false;
      }

      // Scroll element into view
      await this.page.evaluate(el => {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, element);

      await Wait.toSeconds(0.5);

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
          await Wait.toSeconds(2, 'Čekání na aktivaci tlačítka/reakci');

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
          await Log.warn(`[FB] Metoda kliknutí ${index + 1} selhala: ${clickErr.message}`);
        }
      }

      await Log.warn('[FB] Všechny metody kliknutí selhaly.');
      return false;

    } catch (err) {
      await Log.error(`[FB] Chyba při klikání: ${err}`);
      return false;
    }
  }
};
