/**
 * Název souboru: analyzer/analyzer_elements.js
 * Účel: Element discovery and interaction methods pro PageAnalyzer
 *       findElementsWithShortText, getCurrentElements, clickElementWithText,
 *       elementExists, getElementInfo, waitForElement, getAvailableTexts
 */

import { Log } from '../iv_log.class.js';
import { Wait } from '../iv_wait.class.js';

export const ElementsMixin = {

  /**
   * Najde všechny viditelné elementy s krátkým textem (max 10 slov)
   * @param {Object} options - Možnosti hledání
   * @returns {Promise<Array>} Seznam nalezených elementů
   */
  async findElementsWithShortText(options = {}) {
    const {
      maxWords = 10,
      includeInputs = true,
      includeButtons = true,
      onlyVisible = true
    } = options;

    try {
      // Removed spam log - now silent during search

      const elements = await this.page.evaluate((opts) => {
        const { maxWords, includeInputs, includeButtons, onlyVisible } = opts;

        // Zaměřujeme se hlavně na DIV a SPAN elementy
        let selector = 'div, span, a, label, h1, h2, h3, h4, h5, h6, p';
        if (includeInputs) selector += ', input, textarea, select';
        if (includeButtons) selector += ', button';

        const allElements = document.querySelectorAll(selector);
        const results = [];

        allElements.forEach((element) => {
          // Přeskočit skryté elementy
          if (onlyVisible) {
            const style = window.getComputedStyle(element);
            if (style.display === 'none' || style.visibility === 'hidden' || element.offsetWidth === 0) {
              return;
            }

            // Kontrola velikosti elementu - musí mít nějakou velikost
            const rect = element.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) {
              return;
            }

            // NEOMEZOVAT na viewport - tlačítko může být níže na stránce!
          }

          // Získání textu - buď přímý text nebo placeholder/aria-label pro inputy
          let directText = Array.from(element.childNodes)
            .filter(node => node.nodeType === Node.TEXT_NODE)
            .map(node => node.textContent.trim())
            .join(' ')
            .trim();

          // Pro inputy a další elementy bez přímého textu, použij placeholder nebo aria-label
          if (!directText && (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.tagName === 'SELECT')) {
            directText = element.placeholder || element.getAttribute('aria-label') || element.value || '';
          }

          // Pro buttony a odkazy můžeme zkusit i aria-label nebo title
          if (!directText && (element.tagName === 'BUTTON' || element.tagName === 'A')) {
            directText = element.getAttribute('aria-label') || element.title || '';
          }

          // Filtrování - max slov a neprázdný text
          if (directText && directText.split(/\s+/).length <= maxWords) {
            // Vytvoření jednoduchého XPath
            const getElementXPath = (el) => {
              if (el.id) return `//*[@id="${el.id}"]`;
              if (el === document.body) return '/html/body';

              let position = 0;
              const siblings = el.parentNode ? el.parentNode.childNodes : [];
              for (let i = 0; i < siblings.length; i++) {
                const sibling = siblings[i];
                if (sibling === el) {
                  return getElementXPath(el.parentNode) + '/' + el.tagName.toLowerCase() + '[' + (position + 1) + ']';
                }
                if (sibling.nodeType === 1 && sibling.tagName === el.tagName) {
                  position++;
                }
              }
              return '';
            };

            results.push({
              text: directText,
              tagName: element.tagName,
              className: element.className || '',
              id: element.id || '',
              xpath: getElementXPath(element),
              rect: {
                top: element.getBoundingClientRect().top,
                left: element.getBoundingClientRect().left,
                width: element.getBoundingClientRect().width,
                height: element.getBoundingClientRect().height
              }
            });
          }
        });

        return results;
      }, { maxWords, includeInputs, includeButtons, onlyVisible });

      // Log.debug('[ANALYZER]', `Nalezeno ${elements.length} elementů s krátkým textem`); // Reduced spam
      return elements;

    } catch (err) {
      await Log.error('[ANALYZER]', `Chyba při hledání elementů: ${err.message}`);
      return [];
    }
  },

  /**
   * Vrátí aktuální elementy pro současnou stránku
   * @returns {Array} Seznam elementů nebo prázdný array
   */
  async getCurrentElements() {
    if (!this.page || this.page.isClosed()) {
      return [];
    }

    // Vždy načti elementy čerstvě ze stránky
    try {
      const elements = await this.page.evaluate(() => {
        const allElements = [];
        const interactiveSelectors = ['a', 'button', 'input', 'textarea', 'select', '[role="button"]', '[onclick]'];

        interactiveSelectors.forEach(selector => {
          const els = document.querySelectorAll(selector);
          els.forEach(el => {
            const text = el.innerText || el.value || el.placeholder || '';
            if (text.trim()) {
              allElements.push({
                tagName: el.tagName,
                text: text.trim(),
                selector: el.tagName.toLowerCase() + (el.id ? `#${el.id}` : ''),
                xpath: null
              });
            }
          });
        });

        return allElements;
      });

      return elements;
    } catch (err) {
      Log.debug('[ANALYZER]', `Chyba při načítání elementů: ${err.message}`);
      return [];
    }
  },

  /**
   * Klikne na element s daným textem
   * @param {string} text - Text elementu na který kliknout
   * @param {Object} options - Možnosti hledání
   * @returns {Promise<boolean>} true pokud se podařilo kliknout
   */
  async clickElementWithText(text, options = {}) {
    const {
      matchType = 'exact',     // exact, contains, startsWith
      elementType = 'any',     // any, button, input, link, div, span
      timeout = 5000,          // timeout pro kliknutí
      scrollIntoView = false,  // scroll k elementu před kliknutím (defaultně vypnuto)
      waitAfterClick = true,   // čekat po kliknutí na změny
      naturalDelay = true      // přirozené pauzy
    } = options;

    try {
      // Log.debug('[ANALYZER]', `Hledám element s textem: "${text}" (${matchType})`); // Reduced spam

      // Přirozená pauza před hledáním
      if (naturalDelay) {
        await Wait.toSeconds(1);
      }

      // Najdi element přímo na stránce - ŽÁDNÁ CACHE!
      const elements = await this.findElementsWithShortText({
        maxWords: 10,
        includeButtons: true,
        onlyVisible: true
      });

      // Hledej element s požadovaným textem
      let element = null;
      for (const el of elements) {
        const matches = matchType === 'exact' ? el.text === text :
          matchType === 'startsWith' ? el.text.startsWith(text) :
          el.text.includes(text);

        if (matches) {
          element = el;
          break;
        }
      }

      if (!element) {
        await Log.error('[ANALYZER]', `Element "${text}" nenalezen na stránce`);
        return false;
      }

      // Přirozená pauza před kliknutím
      if (naturalDelay) {
        await Wait.toSeconds(1);
      }

      // Klikni na element pomocí XPath nebo selektoru
      const success = await this._performClick(element, { timeout, scrollIntoView });

      if (success) {
        Log.success('[ANALYZER]', `Úspěšné kliknutí na element: "${text}"`);

        // Uložit informace o kliknutém elementu pro pozdější ověření
        this.lastClickedElement = {
          text: element.text,
          xpath: element.xpath,
          id: element.id,
          className: element.className,
          tagName: element.tagName,
          clickedAt: Date.now()
        };

        Log.debug('[ANALYZER]', `Uložen kliknutý element pro tracking: ${this.lastClickedElement.xpath || this.lastClickedElement.id || 'no-id'}`);

        // Počkej na reakci stránky po kliknutí
        if (waitAfterClick) {
          Log.debug('[ANALYZER]', 'Čekám na reakci stránky po kliknutí...');
          await Wait.toSeconds(3);

        }

        return true;
      } else {
        await Log.error('[ANALYZER]', `Nepodařilo se kliknout na element: "${text}"`);
        return false;
      }

    } catch (err) {
      await Log.error('[ANALYZER]', `Chyba při klikání na "${text}": ${err.message}`);
      return false;
    }
  },

  /**
   * Zkontroluje, zda element s daným textem existuje
   * @param {string} text - Text elementu
   * @param {Object} options - Možnosti hledání
   * @returns {Promise<boolean>} true pokud element existuje
   */
  async elementExists(text, options = {}) {
    const {
      matchType = 'exact',
      elementType = 'any'
    } = options;

    try {
      // Vždy hledat přímo na stránce - ŽÁDNÁ CACHE!
      const elements = await this.findElementsWithShortText({
        maxWords: 10,
        includeButtons: true,
        onlyVisible: true
      });

      // Hledej element s požadovaným textem
      let found = false;
      for (const el of elements) {
        const matches = matchType === 'exact' ? el.text === text :
          matchType === 'startsWith' ? el.text.startsWith(text) :
          el.text.includes(text);

        if (matches) {
          found = true;
          break;
        }
      }

      // Loguj pouze změny stavu, ne každou kontrolu
      if (this.lastElementState !== found) {
        Log.debug('[ANALYZER]', `Element "${text}" ${found ? 'existuje' : 'neexistuje'}`);
        this.lastElementState = found;
      }
      return found;

    } catch (err) {
      await Log.error('[ANALYZER]', `Chyba při kontrole existence "${text}": ${err.message}`);
      return false;
    }
  },

  /**
   * Vrátí informace o elementu s daným textem
   * @param {string} text - Text elementu
   * @param {Object} options - Možnosti hledání
   * @returns {Promise<Object|null>} Informace o elementu nebo null
   */
  async getElementInfo(text, options = {}) {
    const {
      matchType = 'exact',
      elementType = 'any'
    } = options;

    try {
      const element = await this._findElementInCache(text, { matchType, elementType });

      if (element) {
        Log.debug('[ANALYZER]', `Informace o elementu "${text}": ${element.tagName}`);
        return {
          text: element.text,
          tagName: element.tagName,
          className: element.className,
          id: element.id,
          rect: element.rect,
          xpath: element.xpath
        };
      }

      Log.debug('[ANALYZER]', `Element "${text}" nenalezen`);
      return null;

    } catch (err) {
      await Log.error('[ANALYZER]', `Chyba při získávání info o "${text}": ${err.message}`);
      return null;
    }
  },

  /**
   * Počká na objevení elementu s daným textem
   * @param {string} text - Text elementu
   * @param {Object} options - Možnosti čekání
   * @returns {Promise<boolean>} true pokud se element objevil
   */
  async waitForElement(text, options = {}) {
    const {
      timeout = 10000,         // max čekání
      checkInterval = 1000,    // interval kontrol
      matchType = 'exact',
      elementType = 'any'
    } = options;

    const startTime = Date.now();

    // Log.debug('[ANALYZER]', `Čekám na element "${text}" (max ${timeout}ms)`); // Reduced spam

    while (Date.now() - startTime < timeout) {

      if (await this.elementExists(text, { matchType, elementType })) {
        Log.success('[ANALYZER]', `Element "${text}" se objevil`);
        return true;
      }

      await Wait.toSeconds(1);
    }

    await Log.warn('[ANALYZER]', `Timeout při čekání na element "${text}"`);
    return false;
  },

  /**
   * Vylistuje všechny dostupné texty elementů pro debug
   * @param {Object} options - Filtrovací možnosti
   * @returns {Array<string>} Seznam textů
   */
  async getAvailableTexts(options = {}) {
    const {
      domain = null,           // filtr podle domény
      elementType = 'any',     // filtr podle typu elementu
      maxResults = 50          // max počet výsledků
    } = options;

    try {
      // Použij pokročilou metodu pro hledání všech viditelných textů včetně span elementů
      const elements = await this.findElementsWithShortText({
        maxWords: 5, // Krátké texty jako "Zveřejnit"
        includeInputs: true,
        includeButtons: true,
        onlyVisible: true
      });

      let filteredTexts = elements
        .filter(el => {
          if (elementType !== 'any' && el.tagName.toLowerCase() !== elementType.toLowerCase()) {
            return false;
          }
          return true;
        })
        .map(el => el.text)
        .slice(0, maxResults);

      Log.debug('[ANALYZER]', `Nalezeno ${filteredTexts.length} textů pro debug`);
      return filteredTexts;

    } catch (err) {
      await Log.error('[ANALYZER]', `Chyba při získávání textů: ${err.message}`);
      return [];
    }
  }
};
