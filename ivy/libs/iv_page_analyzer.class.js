/**
 * Název souboru: iv_page_analyzer.class.js
 * Účel: Unified systém pro analýzu FB stránek - detekce chybových stavů,
 *       ověření funkčnosti a schopnosti postování
 *
 * Refactored: Methods split into focused mixin modules in analyzer/ subdirectory.
 * This file keeps the class definition, constructor, public API and applies mixins.
 */

import { Log } from './iv_log.class.js';
import { getIvyConfig } from './iv_config.class.js';

// Import mixin modules
import { CoreAnalysisMixin } from './analyzer/analyzer_core.js';
import { ErrorDetectionMixin } from './analyzer/analyzer_errors.js';
import { ScoringMixin } from './analyzer/analyzer_scoring.js';
import { ElementsMixin } from './analyzer/analyzer_elements.js';
import { TrackingMixin } from './analyzer/analyzer_tracking.js';
import { FBChecksMixin } from './analyzer/analyzer_fb_checks.js';

const config = getIvyConfig();

export class PageAnalyzer {
  constructor(page) {
    if (!page) {
      throw new Error('Page instance is required for PageAnalyzer');
    }
    this.page = page;
    this.lastAnalysis = null;
    this.analysisCache = new Map();
    this.cacheTimeout = 5000; // 5 sekund

    // Element tracking pro různé záložky
    this.elementUpdateInterval = null;
    this.isElementTrackingActive = false;
    this.updateIntervalMs = 10000; // 10 sekund default

    // Tracking posledního kliknutého elementu pro ověření
    this.lastClickedElement = null;

    // ŽÁDNÉ automatické trackování! Vše pouze na vyžádání
  }


  /**
   * Základní analýza stránky bez cookies/login detekce (pro skupiny)
   * @param {Object} options - Možnosti analýzy
   * @returns {Promise<Object>} Výsledek analýzy
   */
  async analyzeBasicPage(options = {}) {
    try {
      if (!this.page || this.page.isClosed()) {
        throw new Error('Stránka není dostupná pro analýzu');
      }

      // Pouze základní kontrola komplexnosti bez chybových vzorů
      const complexityAnalysis = await this._performComplexityAnalysis();

      return {
        complexity: complexityAnalysis,
        patterns: { detected: false, reason: 'Základní analýza - bez detekce vzorů' },
        severity: 'none'
      };
    } catch (err) {
      Log.error('[ANALYZER]', `Chyba při základní analýze: ${err.message}`);
      return {
        complexity: { isNormal: false, suspiciouslySimple: true },
        patterns: { detected: true, reason: `Chyba analýzy: ${err.message}` },
        severity: 'error'
      };
    }
  }

  /**
   * Hlavní metoda pro kompletní analýzu stránky
   * @param {Object} options - Možnosti analýzy
   * @returns {Promise<Object>} Výsledek analýzy
   */
  async analyzeFullPage(options = {}) {
    const {
      forceRefresh = false // Možnost pro vynucení nové analýzy
    } = options;

    try {
      if (!this.page || this.page.isClosed()) {
        throw new Error('Stránka není dostupná pro analýzu');
      }

      const url = this.page.url();
      const cacheKey = url; // Klíč je pouze URL
      const cached = this.analysisCache.get(cacheKey);

      // Pokud existuje platný záznam v cache, vrať ho
      if (cached && (Date.now() - cached.timestamp < this.cacheTimeout) && !forceRefresh) {
        // Log.debug('[ANALYZER]', `Vracím výsledek z cache pro: ${url}`); // Reduced spam
        return cached.data;
      }

      Log.info('[ANALYZER]', `Spouštím kompletní analýzu stránky: ${url}`);

      // Základní analýza stránky
      const basicAnalysis = await this._performBasicAnalysis();

      // Analýza komplexnosti stránky
      const complexityAnalysis = await this._performComplexityAnalysis();
      Log.info('[ANALYZER]', `Complexity: elements=${complexityAnalysis.metrics?.elements || 0}, scripts=${complexityAnalysis.metrics?.scripts || 0}, normal=${complexityAnalysis.isNormal}`);

      // Analýza navigace
      const navigationAnalysis = await this._performNavigationAnalysis();
      Log.info('[ANALYZER]', `Navigation: standard=${navigationAnalysis.hasStandardNavigation}, score=${navigationAnalysis.navigationScore || 0}`);

      // Vždy provedeme všechny pokročilé analýzy, abychom měli kompletní data pro cache
      const postingAnalysis = await this._performPostingAnalysis();
      const groupAnalysis = await this._performGroupAnalysis();

      // Analýza chybových stavů - PO group analýze
      const errorAnalysis = await this._performErrorAnalysis(complexityAnalysis, navigationAnalysis, groupAnalysis);

      // Sestavení výsledku
      const result = {
        timestamp: new Date().toISOString(),
        url: url,
        status: this._determineOverallStatus(basicAnalysis, errorAnalysis, complexityAnalysis),
        // links: odebrány - sběr odkazů na skupiny je v jiné akci
        basic: basicAnalysis,
        errors: errorAnalysis,
        complexity: complexityAnalysis,
        navigation: navigationAnalysis,
        posting: postingAnalysis,
        group: groupAnalysis,
        recommendations: this._generateRecommendations(basicAnalysis, errorAnalysis, complexityAnalysis),
        details: this._generateDetailedWarnings(errorAnalysis, groupAnalysis)
      };

      this.lastAnalysis = result;
      // Uložení kompletního výsledku do cache s klíčem URL
      this.analysisCache.set(cacheKey, { timestamp: Date.now(), data: result });
      this._cleanupCache(); // Udržuj cache čistou
      Log.success('[ANALYZER]', `Analýza dokončena se stavem: ${result.status}`);

      return result;

    } catch (err) {
      await Log.error('[ANALYZER]', `Chyba při analýze stránky: ${err.message}`);
      throw err;
    }
  }

