// iv_fb.class.js – Refaktorovaná verze

import path from 'path';
import fs from 'fs';

import { Log } from './iv_log.class.js';
import { PageAnalyzer } from './iv_page_analyzer.class.js';
import { getHumanBehavior } from './iv_human_behavior_advanced.js';
import { db } from './iv_sql.js';

import * as wait from './iv_wait.js';

const CONFIG_PATH = path.resolve('./config.json');
const CONFIG = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));

export class FBBot {
  constructor(context, userId = null) {
    this.context = context;
    this.page = null;
    this.newThingElement = null;
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
      this.page.setDefaultNavigationTimeout(15000);

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

  initializeAnalyzer() {
    if (this.page && !this.page.isClosed()) {
      this.pageAnalyzer = new PageAnalyzer(this.page);
      Log.info('[FB]', 'PageAnalyzer inicializován');
      return true;
    }
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
   * Vyhledá <span> elementy podle obsahu textu.
   * @param {string} text - hledaný text
   * @param {object} options - volby (match: startsWith|exact|contains, timeout)
   * @returns {Promise<ElementHandle[]>}
   */
  async _findByText(text, options = {}) {
    try {
      if (!this.page || !this.page.waitForSelector) {
        await Log.warn('[FB] _findByText selhalo: this.page není platná nebo nepodporuje waitForSelector.');
        return [];
      }

      const { match = 'startsWith', timeout = 2000 } = options;

      // Vytvoř XPath stejně jako v _waitForText()
      let xpath;
      if (match === 'startsWith') {
        xpath = `//span[starts-with(normalize-space(string(.)), "${text}")]`;
      } else if (match === 'exact') {
        xpath = `//span[normalize-space(string(.)) = "${text}"]`;
      } else {
        xpath = `//span[contains(normalize-space(string(.)), "${text}")]`;
      }

      // Použij stejný přístup jako _waitForText() s xpath/ prefix
      const selector = `xpath/${xpath}`;

      // Najdi všechny odpovídající elementy
      try {
        // Počkáme na první element s krátkým timeoutem
        await this.page.waitForSelector(selector, { timeout });

        // Pak získáme všechny pomocí $$
        const elements = await this.page.$$(selector);

        return elements || [];

      } catch (timeoutErr) {
        // Pokud timeout, zkus ještě $$ bez čekání
        try {
          const elements = await this.page.$$(selector);
          return elements || [];
        } catch (err) {
          // Žádné elementy nenalezeny
          return [];
        }
      }

    } catch (err) {
      await Log.warn(`[FB] _findByText selhalo pro "${text}":`, err);
      return [];
    }
  }

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
    const t1 = await this._findByText(text1);
    const t2 = await this._findByText(text2);
    return t1.length && t2.length;
  }

  async _clickByText(text, timeout = wait.timeout()) {
    const [button] = await this._findByText(text, { timeout });
    if (!button) throw new Error(`Tlačítko "${text}" nenalezeno.`);
    await button.click();
    Log.info(`[FB] Kliknuto na "${text}".`);
    return true;
  }

  async _typeLikeHuman(text, context = 'neutral') {
    // Pokud máme userId, použij pokročilé chování
    if (this.userId) {
      try {
        if (!this.humanBehavior) {
          this.humanBehavior = await getHumanBehavior(this.userId);
        }

        await this.humanBehavior.typeLikeHuman(this.page, text, context);
        return;
      } catch (error) {
        await Log.warn(`[${this.userId}]`, `⚠️ Pokročilé psaní selhalo, používám fallback: ${error.message}`);
        // Pokračuj fallback metodou
      }
    }

    // Fallback na původní metodu
    const el = await this.page.evaluateHandle(() => document.activeElement);
    const chars = text.split('');

    for (let i = 0; i < chars.length; i++) {
      const char = chars[i];

      // 📉 5–10 % šance na překlep
      if (Math.random() < 0.07 && /[a-zá-ž]/i.test(char)) {
        const typo = String.fromCharCode(char.charCodeAt(0) + 1); // např. o -> p
        await el.type(typo);
        await new Promise(resolve => setTimeout(resolve, wait.type()));

        await el.press('Backspace'); // oprava
        await new Promise(resolve => setTimeout(resolve, wait.type()));
      }

      await el.type(char);
      await new Promise(resolve => setTimeout(resolve, wait.type()));

      // ⌛️ Pauza po některých slovech
      if (char === ' ' && Math.random() < 0.4) {
        await wait.pauseBetweenWords();
      }
    }

    // Log.info(`[FB] Text napsán: ${text}`);
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
      return await this._checkTexts("váš účet jsme uzamkli", "Účet byl zablokován") ? 'account_locked' : false;
    } catch (err) {
      await Log.error('[FB]', `Legacy account lock check failed: ${err}`);
      return false;
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
      await this.page.goto('https://FB.com', { waitUntil: 'domcontentloaded' });
      await wait.delay(10000, false);

      // Inicializuj analyzer po načtení stránky
      this.initializeAnalyzer();

      Log.info('[FB]', 'Stránka FB načtena, spouštím analýzu...');

      // Proveď kompletní analýzu při otevření
      if (this.pageAnalyzer) {
        const analysis = await this.pageAnalyzer.analyzeFullPage({
          includePostingCapability: true
        });

        Log.info('[FB]', `Analýza dokončena - stav: ${analysis.status}`);

        // Zkontroluj výsledky analýzy
        if (analysis.status === 'blocked') {
          const errorReason = analysis.errors?.patterns?.reason || 'Nespecifikovaný problém';
          await Log.error('[FB]', `Účet je zablokován: ${errorReason}`);
          return 'account_locked';
        }

        if (analysis.status === 'warning') {
          const warningReason = analysis.errors?.patterns?.reason || 'Nespecifikovaný problém';
          await Log.warn('[FB]', `Detekován problém: ${warningReason}`);
          // Pokračuj, ale s varováním
        }
      }

    } catch (err) {
      await Log.error('[FB]', `Chyba při načítání stránky: ${err}`);
      return false;
    }

    // Stávající logika kontroly a přihlášení
    if (await this.isAccountLocked()) {
      await Log.error('[FB]', 'Účet je zablokovaný.');
      return 'account_locked';
    }

    if (await this.isProfileLoaded(user)) {
      Log.info('[FB]', `Uživatel ${user.id} ${user.name} ${user.surname} je stále přihlášen.`);
      
      // Posun času aktivity o +3 minuty i pro již přihlášené uživatele
      try {
        await db.updateUserWorktime(user.id, 3);
        Log.info(`[FB] Čas aktivity uživatele ${user.id} posunut o +3 minuty pro rotaci účtů`);
      } catch (err) {
        await Log.warn(`[FB] Nepodařilo se aktualizovat čas aktivity: ${err.message}`);
      }
      
      return 'still_loged';
    }

    Log.info('[FB]', 'Přihlašuji uživatele...');
    return await this.login(user);
  }

