/**
 * Název souboru: iv_page_analyzer.class.js
 * Účel: Unified systém pro analýzu FB stránek - detekce chybových stavů,
 *       ověření funkčnosti a schopnosti postování
 */

import { Log } from './iv_log.class.js';
import * as fbSupport from './iv_fb_support.js';

export class PageAnalyzer {
  constructor(page) {
    if (!page) {
      throw new Error('Page instance is required for PageAnalyzer');
    }
    this.page = page;
    this.lastAnalysis = null;
    this.analysisCache = new Map();
    this.cacheTimeout = 5000; // 5 sekund
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
        Log.info('[ANALYZER]', `Vracím výsledek z cache pro: ${url}`);
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
            reason: 'Účet je zablokován nebo omezen (obecná detekce)',
            type: 'ACCOUNT_LOCKED_GENERIC'
          };
        } else if (checkpoint.detected) {
          finalErrorPatterns = {
            detected: true,
            reason: 'Detekován bezpečnostní checkpoint (obecná detekce)',
            type: 'CHECKPOINT_GENERIC'
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
      const isNormal = data.metrics.elements > 500 &&
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

      const joinButton = await fbSupport.findByText(this.page, 'Přidat se ke skupině', { match: 'exact' });
      if (joinButton.length > 0) {
        groupInfo.hasJoinButton = true;
        groupInfo.joinButtonText = await this.page.evaluate(el => el.textContent.trim(), joinButton[0]);
        groupInfo.membershipStatus = 'not_member';
      } else if (groupInfo.isMember) {
        groupInfo.membershipStatus = 'member';
      } else if (groupInfo.isPending) {
        groupInfo.membershipStatus = 'pending';
      }
      
      // Kontrola možnosti postování
      if (groupInfo.membershipStatus === 'member') {
        const postSelectors = ['[aria-label*="příspěvek"]', '[placeholder*="Co máte na mysli"]', '[placeholder*="What\'s on your mind"]', '[data-testid="status-attachment-mentions-input"]'];
        groupInfo.writeFieldAvailable = (await Promise.all(postSelectors.map(s => this.page.$(s)))).some(el => el !== null);
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
        texts: ['videoselfie', 'video selfie', 'Please take a video selfie'],
        reason: 'Požadavek na videoselfie',
        type: 'VIDEOSELFIE'
      },
      {
        texts: ['váš účet jsme uzamkli', 'Account restricted', 'temporarily restricted', 'Účet máte zablokovaný'],
        reason: 'Účet je zablokován',
        type: 'ACCOUNT_LOCKED'
      },
      {
        texts: ['Verify your identity', 'ověření identity', 'identity verification'],
        reason: 'Požadavek na ověření identity',
        type: 'IDENTITY_VERIFICATION'
      },
      {
        texts: ['suspicious activity', 'podezřelá aktivita', 'unusual activity'],
        reason: 'Detekována podezřelá aktivita',
        type: 'SUSPICIOUS_ACTIVITY'
      },
      {
        texts: ['nemáte opr��vnění', 'not authorized', 'access denied', 'přístup zamítnut'],
        reason: 'Nemáte oprávnění pro tuto akci',
        type: 'ACCESS_DENIED'
      },
      {
        texts: ['Zkontrolujte nastavení reklam', 'Review how we use data for ads', 'Zkontrolujte, jestli můžeme'],
        reason: 'Vyžadován souhlas se zpracováním dat pro reklamy',
        type: 'AD_CONSENT_REQUIRED'
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
            reason: 'Vyžadován souhlas s cookies',
            type: 'COOKIE_CONSENT_REQUIRED'
        });
      }

      // Speciální detekce pro přihlašovací stránku
      const loginButton = await fbSupport.findByText(this.page, 'Přihlásit se', { match: 'exact' });
      if (loginButton.length > 0) {
        detectedPatterns.push({
            detected: true,
            reason: 'Nalezen přihlašovací formulář v neočekávaném kroku.',
            type: 'UNEXPECTED_LOGIN_PAGE'
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
            reason: pattern.reason,
            type: pattern.type
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
          'security check',
          'bezpečnostní kontrola',
          'checkpoint',
          'verify your identity',
          'ověření identity'
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
            return text === 'diskuze' || text === 'discussion';
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
}
