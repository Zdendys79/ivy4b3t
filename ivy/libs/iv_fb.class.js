// iv_fb.class.js – Refaktorovaná verze

import { Log } from './iv_log.class.js';
import { PageAnalyzer } from './iv_page_analyzer.class.js';
import { getHumanBehavior } from '../iv_human_behavior_advanced.js';
import { db } from '../iv_sql.js';
import * as fbSupport from '../iv_fb_support.js';
import { getAllConfig } from '../iv_config.js';
import { getIvyConfig } from './iv_config.class.js';

const config = getIvyConfig();

import { Wait } from './iv_wait.class.js';

export class FBBot {
  constructor(context, userId = null) {
    this.context = context;
    this.page = null;
    this.newThingElement = null;
    this.discussionElement = null;
    this.joinGroupElement = null;
    this.isInitialized = false;
    this.pageAnalyzer = null;
    this.userId = userId;
    this.humanBehavior = null;
  }

  /**
   * Inicializuje FBBot - vytvoří novou stránku a nastaví základní konfigurace
   * @returns {Promise<boolean>} True pokud bylo úspěšné
   */
  async init() {
    try {
      if (this.isInitialized) {
        await Log.warn('[FB]', 'FBBot už je inicializován');
        return true;
      }

      if (!this.context) {
        await Log.error('[FB]', 'Context není k dispozici pro inicializaci');
        return false;
      }

      Log.info('[FB]', 'Inicializuji FB stránku...');
      this.page = await this.context.newPage();

      if (!this.page) {
        await Log.error('[FB]', 'Nepodařilo se vytvořit novou stránku');
        return false;
      }

      // Nastavení timeoutu pro navigaci
      this.page.setDefaultNavigationTimeout(config.fb_page_load_timeout);

      // Nastavení user-agent a viewport
      await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

      // Detekce a zavírání crash dialogů je nyní řešeno spouštěcím argumentem prohlížeče.

      this.isInitialized = true;
      Log.success('[FB]', 'FB stránka inicializována');
      return true;

    } catch (err) {
      await Log.error('[FB] init', err);
      this.page = null;
      this.isInitialized = false;
      return false;
    }
  }

  async initializeAnalyzer() {
    if (this.page && !this.page.isClosed()) {
      this.pageAnalyzer = new PageAnalyzer(this.page);
      
      // Povol auto-tracking pro elementy
      this.pageAnalyzer.enableAutoElementTracking({
        updateInterval: 10000,  // 10 sekund
        maxWords: 10,
        includeInputs: true,
        includeButtons: true,
        onlyVisible: true
      });
      
      // NOVĚ: Okamžitě spusť první hledání elementů
      Log.info('[FB]', 'Spouštím první hledání elementů...');
      await this.pageAnalyzer.startElementTracking({
        updateInterval: 10000,
        maxWords: 10,
        includeInputs: true,
        includeButtons: true,
        onlyVisible: true
      });
      
      Log.success('[FB]', 'PageAnalyzer inicializován a elementy nalezeny');
      return true;
    }
    Log.warn('[DIAGNOSTIC]', 'PageAnalyzer could not be initialized (page not ready).');
    return false;
  }
  async bringToFront() {
    if (!this.isReady()) {
      await Log.error('[FB]', 'FBBot není připraven pro bringToFront');
      return false;
    }

    try {
      await this.page.bringToFront();
      return true;
    } catch (err) {
      await Log.error('[FB] bringToFront', err);
      return false;
    }
  }

  async screenshot(name) {
    if (!this.isReady()) {
      await Log.error('[FB]', 'FBBot není připraven pro screenshot');
      return false;
    }

    try {
      const filename = `errors/${name}_${Date.now()}.png`;
      await this.page.screenshot({ path: filename });
      Log.info(`[FB] Screenshot uložen: ${filename}`);
      return true;
    } catch (err) {
      await Log.error('[FB] screenshot', err);
      return false;
    }
  }


  // 🧩 Vnitřní helpery pro zjednodušení

  /**
   * Čeká na <span> s textem podle dané strategie (např. startsWith)
   * Vhodné pro použití v Promise.race().
   */
  async _waitForText(text, options = {}) {
    try {
      if (!this.page || !this.page.waitForSelector) {
        await Log.warn('[FB] _waitForText selhalo: this.page není připraven.');
        return null;
      }

      const { match = 'startsWith', timeout = 5000 } = options;

      let xpath;
      if (match === 'startsWith') {
        xpath = `//span[starts-with(normalize-space(string(.)), "${text}")]`;
      } else if (match === 'exact') {
        xpath = `//span[normalize-space(string(.)) = "${text}"]`;
      } else {
        xpath = `//span[contains(normalize-space(string(.)), "${text}")]`;
      }

      const selector = `xpath/${xpath}`;
      return await this.page.waitForSelector(selector, { timeout });
    } catch (err) {
      await Log.warn('[FB] _waitForText selhalo:', err);
      return null;
    }
  }