  async isProfileLoaded(user) {
    try {
      await this.page.waitForSelector('[aria-label="Váš profil"]', { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  async login(user) {
    try {
      await this.acceptCookies();

      await this.page.waitForSelector('#email', { timeout: 5000 });
      await this.page.type('#email', user.fb_login, { delay: wait.type() });

      await this.page.waitForSelector('#pass', { timeout: 5000 });
      await this.page.type('#pass', user.fb_pass, { delay: wait.type() });

      await this._clickByText('Přihlásit se');
      await wait.delay(15 * wait.timeout());

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
        await Log.warn(`[FB] Uživatel není přihlášen na FB.`);
        return false;
      }
    } catch (err) {
      await Log.error(`[FB] Chyba při loginu: ${err}`);
      return false;
    }
  }

  async acceptCookies() {
    try {
      const [cookieBtn] = await this._findByText('Přijmout všechno');
      if (cookieBtn) {
        await cookieBtn.click();
        await wait.delay(wait.timeout());
        Log.info(`[FB] Cookie banner odkliknut.`);
      } else {
        Log.info(`[FB] Cookie banner nenalezen.`);
      }
    } catch (err) {
      console.warn(`[FB] Cookie banner error: ${err}`);
    }
  }

  /**
   * Rozšířená detekce zablokovaných účtů - kompatibilní se stávajícím kódem
   * @returns {Object|string} Objekt s výsledkem detekce nebo string pro zpětnou kompatibilitu
   */
  async isAccountLocked() {
    try {
      // Pokud nemáme analyzer, použij fallback
      if (!this.pageAnalyzer) {
        await Log.warn('[FB]', 'PageAnalyzer není k dispozici, používám fallback detekci');
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
            type: fullAnalysis.errors.patterns.type || 'UNKNOWN',
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
        reason: 'Požadavek na videoselfie',
        type: 'VIDEOSELFIE'
      },

      // Klasické zablokování
      {
        texts: ['váš účet jsme uzamkli', 'Account restricted', 'temporarily restricted'],
        reason: 'Účet je zablokován',
        type: 'ACCOUNT_LOCKED'
      },

      // Ověření identity
      {
        texts: ['Verify your identity', 'ověření identity', 'identity verification'],
        reason: 'Požadavek na ověření identity',
        type: 'IDENTITY_VERIFICATION'
      },

      // Podezřelá aktivita
      {
        texts: ['suspicious activity', 'podezřelá aktivita', 'unusual activity'],
        reason: 'Detekována podezřelá aktivita',
        type: 'SUSPICIOUS_ACTIVITY'
      },

      // Ověření telefonu
      {
        texts: ['Please confirm your phone', 'potvrďte telefon', 'phone verification'],
        reason: 'Požadavek na ověření telefonu',
        type: 'PHONE_VERIFICATION'
      },

      // Checkpoint obecně
      {
        texts: ['Security check', 'bezpečnostní kontrola', 'checkpoint'],
        reason: 'Bezpečnostní checkpoint',
        type: 'SECURITY_CHECKPOINT'
      },

      // Chyby přihlášení
      {
        texts: ['Nepamatujete si svůj účet?', 'Forgot Account?'],
        reason: 'Neúspěšné přihlášení',
        type: 'LOGIN_FAILED'
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
              reason: pattern.reason,
              type: pattern.type,
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
      const found = await this._findByText(indicator, { timeout: 1500 });
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
      Log.info('[FB]', `Hledám element pro psaní příspěvku. Texty: ${CONFIG.new_post_texts.join(', ')}`);
      
      // Pokus 1: Přesná shoda s starts-with
      let result = await this.findPostElementWithStrategy('starts-with');
      if (result) {
        this.newThingElement = result.handle;
        Log.success('[FB]', `Element nalezen (starts-with): "${result.text}"`);
        return true;
      }

      Log.info('[FB]', 'starts-with selhalo, zkouším contains...');
      
      // Pokus 2: Částečná shoda s contains
      result = await this.findPostElementWithStrategy('contains');
      if (result) {
        this.newThingElement = result.handle;
        Log.success('[FB]', `Element nalezen (contains): "${result.text}"`);
        return true;
      }

      Log.info('[FB]', 'Obě strategie selhaly, zkouším obecný fallback...');
      
      // Pokus 3: Obecný fallback
      result = await this.findPostElementFallback();
      if (result) {
        this.newThingElement = result.handle;
        Log.success('[FB]', `Element nalezen (fallback): clickable span`);
        return true;
      }

      // NOVÝ Pokus 4: Jako poslední možnost - zkus přejít do sekce Diskuze
      Log.info('[FB]', 'Fallback selhal, zkouším přechod do sekce Diskuze jako poslední možnost...');
      const discussClicked = await this.clickDiscus();
      if (discussClicked) {
        Log.info('[FB]', '✅ Přešel do sekce Diskuze, opakuji hledání pole pro psaní...');
        await wait.delay(2000, 3000); // Čekání na načtení
        
        // Opakuj hledání po přechodu do diskuze
        result = await this.findPostElementWithStrategy('starts-with');
        if (result) {
          this.newThingElement = result.handle;
          Log.success('[FB]', `Element nalezen po přechodu do diskuze: "${result.text}"`);
          return true;
        }
      }

      await Log.warn('[FB]', 'Všechny strategie včetně diskuze selhaly, spouštím diagnostiku...');
      await this.debugPostCreationElements();
      throw new Error('Žádný z možných textů nebyl nalezen.');
    } catch (err) {
      await Log.error('[FB] newThing()', err);
      return false;
    }
  }

  async findPostElementWithStrategy(strategy) {
    try {
      Log.debug('[FB]', `Spouštím strategii: ${strategy} pro texty: ${CONFIG.new_post_texts.join(', ')}`);
      
      const promises = CONFIG.new_post_texts.map(text => {
        const xpath = strategy === 'starts-with' 
          ? `//span[starts-with(normalize-space(text()), "${text}")]`
          : `//span[contains(normalize-space(text()), "${text}")]`;
        const selector = `xpath/${xpath}`;
        
        return this.page.waitForSelector(selector, { timeout: 3000 })
          .then(handle => {
            Log.debug('[FB]', `✓ Nalezen element pro text: "${text}" (${strategy})`);
            return { handle, text };
          })
          .catch(() => {
            Log.debug('[FB]', `✗ Element nenalezen pro text: "${text}" (${strategy})`);
            return null;
          });
      });

      const validPromises = promises.filter(p => p !== null);
      if (validPromises.length === 0) {
        Log.debug('[FB]', `Strategie ${strategy}: žádné platné selektory`);
        return null;
      }

      return await Promise.race(validPromises);
    } catch (err) {
      Log.debug('[FB]', `Strategie ${strategy} selhala: ${err.message}`);
      return null;
    }
  }

  async findPostElementFallback() {
    try {
      Log.info('[FB]', 'Zkouším fallback: hledám klikatelné span elementy...');
      
      // Hledáme span elementy které mohou být klikatelné (mají cursor pointer nebo jsou uvnitř klikatelného elementu)
      const fallbackSelectors = [
        'xpath=//span[contains(@class, "x1lliihq") and contains(text(), "Napište")]',
        'xpath=//span[contains(@style, "cursor") and contains(text(), "něco")]',
        'xpath=//div[contains(@role, "textbox")]//span',
        'xpath=//div[@data-testid="status-attachment-mentions-input"]//span'
      ];

      for (const selector of fallbackSelectors) {
        try {
          const handle = await this.page.waitForSelector(selector, { timeout: 2000 });
          if (handle) {
            Log.info('[FB]', `Fallback nalezl element s selektorem: ${selector}`);
            return { handle, text: 'fallback' };
          }
        } catch (err) {
          // Pokračuj s dalším selektorem
        }
      }
      
      return null;
    } catch (err) {
      Log.debug('[FB]', `Fallback selhal: ${err.message}`);
      return null;
    }
  }

  async clickNewThing() {
    try {
      if (!this.newThingElement) {
        Log.error('[FB]', 'newThingElement není definován. Možná selhal newThing()');
        return false;
      }
      
      Log.info('[FB]', 'Klikám na element pro psaní příspěvku...');
      await this.bringToFront();
      await this.newThingElement.click();
      
      const delay = 3 * wait.timeout();
      Log.info('[FB]', `Čekám ${delay}ms po kliknutí na pole pro psaní příspěvku...`);
      await wait.delay(delay);
      
      Log.success('[FB]', 'Kliknuto na pole pro psaní příspěvku.');
      return true;
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
      
      const delay = 10 * wait.timeout();
      Log.debug('[FB]', `Čekám ${delay}ms před vložením textu...`);
      await wait.delay(delay);
      
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

      await wait.delay(wait.timeout() * 2); // Počkáme na vložení

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

      // Zkopíruj text do schránky
      await this.page.evaluate((textToCopy) => {
        return navigator.clipboard.writeText(textToCopy);
      }, text);

      await wait.delay(wait.timeout()); // Krátká pauza po kopírování

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

      await this.bringToFront();

      // Lidské chování - přečteme si co jsme napsali (krátká pauza)
      Log.info('[FB] Kontrolujem napsaný text...');
      await wait.delay(wait.timeout() * 2); // 1-2.4 sekundy

      // Čekáme až FB aktivuje tlačítko
      Log.info('[FB] Čekám než se tlačítko aktivuje...');
      await wait.delay(3000 + Math.random() * 2000); // 3-5 sekund

      // Najdeme tlačítko - jednoduše a lidsky
      const spans = await this.page.$$('span');
      Log.info(`[FB] Hledám odeslací tlačítko...`);

      for (const targetText of CONFIG.submit_texts) {
        for (const span of spans) {
          try {
            const spanInfo = await this.page.evaluate(el => {
              const text = el.textContent.trim();
              const rect = el.getBoundingClientRect();
              const button = el.closest('button, div[role="button"], [tabindex]');

              return {
                text,
                visible: rect.width > 0 && rect.height > 0,
                hasButton: !!button,
                isActionText: text.includes('k příspěvku') || text.includes('příspěvku')
              };
            }, span);

            // Hledáme přesně náš text, bez "k příspěvku"
            if (spanInfo.text === targetText &&
              spanInfo.visible &&
              spanInfo.hasButton &&
              !spanInfo.isActionText) {

              Log.info(`[FB] Našel jsem tlačítko: "${targetText}"`);

              // Lidské chování - krátké váhání před kliknutím
              await wait.delay(800 + Math.random() * 1200); // 0.8-2 sekundy

              // Klikneme
              await span.click();
              Log.info(`[FB] Kliknuto na "${targetText}".`);

              // Čekáme na odeslání
              await wait.delay(10 * wait.timeout(), false);

              // Kontrola - pokud tlačítko zmizelo, bylo to úspěšné
              const stillExists = await this.page.evaluate(el => {
                return document.contains(el);
              }, span).catch(() => false);

              if (!stillExists) {
                Log.success(`[FB] Příspěvek úspěšně odeslán!`);
                return true;
              }
            }
          } catch (spanErr) {
            // Element neexistuje, pokračujeme
          }
        }
      }

      await Log.warn('[FB] Nepodařilo se najít odeslací tlačítko.');
      return false;

    } catch (err) {
      await Log.error(`[FB] Chyba při odesílání:`, err);
      return false;
    }
  }

  async fallbackClick() {
    Log.info('[FB] Spouštím fallback klikání...');

    try {
      // Jednoduchý fallback - najdi všechny span elementy a klikni na první "Přidat"
      const spans = await this.page.$$('span');

      for (const span of spans) {
        try {
          const text = await this.page.evaluate(el => el.textContent.trim(), span);

          if (text === 'Přidat' || text === 'Zveřejnit') {
            Log.info(`[FB] Fallback našel: "${text}"`);

            // Zkusíme kliknout
            await span.click();
            await wait.delay(3000);

            // Kontrola - pokud span zmizelo, pravděpodobně se to povedlo
            const stillExists = await this.page.evaluate(el => {
              return document.contains(el);
            }, span).catch(() => false);

            if (!stillExists) {
              Log.success('[FB] Fallback kliknutí bylo úspěšné!');
              return true;
            }
          }
        } catch (spanErr) {
          // Pokračujeme na další span
        }
      }

      await Log.warn('[FB] Fallback klikání nenašlo vhodné tlačítko.');
      return false;

    } catch (err) {
      await Log.error('[FB] Fallback klikání selhalo:', err);
      return false;
    }
  }

  async findActiveSendButtons() {
    const candidates = [];

    try {
      Log.info('[FB] Hledám tlačítka pomocí standardních selektorů...');

      // Strategie 1: Hledání všech span elementů a filtrování podle textu
      const allSpans = await this.page.$$('span');
      Log.info(`[FB] Nalezeno ${allSpans.length} span elementů.`);

      for (const span of allSpans) {
        try {
          const context = await this.page.evaluate(el => {
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
              buttonAriaLabel: button ? button.getAttribute('aria-label') : null
            };
          }, span);

          if (context && this.isTargetText(context.text) && this.isValidCandidate(context)) {
            candidates.push({ element: span, context, text: context.text });
            Log.info(`[FB] Nalezen kandidát: "${context.text}" (enabled: ${context.enabled}, buttonDisabled: ${context.buttonDisabled})`);
          }
        } catch (evalErr) {
          // Tichá chyba - element už neexistuje
        }
      }

      // Strategie 2: Hledání buttonů s aria-label
      const buttons = await this.page.$$('button, div[role="button"]');
      Log.info(`[FB] Nalezeno ${buttons.length} button elementů.`);

      for (const button of buttons) {
        try {
          const context = await this.page.evaluate(el => {
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
              visibility: style.visibility
            };
          }, button);

          if (context &&
            (this.isTargetText(context.ariaLabel) || this.isTargetText(context.innerText)) &&
            this.isValidCandidate(context)) {
            candidates.push({ element: button, context, text: context.ariaLabel || context.innerText });
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
          const elements = await this.page.$$(selector);
          for (const element of elements) {
            try {
              const context = await this.page.evaluate(el => {
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
                  visibility: style.visibility
                };
              }, element);

              if (context && this.isTargetText(context.text) && this.isValidCandidate(context)) {
                // Kontrola, zda už není v candidates
                const exists = candidates.some(c => c.text === context.text);
                if (!exists) {
                  candidates.push({ element, context, text: context.text });
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

  isTargetText(text) {
    if (!text) return false;
    const normalizedText = text.trim().toLowerCase();
    const targets = CONFIG.submit_texts.map(t => t.toLowerCase());
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

      await wait.delay(500);

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
          await wait.delay(2000);

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
    const t1 = "Výchozí okruh uživatelů";
    const t2 = "Přátelé";
    try {
      const [rangeSelect] = await this._findByText(t1, { timeout: 2000 });
      if (rangeSelect) {
        const friends = await this._findByText(t2, { timeout: 2000 });
        if (friends.length) {
          await friends[friends.length - 2].click();
          const [done] = await this._findByText("Hotovo", { timeout: wait.timeout() });
          if (!done) throw `Tlačítko "Hotovo" nenalezeno.`;
          await wait.delay(3 * wait.timeout());
          await this.page.evaluate(el => { el.click({ clickCount: 2 }); }, done);
          await wait.delay(15 * wait.timeout());
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

      let fbGroupUrl = "https://FB.com/";
      fbGroupUrl += group.typ === "P" ? "" : "groups/";
      fbGroupUrl += group.fb_id;
      

      Log.info('[FB]', `Otevírám skupinu: ${fbGroupUrl}`);

      await this.page.goto(fbGroupUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });

      await wait.delay(5000 + Math.random() * 3000);

      // NOVÉ - Analýza skupiny po načtení
      if (this.pageAnalyzer) {
        const groupAnalysis = await this.pageAnalyzer.analyzeFullPage({
          includeGroupAnalysis: true,
          includePostingCapability: true
        });

        Log.info('[FB]', `Analýza skupiny dokončena - stav: ${groupAnalysis.status}`);

        if (groupAnalysis.group && !groupAnalysis.group.isGroup) {
          await Log.warn('[FB]', `URL neodpovídá skupině: ${groupAnalysis.group.reason}`);
        }

        if (groupAnalysis.posting && !groupAnalysis.posting.canInteract) {
          await Log.warn('[FB]', 'Ve skupině není možné interagovat');
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
        const [counter] = await this._findByText(label, { timeout: 3500 });
        if (counter) {
          const value = await this.page.evaluate(el => el.textContent, counter);
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
      await this._clickByText("Přidat se ke skupině", wait.timeout());
      await wait.delay(15 * wait.timeout());
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
        const likes = await this._findByText("To se mi líbí", { timeout: wait.timeout() });
        if (!likes.length) throw `Tlačítko "To se mi líbí" nenalezeno.`;
        const randomLike = likes[Math.floor(Math.random() * likes.length)];
        await randomLike.click();
        Log.info(`[FB] Kliknuto na tlačítko "To se mi líbí".`);
        await wait.delay(5 * wait.timeout());
        return true;
      } catch (err) {
        await Log.error(`[FB] Chyba při klikání na "To se mi líbí": ${err}`);
        return false;
      }
    } else {
      Log.info(`[FB] Kliknutí na "To se mi líbí" přeskočeno (náhodné).`);
      return true;
    }
  }

  // Pokračování třídy FBBot

  async contentNotAvailable() {
    return await this._checkTexts("Obsah teď není dostupný", "Přejít do kanálu");
  }

  async stillSendButton() {
    const found = await this._findByText("Zveřejnit", { timeout: wait.timeout() });
    if (found.length) {
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
    const found = await this._findByText("Forgot Account?", { timeout: 1500 });
    if (found.length) {
      Log.info(`[FB] Text "Forgot Account?" nalezen.`);
      return true;
    }
    return false;
  }

  async loginFailedCs() {
    const found = await this._findByText("Nepamatujete si svůj účet?", { timeout: 1500 });
    if (found.length) {
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
    const found = await this._findByText("Prodat", { timeout: 3500 });
    if (found.length) {
      Log.info(`[FB] Skupina je prodejní.`);
      return true;
    }
    return false;
  }

  async clickDiscus() {
    try {
      Log.info('[FB]', 'Hledám tlačítko "Diskuze"...');
      const elements = await this._findByText("Diskuze", { timeout: 3000 });
      if (elements.length > 0) {
        await elements[0].click();
        Log.success('[FB]', '✅ Úspěšně kliknuto na "Diskuze"');
        return true;
      }
      throw new Error('Tlačítko "Diskuze" nenalezeno');
    } catch (err) {
      Log.debug(`[FB] clickDiscus selhal: ${err.message}`);
      return false;
    }
  }

  async joinToGroup() {
    try {
      await this._clickByText("Přidat se ke skupině");
      return true;
    } catch (err) {
      await Log.error(`[FB] Chyba v joinToGroup: ${err}`);
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
      
      // Najdi všechny span elementy s klikatelným obsahem
      const spans = await this.page.$$('span');
      Log.info('[DEBUG]', `Nalezeno ${spans.length} span elementů na stránce`);
      
      const postRelatedTexts = [];
      for (const span of spans) {
        try {
          const spanData = await this.page.evaluate(el => {
            const text = el.textContent?.trim();
            const parent = el.parentElement;
            const clickableParent = el.closest('button, div[role="button"], [tabindex], [onclick]');
            
            // Hledej texty související s psaním příspěvku
            const postKeywords = ['napište', 'příspěvek', 'sdílet', 'psaní', 'honí hlavou', 'myslíte', 'skupina'];
            const isPostRelated = postKeywords.some(keyword => 
              text?.toLowerCase().includes(keyword.toLowerCase())
            );
            
            return {
              text: text || '',
              hasClickableParent: !!clickableParent,
              parentTag: parent?.tagName,
              isPostRelated: isPostRelated,
              visible: el.offsetWidth > 0 && el.offsetHeight > 0
            };
          }, span);
          
          if (spanData.isPostRelated && spanData.visible) {
            postRelatedTexts.push(spanData.text);
          }
        } catch (err) {
          // Element byl odstraněn během zpracování
        }
      }
      
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
          const elements = await this.page.$$(selector);
          if (elements.length > 0) {
            Log.info('[DEBUG]', `Selektor "${selector}" našel ${elements.length} elementů`);
            
            // Test prvního elementu
            const firstElement = elements[0];
            const elementInfo = await this.page.evaluate(el => {
              const rect = el.getBoundingClientRect();
              return {
                text: el.textContent?.trim() || '',
                ariaLabel: el.getAttribute('aria-label') || '',
                placeholder: el.getAttribute('placeholder') || '',
                visible: rect.width > 0 && rect.height > 0,
                tagName: el.tagName
              };
            }, firstElement);
            
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
        const elements = await this._findByText(input.trim(), { timeout: 3000 });
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
   * @returns {Promise<boolean>} True pokud bylo úspěšné
   */
  async close() {
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

}