  /**
   * Rychlá kontrola základního stavu stránky
   * @returns {Promise<Object>} Základní informace o stavu
   */
  async quickStatusCheck() {
    try {
      const url = this.page.url();

      // Rychlé kontroly
      const isLoggedIn = await this._checkLoginStatus();
      const hasErrors = await this._quickErrorCheck();
      const isResponsive = await this._checkPageResponsiveness();

      return {
        url: url,
        isLoggedIn: isLoggedIn,
        hasErrors: hasErrors,
        isResponsive: isResponsive,
        isReady: isLoggedIn && !hasErrors && isResponsive
      };

    } catch (err) {
      await Log.error('[ANALYZER]', `Chyba při rychlé kontrole: ${err.message}`);
      return {
        url: this.page.url(),
        isLoggedIn: false,
        hasErrors: true,
        isResponsive: false,
        isReady: false
      };
    }
  }

  /**
   * Ověří schopnost postovat do aktuální skupiny/stránky
   * @returns {Promise<Object>} Výsledek ověření postování
   */
  async verifyPostingCapability() {
    try {
      Log.info('[ANALYZER]', 'Ověřuji schopnost postování...');

      const currentUrl = this.page.url();
      const pageType = this._determinePageType(currentUrl);

      // Základní kontrola přihlášení
      const loginStatus = await this._checkLoginStatus();
      if (!loginStatus) {
        return {
          canPost: false,
          reason: 'Uživatel není přihlášen',
          pageType: pageType
        };
      }

      // Kontrola chybových stavů
      const errorCheck = await this._quickErrorCheck();
      if (errorCheck) {
        return {
          canPost: false,
          reason: 'Detekován chybový stav stránky',
          pageType: pageType
        };
      }

      // Specifická kontrola podle typu stránky
      let postingCheck;
      switch (pageType) {
        case 'group':
          postingCheck = await this._verifyGroupPosting();
          break;
        case 'profile':
          postingCheck = await this._verifyProfilePosting();
          break;
        case 'page':
          postingCheck = await this._verifyPagePosting();
          break;
        default:
          postingCheck = {
            canPost: false,
            reason: 'Neznámý typ stránky'
          };
      }

      return {
        ...postingCheck,
        pageType: pageType,
        url: currentUrl
      };

    } catch (err) {
      await Log.error('[ANALYZER]', `Chyba při ověřování postování: ${err.message}`);
      return {
        canPost: false,
        reason: `Chyba při ověřování: ${err.message}`,
        pageType: 'unknown'
      };
    }
  }
}

// Apply all mixins to PageAnalyzer prototype
Object.assign(PageAnalyzer.prototype, CoreAnalysisMixin);
Object.assign(PageAnalyzer.prototype, ErrorDetectionMixin);
Object.assign(PageAnalyzer.prototype, ScoringMixin);
Object.assign(PageAnalyzer.prototype, ElementsMixin);
Object.assign(PageAnalyzer.prototype, TrackingMixin);
Object.assign(PageAnalyzer.prototype, FBChecksMixin);
