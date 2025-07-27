/**
 * Název souboru: iv_page_analyzer.class.js
 * Účel: Unified systém pro analýzu FB stránek - detekce chybových stavů,
 *       ověření funkčnosti a schopnosti postování
 */

import { Log } from './iv_log.class.js';
import * as fbSupport from '../iv_fb_support.js';
import { getAllConfig } from '../iv_config.js';
import { getIvyConfig } from './iv_config.class.js';
import { Wait } from './iv_wait.class.js';

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
    this.elementCache = new Map(); // url -> { elements: [], timestamp, domain }
    this.elementUpdateInterval = null;
    this.isElementTrackingActive = false;
    this.updateIntervalMs = 10000; // 10 sekund default
    this.autoTrackingEnabled = false;
    this.autoTrackingOptions = {};
    
    // Nastavení event listenerů pro automatický tracking
    this._setupAutoTracking();
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
        links: complexityAnalysis.links, // Přidání odkazů do výsledku
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

  // ========================================
  // PRIVATE METHODS - Základní analýzy
  // ========================================

  async _performBasicAnalysis() {
    try {
      const url = this.page.url();
      const title = await this._safeGetPageTitle();
      const isLoggedIn = await this._checkLoginStatus();
      const pageType = this._determinePageType(url);
      
      // Přidej základní text analýzu
      const bodyText = await this.page.evaluate(() => {
        return document.body ? document.body.innerText.substring(0, 5000) : '';
      });

      return {
        url: url,
        title: title,
        pageType: pageType,
        isLoggedIn: isLoggedIn,
        bodyText: bodyText,
        loadTime: Date.now()
      };

    } catch (err) {
      await Log.error('[ANALYZER]', `Chyba při základní analýze: ${err.message}`);
      return {
        url: this.page.url(),
        title: 'Unknown',
        pageType: 'unknown',
        isLoggedIn: false,
        loadTime: Date.now()
      };
    }
  }

  async _safeGetPageTitle() {
    try {
      if (!this.page || this.page.isClosed()) {
        return 'Page not available';
      }
      return await this.page.title();
    } catch (err) {
      await Log.warn('[ANALYZER]', `Cannot get page title: ${err.message}`);
      return 'Title unavailable';
    }
  }

  async _performErrorAnalysis(complexityAnalysis, navigationAnalysis, groupAnalysis = null) {
    try {
      // Defenzivní kontrola vstupních parametrů
      const safeComplexity = complexityAnalysis || { isNormal: false, metrics: {}, suspiciouslySimple: true };
      const safeNavigation = navigationAnalysis || { hasStandardNavigation: false, elements: {} };

      // KROK 1: Vyhodnocení struktury stránky
      const isNormalStructure = safeComplexity.isNormal && safeNavigation.hasStandardNavigation;

      if (isNormalStructure) {
        Log.info('[ANALYZER]', 'Struktura stránky je normální. Předpokládám, že není chyba.');
        return {
          hasErrors: false,
          accountLocked: false,
          checkpoint: { detected: false },
          patterns: { detected: false, reason: 'Struktura stránky je normální' },
          severity: 'none'
        };
      }

      await Log.warnInteractive('[ANALYZER]', 'Struktura stránky NENÍ normální. Hledám chybové vzory...');

      // KROK 2: Hledání chybových vzorů (pouze pokud struktura není normální)
      const cookieButton = await fbSupport.findByText(this.page, 'Povolit soubory cookie', { match: 'contains' });
      let finalErrorPatterns = await this._detectErrorPatterns(groupAnalysis, cookieButton.length > 0);

      const accountLocked = await this._checkAccountLocked();
      const checkpoint = await this._checkCheckpoint();

      // Pokud hlavní detekce nic nenašla, zkontroluj obecnější stavy
      if (!finalErrorPatterns.detected) {
        if (accountLocked) {
          finalErrorPatterns = {
            detected: true,
            reason: 'Účet je zablokován nebo omezen (obecná detekce)', type: 'ACCOUNT_LOCKED_GENERIC'
          };
        } else if (checkpoint.detected) {
          finalErrorPatterns = {
            detected: true,
            reason: 'Detekován bezpečnostní checkpoint (obecná detekce)', type: 'CHECKPOINT_GENERIC'
          };
        }
      }

      // KROK 3: Sestavení výsledku
      return {
        hasErrors: finalErrorPatterns.detected,
        accountLocked: accountLocked,
        checkpoint: checkpoint,
        patterns: finalErrorPatterns,
        severity: this._calculateErrorSeverity(finalErrorPatterns, accountLocked, checkpoint)
      };

    } catch (err) {
      await Log.error('[ANALYZER]', `Chyba při analýze chyb: ${err.message}`);
      return {
        hasErrors: true,
        accountLocked: false,
        checkpoint: { detected: false },
        patterns: { detected: false, reason: `Chyba analýzy: ${err.message}` },
        severity: 'unknown'
      };
    }
  }

  async _performComplexityAnalysis() {
    try {
      Log.debug('[ANALYZER]', 'Spouštím page.evaluate pro complexity analýzu...');
      
      const data = await this.page.evaluate(() => {
        const elements = document.querySelectorAll('*');
        const allLinks = document.querySelectorAll('a');
        const currentHostname = window.location.hostname;

        const extractedLinks = {
            groups: [],
        };

        allLinks.forEach(link => {
            const href = link.href;
            if (!href) return;

            try {
                const url = new URL(href);
                // Hledáme odkazy na skupiny na stejné doméně
                if (url.hostname === currentHostname && href.includes('/groups/')) {
                    // Jednoduchý filtr pro relevantní odkazy na skupiny
                    if (href.match(/\/groups\/(\d+|\w+)\/?$/)) {
                       extractedLinks.groups.push(href);
                    }
                }
            } catch (e) { /* Ignorovat nevalidní URL */ }
        });

        return {
          metrics: {
            elements: elements.length,
            images: document.querySelectorAll('img, svg').length,
            scripts: document.querySelectorAll('script').length,
            links: allLinks.length,
            buttons: document.querySelectorAll('button, input[type="button"], input[type="submit"]').length,
            forms: document.querySelectorAll('form').length,
            bodyTextLength: document.body ? document.body.innerText.length : 0,
            documentReady: document.readyState,
            hasBody: !!document.body,
            title: document.title || 'No title'
          },
          links: {
              groups: [...new Set(extractedLinks.groups)] // Odstranění duplicit
          }
        };
      });

      Log.debug('[ANALYZER]', `Raw metrics: ${JSON.stringify(data.metrics)}`);
      if (data.links.groups.length > 0) {
        Log.info('[ANALYZER]', `Nalezeno ${data.links.groups.length} unikátních odkazů na skupiny.`);
      }

      // Hodnocení komplexnosti (upravené pro moderní Facebook)
      const isNormal = data.metrics.elements > 1500 &&
        data.metrics.images > 10 &&          // Facebook používá hodně SVG ikon
        data.metrics.scripts > 20 &&
        data.metrics.links > 5;              // SPA používá méně přímých odkazů

      const suspiciouslySimple = data.metrics.elements < 100 &&
        data.metrics.images < 5 &&
        data.metrics.bodyTextLength < 1000;

      return {
        metrics: data.metrics,
        links: data.links, // Předání odkazů dál
        isNormal: isNormal,
        suspiciouslySimple: suspiciouslySimple,
        complexityScore: this._calculateComplexityScore(data.metrics)
      };

    } catch (err) {
      await Log.error('[ANALYZER]', `Chyba při analýze komplexnosti: ${err.message}`);
      return {
        metrics: null,
        isNormal: false,
        suspiciouslySimple: true,
        complexityScore: 0
      };
    }
  }

  async _performNavigationAnalysis() {
    try {
      const navigationElements = await this.page.evaluate(() => {
        const selectors = [
          '[aria-label="Váš profil"]',
          '[aria-label="FB"]',
          '[data-pagelet="LeftRail"]',
          '[role="banner"]',
          'nav[aria-label]',
          '[data-testid="fb-nav"]'
        ];

        const found = {};
        selectors.forEach(selector => {
          found[selector] = document.querySelector(selector) !== null;
        });

        return found;
      });

      const hasStandardNavigation = Object.values(navigationElements).some(Boolean);

      return {
        elements: navigationElements,
        hasStandardNavigation: hasStandardNavigation,
        navigationScore: this._calculateNavigationScore(navigationElements)
      };

    } catch (err) {
      await Log.error('[ANALYZER]', `Chyba při analýze navigace: ${err.message}`);
      return {
        elements: {},
        hasStandardNavigation: false,
        navigationScore: 0
      };
    }
  }

  async _performPostingAnalysis() {
    try {
      Log.info('[ANALYZER]', 'Provádím analýzu schopnosti postování...');

      const postingElements = await this.page.evaluate(() => {
        // Hledáme různé indikátory možnosti postování
        const indicators = {
          newPostField: false,
          shareButton: false,
          commentField: false,
          reactionButtons: false,
          writePostBox: false
        };

        // Pole pro nový příspěvek
        const newPostSelectors = [
          '[placeholder*="Co máte na mysli"]',
          '[placeholder*="What\'s on your mind"]',
          '[aria-label*="příspěvek"]',
          '[data-testid="status-attachment-mentions-input"]'
        ];

        indicators.newPostField = newPostSelectors.some(selector =>
          document.querySelector(selector) !== null
        );

        // Tlačítka pro sdílení
        const shareButton = Array.from(document.querySelectorAll('span')).find(span => span.textContent.includes('Sdílet') || span.textContent.includes('Share'));
        indicators.shareButton = !!shareButton || !!document.querySelector('[aria-label*="Sdílet"]');

        // Pole pro komentáře
        const commentSelectors = [
          '[placeholder*="komentář"]',
          '[placeholder*="comment"]',
          '[aria-label*="komentář"]'
        ];

        indicators.commentField = commentSelectors.some(selector =>
          document.querySelector(selector) !== null
        );

        // Reaction tlačítka
        const reactionSelectors = [
          '[aria-label*="Líbí"]',
          '[aria-label*="Like"]',
          '[data-testid="react-button"]'
        ];

        indicators.reactionButtons = reactionSelectors.some(selector =>
          document.querySelector(selector) !== null
        );

        return indicators;
      });

      const canInteract = Object.values(postingElements).some(Boolean);

      return {
        elements: postingElements,
        canInteract: canInteract,
        interactionScore: this._calculateInteractionScore(postingElements)
      };

    } catch (err) {
      await Log.error('[ANALYZER]', `Chyba při analýze postování: ${err.message}`);
      return {
        elements: {},
        canInteract: false,
        interactionScore: 0
      };
    }
  }

  async _performGroupAnalysis() {
    try {
      const url = this.page.url();

      if (!url.includes('/groups/')) {
        return { isGroup: false, reason: 'Není skupina' };
      }

      // Krok 1: Získání syrových dat z prohlížeče
      const pageData = await this.page.evaluate(() => {
        const bodyText = document.body.textContent.toLowerCase();
        return {
          isPrivate: bodyText.includes('soukromá skupina') || bodyText.includes('private group'),
          isPublic: bodyText.includes('veřejná skupina') || bodyText.includes('public group'),
          isClosed: bodyText.includes('uzavřená skupina') || bodyText.includes('closed group'),
          isMember: bodyText.includes('člen') || bodyText.includes('member'),
          isPending: bodyText.includes('žádost odeslána') || bodyText.includes('request sent') || bodyText.includes('čeká na schválení') || bodyText.includes('pending approval'),
          hasExpertInvite: bodyText.includes('stát se expertem skupiny') || bodyText.includes('become a group expert')
        };
      });

      // Krok 2: Zpracování a detekce v Node.js kontextu
      const groupInfo = {
        ...pageData,
        hasJoinButton: false,
        joinButtonText: '',
        membershipStatus: 'unknown',
        supplementary_actions: []
      };

      if (groupInfo.hasExpertInvite) {
        groupInfo.supplementary_actions.push({ type: 'ACCEPT_EXPERT_INVITE' });
      }

      const config = await getAllConfig();
      const joinText = config.cfg_group_join_text || 'Přidat se ke skupině';
      
      const joinButton = await fbSupport.findByText(this.page, joinText, { match: 'exact' });
      if (joinButton.length > 0) {
        groupInfo.hasJoinButton = true;
        groupInfo.joinButtonText = joinText;
        groupInfo.membershipStatus = 'not_member';
      } else if (groupInfo.isMember) {
        groupInfo.membershipStatus = 'member';
      } else if (groupInfo.isPending) {
        groupInfo.membershipStatus = 'pending';
      }
      
      // Kontrola možnosti postování
      if (groupInfo.membershipStatus === 'member') {
        const postSelectors = ['[aria-label*="příspěvek"]', '[placeholder*="Co máte na mysli"]', '[placeholder*="What\'s on your mind"]', '[data-testid="status-attachment-mentions-input"]'];
        
        // Use JavaScript evaluation instead of Puppeteer $
        groupInfo.writeFieldAvailable = await this.page.evaluate((selectors) => {
          return selectors.some(selector => {
            const element = document.querySelector(selector);
            return element !== null && element.offsetParent !== null;
          });
        }, postSelectors);
      }

      return {
        isGroup: true,
        ...groupInfo,
        url: url
      };

    } catch (err) {
      await Log.error('[ANALYZER]', `Chyba při analýze skupiny: ${err.message}`);
      return { isGroup: false, reason: `Chyba: ${err.message}` };
    }
  }

  // ========================================
  // PRIVATE METHODS - Pomocné funkce
  // ========================================

  async _checkLoginStatus() {
    try {
      const loginIndicators = await this.page.evaluate(() => {
        const indicators = [
          document.querySelector('[aria-label="Váš profil"]') !== null,
          document.querySelector('[data-testid="blue_bar_profile"]') !== null,
          document.querySelector('#email') === null, // Absence login formu
          document.querySelector('#pass') === null
        ];
        return indicators.some(Boolean);
      });

      return loginIndicators;
    } catch (err) {
      return false;
    }
  }

  async _quickErrorCheck() {
    try {
      const hasErrors = await this.page.evaluate(() => {
        const errorTexts = [
          'váš účet jsme uzamkli',
          'account restricted',
          'temporarily restricted',
          'security check',
          'bezpečnostní kontrola',
          'videoselfie',
          'verify your identity'
        ];

        const bodyText = document.body.textContent.toLowerCase();
        return errorTexts.some(text => bodyText.includes(text));
      });

      return hasErrors;
    } catch (err) {
      return true; // Při chybě předpokládáme problém
    }
  }

  async _checkPageResponsiveness() {
    try {
      // Test responsiveness - zkusíme kliknout na nějaký element
      await this.page.evaluate(() => {
        const testElement = document.querySelector('body');
        if (testElement) {
          testElement.scrollTop = testElement.scrollTop + 1;
          testElement.scrollTop = testElement.scrollTop - 1;
        }
      });

      return true;
    } catch (err) {
      return false;
    }
  }

  _determinePageType(url) {
    if (url.includes('/groups/')) return 'group';
    if (url.includes('/profile.php') || url.match(/FB\.com\/[^\/]+$/)) return 'profile';
    if (url.includes('/pages/')) return 'page';
    if (url === 'https://www.FB.com/' || url === 'https://FB.com/') return 'homepage';
    return 'unknown';
  }

  async _detectErrorPatterns(groupAnalysis = null, hasCookieButton = false) {
    const patterns = [
      {
        texts: ['videoselfie', 'video selfie', 'Please take a video selfie', 'Potvrďte svou totožnost pomocí videoselfie'],
        reason: 'Požadavek na videoselfie', type: 'VIDEOSELFIE'
      },
      {
        texts: ['váš účet jsme uzamkli', 'Account restricted', 'temporarily restricted', 'Účet máte zablokovaný'],
        reason: 'Účet je zablokován', type: 'ACCOUNT_LOCKED'
      },
      {
        texts: ['Verify your identity', 'ověření identity', 'identity verification'],
        reason: 'Požadavek na ověření identity', type: 'IDENTITY_VERIFICATION'
      },
      {
        texts: ['suspicious activity', 'podezřelá aktivita', 'unusual activity'],
        reason: 'Detekována podezřelá aktivita', type: 'SUSPICIOUS_ACTIVITY'
      },
      {
        texts: ['nemáte opr��vnění', 'not authorized', 'access denied', 'přístup zamítnut'],
        reason: 'Nemáte oprávnění pro tuto akci', type: 'ACCESS_DENIED'
      },
      {
        texts: ['Zkontrolujte nastavení reklam', 'Review how we use data for ads', 'Zkontrolujte, jestli můžeme'],
        reason: 'Vyžadován souhlas se zpracováním dat pro reklamy', type: 'AD_CONSENT_REQUIRED'
      }
    ];

    try {
      const pageData = await this.page.evaluate(() => {
        const bodyText = document.body.textContent.toLowerCase();
        return { bodyText };
      });

      const detectedPatterns = [];

      // Speciální detekce pro cookie banner
      if (hasCookieButton) {
        detectedPatterns.push({
            detected: true,
            reason: 'Vyžadován souhlas s cookies', type: 'COOKIE_CONSENT_REQUIRED'
        });
      }

      // Speciální detekce pro přihlašovací stránku
      const loginButton = await fbSupport.findByText(this.page, 'Přihlásit se', { match: 'exact' });
      if (loginButton.length > 0) {
        detectedPatterns.push({
            detected: true,
            reason: 'Nalezen přihlašovací formulář v neočekávaném kroku.', type: 'UNEXPECTED_LOGIN_PAGE'
        });
      }

      for (const pattern of patterns) {
        const textFound = pattern.texts.some(text =>
          pageData.bodyText.includes(text.toLowerCase())
        );
        if (textFound) {
          detectedPatterns.push({
            detected: true,
            pattern: pattern,
            reason: pattern.reason, type: pattern.type
          });
        }
      }

      if (detectedPatterns.length > 0) {
        // Vrátit nejzávažnější problém
        const criticalPattern = detectedPatterns.find(p =>
          ['ACCOUNT_LOCKED', 'IDENTITY_VERIFICATION', 'VIDEOSELFIE', 'UNEXPECTED_LOGIN_PAGE'].includes(p.type)
        );
        if (criticalPattern) return criticalPattern;

        // Vrátit první vyžadující akci
        const actionPattern = detectedPatterns.find(p => ['AD_CONSENT_REQUIRED', 'COOKIE_CONSENT_REQUIRED'].includes(p.type));
        if (actionPattern) return actionPattern;

        // Vrátit první warning pattern
        return detectedPatterns[0];
      }

      return { detected: false };

    } catch (err) {
      return { detected: false, error: err.message };
    }
  }

  async _checkAccountLocked() {
    try {
      const lockIndicators = await this.page.evaluate(() => {
        const lockTexts = [
          'váš účet jsme uzamkli',
          'account restricted',
          'temporarily restricted',
          'account locked'
        ];

        const bodyText = document.body.textContent.toLowerCase();
        return lockTexts.some(text => bodyText.includes(text));
      });

      return lockIndicators;
    } catch (err) {
      return false;
    }
  }

  async _checkCheckpoint() {
    try {
      const checkpointIndicators = await this.page.evaluate(() => {
        const checkpointTexts = [
          'security check required',
          'bezpečnostní kontrola vyžadována',
          'verify your identity',
          'ověření identity',
          'confirm your identity',
          'potvrdit vaši identitu'
        ];

        const bodyText = document.body.textContent.toLowerCase();
        const hasCheckpointText = checkpointTexts.some(text => bodyText.includes(text));

        // Další indikátory checkpoint
        const hasVerificationForm = document.querySelector('input[type="file"]') !== null;
        const hasPhoneVerification = bodyText.includes('phone') && bodyText.includes('verification');

        return {
          detected: hasCheckpointText || hasVerificationForm || hasPhoneVerification,
          hasVerificationForm: hasVerificationForm,
          hasPhoneVerification: hasPhoneVerification
        };
      });

      return checkpointIndicators;
    } catch (err) {
      return { detected: false };
    }
  }

  async _verifyGroupPosting() {
    try {
      const groupStatus = await this.page.evaluate(() => {
        // Kontrola členství
        const isMember = document.body.textContent.includes('člen') ||
          document.body.textContent.includes('member');

        // Kontrola možnosti psát příspěvek
        const canPost = document.querySelector('[placeholder*="Co máte na mysli"]') !== null ||
          document.querySelector('[aria-label*="příspěvek"]') !== null;

        // Kontrola zda není skupina pouze pro čtení
        const isReadOnly = document.body.textContent.includes('pouze pro čtení') ||
          document.body.textContent.includes('read only');

        // Kontrola existence záložky "Diskuze"
        const discussionTab = Array.from(document.querySelectorAll('span, a, div[role="button"]')).find(el => {
            const text = el.textContent?.trim().toLowerCase();
            return text === 'diskuze' || text === 'discussion' || text === 'hlavní' || text === 'featured';
        });

        return {
          isMember: isMember,
          canPost: canPost,
          isReadOnly: isReadOnly,
          discussionTabAvailable: discussionTab !== undefined && discussionTab !== null
        };
      });

      if (!groupStatus.isMember) {
        return {
          canPost: false,
          reason: 'Nejste členem skupiny'
        };
      }

      if (groupStatus.isReadOnly) {
        return {
          canPost: false,
          reason: 'Skupina je pouze pro čtení'
        };
      }

      if (!groupStatus.canPost) {
        if (groupStatus.discussionTabAvailable) {
            return {
                canPost: false,
                reason: 'Je potřeba přejít na diskuzi',
                actionRequired: 'click_discussion_tab'
            };
        }
        return {
          canPost: false,
          reason: 'Pole pro psaní příspěvku není dostupné'
        };
      }

      return {
        canPost: true,
        reason: 'Skupina je připravena pro postování'
      };

    } catch (err) {
      return {
        canPost: false,
        reason: `Chyba při ověřování skupiny: ${err.message}`
      };
    }
  }

  async _verifyProfilePosting() {
    try {
      const profileStatus = await this.page.evaluate(() => {
        const hasPostField = document.querySelector('[placeholder*="Co máte na mysli"]') !== null;
        const isOwnProfile = document.body.textContent.includes('Váš profil') ||
          document.querySelector('[aria-label="Váš profil"]') !== null;

        return {
          hasPostField: hasPostField,
          isOwnProfile: isOwnProfile
        };
      });

      if (!profileStatus.hasPostField) {
        return {
          canPost: false,
          reason: 'Pole pro psaní příspěvku není dostupné'
        };
      }

      return {
        canPost: true,
        reason: profileStatus.isOwnProfile ? 'Vlastní profil připraven' : 'Cizí profil připraven'
      };

    } catch (err) {
      return {
        canPost: false,
        reason: `Chyba při ověřování profilu: ${err.message}`
      };
    }
  }

  async _verifyPagePosting() {
    try {
      const pageStatus = await this.page.evaluate(() => {
        const hasPostField = document.querySelector('[placeholder*="Co máte na mysli"]') !== null;
        const isAdmin = document.body.textContent.includes('spravovat') ||
          document.body.textContent.includes('admin');

        return {
          hasPostField: hasPostField,
          isAdmin: isAdmin
        };
      });

      if (!pageStatus.isAdmin) {
        return {
          canPost: false,
          reason: 'Nejste administrátorem stránky'
        };
      }

      if (!pageStatus.hasPostField) {
        return {
          canPost: false,
          reason: 'Pole pro psaní příspěvku není dostupné'
        };
      }

      return {
        canPost: true,
        reason: 'Stránka je připravena pro postování'
      };

    } catch (err) {
      return {
        canPost: false,
        reason: `Chyba při ověřování stránky: ${err.message}`
      };
    }
  }

  _calculateComplexityScore(metrics) {
    if (!metrics) return 0;

    let score = 0;
    score += Math.min(metrics.elements / 100, 10); // Max 10 bodů za elementy
    score += Math.min(metrics.images / 2, 5);      // Max 5 bodů za obrázky
    score += Math.min(metrics.scripts / 5, 3);     // Max 3 body za scripty
    score += Math.min(metrics.links / 10, 2);      // Max 2 body za odkazy

    return Math.round(score);
  }

  _calculateNavigationScore(elements) {
    const foundCount = Object.values(elements).filter(Boolean).length;
    return Math.round((foundCount / Object.keys(elements).length) * 10);
  }

  _calculateInteractionScore(elements) {
    const foundCount = Object.values(elements).filter(Boolean).length;
    return Math.round((foundCount / Object.keys(elements).length) * 10);
  }

  _calculateErrorSeverity(patterns, accountLocked, checkpoint) {
    if (accountLocked) return 'critical';
    if (checkpoint.detected) return 'high';
    if (patterns.detected && patterns.type === 'UNEXPECTED_LOGIN_PAGE') return 'critical';
    if (patterns.detected && (patterns.type === 'AD_CONSENT_REQUIRED' || patterns.type === 'COOKIE_CONSENT_REQUIRED')) return 'action_required';
    if (patterns.detected) return 'medium';
    return 'none';
  }

  _determineOverallStatus(basic, errors, complexity) {
    if (errors.patterns.type === 'UNEXPECTED_LOGIN_PAGE') {
      return 'login_required';
    }
    if (errors.severity === 'action_required') {
      if (errors.patterns.type === 'AD_CONSENT_REQUIRED') return 'ad_consent_required';
      if (errors.patterns.type === 'COOKIE_CONSENT_REQUIRED') return 'cookie_consent_required';
    }

    if (errors.hasErrors) {
      return errors.severity === 'critical' ? 'blocked' : 'warning';
    }

    if (!basic.isLoggedIn) {
      return 'not_logged_in';
    }

    if (complexity.suspiciouslySimple) {
      return 'suspicious';
    }

    return 'ok';
  }

  _generateRecommendations(basic, errors, complexity) {
    const recommendations = [];

    if (!basic.isLoggedIn) {
      recommendations.push('Přihlaste se na FB');
    }

    if (errors.hasErrors) {
      if (errors.accountLocked) {
        recommendations.push('Účet je zablokován - kontaktujte podporu FB');
      }
      if (errors.checkpoint.detected) {
        recommendations.push('Dokončete bezpečnostní ověření');
      }
    }

    if (complexity.suspiciouslySimple) {
      recommendations.push('Stránka má podezřelou strukturu - ověřte správnost URL');
    }

    if (recommendations.length === 0) {
      recommendations.push('Stránka je připravena k použití');
    }

    return recommendations;
  }

  _generateCacheKey(url, options) {
    const optionsStr = JSON.stringify(options);
    return `${url}-${optionsStr}`;
  }

  _cleanupCache() {
    // Udržuj maximálně 50 záznamů v cache
    if (this.analysisCache.size > 50) {
      const firstKey = this.analysisCache.keys().next().value;
      this.analysisCache.delete(firstKey);
    }
  }

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
            
            // Kontrola, zda je element ve viewportu (viditelný na obrazovce)
            const rect = element.getBoundingClientRect();
            const isInViewport = rect.top >= 0 && 
                                rect.left >= 0 && 
                                rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
                                rect.right <= (window.innerWidth || document.documentElement.clientWidth);
            
            if (!isInViewport) {
              return;
            }
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
  }

  /**
   * Povolí automatické spuštění trackingu při načtení stránky
   * @param {Object} options - Možnosti sledování
   */
  enableAutoElementTracking(options = {}) {
    this.autoTrackingEnabled = true;
    this.autoTrackingOptions = {
      updateInterval: 10000,
      maxWords: 10,
      includeInputs: true,
      includeButtons: true,
      onlyVisible: true,
      ...options
    };
    
    // Log.debug('[ANALYZER]', 'Automatický element tracking povolen'); // Reduced spam
  }

  /**
   * Zakáže automatické spuštění trackingu
   */
  disableAutoElementTracking() {
    this.autoTrackingEnabled = false;
    this.autoTrackingOptions = {};
    
    Log.info('[ANALYZER]', 'Automatický element tracking zakázán');
  }

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

    // První aktualizace ihned
    await this._updateElementCache({ maxWords, includeInputs, includeButtons, onlyVisible });

    // Nastavení pravidelných aktualizací
    this.elementUpdateInterval = setInterval(async () => {
      try {
        if (!this.page || this.page.isClosed()) {
          this.stopElementTracking();
          return;
        }
        
        await this._updateElementCache({ maxWords, includeInputs, includeButtons, onlyVisible });
      } catch (err) {
        await Log.error('[ANALYZER]', `Chyba při aktualizaci element cache: ${err.message}`);
      }
    }, this.updateIntervalMs);

    // Log.debug('[ANALYZER]', `Element tracking spuštěn s intervalem ${updateInterval}ms`); // Reduced spam
  }

  /**
   * Zastaví automatické sledování elementů
   */
  stopElementTracking() {
    if (this.elementUpdateInterval) {
      clearInterval(this.elementUpdateInterval);
      this.elementUpdateInterval = null;
    }
    
    this.isElementTrackingActive = false;
    // Log.debug('[ANALYZER]', 'Element tracking zastaven'); // Reduced spam
  }

  /**
   * Vrátí aktuální elementy pro současnou stránku
   * @returns {Array} Seznam elementů nebo prázdný array
   */
  getCurrentElements() {
    if (!this.page || this.page.isClosed()) {
      return [];
    }

    const url = this.page.url();
    const cached = this.elementCache.get(url);
    
    if (!cached) {
      return [];
    }

    return cached.elements;
  }

  /**
   * Vrátí elementy pro specifickou doménu
   * @param {string} domain - Doména (fb, utio, atd.)
   * @returns {Array} Seznam všech elementů pro doménu
   */
  getElementsByDomain(domain) {
    const results = [];
    
    for (const [url, cache] of this.elementCache.entries()) {
      if (cache.domain === domain) {
        results.push({
          url: url,
          elements: cache.elements,
          timestamp: cache.timestamp
        });
      }
    }
    
    return results;
  }

  /**
   * Vrátí statistiky element cache
   * @returns {Object} Statistiky
   */
  getElementCacheStats() {
    const stats = {
      totalUrls: this.elementCache.size,
      isTracking: this.isElementTrackingActive,
      updateInterval: this.updateIntervalMs,
      domains: {}
    };

    for (const [url, cache] of this.elementCache.entries()) {
      if (!stats.domains[cache.domain]) {
        stats.domains[cache.domain] = {
          totalElements: 0,
          lastUpdate: null
        };
      }
      
      stats.domains[cache.domain].totalElements += cache.elements.length;
      
      if (!stats.domains[cache.domain].lastUpdate || cache.timestamp > stats.domains[cache.domain].lastUpdate) {
        stats.domains[cache.domain].lastUpdate = cache.timestamp;
      }
    }

    return stats;
  }

  /**
   * Vymaže element cache
   * @param {string} domain - Volitelně vymaž pouze pro specifickou doménu
   */
  clearElementCache(domain = null) {
    if (domain) {
      for (const [url, cache] of this.elementCache.entries()) {
        if (cache.domain === domain) {
          this.elementCache.delete(url);
        }
      }
      Log.info('[ANALYZER]', `Element cache vymazána pro doménu: ${domain}`);
    } else {
      this.elementCache.clear();
      Log.info('[ANALYZER]', 'Celá element cache vymazána');
    }
  }

  /**
   * Privátní metoda pro aktualizaci element cache
   * @private
   */
  async _updateElementCache(options) {
    try {
      const url = this.page.url();
      const domain = this._extractDomain(url);
      
      // Najdi elementy
      const elements = await this.findElementsWithShortText(options);
      
      // Uložení do cache
      this.elementCache.set(url, {
        elements: elements,
        timestamp: Date.now(),
        domain: domain
      });

      // Údržba cache - max 100 URL
      if (this.elementCache.size > 100) {
        const oldestUrl = Array.from(this.elementCache.entries())
          .sort((a, b) => a[1].timestamp - b[1].timestamp)[0][0];
        this.elementCache.delete(oldestUrl);
      }

      // Cache update - silent operation to reduce spam

    } catch (err) {
      await Log.error('[ANALYZER]', `Chyba při aktualizaci element cache: ${err.message}`);
    }
  }

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
  }

  /**
   * Nastaví event listenery pro automatické spuštění trackingu
   * @private
   */
  _setupAutoTracking() {
    try {
      // Event listener pro navigation events
      this.page.on('domcontentloaded', async () => {
        if (this.autoTrackingEnabled) {
          Log.debug('[ANALYZER]', 'DOMContentLoaded - čekám na networkidle2');
          await this._waitForPageLoad();
        }
      });

      this.page.on('load', async () => {
        if (this.autoTrackingEnabled) {
          Log.debug('[ANALYZER]', 'Page load - čekám na networkidle2');
          await this._waitForPageLoad();
        }
      });

      // Ručně sledujeme URL změny pro SPA navigaci
      this._currentUrl = this.page.url();
      this._setupUrlChangeDetection();

    } catch (err) {
      Log.warn('[ANALYZER]', `Nepodařilo se nastavit auto tracking: ${err.message}`);
    }
  }

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
      
      // Spustí tracking pokud není již aktivní
      if (!this.isElementTrackingActive) {
        await this.startElementTracking(this.autoTrackingOptions);
      } else {
        // Jen aktualizuj cache pro novou stránku
        await this._updateElementCache(this.autoTrackingOptions);
      }
      
    } catch (err) {
      // Timeout nebo jiná chyba - zkusíme spustit tracking i tak
      await Log.warn('[ANALYZER]', `Timeout při čekání na networkidle2: ${err.message}`);
      
      if (this.autoTrackingEnabled && !this.isElementTrackingActive) {
        await this.startElementTracking(this.autoTrackingOptions);
      }
    }
  }

  /**
   * Nastaví detekci změn URL pro SPA
   * @private
   */
  _setupUrlChangeDetection() {
    // Pravidelně kontroluj URL změny (pro SPA navigaci)
    setInterval(async () => {
      try {
        if (!this.page || this.page.isClosed()) {
          return;
        }
        
        const currentUrl = this.page.url();
        if (currentUrl !== this._currentUrl) {
          this._currentUrl = currentUrl;
          Log.debug('[ANALYZER]', `URL změna detekována: ${currentUrl}`);
          
          if (this.autoTrackingEnabled) {
            // Počkej chvíli na načtení nového obsahu
            await Wait.toSeconds(3);
            await this._updateElementCache(this.autoTrackingOptions);
          }
        }
      } catch (err) {
        // Ignoruj chyby při URL detekci
      }
    }, 5000); // Kontrola každých 5 sekund
  }

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

      // Najdi element v cache
      const element = await this._findElementInCache(text, { matchType, elementType });
      
      if (!element) {
        // Pokud není v cache, vrať chybu - žádné fallbacky!
        await Log.error('[ANALYZER]', `Element "${text}" nenalezen v cache - akce selhala`);
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
        
        // Počkej na reakci stránky po kliknutí
        if (waitAfterClick) {
          Log.debug('[ANALYZER]', 'Čekám na reakci stránky po kliknutí...');
          await Wait.toSeconds(3);
          
          // Aktualizuj element cache po změnách
          await this._updateElementCache(this.autoTrackingOptions);
          Log.debug('[ANALYZER]', 'Element cache aktualizována po kliknutí');
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
  }

  /**
   * Zkontroluje, zda element s daným textem existuje
   * @param {string} text - Text elementu
   * @param {Object} options - Možnosti hledání
   * @returns {Promise<boolean>} true pokud element existuje
   */
  async elementExists(text, options = {}) {
    const {
      matchType = 'exact',
      elementType = 'any',
      refreshCache = false
    } = options;

    try {
      // Možnost refreshe cache před kontrolou
      if (refreshCache) {
        await this._updateElementCache(this.autoTrackingOptions);
      }

      const element = await this._findElementInCache(text, { matchType, elementType });
      const exists = element !== null;
      
      // Loguj pouze změny stavu, ne každou kontrolu
      if (this.lastElementState !== exists) {
        Log.debug('[ANALYZER]', `Element "${text}" ${exists ? 'existuje' : 'neexistuje'}`);
        this.lastElementState = exists;
      }
      return exists;

    } catch (err) {
      await Log.error('[ANALYZER]', `Chyba při kontrole existence "${text}": ${err.message}`);
      return false;
    }
  }

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
  }

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
      // Refresh cache a zkontroluj existenci
      await this._updateElementCache(this.autoTrackingOptions);
      
      if (await this.elementExists(text, { matchType, elementType })) {
        Log.success('[ANALYZER]', `Element "${text}" se objevil`);
        return true;
      }

      await Wait.toSeconds(1);
    }

    await Log.warn('[ANALYZER]', `Timeout při čekání na element "${text}"`);
    return false;
  }

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
      const elements = this.getCurrentElements();
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

  // ========================================
  // PRIVATE METHODS - Helper funkce pro klikání
  // ========================================

  /**
   * Najde element v cache podle textu
   * @private
   */
  async _findElementInCache(text, options) {
    const { matchType, elementType } = options;
    const elements = this.getCurrentElements();

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
  }

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
        // Fallback - pokus se najít podle pozice a textu
        return await this._directClickByText(element.text, { timeout });
      }

      // Proveď kliknutí
      const result = await this.page.evaluate(async (sel, scroll, text) => {
        let targetElement = null;
        
        // Zkus najít podle selektoru
        if (sel.startsWith('/') || sel.startsWith('(')) {
          // XPath
          const xpath = sel;
          const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
          targetElement = result.singleNodeValue;
        } else {
          // CSS selektor
          targetElement = document.querySelector(sel);
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
  }


  /**
   * Vymaže cache analýz
   */
  clearCache() {
    this.analysisCache.clear();
    Log.info('[ANALYZER]', 'Cache analýz vymazána');
  }

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

  /**
   * Generuje detailní varování pro konkrétní stavy
   * @param {Object} errorAnalysis - Výsledek analýzy chyb
   * @param {Object} groupAnalysis - Výsledek analýzy skupiny
   * @returns {Array} Seznam detailních varování
   */
  _generateDetailedWarnings(errorAnalysis, groupAnalysis) {
    const warnings = [];

    // Zpracuj chybové patterny
    if (errorAnalysis && errorAnalysis.patterns && errorAnalysis.patterns.detected) {
      warnings.push(errorAnalysis.patterns.reason);

      if (errorAnalysis.patterns.additionalInfo) {
        warnings.push(errorAnalysis.patterns.additionalInfo);
      }
    }

    // Zpracuj varování ze skupiny
    if (groupAnalysis && groupAnalysis.warningDetails && groupAnalysis.warningDetails.length > 0) {
      warnings.push(...groupAnalysis.warningDetails);
    }

    return warnings;
  }

  // ========================================
  // SJEDNOCENÉ FB ANALÝZY
  // ========================================

  /**
   * Sjednocený profil check - nahrazuje isProfileLoaded z FBBot
   * @param {Object} user - Uživatelské údaje
   * @returns {Promise<boolean>} True pokud je profil načten
   */
  async isProfileLoaded(user) {
    try {
      await this.page.waitForSelector('[aria-label="Váš profil"]', { timeout: config.fb_page_load_timeout });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Detekuje blokování účtu - sjednocuje různé kontroly
   * @returns {Promise<Object>} Informace o blokaci
   */
  async detectAccountBlock() {
    try {
      const blockIndicators = await this.page.evaluate(() => {
        const blockTexts = [
          'váš účet jsme uzamkli',
          'account restricted',
          'temporarily restricted',
          'security check',
          'bezpečnostní kontrola',
          'videoselfie',
          'verify your identity',
          'confirm your identity',
          'potvrdit svou identitu',
          'checkpoint',
          'account suspended',
          'účet pozastaven',
          'review blocked',
          'temporarily blocked',
          'dočasně blokován',
          'suspicious activity',
          'podezřelá aktivita',
          'unusual activity'
        ];

        const bodyText = document.body.textContent.toLowerCase();
        const foundBlocks = blockTexts.filter(text => bodyText.includes(text));
        
        return {
          isBlocked: foundBlocks.length > 0,
          foundTexts: foundBlocks,
          pageTitle: document.title,
          currentUrl: window.location.href
        };
      });

      if (blockIndicators.isBlocked) {
        await Log.warn('[ANALYZER]', `Detekován blok účtu: ${blockIndicators.foundTexts.join(', ')}`);
        return {
          isBlocked: true,
          blockType: this._categorizeBlockType(blockIndicators.foundTexts),
          foundTexts: blockIndicators.foundTexts,
          pageTitle: blockIndicators.pageTitle,
          currentUrl: blockIndicators.currentUrl
        };
      }

      return {
        isBlocked: false,
        blockType: null,
        foundTexts: [],
        pageTitle: blockIndicators.pageTitle,
        currentUrl: blockIndicators.currentUrl
      };

    } catch (err) {
      await Log.error('[ANALYZER]', `Chyba při detekci bloku: ${err.message}`);
      return {
        isBlocked: false, // V případě chyby neblokujeme
        blockType: 'unknown',
        foundTexts: [],
        pageTitle: 'unknown',
        currentUrl: this.page.url()
      };
    }
  }

  /**
   * Kontroluje, zda je možné použít "Napsat něco" element
   * @returns {Promise<boolean>} True pokud je element dostupný
   */
  async canUseNewThingElement() {
    try {
      const newThingTexts = [
        'Napište něco',
        'Co se děje',
        'What\'s on your mind',
        'Write something',
        'Share something',
        'Start a post'
      ];

      for (const text of newThingTexts) {
        const element = await fbSupport.findByText(this.page, text, { timeout: 1000 });
        if (element) {
          // Zkontroluj, zda je element interaktivní
          const isClickable = await this.page.evaluate((el) => {
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0 && 
                   window.getComputedStyle(el).visibility !== 'hidden' &&
                   !el.disabled;
          }, element);
          
          if (isClickable) {
            return true;
          }
        }
      }
      
      return false;
    } catch (err) {
      await Log.error('[ANALYZER]', `Chyba při kontrole newThing elementu: ${err.message}`);
      return false;
    }
  }

  /**
   * Analyzuje skupinu a její schopnosti
   * @returns {Promise<Object>} Analýza skupiny
   */
  async analyzeGroup() {
    try {
      const url = this.page.url();
      const isGroupPage = url.includes('/groups/') || url.includes('/group/');
      
      if (!isGroupPage) {
        return {
          isGroup: false,
          canPost: false,
          reason: 'Není stránka skupiny'
        };
      }

      // Kontrola členství ve skupině
      const membershipStatus = await this._checkGroupMembership();
      
      // Kontrola schopnosti postovat
      const canPost = await this.canUseNewThingElement();
      
      return {
        isGroup: true,
        canPost: canPost && membershipStatus.isMember,
        membershipStatus: membershipStatus,
        reason: !canPost ? 'Nelze najít postovací element' : 
                !membershipStatus.isMember ? 'Nejste členem skupiny' : 'OK'
      };

    } catch (err) {
      await Log.error('[ANALYZER]', `Chyba při analýze skupiny: ${err.message}`);
      return {
        isGroup: false,
        canPost: false,
        reason: `Chyba při analýze: ${err.message}`
      };
    }
  }

  /**
   * Rychlá kontrola FB funkcionality - nahrazuje quickFBCheck z workeru
   * @param {Object} user - Uživatelské údaje
   * @returns {Promise<boolean>} True pokud je FB funkční
   */
  async quickFBCheck(user) {
    try {
      // Kontrola přihlášení
      const isLoggedIn = await this.isProfileLoaded(user);
      if (!isLoggedIn) {
        await Log.warn(`[${user.id}]`, 'FB není funkční - uživatel není přihlášen');
        return false;
      }

      // Proveď základní analýzu stránky
      const basicAnalysis = await this.analyzeFullPage({ forceRefresh: true });
      
      // Pokud je stránka chudá, TEPRVE POTOM hledej příčinu
      if (basicAnalysis.severity === 'high' || basicAnalysis.severity === 'medium') {
        // Nyní můžeme hledat příčinu - checkpoint, blokace, atd.
        const blockStatus = await this.detectAccountBlock();
        if (blockStatus.isBlocked) {
          await Log.warn(`[${user.id}]`, `FB není funkční - ${blockStatus.blockType}: ${blockStatus.foundTexts.join(', ')}`);
          return false;
        }
        
        await Log.warn(`[${user.id}]`, `FB není funkční - stránka má problémy: ${basicAnalysis.reason}`);
        return false;
      }

      Log.success(`[${user.id}]`, 'FB je funkční a uživatel je přihlášen');
      return true;
      
    } catch (err) {
      await Log.error(`[${user.id}]`, `Chyba při kontrole FB: ${err.message}`);
      return false;
    }
  }

  /**
   * Kategorizes block type based on found texts
   * @param {Array} foundTexts - Array of found block texts
   * @returns {string} Block type
   */
  _categorizeBlockType(foundTexts) {
    if (foundTexts.some(text => text.includes('videoselfie') || text.includes('identity'))) {
      return 'identity_verification';
    }
    if (foundTexts.some(text => text.includes('security') || text.includes('checkpoint'))) {
      return 'security_check';
    }
    if (foundTexts.some(text => text.includes('restricted') || text.includes('suspended'))) {
      return 'account_restricted';
    }
    if (foundTexts.some(text => text.includes('temporarily') || text.includes('dočasně'))) {
      return 'temporary_block';
    }
    if (foundTexts.some(text => text.includes('suspicious') || text.includes('podezřelá'))) {
      return 'suspicious_activity';
    }
    return 'unknown_block';
  }

  /**
   * Checks group membership status
   * @returns {Promise<Object>} Membership status
   */
  async _checkGroupMembership() {
    try {
      const membershipInfo = await this.page.evaluate(() => {
        const joinButton = document.querySelector('[data-testid="join_group_button"]');
        const requestSent = document.querySelector('[data-testid="pending_request_button"]');
        const leaveButton = document.querySelector('[data-testid="leave_group_button"]');
        
        return {
          hasJoinButton: !!joinButton,
          hasRequestSent: !!requestSent,
          hasLeaveButton: !!leaveButton
        };
      });
      
      if (membershipInfo.hasLeaveButton) {
        return { isMember: true, status: 'member' };
      }
      if (membershipInfo.hasRequestSent) {
        return { isMember: false, status: 'request_pending' };
      }
      if (membershipInfo.hasJoinButton) {
        return { isMember: false, status: 'not_member' };
      }
      
      return { isMember: true, status: 'unknown' }; // Assume member if no clear indicators
    } catch (err) {
      return { isMember: false, status: 'error' };
    }
  }
}
