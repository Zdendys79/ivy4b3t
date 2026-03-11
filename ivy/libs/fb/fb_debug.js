// fb_debug.js – Debug mixin for FBBot

import { Log } from '../iv_log.class.js';
import * as fbSupport from '../../iv_fb_support.js';

export const DebugMixin = {

  async debugPostCreationElements() {
    try {
      Log.info('[DEBUG]', 'Spouštím diagnostiku elementů pro vytvoření příspěvku...');

      // Najdi všechny span elementy pomocí JavaScript evaluation
      const spans = await this.page.evaluate(() => {
        const postKeywords = ['napište', 'příspěvek', 'sdílet', 'psaní', 'honí hlavou', 'myslíte', 'skupina'];

        return Array.from(document.querySelectorAll('span')).map((el, index) => {
          const text = el.textContent?.trim() || '';
          const parent = el.parentElement;
          const clickableParent = el.closest('button, div[role="button"], [tabindex], [onclick]');

          const isPostRelated = postKeywords.some(keyword =>
            text.toLowerCase().includes(keyword.toLowerCase())
          );

          return {
            index,
            text: text,
            hasClickableParent: !!clickableParent,
            parentTag: parent?.tagName,
            isPostRelated: isPostRelated,
            visible: el.offsetWidth > 0 && el.offsetHeight > 0
          };
        }).filter(spanData => spanData.isPostRelated && spanData.visible);
      });

      Log.info('[DEBUG]', `Nalezeno ${spans.length} relevantních span elementů na stránce`);

      const postRelatedTexts = spans.map(spanData => spanData.text);

      Log.info('[DEBUG]', `Nalezeno ${postRelatedTexts.length} textů souvisejících s příspěvky:`);
      postRelatedTexts.forEach(text => {
        Log.info('[DEBUG]', `- "${text}"`);
      });

      // Pokus o nalezení alternativních selektorů
      const alternativeSelectors = [
        'div[role="button"][aria-label*="příspěvek"]',
        'div[role="button"][aria-label*="Napište"]',
        'div[role="button"][aria-label*="Co se"]',
        'div[role="textbox"][aria-label*="příspěvek"]',
        'div[role="textbox"][aria-label*="Napište"]',
        'div[contenteditable="true"]',
        'textarea[placeholder*="příspěvek"]',
        'div[data-testid*="post"]',
        'div[data-testid*="composer"]'
      ];

      Log.info('[DEBUG]', 'Testování alternativních selektorů...');
      for (const selector of alternativeSelectors) {
        try {
          const elements = await this.page.evaluate((sel) => {
            return Array.from(document.querySelectorAll(sel)).map((el, index) => ({
              index,
              text: el.textContent?.trim() || '',
              ariaLabel: el.getAttribute('aria-label') || '',
              isVisible: el.offsetParent !== null
            }));
          }, selector);

          if (elements.length > 0) {
            Log.info('[DEBUG]', `Selektor "${selector}" našel ${elements.length} elementů`);

            // Test prvního elementu
            const firstElementInfo = elements[0];
            const elementInfo = await this.page.evaluate((sel, elementIndex) => {
              const allElements = document.querySelectorAll(sel);
              const el = allElements[elementIndex];
              if (!el) return null;
              const rect = el.getBoundingClientRect();
              return {
                text: el.textContent?.trim() || '',
                ariaLabel: el.getAttribute('aria-label') || '',
                placeholder: el.getAttribute('placeholder') || '',
                visible: rect.width > 0 && rect.height > 0,
                tagName: el.tagName
              };
            }, selector, firstElementInfo.index);

            Log.info('[DEBUG]', `Element info: ${JSON.stringify(elementInfo)}`);
          }
        } catch (err) {
          Log.debug('[DEBUG]', `Selektor "${selector}" selhal: ${err.message}`);
        }
      }

    } catch (err) {
      await Log.error('[DEBUG]', `Chyba v diagnostice: ${err.message}`);
    }
  },

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
      const input = await ask('Text pro _findByText(): ');
      if (input.trim().toLowerCase() === 'x') break;

      try {
        const elements = await fbSupport.findByText(this.page, input.trim(), { timeout: 3000 });
        Log.info('[DEBUG]', `Nalezeno ${elements.length} prvků pro "${input.trim()}".`);

        for (let i = 0; i < elements.length; i++) {
          const text = await this.page.evaluate(el => el.innerText, elements[i]);
          Log.info(`[${i + 1}]`, text.replace(/\n/g, ' '));
        }
      } catch (err) {
        await Log.error('[DEBUG]', err);
      }
    }

    rl.close();
    Log.info('[DEBUG]', 'Ladění vyhledávání textu ukončeno.');
  },

  async testXPath(selector) {
    try {
      const found = await this.page.$x(selector, { visible: true, timeout: 2000 });
      Log.info(`[FB] XPath ${selector} – nalezeno: ${found.length}`);
      if (!found.length) throw `Element pro XPath ${selector} nenalezen.`;
      return found[0];
    } catch (err) {
      await Log.error(`[FB] Chyba v testXPath: ${err}`);
      return false;
    }
  },

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
      await Log.error(`[FB] Chyba při ukládání screenshotu: ${err}`);
    }
  },

  async getScreenshotForDatabase() {
    try {
      const image = await this.page.screenshot({ type: 'png' });
      return image;
    } catch (err) {
      await Log.error(`[FB] Screenshot pro DB selhal: ${err}`);
      return null;
    }
  }
};
