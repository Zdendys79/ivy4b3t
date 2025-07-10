/**
 * Název souboru: iv_page_analyzer.class.js
 * Účel: Unified systém pro analýzu FB stránek - detekce chybových stavů,
 *       ověření funkčnosti a schopnosti postování
 */

import { Log } from './iv_log.class.js';

export class PageAnalyzer {
  constructor(page) {
    if (!page) {
      throw new Error('Page instance is required for PageAnalyzer');
    }
    this.page = page;
    this.lastAnalysis = null;
    this.analysisCache = new Map();
  }

  /**
   * Hlavní metoda pro kompletní analýzu stránky
   * @param {Object} options - Možnosti analýzy
   * @returns {Promise<Object>} Výsledek analýzy
   */
  async analyzeFullPage(options = {}) {
    const {
      includePostingCapability = false,
      includeGroupAnalysis = false
    } = options;

    try {
      if (!this.page || this.page.isClosed()) {
        throw new Error('Stránka není dostupná pro analýzu');
      }

      const url = this.page.url();
      // Cache je vypnutá - Facebook stránky jsou dynamické

      Log.info('[ANALYZER]', `Spouštím kompletní analýzu stránky: ${url}`);

      // Základní analýza stránky
      const basicAnalysis = await this._performBasicAnalysis();

      // Analýza komplexnosti stránky
      const complexityAnalysis = await this._performComplexityAnalysis();
      Log.info('[ANALYZER]', `Complexity: elements=${complexityAnalysis.metrics?.elements || 0}, scripts=${complexityAnalysis.metrics?.scripts || 0}, normal=${complexityAnalysis.isNormal}`);

      // Analýza navigace
      const navigationAnalysis = await this._performNavigationAnalysis();
      Log.info('[ANALYZER]', `Navigation: standard=${navigationAnalysis.hasStandardNavigation}, score=${navigationAnalysis.navigationScore || 0}`);

      // Analýza chybových stavů
      const errorAnalysis = await this._performErrorAnalysis(complexityAnalysis, navigationAnalysis);

      // Pokročilé analýzy podle potřeby
      const postingAnalysis = includePostingCapability ?
        await this._performPostingAnalysis() : null;

      const groupAnalysis = includeGroupAnalysis ?
        await this._performGroupAnalysis() : null;

      // Sestavení výsledku
      const result = {
        timestamp: new Date().toISOString(),
        url: url,
        status: this._determineOverallStatus(basicAnalysis, errorAnalysis, complexityAnalysis),
        basic: basicAnalysis,
        errors: errorAnalysis,
        complexity: complexityAnalysis,
        navigation: navigationAnalysis,
        posting: postingAnalysis,
        group: groupAnalysis,
        recommendations: this._generateRecommendations(basicAnalysis, errorAnalysis, complexityAnalysis),
        details: this._generateDetailedWarnings(errorAnalysis, groupAnalysis)
      };

      // Cache je vypnutá - vždy aktuální výsledky

      this.lastAnalysis = result;
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

  async _performErrorAnalysis(complexityAnalysis, navigationAnalysis) {
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

      await Log.warn('[ANALYZER]', 'Struktura stránky NENÍ normální. Hledám chybové vzory...');

      // KROK 2: Hledání chybových vzorů (pouze pokud struktura není normální)
      let finalErrorPatterns = await this._detectErrorPatterns();

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
      
      const metrics = await this.page.evaluate(() => {
        const elementCount = document.querySelectorAll('*').length;
        const imageCount = document.querySelectorAll('img').length;
        const scriptCount = document.querySelectorAll('script').length;
        const linkCount = document.querySelectorAll('a').length;
        const buttonCount = document.querySelectorAll('button, input[type="button"], input[type="submit"]').length;
        const formCount = document.querySelectorAll('form').length;

        return {
          elements: elementCount,
          images: imageCount,
          scripts: scriptCount,
          links: linkCount,
          buttons: buttonCount,
          forms: formCount,
          bodyTextLength: document.body ? document.body.innerText.length : 0,
          documentReady: document.readyState,
          hasBody: !!document.body,
          title: document.title || 'No title'
        };
      });

      Log.debug('[ANALYZER]', `Raw metrics: ${JSON.stringify(metrics)}`);

      // Hodnocení komplexnosti
      const isNormal = metrics.elements > 500 &&
        metrics.images > 10 &&
        metrics.scripts > 20 &&
        metrics.links > 50;

      const suspiciouslySimple = metrics.elements < 100 &&
        metrics.images < 5 &&
        metrics.bodyTextLength < 1000;

      return {
        metrics: metrics,
        isNormal: isNormal,
        suspiciouslySimple: suspiciouslySimple,
        complexityScore: this._calculateComplexityScore(metrics)
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
        return {
          isGroup: false,
          reason: 'Není skupina'
        };
      }

      const groupInfo = await this.page.evaluate(() => {
        const info = {
          isPrivate: false,
          isPublic: false,
          isClosed: false,
          canPost: false,
          needsApproval: false,
          isMember: false,
          hasJoinButton: false,
          joinButtonText: '',
          writeFieldAvailable: false,
          membershipStatus: 'unknown',
          warningDetails: []
        };

        // Detekce typu skupiny a členství
        const allElements = document.querySelectorAll('*');
        for (const element of allElements) {
          const text = element.textContent?.toLowerCase() || '';

          if (text.includes('soukromá skupina') || text.includes('private group')) {
            info.isPrivate = true;
          }
          if (text.includes('veřejná skupina') || text.includes('public group')) {
            info.isPublic = true;
          }
          if (text.includes('uzavřená skupina') || text.includes('closed group')) {
            info.isClosed = true;
          }
          if (text.includes('člen') || text.includes('member')) {
            info.isMember = true;
            info.membershipStatus = 'member';
          }
        }

        // Detekce tlačítek pro přidání ke skupině
        const joinButtons = Array.from(document.querySelectorAll('*')).filter(el => {
          const text = el.textContent?.toLowerCase() || '';
          return text.includes('přidat se ke skupině') ||
                 text.includes('join group') ||
                 text.includes('join this group') ||
                 text.includes('připojit se ke skupině') ||
                 text.includes('požádat o členství') ||
                 text.includes('request to join');
        });

        if (joinButtons.length > 0) {
          info.hasJoinButton = true;
          info.joinButtonText = joinButtons[0].textContent.trim();
          info.membershipStatus = 'not_member';
          info.warningDetails.push(`Detekováno tlačítko: "${info.joinButtonText}"`);
        }

        // Kontrola možnosti postování
        const postSelectors = [
          '[aria-label*="příspěvek"]',
          '[placeholder*="Co máte na mysli"]',
          '[placeholder*="What\'s on your mind"]',
          '[data-testid="status-attachment-mentions-input"]'
        ];

        const postElements = postSelectors.map(selector => document.querySelector(selector)).filter(Boolean);
        info.writeFieldAvailable = postElements.length > 0;
        info.canPost = info.writeFieldAvailable && info.isMember;

        // Detailní důvody proč není možné postovat
        if (!info.canPost) {
          if (!info.isMember && !info.hasJoinButton) {
            info.warningDetails.push('Není člen skupiny a není dostupné tlačítko pro přidání');
          } else if (!info.isMember) {
            info.warningDetails.push('Není člen skupiny - je potřeba se přidat');
          } else if (!info.writeFieldAvailable) {
            info.warningDetails.push('Pole pro psaní příspěvku není dostupné');
          }
        }

        // Detekce čekající žádosti o členství
        const bodyText = document.body.textContent.toLowerCase();
        if (bodyText.includes('žádost odeslána') || bodyText.includes('request sent') ||
            bodyText.includes('čeká na schválení') || bodyText.includes('pending approval')) {
          info.needsApproval = true;
          info.membershipStatus = 'pending';
          info.warningDetails.push('Žádost o členství čeká na schválení');
        }

        return info;
      });

      return {
        isGroup: true,
        ...groupInfo,
        url: url
      };

    } catch (err) {
      await Log.error('[ANALYZER]', `Chyba při analýze skupiny: ${err.message}`);
      return {
        isGroup: false,
        reason: `Chyba: ${err.message}`
      };
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

  async _detectErrorPatterns() {
    const patterns = [
      {
        texts: ['videoselfie', 'video selfie', 'Please take a video selfie'],
        reason: 'Požadavek na videoselfie',
        type: 'VIDEOSELFIE'
      },
      {
        texts: ['váš účet jsme uzamkli', 'Account restricted', 'temporarily restricted'],
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
        texts: ['přidat se ke skupině', 'join group', 'join this group', 'připojit se ke skupině'],
        reason: 'Není člen skupiny - je potřeba se přidat',
        type: 'JOIN_GROUP_REQUIRED'
      },
      {
        texts: ['žádost o členství', 'membership request', 'pending approval', 'čeká na schválení'],
        reason: 'Žádost o členství čeká na schválení',
        type: 'MEMBERSHIP_PENDING'
      },
      {
        texts: ['skupina je uzavřená', 'group is closed', 'private group', 'soukromá skupina'],
        reason: 'Skupina je uzavřená nebo soukromá',
        type: 'GROUP_CLOSED'
      },
      {
        texts: ['nemáte oprávnění', 'not authorized', 'access denied', 'přístup zamítnut'],
        reason: 'Nemáte oprávnění pro tuto akci',
        type: 'ACCESS_DENIED'
      }
    ];

    try {
      const pageData = await this.page.evaluate(() => {
        const bodyText = document.body.textContent.toLowerCase();

        // Detekce tlačítek pro přidání ke skupině
        const joinButtons = Array.from(document.querySelectorAll('*')).filter(el => {
          const text = el.textContent?.toLowerCase() || '';
          return text.includes('přidat se ke skupině') ||
                 text.includes('join group') ||
                 text.includes('join this group') ||
                 text.includes('připojit se ke skupině');
        });

        // Detekce polí pro psaní
        const writeFields = document.querySelectorAll([
          '[placeholder*="Co máte na mysli"]',
          '[placeholder*="What\'s on your mind"]',
          '[aria-label*="příspěvek"]',
          '[data-testid="status-attachment-mentions-input"]'
        ].join(','));

        return {
          bodyText: bodyText,
          hasJoinButton: joinButtons.length > 0,
          hasWriteField: writeFields.length > 0,
          joinButtonCount: joinButtons.length
        };
      });

      const detectedPatterns = [];

      for (const pattern of patterns) {
        const textFound = pattern.texts.some(text =>
          pageData.bodyText.includes(text.toLowerCase())
        );

        // Speciální logika pro JOIN_GROUP_REQUIRED
        if (pattern.type === 'JOIN_GROUP_REQUIRED') {
          if (textFound || pageData.hasJoinButton) {
            detectedPatterns.push({
              detected: true,
              pattern: pattern,
              reason: pattern.reason,
              type: pattern.type,
              hasActionButton: pageData.hasJoinButton,
              additionalInfo: `Počet tlačítek: ${pageData.joinButtonCount}`
            });
          }
        } else if (textFound) {
          detectedPatterns.push({
            detected: true,
            pattern: pattern,
            reason: pattern.reason,
            type: pattern.type
          });
        }
      }

      // Pokud není pole pro psaní, ale nejsou ani join tlačítka, pak je to jiný problém
      if (!pageData.hasWriteField && !pageData.hasJoinButton && pageData.bodyText.includes('group')) {
        detectedPatterns.push({
          detected: true,
          pattern: {
            reason: 'Pole pro psaní není dostupné v této skupině',
            type: 'NO_WRITE_FIELD'
          },
          reason: 'Pole pro psaní není dostupné v této skupině',
          type: 'NO_WRITE_FIELD'
        });
      }

      if (detectedPatterns.length > 0) {
        // Vrátit nejzávažnější problém
        const criticalPattern = detectedPatterns.find(p =>
          ['ACCOUNT_LOCKED', 'IDENTITY_VERIFICATION', 'VIDEOSELFIE'].includes(p.type)
        );

        if (criticalPattern) {
          return criticalPattern;
        }

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
    if (patterns.detected) return 'medium';
    return 'none';
  }

  _determineOverallStatus(basic, errors, complexity) {
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
