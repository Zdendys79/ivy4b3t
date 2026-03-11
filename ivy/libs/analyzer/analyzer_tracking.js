/**
 * Název souboru: analyzer/analyzer_tracking.js
 * Účel: Element tracking, click mechanics and cache methods pro PageAnalyzer
 *       startElementTracking, stopElementTracking, isLastClickedElementStillVisible,
 *       _findElementInCache, _performClick, _extractDomain,
 *       _setupAutoTracking, _setupUrlChangeDetection, _waitForPageLoad,
 *       _generateCacheKey, _cleanupCache, clearCache, getCacheStats
 */

import { Log } from '../iv_log.class.js';
import { Wait } from '../iv_wait.class.js';

export const TrackingMixin = {

  /**
   * Spustí automatické sledování elementů na pozadí
   * @param {Object} options - Možnosti sledování
   */
  async startElementTracking(options = {}) {
    const {
      updateInterval = 10000, // 10 sekund
      maxWords = 10,
      includeInputs = true,
      includeButtons = true,
      onlyVisible = true
    } = options;

    if (this.isElementTrackingActive) {
      await Log.warn('[ANALYZER]', 'Element tracking je již aktivní');
      return;
    }

    this.updateIntervalMs = updateInterval;
    this.isElementTrackingActive = true;

    // Pouze jednorázová aktualizace - ŽÁDNÝ interval!

    // Log.debug('[ANALYZER]', `Element tracking spuštěn s intervalem ${updateInterval}ms`); // Reduced spam
  },

  /**
   * Zastaví automatické sledování elementů
   */
  stopElementTracking() {
    // Již není co zastavovat - žádné intervaly neběží
    this.isElementTrackingActive = false;
  },

  /**
   * Kontroluje jestli poslední kliknutý element stále existuje na stránce
   * @returns {Promise<boolean>} true pokud element stále existuje, false pokud zmizel
   */
  async isLastClickedElementStillVisible() {
    try {
      if (!this.lastClickedElement) {
        Log.debug('[ANALYZER]', 'Žádný kliknutý element k ověření');
        return null; // Žádný element nebyl kliknut
      }

      const { xpath, id, className, text, tagName } = this.lastClickedElement;

      // Priorita: xpath > id > kombinace className+tagName+text
      let elementExists = false;
      let foundMethod = 'none';

      // 1. Pokus přes XPath (nejstabilnější)
      if (xpath) {
        try {
          const elementExists_xpath = await this.page.evaluate((xpathQuery) => {
            const result = document.evaluate(
              xpathQuery,
              document,
              null,
              XPathResult.FIRST_ORDERED_NODE_TYPE,
              null
            );
            const element = result.singleNodeValue;
            return element && element.offsetParent !== null;
          }, xpath);

          if (elementExists_xpath) {
            elementExists = true;
            foundMethod = 'xpath';
          }
        } catch (xpathErr) {
          Log.debug('[ANALYZER]', `XPath hledání selhalo: ${xpathErr.message}`);
        }
      }

      // 2. Pokus přes ID (fallback)
      if (!elementExists && id) {
        try {
          const element = await this.page.$(`#${id}`);
          if (element) {
            const isVisible = await this.page.evaluate(el => {
              return el && el.offsetParent !== null;
            }, element);
            elementExists = isVisible;
            foundMethod = 'id';
          }
        } catch (idErr) {
          Log.debug('[ANALYZER]', `ID hledání selhalo: ${idErr.message}`);
        }
      }

      // 3. Pokus přes kombinace vlastností (poslední fallback)
      if (!elementExists && className && text) {
        try {
          const elements = await this.getCurrentElements();
          const matchingElement = elements.find(el =>
            el.className === className &&
            el.tagName === tagName &&
            el.text === text
          );
          elementExists = !!matchingElement;
          foundMethod = 'properties';
        } catch (fallbackErr) {
          Log.debug('[ANALYZER]', `Fallback hledání selhalo: ${fallbackErr.message}`);
        }
      }

      Log.debug('[ANALYZER]', `Kliknutý element ${elementExists ? 'STÁLE EXISTUJE' : 'ZMIZEL'} (metoda: ${foundMethod})`);

      return { exists: elementExists, method: foundMethod };

    } catch (err) {
      await Log.error('[ANALYZER]', `Chyba při ověřování kliknutého elementu: ${err.message}`);
      return null; // Chyba při ověřování - neznámý stav
    }
  },

  /**
   * Najde element v cache podle textu
   * @private
   */
  async _findElementInCache(text, options) {
    const { matchType, elementType } = options;
    const elements = await this.getCurrentElements();

    for (const element of elements) {
      // Kontrola typu elementu
      if (elementType !== 'any' && element.tagName.toLowerCase() !== elementType.toLowerCase()) {
        continue;
      }

      // Kontrola textu podle matchType
      const elementText = element.text.trim();
      const searchText = text.trim();

      let matches = false;
      switch (matchType) {
        case 'exact':
          matches = elementText === searchText;
          break;
        case 'contains':
          matches = elementText.toLowerCase().includes(searchText.toLowerCase());
          break;
        case 'startsWith':
          matches = elementText.toLowerCase().startsWith(searchText.toLowerCase());
          break;
      }

      if (matches) {
        return element;
      }
    }

    return null;
  },

  /**
   * Provede kliknutí na element
   * @private
   */
  async _performClick(element, options) {
    const { timeout, scrollIntoView } = options;

    try {
      // Použij XPath nebo CSS selektor
      let selector = null;

      if (element.id) {
        selector = `#${element.id}`;
      } else if (element.xpath) {
        selector = element.xpath;
      } else {
        // Fallback - použijeme prázdný selektor a spoléháme na hledání podle textu
        selector = '';
      }

      // Proveď kliknutí
      const result = await this.page.evaluate(async (sel, scroll, text) => {
        let targetElement = null;

        // Zkus najít podle selektoru (pouze pokud není prázdný)
        if (sel && sel.length > 0) {
          if (sel.startsWith('/') || sel.startsWith('(')) {
            // XPath
            const result = document.evaluate(sel, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
            targetElement = result.singleNodeValue;
          } else {
            // CSS selektor
            targetElement = document.querySelector(sel);
          }
        }

        // Pokud element není nalezen, zkus najít podle textu
        if (!targetElement) {
          const allElements = document.querySelectorAll('*');
          for (const el of allElements) {
            if (el.textContent.trim() === text) {
              targetElement = el;
              break;
            }
          }
        }

        if (!targetElement) {
          return false;
        }

        // Scroll do view (pouze pokud je explicitně požadováno)
        if (scroll) {
          targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          await Wait.toSeconds(1);
        }

        // Klikni
        targetElement.click();
        return true;

      }, selector, scrollIntoView, element.text);

      return result;

    } catch (err) {
      await Log.warn('[ANALYZER]', `Chyba při _performClick: ${err.message}`);
      return false;
    }
  },

  /**
   * Extrahuje doménu z URL
   * @private
   */
  _extractDomain(url) {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();

      if (hostname.includes('facebook.com') || hostname.includes('fb.com')) {
        return 'fb';
      }
      if (hostname.includes('utio.b3group.cz')) {
        return 'utio';
      }

      return hostname;
    } catch (err) {
      return 'unknown';
    }
  },

  /**
   * Nastaví event listenery pro automatické spuštění trackingu
   * @private
   */
  _setupAutoTracking() {
    // ZAKÁZÁNO! Žádné automatické trackování
    // Všechny analýzy pouze na vyžádání
  },

  /**
   * Čeká na networkidle2 a spustí tracking
   * @private
   */
  async _waitForPageLoad() {
    try {
      // Počkáme na networkidle2 - Puppeteer způsob
      await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });

      // Další krátká pauza pro dokončení JavaScriptu
      await Wait.toSeconds(2);

      const newUrl = this.page.url();
      Log.info('[ANALYZER]', `Stránka načtena (networkidle2): ${newUrl}`);


    } catch (err) {
      // Timeout nebo jiná chyba - zkusíme spustit tracking i tak
      await Log.warn('[ANALYZER]', `Timeout při čekání na networkidle2: ${err.message}`);

    }
  },

  /**
   * Nastaví detekci změn URL pro SPA
   * @private
   */
  _setupUrlChangeDetection() {
    // ZAKÁZÁNO! Žádná automatická detekce URL změn
    // Všechny kontroly pouze na vyžádání
  },

  _generateCacheKey(url, options) {
    const optionsStr = JSON.stringify(options);
    return `${url}-${optionsStr}`;
  },

  _cleanupCache() {
    // Udržuj maximálně 50 záznamů v cache
    if (this.analysisCache.size > 50) {
      const firstKey = this.analysisCache.keys().next().value;
      this.analysisCache.delete(firstKey);
    }
  },

  /**
   * Vymaže cache analýz
   */
  clearCache() {
    this.analysisCache.clear();
    Log.info('[ANALYZER]', 'Cache analýz vymazána');
  },

  /**
   * Vrátí statistiky cache
   */
  getCacheStats() {
    return {
      size: this.analysisCache.size,
      maxSize: 50,
      lastAnalysis: this.lastAnalysis ? this.lastAnalysis.timestamp : null
    };
  }
};