  async _checkTexts(text1, text2) {
    if (!this.pageAnalyzer) {
      throw new Error('PageAnalyzer není inicializován');
    }

    const exists1 = await this.pageAnalyzer.elementExists(text1);
    const exists2 = await this.pageAnalyzer.elementExists(text2);
    return exists1 && exists2;
  }

  async _clickByText(text, timeout = 1000) {
    if (!this.pageAnalyzer) {
      await Log.warn('[FB]', 'PageAnalyzer není dostupný, používám fallback');
      const buttons = await fbSupport.findByText(this.page, text, { timeout, match: 'exact' });
      if (!buttons || buttons.length === 0) {
        throw new Error(`Tlačítko "${text}" nenalezeno.`);
      }
      await buttons[0].click();
      Log.info(`[FB] Kliknuto na "${text}".`);
      return true;
    }

    const success = await this.pageAnalyzer.clickElementWithText(text, {
      timeout: timeout,
      matchType: 'exact',
      naturalDelay: true
    });

    if (!success) {
      throw new Error(`Tlačítko "${text}" nenalezeno nebo nelze kliknout.`);
    }

    Log.info(`[FB] Kliknuto na "${text}" pomocí PageAnalyzer.`);
    return true;
  }

  async _typeLikeHuman(text, context = 'neutral') {
    // Pokud máme userId, použij pokročilé chování
    if (this.userId) {
      if (!this.humanBehavior) {
        this.humanBehavior = await getHumanBehavior(this.userId);
      }

      await this.humanBehavior.typeLikeHuman(this.page, text, context);
      return;
    }

    // Kritická chyba - userId je povinný pro typing
    const error = new Error('userId je povinný pro _typeLikeHuman funkci');
    Log.error(`[FB]`, error);
    throw error;
  }

