// fb_error_detection.js – Error detection mixin for FBBot

import { Log } from '../iv_log.class.js';
import * as fbSupport from '../../iv_fb_support.js';

export const ErrorDetectionMixin = {

  /**
   * Rozšířená detekce zablokovaných účtů - kompatibilní se stávajícím kódem
   * @returns {Object|string} Objekt s výsledkem detekce nebo string pro zpětnou kompatibilitu
   */
  async isAccountLocked() {
    try {
      // Pokud nemáme analyzer, použij fallback
      if (!this.pageAnalyzer) {
        const quitRequested = await Log.warnInteractive('[FB]', 'PageAnalyzer není k dispozici, používám fallback detekci');
        if (quitRequested === 'quit') return { locked: false, quit: true }; // Propagate quit request
        return await this._legacyAccountLockCheck();
      }

      // Rychlá kontrola pomocí nového analyzeru
      const quickCheck = await this.pageAnalyzer.quickStatusCheck();

      if (quickCheck.hasErrors) {
        // Detailní analýza při problémech
        const fullAnalysis = await this.pageAnalyzer.analyzeFullPage({
          includePostingCapability: false
        });

        if (fullAnalysis.errors.hasErrors) {
          await Log.warn('[FB]', `Detekován problém s účtem: ${fullAnalysis.errors.patterns.reason || 'Neznámý problém'}`);

          // Zpětná kompatibilita - vrať string pro kritické chyby
          if (fullAnalysis.errors.severity === 'critical') {
            return 'account_locked';
          }

          // Vrať objekt s detaily
          return {
            locked: true,
            reason: fullAnalysis.errors.patterns.reason || 'Detekován problém s účtem',
            type: fullAnalysis.errors.patterns.type ? fullAnalysis.errors.patterns.type : (() => { throw new Error('FB_CLASS: Chybí patterns.type v fullAnalysis'); })(),
            severity: fullAnalysis.errors.severity
          };
        }
      }

      return false; // Žádný problém

    } catch (err) {
      await Log.error('[FB]', `Chyba při detekci zablokovaného účtu: ${err.message}`);
      // Fallback při chybě
      return await this._legacyAccountLockCheck();
    }
  },

  /**
   * Detekuje specifické chybové patterny na stránce - BEZPEČNÁ verze
   * @returns {Object} Výsledek detekce s důvodem
   */
  async detectErrorPatterns() {
    const patterns = [
      // Videoselfie požadavky
      {
        texts: ['videoselfie', 'video selfie', 'Please take a video selfie'],
        reason: 'Požadavek na videoselfie', type: 'VIDEOSELFIE'
      },

      // Klasické zablokování
      {
        texts: ['váš účet jsme uzamkli', 'Account restricted', 'temporarily restricted'],
        reason: 'Účet je zablokován', type: 'ACCOUNT_LOCKED'
      },

      // Ověření identity
      {
        texts: ['Verify your identity', 'ověření identity', 'identity verification'],
        reason: 'Požadavek na ověření identity', type: 'IDENTITY_VERIFICATION'
      },

      // Podezřelá aktivita
      {
        texts: ['suspicious activity', 'podezřelá aktivita', 'unusual activity'],
        reason: 'Detekována podezřelá aktivita', type: 'SUSPICIOUS_ACTIVITY'
      },

      // Ověření telefonu
      {
        texts: ['Please confirm your phone', 'potvrďte telefon', 'phone verification'],
        reason: 'Požadavek na ověření telefonu', type: 'PHONE_VERIFICATION'
      },

      // Checkpoint obecně
      {
        texts: ['Security check', 'bezpečnostní kontrola', 'checkpoint'],
        reason: 'Bezpečnostní checkpoint', type: 'SECURITY_CHECKPOINT'
      },

      // Chyby přihlášení
      {
        texts: ['Nepamatujete si svůj účet?', 'Forgot Account?'],
        reason: 'Neúspěšné přihlášení', type: 'LOGIN_FAILED'
      }
    ];

    for (const pattern of patterns) {
      for (const text of pattern.texts) {
        try {
          // Bezpečná verze _findByText s timeout a error handling
          const found = await this.safelyFindByText(text);
          if (found && found.length > 0) {
            return {
              detected: true,
              reason: pattern.reason, type: pattern.type,
              foundText: text
            };
          }
        } catch (err) {
          // Pokračuj na další text při chybě
          await Log.warn(`[FB] Chyba při hledání textu "${text}": ${err}`);
          continue;
        }
      }
    }

    return { detected: false, reason: null, type: null };
  },

  /**
   * Pokročilá detekce videoselfie požadavku
   * @returns {Boolean} True pokud je detekován videoselfie požadavek
   */
  async detectVideoselfieRequest() {
    const videoselfieIndicators = [
      'videoselfie',
      'video selfie',
      'take a video',
      'record yourself',
      'nahrát video',
      'video sebe sama'
    ];

    for (const indicator of videoselfieIndicators) {
      const found = await fbSupport.findByText(this.page, indicator, { timeout: 1500 });
      if (found.length > 0) {
        await Log.warn(`[FB] Detekován videoselfie požadavek: "${indicator}"`);
        return true;
      }
    }

    // Kontrola na přítomnost video elementů nebo camera ikonů
    try {
      const hasVideoElements = await this.page.evaluate(() => {
        const videos = document.querySelectorAll('video').length;
        const cameraIcons = document.querySelectorAll('[aria-label*="camera"], [aria-label*="video"]').length;
        return videos > 0 || cameraIcons > 0;
      });

      if (hasVideoElements) {
        await Log.warn(`[FB] Detekována video/camera rozhraní - možný videoselfie`);
        return true;
      }
    } catch (err) {
      await Log.error(`[FB] Chyba při detekci video elementů: ${err}`);
    }

    return false;
  },

  /**
   * Kontroluje přítomnost standardní FB navigace
   * @returns {Boolean} True pokud má stránka FB navigaci
   */
  async hasStandardNavigation() {
    try {
      if (!this.page || typeof this.page.$ !== 'function') {
        return false;
      }

      const navigationSelectors = [
        '[aria-label="Váš profil"]',
        '[aria-label="FB"]',
        '[data-pagelet="LeftRail"]',
        '[role="banner"]',
        'nav[aria-label]'
      ];

      for (const selector of navigationSelectors) {
        try {
          const element = await this.page.$(selector);
          if (element) {
            return true;
          }
        } catch (err) {
          // Pokračuj na další selektor
          continue;
        }
      }

      return false;

    } catch (err) {
      await Log.error(`[FB] Chyba při kontrole navigace: ${err}`);
      return false;
    }
  },

  /**
   * Bezpečná verze _findByText s lepším error handlingem
   * @param {string} text - Text k vyhledání
   * @returns {Array} Pole nalezených elementů
   */
  async safelyFindByText(text) {
    try {
      if (!this.page || typeof this.page.evaluate !== 'function') {
        await Log.warn(`[FB] Page objektu není k dispozici pro hledání textu`);
        return [];
      }

      // Použij page.evaluate místo $x pro lepší kompatibilitu
      const found = await this.page.evaluate((searchText) => {
        const xpath = `//span[contains(normalize-space(text()), "${searchText}")]`;
        const result = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        return result.snapshotLength > 0 ? [true] : []; // Vrať jednoduchý indikátor
      }, text);

      return found;

    } catch (err) {
      await Log.warn(`[FB] safelyFindByText selhalo pro "${text}": ${err}`);
      return [];
    }
  },

  /**
   * Řeší problémy s načtenou stránkou
   * @param {object} analysis - výsledek analýzy z _performComplexityAnalysis
   * @returns {Promise<boolean>} true pokud má stránka dostatek elementů, false pokud ne
   */
  async handlePageIssues(analysis) {
    try {
      Log.info('[FB]', `Analyzing page issues based on complexity analysis`);

      // Detekce důvodu pomocí viditelných elementů
      const lockReasonResult = await this.detectErrorPatterns();
      let lockReason = lockReasonResult ? lockReasonResult.type : 'unknown_checkpoint';

      // Zajistí, že lock_reason nebude delší než 255 znaků (DB limit)
      if (lockReason && lockReason.length > 255) {
        lockReason = lockReason.substring(0, 252) + '...';
      }

      if (lockReasonResult && lockReasonResult.detected) {
        Log.info('[FB]', `Lock reason: ${lockReason} (${lockReasonResult.reason}) - nalezen text: "${lockReasonResult.foundText}"`);
      } else {
        Log.info('[FB]', `Lock reason: ${lockReason} - žádný specifický důvod nenalezen`);
      }

      const complexityInfo = analysis?.complexity ?
        `Normal: ${analysis.complexity.isNormal}, Suspicious: ${analysis.complexity.suspiciouslySimple}` :
        'No complexity data';

      await Log.systemLog('PAGE_ISSUE', `URL: ${this.page.url()}, Complexity: ${complexityInfo}, Reason: ${lockReason}`);

      return false;

    } catch (err) {
      await Log.error('[FB]', `Chyba při řešení problémů: ${err.message}`);
      return false;
    }
  },

  /**
   * Analyzuje komplexnost stránky pro detekci chybových stavů
   * @returns {Object} Informace o komplexnosti stránky
   */
  async analyzePageComplexity() {
    // Backwards compatibility - pokud někdo volá přímo tuto metodu
    if (this.pageAnalyzer) {
      const analysis = await this.pageAnalyzer.analyzeFullPage({
        includePostingCapability: false
      });
      return analysis.complexity;
    }

    // Fallback - bez PageAnalyzer nelze provést analýzu
    await Log.error('[FB]', 'PageAnalyzer není dostupný - nelze provést analýzu komplexnosti stránky');
    return { isNormal: false, metrics: null, suspiciouslySimple: true };
  },

  async _legacyAccountLockCheck() {
    try {
      const blockTexts = [
        "váš účet jsme uzamkli",
        "Účet byl zablokován",
        "Účet máte zablokovaný",
        "Account restricted",
        "temporarily restricted"
      ];

      // Kontrola všech variant textu blokace
      for (const text of blockTexts) {
        const isBlocked = await this._checkTexts(text, "Account block detected");
        if (isBlocked) {
          // Zaloguj detekci do system logu
          await Log.warn('[FB]', `Detekováno hlášení o zablokování účtu: "${text}"`);
          await this._logAccountBlockDetection(text);
          return 'account_locked';
        }
      }

      return false;
    } catch (err) {
      await Log.error('[FB]', `Legacy account lock check failed: ${err}`);
      return false;
    }
  },

  async _logAccountBlockDetection(detectedText) {
    try {
      // Import db zde pro zabránění circular import
      const { db } = await import('../../iv_sql.js');
      const os = await import('os');

      const currentUrl = this.page ? this.page.url() : 'unknown';
      const pageTitle = this.page ? await this.page.title().catch(() => 'unknown') : 'unknown';

      // Zaloguj do system logu
      await db.systemLog(
        'Account Block Detected',
        `Detekováno hlášení o zablokování účtu: "${detectedText}"`,
        {
          detected_text: detectedText,
          page_url: currentUrl,
          page_title: pageTitle,
          timestamp: new Date().toISOString(),
          hostname: os.hostname()
        }
      );

      Log.info('[FB]', `Hlášení o blokaci zalogováno do system logu: "${detectedText}"`);

    } catch (err) {
      await Log.error('[FB]', `Chyba při logování detekce blokace: ${err.message}`);
    }
  }
};
