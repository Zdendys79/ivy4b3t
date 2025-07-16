/**
 * Název souboru: quote_post_simple.action.js
 * Umístění: ~/ivy/actions/quote_post_simple.action.js
 *
 * Popis: Jednoduchá implementace quote post akce
 * - Krok za krokem
 * - Bez fallbacků
 * - Minimalistické řešení
 */

import { BaseAction } from '../libs/base_action.class.js';
import { Log } from '../libs/iv_log.class.js';

export class QuotePostSimpleAction extends BaseAction {
  constructor() {
    super('quote_post');
  }

  /**
   * Definuje požadavky akce na služby
   */
  getRequirements() {
    return {
      needsFB: true,
      needsUtio: false
    };
  }

  /**
   * Ověří připravenost akce
   */
  async verifyReadiness(user, context) {
    return {
      ready: true,
      reason: 'Připraveno'
    };
  }

  /**
   * Provedení quote post - krok po kroku
   */
  async execute(user, context, pickedAction) {
    const { fbBot } = context;

    try {
      Log.info(`[${user.id}]`, 'Spouštím jednoduchý quote post...');

      // KROK 1: Otevřít prohlížeč na stránce facebook.com
      await this.step1_openFacebook(user, fbBot);

      // Prozatím končíme po kroku 1
      Log.success(`[${user.id}]`, 'Krok 1 dokončen - prohlížeč je na facebook.com');
      return true;

    } catch (err) {
      await Log.error(`[${user.id}]`, `Chyba při quote post: ${err.message}`);
      return false;
    }
  }

  /**
   * KROK 1: Otevřít prohlížeč na facebook.com
   */
  async step1_openFacebook(user, fbBot) {
    Log.info(`[${user.id}]`, 'KROK 1: Otevírám Facebook...');

    // Kontrola, zda už nejsme na Facebooku
    const currentUrl = fbBot.page.url();
    Log.debug(`[${user.id}]`, `Aktuální URL: ${currentUrl}`);

    if (currentUrl.includes('facebook.com')) {
      Log.info(`[${user.id}]`, 'Prohlížeč už je na facebook.com');
      return;
    }

    // Navigace na Facebook
    Log.info(`[${user.id}]`, 'Naviguji na facebook.com...');
    
    await fbBot.page.goto('https://www.facebook.com/', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    // Krátká pauza po načtení
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Reinicializace analyzátoru
    fbBot.initializeAnalyzer();

    Log.success(`[${user.id}]`, 'KROK 1 DOKONČEN: Jsme na facebook.com');
  }
}