// iv_fb.class.js – Refaktorovaná verze s mixin moduly

import { Log } from './iv_log.class.js';
import { PageAnalyzer } from './iv_page_analyzer.class.js';
import { getHumanBehavior } from '../iv_human_behavior_advanced.js';
import { db } from '../iv_sql.js';
import * as fbSupport from '../iv_fb_support.js';
import { getIvyConfig } from './iv_config.class.js';

const config = getIvyConfig();

import { Wait } from './iv_wait.class.js';

// Import mixins
import { NavigationMixin } from './fb/fb_navigation.js';
import { LoginMixin } from './fb/fb_login.js';
import { ErrorDetectionMixin } from './fb/fb_error_detection.js';
import { PostCreationMixin } from './fb/fb_post_creation.js';
import { GroupOpsMixin } from './fb/fb_group_ops.js';
import { PostVerificationMixin } from './fb/fb_post_verification.js';
import { DebugMixin } from './fb/fb_debug.js';

export class FBBot {
  constructor(context, userId = null, disableAnalysis = false) {
    this.context = context;
    this.page = null;
    this.newThingElement = null;
    this.discussionElement = null;
    this.joinGroupElement = null;
    this.isInitialized = false;
    this.pageAnalyzer = null;
    this.userId = userId;
    this.disableAnalysis = disableAnalysis;
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
      return true;

    } catch (err) {
      await Log.error('[FB] init', err);
      this.page = null;
      this.isInitialized = false;
      return false;
    }
  }

  async initializeAnalyzer() {
    if (this.disableAnalysis) {
      Log.info('[FB]', 'Analýza stránek je zakázána (UI režim)');
      return;
    }

    if (this.page && !this.page.isClosed()) {
      this.pageAnalyzer = new PageAnalyzer(this.page);

      // ŽÁDNÉ automatické spouštění analýz!
      // Analýzy se budou spouštět POUZE na vyžádání pomocí await

      Log.success('[FB]', 'PageAnalyzer inicializován a elementy nalezeny');
      return true;
    }
    await Log.warn('[DIAGNOSTIC]', 'PageAnalyzer could not be initialized (page not ready).');
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


  // Vnitřní helpery pro zjednodušení

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
    if (this.disableAnalysis) {
      return false; // V UI režimu neprovádět kontroly
    }

    await this.ensureAnalyzer();

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
    await Log.error(`[FB]`, error);
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

  // Pomocná metoda pro kontrolu dostupnosti analyzéru
  isAnalyzerAvailable() {
    return !this.disableAnalysis && this.pageAnalyzer;
  }

  // Zajistí inicializaci analyzéru pokud je potřeba a povolena
  async ensureAnalyzer() {
    if (this.disableAnalysis) {
      throw new Error('Analýza je zakázána v UI režimu');
    }
    if (!this.pageAnalyzer) {
      await this.initializeAnalyzer();
    }
  }

  async isProfileLoaded(user) {
    if (!this.isAnalyzerAvailable()) {
      Log.debug('[FB]', 'Analýza zakázána - předpokládám, že profil je načten');
      return true; // V UI režimu předpokládáme, že je vše OK
    }
    // Použij sjednocené metody z analyzéru
    return await this.pageAnalyzer.isProfileLoaded(user);
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
          await Log.warn('[FB]', `Chyba při zavírání prohlížeče: ${browserCloseErr.message}`);
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
        await Wait.charDelay();
      }

      // Přidat mezeru a čekat mezi slovy (kromě posledního slova)
      if (i < words.length - 1) {
        await this.page.keyboard.type(' ');
        await Wait.wordDelay();
      }
    }
  }
}

// Apply all mixins to FBBot prototype
Object.assign(FBBot.prototype, NavigationMixin);
Object.assign(FBBot.prototype, LoginMixin);
Object.assign(FBBot.prototype, ErrorDetectionMixin);
Object.assign(FBBot.prototype, PostCreationMixin);
Object.assign(FBBot.prototype, GroupOpsMixin);
Object.assign(FBBot.prototype, PostVerificationMixin);
Object.assign(FBBot.prototype, DebugMixin);