  async _verifyTargetGroup(targetGroup) {
    try {
      const currentUrl = this.page.url();

      // Kontrola, zda jsme ve správné skupině
      if (!currentUrl.includes(targetGroup.fb_id)) {
        return {
          valid: false,
          reason: `Nejsme ve správné skupině. Očekáváno: ${targetGroup.fb_id}, aktuální URL: ${currentUrl}`
        };
      }

      // Analýza skupiny
      if (this.pageAnalyzer) {
        const groupAnalysis = await this.pageAnalyzer.analyzeFullPage({
          includeGroupAnalysis: true
        });

        if (groupAnalysis.group && !groupAnalysis.group.canPost) {
          return {
            valid: false,
            reason: 'Ve skupině není možné postovat'
          };
        }

        if (groupAnalysis.group && !groupAnalysis.group.isMember) {
          return {
            valid: false,
            reason: 'Nejste členem skupiny'
          };
        }
      }

      return {
        valid: true,
        reason: 'Skupina je validní pro postování',
        analysis: groupAnalysis // Předáváme analýzu pro další použití
      };

    } catch (err) {
      return {
        valid: false,
        reason: `Chyba při ověřování skupiny: ${err.message}`
      };
    }
  }

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
  }

  async _logAccountBlockDetection(detectedText) {
    try {
      // Import db zde pro zabránění circular import
      const { db } = await import('./iv_sql.js');
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

  async _legacyComplexityAnalysis() {
    // Původní implementace pro zpětnou kompatibilitu
    try {
      const metrics = await this.page.evaluate(() => {
        return {
          elements: document.querySelectorAll('*').length,
          images: document.querySelectorAll('img').length,
          scripts: document.querySelectorAll('script').length,
          links: document.querySelectorAll('a').length,
          bodyText: document.body ? document.body.innerText.length : 0
        };
      });

      const isNormal = metrics.elements > 500 &&
        metrics.images > 10 &&
        metrics.scripts > 20 &&
        metrics.links > 50;

      return {
        isNormal,
        metrics,
        suspiciouslySimple: metrics.elements < 100 && metrics.images < 5
      };

    } catch (err) {
      await Log.error('[FB]', `Chyba při legacy analýze komplexnosti: ${err}`);
      return { isNormal: true, metrics: null, suspiciouslySimple: false };
    }
  }

  async openFB(user) {
    try {
      await this.bringToFront();
      
      // Lidská pauza před navigací na Facebook
      const navigationDelay = 5000 + Math.random() * 10000; // 5-15 sekund
      Log.info('[FB]', `Čekám ${Math.round(navigationDelay/1000)}s před navigací na Facebook...`);
      await Wait.toSeconds(navigationDelay / 1000, 'Před navigací na FB');
      
      await this.page.goto('https://www.facebook.com/', { waitUntil: 'domcontentloaded' });
      await Wait.toSeconds(3, 'Stabilizace po otevření FB');
      Log.info('[FB]', 'Stránka FB byla úspěšně otevřena.');
      return true;
    } catch (err) {
      await Log.error('[FB]', `Chyba při otevírání stránky Facebooku: ${err.message}`);
      return false;
    }
  }

  async isProfileLoaded(user) {
    // Použij sjednocené metody z analyzéru
    return await this.pageAnalyzer.isProfileLoaded(user);
  }

  async login(user) {
    try {
      await this.acceptCookies();

      await this.page.waitForSelector('#email', { timeout: 5000 });
      await this.page.type('#email', user.fb_login, { delay: Wait.charDelay() });

      await this.page.waitForSelector('#pass', { timeout: 5000 });
      await this.page.type('#pass', user.fb_pass, { delay: Wait.charDelay() });

      const config = await getAllConfig();
      const loginText = config.cfg_login_text || 'Přihlásit se';
      await this._clickByText(loginText);
      await Wait.toSeconds(15, 'Po přihlášení');

      if (await this.isProfileLoaded(user)) {
        Log.success(`[FB] Uživatel ${user.id} ${user.name} ${user.surname} je nyní přihlášen.`);
        
        // Posun času aktivity o +3 minuty pro rotaci účtů během testování
        try {
          await db.updateUserWorktime(user.id, 3);
          Log.info(`[FB] Čas aktivity uživatele ${user.id} posunut o +3 minuty pro rotaci účtů`);
        } catch (err) {
          await Log.warn(`[FB] Nepodařilo se aktualizovat čas aktivity: ${err.message}`);
        }
        
        return 'now_loged';
      } else {
        await Log.warnInteractive(`[FB]`, `Uživatel není přihlášen na FB.`);
        return false;
      }
    } catch (err) {
      Log.error(`[FB] Chyba při loginu: ${err}`);
      return false;
    }
  }

  async acceptCookies() {
    try {
      // Zkusíme najít tlačítko pro cookies z konfigurace (ALLOW = odmítáme volitelné!)
      const config = await getAllConfig();
      const acceptText = config.cfg_cookies_allow || 'Odmítnout volitelné soubory cookie';
      Log.info(`[FB] Hledám tlačítko pro cookies: "${acceptText}"`);
      
      if (!this.pageAnalyzer) {
        throw new Error('PageAnalyzer není inicializován');
      }

      const success = await this.pageAnalyzer.clickElementWithText(acceptText, {
        matchType: 'contains',
        timeout: 5000,
        waitAfterClick: true,
        naturalDelay: true
      });

      if (success) {
        Log.info(`[FB] Cookie banner přijat pomocí PageAnalyzer: "${acceptText}".`);
        return true;
      } else {
        Log.warn(`[FB] Cookie tlačítko "${acceptText}" nenalezeno.`);
        return false;
      }

    } catch (err) {
      Log.error(`[FB] Cookie banner error: ${err.message}`);
      return false;
    }
  }

  /**
   * Řeší vícestránkový proces souhlasu se zpracováním dat pro reklamy.
   * @returns {Promise<boolean>} True pokud byl proces úspěšně dokončen.
   */
  async resolveAdConsentFlow() {
    Log.info('[FB]', 'Kontroluji obrazovku souhlasu s reklamami...');
    let inConsentFlow = true;
    let attempts = 0;
    const MAX_ATTEMPTS = 5; // Pojistka proti nekonečné smyčce

    while (inConsentFlow && attempts < MAX_ATTEMPTS) {
      attempts++;
      try {
        // Hledáme klíčový text, abychom věděli, že jsme stále v procesu
        const config = await getAllConfig();
        const adSettingsText = config.cfg_ad_settings || 'Zkontrolujte nastavení reklam';
        const consentElement = await this.page.waitForSelector(`xpath///span[contains(., '${adSettingsText}') or contains(., 'Review how we use data for ads') or contains(., 'Zkontrolujte, jestli můžeme')]`, { timeout: 5000 });
        if (!consentElement) {
          inConsentFlow = false;
          continue;
        }

        Log.info(`[FB][AdConsent] Pokus ${attempts}/${MAX_ATTEMPTS}: Nalezena obrazovka souhlasu.`);

        // Hledáme jakékoliv akční tlačítko s konfigurovatelnými texty
        const nextText = config.cfg_next_text || 'Další';
        const acceptText = config.cfg_accept_text || 'Přijmout';
        const allowAllText = config.cfg_allow_all_text || 'Povolit vše';
        const saveText = config.cfg_save_text || 'Uložit';
        const confirmText = config.cfg_confirm_text || 'Potvrdit';
        const actionButton = await Promise.race([
          this.page.waitForSelector(`xpath///div[@role='button'][.//span[contains(., '${nextText}') or contains(., 'Next')]]`),
          this.page.waitForSelector(`xpath///div[@role='button'][.//span[contains(., '${acceptText}') or contains(., 'Accept')]]`),
          this.page.waitForSelector(`xpath///div[@role='button'][.//span[contains(., '${allowAllText}') or contains(., 'Allow all')]]`),
          this.page.waitForSelector(`xpath///div[@role='button'][.//span[contains(., '${saveText}') or contains(., 'Save')]]`),
          this.page.waitForSelector(`xpath///div[@role='button'][.//span[contains(., '${confirmText}') or contains(., 'Confirm')]]`)
        ]);

        if (actionButton) {
          const buttonText = await this.page.evaluate(el => el.textContent, actionButton);
          Log.info(`[FB][AdConsent] Klikám na tlačítko: "${buttonText}"`);
          await actionButton.click();
          await this.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
          await Wait.toSeconds(3, 'Počkat na stabilizaci stránky');
        } else {
          Log.warn('[FB][AdConsent] Nenalezeno žádné pokračovací tlačítko, proces končí.');
          inConsentFlow = false;
        }
      } catch (error) {
        // Pokud nenajdeme žádný prvek, předpokládáme, že proces skončil
        Log.info('[FB][AdConsent] Proces souhlasu s reklamami pravděpodobně dokončen.');
        inConsentFlow = false;
      }
    }
    return true;
  }

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
            reason: fullAnalysis.errors.patterns.reason || 'Detekován problém s účtem', type: fullAnalysis.errors.patterns.type || 'UNKNOWN',
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
  }

  async verifyPostingReadiness(targetGroup = null) {
    try {
      if (!this.pageAnalyzer) {
        await Log.warn('[FB]', 'PageAnalyzer není k dispozici pro ověření postování');
        return {
          ready: false,
          reason: 'Analyzer není dostupný'
        };
      }

      Log.info('[FB]', 'Ověřuji připravenost pro postování...');

      // Základní kontrola stavu stránky
      const quickCheck = await this.pageAnalyzer.quickStatusCheck();

      if (!quickCheck.isReady) {
        return {
          ready: false,
          reason: `Stránka není připravena: přihlášen=${quickCheck.isLoggedIn}, chyby=${quickCheck.hasErrors}, responsive=${quickCheck.isResponsive}`,
          details: quickCheck
        };
      }

      // Kontrola schopnosti postování
      const postingCheck = await this.pageAnalyzer.verifyPostingCapability();

      if (!postingCheck.canPost) {
        return {
          ready: false,
          reason: postingCheck.reason,
          pageType: postingCheck.pageType,
          details: postingCheck
        };
      }

      // Pokud je specifikována cílová skupina, ověř ji
      let groupAnalysis = null;
      if (targetGroup) {
        const groupVerification = await this._verifyTargetGroup(targetGroup);
        if (!groupVerification.valid) {
          return {
            ready: false,
            reason: groupVerification.reason,
            details: groupVerification
          };
        }
        groupAnalysis = groupVerification.analysis; // Zachováme analýzu pro předání
      }

      Log.success('[FB]', 'Stránka je připravena pro postování');
      return {
        ready: true,
        reason: 'Všechny kontroly prošly úspěšně',
        pageType: postingCheck.pageType,
        analysis: groupAnalysis, // Předáváme analýzu pro další použití
        details: {
          quickCheck: quickCheck,
          postingCheck: postingCheck
        }
      };

    } catch (err) {
      await Log.error('[FB]', `Chyba při ověřování připravenosti: ${err.message}`);
      return {
        ready: false,
        reason: `Chyba při ověřování: ${err.message}`
      };
    }
  }

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

    // Fallback na původní implementaci
    await Log.warn('[FB]', 'Používám původní analyzePageComplexity - doporučuje se přejít na PageAnalyzer');
    return await this._legacyComplexityAnalysis();
  }

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
  }

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
  }

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
  }

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
  }

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
  }

  async findDiscussionElement() {
    try {
      if (!this.pageAnalyzer) {
        throw new Error('PageAnalyzer není inicializován');
      }

      const config = await getAllConfig();
      const discussionTexts = [
        config.cfg_discussion_text || 'Diskuze',
        config.cfg_discussion_en || 'Discussion', 
        config.cfg_main_tab_text || 'Hlavní',
        config.cfg_main_tab_en || 'Featured'
      ];
      
      Log.info('[FB]', `Hledám element pro diskuzi. Varianty: ${discussionTexts.join(', ')}`);

      for (const text of discussionTexts) {
        try {
          // Použij PageAnalyzer místo fbSupport.findByText
          const elementExists = await this.pageAnalyzer.elementExists(text, {
            matchType: 'exact',
            refreshCache: false
          });

          if (elementExists) {
            this.discussionText = text;
            this.discussionElement = true; // Kompatibilita s původním kódem
            Log.success('[FB]', `Element pro diskuzi "${text}" nalezen v PageAnalyzer cache`);
            return true;
          }
        } catch (e) {
          // Pokračovat s další variantou
        }
      }
      
      Log.info('[FB]', 'Element pro diskuzi nebyl nalezen');
      return false;
    } catch (err) {
      await Log.error('[FB] findDiscussionElement()', err);
      return false;
    }
  }

  async findJoinGroupElement() {
    try {
      if (!this.pageAnalyzer) {
        throw new Error('PageAnalyzer není inicializován');
      }

      const config = await getAllConfig();
      const joinText = config.cfg_group_join_text || 'Přidat se ke skupině';
      
      Log.info('[FB]', `Hledám element pro přidání do skupiny: "${joinText}"`);

      const elementExists = await this.pageAnalyzer.elementExists(joinText, {
        matchType: 'exact',
        refreshCache: true
      });

      if (elementExists) {
        this.joinGroupText = joinText;
        this.joinGroupElement = true; // Kompatibilita s původním kódem
        Log.success('[FB]', `Element pro přidání do skupiny "${joinText}" nalezen v PageAnalyzer cache`);
        return true;
      }

      Log.info('[FB]', 'Element pro přidání do skupiny nebyl nalezen');
      return false;
    } catch (err) {
      await Log.error('[FB] findJoinGroupElement()', err);
      return false;
    }
  }

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
          Log.debug('[FB]', `✓ Nalezen element pro text: "${text}" (${strategy})`);
          return { handle: elements[0], text };
        } else {
          Log.debug('[FB]', `✗ Element nenalezen pro text: "${text}" (${strategy})`);
        }
      }
      
      Log.debug('[FB]', `Strategie ${strategy}: žádné elementy nenalezeny`);
      return null;
    } catch (err) {
      Log.debug('[FB]', `Strategie ${strategy} selhala: ${err.message}`);
      return null;
    }
  }


  async clickNewThing() {
    try {
      if (!this.newThingElement || !this.newThingText) {
        Log.error('[FB]', 'newThingElement není definován. Možná selhal newThing()');
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
  }

  async pasteStatement(text, useClipboard = false) {
    try {
      if (!text) {
        Log.error('[FB]', 'Prázdný text pro příspěvek - nelze pokračovat');
        return false;
      }

      Log.info('[FB]', `Vkládám text příspěvku (${text.length} znaků). Metoda: ${useClipboard ? 'schránka' : 'psaní po písmenech'}`);
      
      // Ujisti se, že má FB stránka focus před vkládáním
      await this.bringToFront();
      
      const delay = 2000 + Math.random() * 3000; // 2-5 sekund místo 10+
      Log.debug('[FB]', `Čekám ${delay.toFixed(0)}ms před vložením textu...`);
      await Wait.toSeconds(delay / 1000, 'Čekání před vložením textu');
      
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
  }

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
  }

  async pasteTextViaClipboard(text) {
    try {
      if (!text) throw `Prázdný text pro vložení.`;

      // Ujisti se, že má stránka focus pro přístup ke schránce
      await this.bringToFront();
      await Wait.toSeconds(0.5, 'Krátká pauza po focus');

      // Zkopíruj text do schránky
      await this.page.evaluate((textToCopy) => {
        return navigator.clipboard.writeText(textToCopy);
      }, text);

      await Wait.toSeconds(1, 'Krátká pauza po kopírování');

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
  }

  async writeMessage(text, useClipboard = false) {
    try {
      Log.info('[FB]', `Začínám psaní zprávy (${text.length} znaků)...`);
      
      // 1. Najdi pole pro psaní příspěvku
      if (!await this.newThing()) {
        Log.error('[FB]', 'Nepodařilo se najít pole pro psaní příspěvku');
        return false;
      }
      
      // 2. Klikni na pole pro psaní příspěvku
      if (!await this.clickNewThing()) {
        Log.error('[FB]', 'Nepodařilo se kliknout na pole pro psaní příspěvku');
        return false;
      }
      
      // 3. Vloži text příspěvku
      if (!await this.pasteStatement(text, useClipboard)) {
        Log.error('[FB]', 'Nepodařilo se vložit text příspěvku');
        return false;
      }
      
      // 4. Odešli příspěvek
      if (!await this.clickSendButton()) {
        Log.error('[FB]', 'Nepodařilo se odeslat příspěvek');
        return false;
      }
      
      Log.success('[FB]', 'Zpráva úspěšně napsána a odeslána!');
      return true;
      
    } catch (err) {
      await Log.error('[FB] writeMessage', err);
      return false;
    }
  }

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

      const config = await getAllConfig();
      const submitTexts = config.cfg_submit_texts || ["Zveřejnit", "Přidat"];

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

      Log.warn('[FB] Žádné odeslací tlačítko nenalezeno');
      return false;

    } catch (err) {
      await Log.error(`[FB] Chyba při odesílání:`, err);
      return false;
    }
  }

  // fallbackClick() odstraněna - používáme pouze PageAnalyzer

  async findActiveSendButtons() {
    const candidates = [];
    const config = await getAllConfig();
    const submitTexts = config.cfg_submit_texts || ["Přidat", "Zveřejnit"];

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
  }

  isTargetText(text, submitTexts) {
    if (!text) return false;
    const normalizedText = text.trim().toLowerCase();
    const targets = submitTexts.map(t => t.toLowerCase());
    return targets.includes(normalizedText);
  }

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
  }


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
  }

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

      await Wait.toSeconds(0.5, 'Krátká pauza');

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

  async defaultRange() {
    const config = await getAllConfig();
    const t1 = config.cfg_privacy_audience || "Výchozí okruh uživatelů";
    const t2 = config.cfg_friends_text || "Přátelé";
    const doneText = config.cfg_done_text || "Hotovo";
    try {
      const rangeSelect = await fbSupport.findByText(this.page, t1, { timeout: 2000 });
      if (rangeSelect.length > 0) {
        const friends = await fbSupport.findByText(this.page, t2, { timeout: 2000 });
        if (friends.length) {
          await friends[friends.length - 2].click();
          const done = await fbSupport.findByText(this.page, doneText, { timeout: 5000 });
          if (!done || done.length === 0) throw `Tlačítko "${doneText}" nenalezeno.`;
          await Wait.toSeconds(3, 'Dlouhé čekání');
          await this.page.evaluate(el => { el.click({ clickCount: 2 }); }, done[0]);
          await Wait.toSeconds(15, 'Po přihlášení');
          Log.info(`[FB] Výchozí okruh uživatelů nastaven.`);
        } else {
          throw `SPAN "${t2}" nenalezen.`;
        }
      } else {
        throw `SPAN "${t1}" nenalezen.`;
      }
      return true;
    } catch (err) {
      await Log.error(`[FB] Chyba v defaultRange: ${err}`);
      return false;
    }
  }

  async openGroup(group) {
    try {
      

      await this.bringToFront();

      let fbGroupUrl;
      if (group.type === "P") {
        fbGroupUrl = `https://FB.com/${group.fb_id}`;
      } else if (group.is_buy_sell_group) {
        fbGroupUrl = `https://FB.com/groups/${group.fb_id}/buy_sell_discussion`;
        Log.info('[FB]', `🛒 Používám optimalizovanou navigaci pro prodejní skupinu`);
      } else {
        fbGroupUrl = `https://FB.com/groups/${group.fb_id}`;
      }
      
      // Lidská pauza před navigací na skupinu
      const navigationDelay = 5000 + Math.random() * 10000; // 5-15 sekund
      Log.info('[FB]', `Čekám ${Math.round(navigationDelay/1000)}s před navigací na skupinu ${group.name}...`);
      await Wait.toSeconds(navigationDelay / 1000, 'Před navigací na FB');

      Log.info('[FB]', `Otevírám skupinu: ${fbGroupUrl}`);

      await this.page.goto(fbGroupUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });

      await Wait.toSeconds(8, 'Náhodná pauza 5-8s');

      // NOVÉ - Analýza skupiny po načtení
      if (this.pageAnalyzer) {
        const analysis = await this.pageAnalyzer.analyzeFullPage({ forceRefresh: true });
        Log.info('[FB]', `Analýza skupiny dokončena - stav: ${analysis.status}`);

        // Uložení detailů o skupině, pokud je to skutečně skupina
        if (analysis.group?.isGroup) {
          await db.saveGroupExplorationDetails(analysis, this.userId);
          Log.info('[FB]', `Uloženy detaily pro skupinu ${group.fb_id}`);
        }

        // Uložení objevených odkazů
        if (analysis.links?.groups?.length > 0) {
          await db.saveDiscoveredLinks(analysis.links.groups, this.userId);
          Log.info('[FB]', `Uloženo ${analysis.links.groups.length} nových odkazů na skupiny.`);
        }
      }

      Log.success('[FB]', `Skupina ${group.fb_id} úspěšně otevřena`);
      return true;

    } catch (err) {
      await Log.error('[FB]', `Chyba při otevírání skupiny ${group.fb_id}: ${err.message}`);
      return false;
    }
  }

  async readUserCounter() {
    await this.bringToFront();
    const labels = ["členů", "sledujících"];
    for (let label of labels) {
      try {
        const counter = await fbSupport.findByText(this.page, label, { timeout: 3500 });
        if (counter && counter.length > 0) {
          const value = await this.page.evaluate(el => el.textContent, counter[0]);
          return await this.getCounterValue(value);
        }
      } catch (err) {
        await Log.error(`[FB] Counter "${label}" nenalezen: ${err}`);
      }
    }
    return 0;
  }

  async getCounterValue(str) {
    try {
      let regex = /[+-]?\d+(\.\d+)?/g;
      let [floats] = str.replace(",", ".").match(regex).map(v => parseFloat(v));
      if (str.includes("tis.")) floats *= 1000;
      return floats;
    } catch (err) {
      await Log.error(`[FB] Chyba při parsování counter value: ${err}`);
      return 0;
    }
  }

  async addMeToGroup() {
    try {
      await this._clickByText("Přidat se ke skupině", 1000);
      await Wait.toSeconds(15, 'Po přihlášení');
      Log.info(`[FB] Přidání do skupiny úspěšné.`);
      return true;
    } catch (err) {
      await Log.error(`[FB] Chyba při přidávání do skupiny: ${err}`);
      return false;
    }
  }

  async clickLike() {
    if (Math.random() < 0.1) { // 10% šance
      try {
        const config = await getAllConfig();
        const likeText = config.cfg_like_text || "To se mi líbí";
        const likes = await fbSupport.findByText(this.page, likeText, { timeout: 5000 });
        if (!likes.length) throw `Tlačítko "${likeText}" nenalezeno.`;
        const randomLike = likes[Math.floor(Math.random() * likes.length)];
        await randomLike.click();
        Log.info(`[FB] Kliknuto na tlačítko "${likeText}".`);
        await Wait.toSeconds(5, 'Dlouhé čekání na like');
        return true;
      } catch (err) {
        await Log.error(`[FB] Chyba při klikání na lajk tlačítko: ${err}`);
        return false;
      }
    } else {
      Log.info(`[FB] Kliknutí na lajk tlačítko přeskočeno (náhodné).`);
      return true;
    }
  }

  // Pokračování třídy FBBot

  async contentNotAvailable() {
    return await this._checkTexts("Obsah teď není dostupný", "Přejít do kanálu");
  }

  async stillSendButton() {
    if (!this.pageAnalyzer) {
      throw new Error('PageAnalyzer není inicializován');
    }

    const exists = await this.pageAnalyzer.elementExists("Zveřejnit", { 
      matchType: 'exact',
      refreshCache: true 
    });
    
    if (exists) {
      Log.info(`[FB] Tlačítko "Zveřejnit" stále nalezeno!`);
      return true;
    }
    return false;
  }

  async spamDetected() {
    return await this._checkTexts("Zveřejnit", "před spamem");
  }

  async tryAgainLater() {
    return await this._checkTexts("Zveřejnit", "Můžete to zkusit později");
  }

  async problemWithURL() {
    return await this._checkTexts("Zveřejnit", "problém se zadanou adresou");
  }

  async loginFailedEn() {
    if (!this.pageAnalyzer) {
      throw new Error('PageAnalyzer není inicializován');
    }

    const found = await this.pageAnalyzer.elementExists("Forgot Account?", {
      matchType: 'exact',
      refreshCache: true
    });
    if (found) {
      Log.info(`[FB] Text "Forgot Account?" nalezen.`);
      return true;
    }
    return false;
  }

  async loginFailedCs() {
    if (!this.pageAnalyzer) {
      throw new Error('PageAnalyzer není inicializován');
    }

    const found = await this.pageAnalyzer.elementExists("Nepamatujete si svůj účet?", {
      matchType: 'exact',
      refreshCache: true
    });
    if (found) {
      Log.info(`[FB] Text "Nepamatujete si svůj účet?" nalezen.`);
      return true;
    }
    return false;
  }

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
  }

  async getScreenshotForDatabase() {
    try {
      const image = await this.page.screenshot({ type: 'png' });
      return image;
    } catch (err) {
      await Log.error(`[FB] Screenshot pro DB selhal: ${err}`);
      return null;
    }
  }

  // Pokračování třídy FBBot

  async isSellGroup() {
    const config = await getAllConfig();
    const sellText = config.cfg_sell_text || "Prodat";
    const found = await fbSupport.findByText(this.page, sellText, { timeout: 3500 });
    if (found.length) {
      Log.info(`[FB] Skupina je prodejní.`);
      return true;
    }
    return false;
  }

  async clickDiscus() {
    try {
      // Použij již nalezený element pokud existuje
      if (this.discussionElement) {
        try {
          // Ověř, že element je stále platný
          const elementExists = await this.page.evaluate((el) => {
            return el && el.isConnected && el.offsetParent !== null;
          }, this.discussionElement);
          
          if (elementExists) {
            await this.discussionElement.click();
            Log.success('[FB]', '✅ Úspěšně kliknuto na element pro diskuzi (z cache)');
            return true;
          } else {
            Log.warn('[FB]', 'Element pro diskuzi již není platný, hledám znovu...');
          }
        } catch (err) {
          Log.warn('[FB]', `Chyba při ověřování elementu pro diskuzi: ${err.message}, hledám znovu...`);
        }
      }

      // Fallback - hledej element znovu
      if (await this.findDiscussionElement()) {
        await this.discussionElement.click();
        Log.success('[FB]', '✅ Úspěšně kliknuto na element pro diskuzi (nově nalezený)');
        return true;
      }
      
      throw new Error('Element pro diskuzi nebyl nalezen');
    } catch (err) {
      Log.debug(`[FB] clickDiscus selhal: ${err.message}`);
      return false;
    }
  }

  async joinToGroup() {
    try {
      if (!this.pageAnalyzer) {
        throw new Error('PageAnalyzer není inicializován');
      }

      // Pokud už máme text z findJoinGroupElement, použij ho
      if (this.joinGroupText) {
        const success = await this.pageAnalyzer.clickElementWithText(this.joinGroupText, {
          matchType: 'exact',
          naturalDelay: true,
          waitAfterClick: true
        });

        if (success) {
          Log.success('[FB]', '✅ Úspěšně kliknuto na element pro přidání do skupiny pomocí PageAnalyzer');
          return true;
        }
      }

      // Pokud nemáme text, zkus najít element
      if (await this.findJoinGroupElement()) {
        const success = await this.pageAnalyzer.clickElementWithText(this.joinGroupText, {
          matchType: 'exact',
          naturalDelay: true,
          waitAfterClick: true
        });

        if (success) {
          Log.success('[FB]', '✅ Úspěšně kliknuto na element pro přidání do skupiny (nově nalezený)');
          return true;
        }
      }
      
      throw new Error('Element pro přidání do skupiny nebyl nalezen');
    } catch (err) {
      await Log.error(`[FB] Chyba v joinToGroup: ${err.message}`);
      return false;
    }
  }

  async handleAcceptExpertInvite() {
    try {
      const config = await getAllConfig();
      const acceptText = config.cfg_accept_text || 'Přijmout';
      const expertText = config.cfg_expert_accept || 'expertem skupiny';
      Log.info('[FB]', `Hledám tlačítko "${acceptText}" pro pozvánku experta...`);
      // Hledáme tlačítko "Přijmout" v kontextu, kde se mluví o expertovi.
      const button = await this.page.waitForSelector(`xpath///div[@role='button'][.//span[text()='${acceptText}'] and ancestor::div[contains(., '${expertText}')]]`, { timeout: 5000 });
      
      if (button) {
        await button.click();
        await Wait.toSeconds(2000, 3000); // Počkat na reakci
        Log.success('[FB]', '✅ Pozvánka pro experta byla přijata.');
        return true;
      }
      Log.warn('[FB]', 'Tlačítko "Přijmout" pro pozvánku experta nenalezeno.');
      return false;
    } catch (err) {
      Log.error(`[FB] Chyba při přijímání pozvánky experta: ${err.message}`);
      return false;
    }
  }


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
  }

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
      Log.error('[DEBUG]', `Chyba v diagnostice: ${err.message}`);
    }
  }

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
      const input = await ask('🔍 Text pro _findByText(): ');
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
  }

  /**
   * Zavře FB stránku a vyčistí zdroje
   * @param {boolean} closeBrowser - Pokud true, zavře celý prohlížeč místo jen záložky
   * @returns {Promise<boolean>} True pokud bylo úspěšné
   */
  async close(closeBrowser = false) {
    try {
      if (!this.isInitialized) {
        Log.info('[FB]', 'FBBot není inicializován, close není potřeba');
        return true;
      }

      if (this.page && !this.page.isClosed()) {
        Log.info('[FB]', 'Zavírám FB stránku...');
        await this.page.close();
        Log.success('[FB]', 'FB stránka zavřena');
      }
      
      // Pokud je požadováno zavření celého prohlížeče
      if (closeBrowser && this.context && this.context.browser) {
        try {
          Log.info('[FB]', 'Zavírám celý prohlížeč...');
          await this.context.browser().close();
          Log.success('[FB]', 'Prohlížeč úspěšně zavřen');
        } catch (browserCloseErr) {
          Log.warn('[FB]', `Chyba při zavírání prohlížeče: ${browserCloseErr.message}`);
        }
      }

      this.page = null;
      this.newThingElement = null;
      this.isInitialized = false;
      return true;

    } catch (err) {
      await Log.error('[FB] close', err);
      return false;
    }
  }

  /**
   * Kontroluje, zda je FBBot připraven k použití
   * @returns {boolean} True pokud je připraven
   */
  isReady() {
    return this.isInitialized && this.page && !this.page.isClosed();
  }

  async getCurrentPageAnalysis() {
    if (!this.pageAnalyzer) {
      await Log.warn('[FB]', 'PageAnalyzer není k dispozici');
      return null;
    }

    try {
      return await this.pageAnalyzer.analyzeFullPage({
        includePostingCapability: true,
        includeGroupAnalysis: true
      });
    } catch (err) {
      await Log.error('[FB]', `Chyba při získávání analýzy: ${err.message}`);
      return null;
    }
  }

  // Cache byla odstraněna - PageAnalyzer vždy vrací aktuální data

  /**
   * Lidské psaní textu znak po znaku
   * @param {string} text - Text k napsání
   * @returns {Promise<void>}
   */
  async humanTyping(text) {
    if (!this.page) {
      throw new Error('Page není k dispozici pro psaní');
    }

    const { Wait } = await import('./iv_wait.class.js');
    const words = text.split(' ');
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      
      // Napsat slovo znak po znaku
      for (const char of word) {
        await this.page.keyboard.type(char);
        await Wait.toSeconds(Wait.charDelay() / 1000, 'Pauza mezi znaky');
      }
      
      // Přidat mezeru a čekat mezi slovy (kromě posledního slova)
      if (i < words.length - 1) {
        await this.page.keyboard.type(' ');
        await Wait.wordDelay();
      }
    }
  }

}
