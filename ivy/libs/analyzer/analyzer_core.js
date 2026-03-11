/**
 * Název souboru: analyzer/analyzer_core.js
 * Účel: Core private analysis methods pro PageAnalyzer
 *       _performBasicAnalysis, _performComplexityAnalysis, _performNavigationAnalysis,
 *       _performPostingAnalysis, _performGroupAnalysis, _performErrorAnalysis,
 *       _safeGetPageTitle, _determinePageType, _verifyGroupPosting,
 *       _verifyProfilePosting, _verifyPagePosting
 */

import { Log } from '../iv_log.class.js';
import * as fbSupport from '../../iv_fb_support.js';

export const CoreAnalysisMixin = {

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
  },

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
  },

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
  },

  async _performComplexityAnalysis() {
    try {
      Log.debug('[ANALYZER]', 'Spouštím page.evaluate pro complexity analýzu...');

      const data = await this.page.evaluate(() => {
        const elements = document.querySelectorAll('*');
        const allLinks = document.querySelectorAll('a');
        const currentHostname = window.location.hostname;

        // Sběr odkazů na skupiny odebrán - tato funkcionalita je v jiné akci

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
          }
          // links: objekt odebrán - sběr odkazů na skupiny je v jiné akci
        };
      });

      Log.debug('[ANALYZER]', `Raw metrics: ${JSON.stringify(data.metrics)}`);

      // Hodnocení komplexnosti (opravené limity pro moderní Facebook)
      const isNormal = data.metrics.elements > 300 &&   // Sníženo z 1500 - moderní FB je jednodušší
        data.metrics.images > 5 &&           // Sníženo z 10 - SVG ikony
        data.metrics.scripts > 5 &&          // Sníženo z 20 - méně skriptů v SPA
        data.metrics.links > 2;              // Sníženo z 5 - SPA používá méně přímých odkazů

      const suspiciouslySimple = data.metrics.elements < 100 &&
        data.metrics.images < 5 &&
        data.metrics.bodyTextLength < 1000;

      return {
        metrics: data.metrics,
        // links: odebrány - sběr odkazů na skupiny je v jiné akci
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
  },

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
  },

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
  },

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

      if (groupInfo.isMember) {
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
  },

  _determinePageType(url) {
    if (url.includes('/groups/')) return 'group';
    if (url.includes('/profile.php') || url.match(/FB\.com\/[^\/]+$/)) return 'profile';
    if (url.includes('/pages/')) return 'page';
    if (url === 'https://www.FB.com/' || url === 'https://FB.com/') return 'homepage';
    return 'unknown';
  },

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
  },

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
  },

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
};
