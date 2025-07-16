/**
 * Název souboru: quote_post.action.js
 * Umístění: ~/ivy/actions/quote_post.action.js
 *
 * Popis: Implementace quote post akce
 * - Krok za krokem
 * - Bez fallbacků
 * - Minimalistické řešení
 */

import { BaseAction } from '../libs/base_action.class.js';
import { Log } from '../libs/iv_log.class.js';

export class QuotePostAction extends BaseAction {
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
    const { fbBot, browser } = context;

    try {
      Log.info(`[${user.id}]`, 'Spouštím jednoduchý quote post...');

      // KROK 1: Otevřít prohlížeč na stránce facebook.com
      await this.step1_openFacebook(user, fbBot);

      // KROK 2: Kliknout na "Co se vám honí hlavou"
      await this.step2_clickPostInput(user, fbBot);

      // Prozatím končíme po kroku 2 - akce není dokončena
      Log.success(`[${user.id}]`, 'Krok 2 dokončen - kliknuto na vstupní pole');
      
      // Čekání 60s nebo do zavření prohlížeče - použít browser management
      Log.info(`[${user.id}]`, 'Čekám 60s nebo do zavření prohlížeče...');
      
      // Import BrowserManager
      const { BrowserManager } = await import('../libs/iv_browser_manager.class.js');
      const browserManager = new BrowserManager();
      
      const result = await browserManager.waitForBrowserCloseOrTimeout(user, browser, 60000);
      
      if (result === 'restart' || result === 'ui_command') {
        Log.info(`[${user.id}]`, `Akce ukončena kvůli: ${result}`);
        return false;
      }
      
      await Log.warn(`[${user.id}]`, 'Nedokončený Programový kód akce.');
      return false;

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

    // Navigace na Facebook - čekáme na networkidle2
    Log.info(`[${user.id}]`, 'Naviguji na facebook.com...');
    
    await fbBot.page.goto('https://www.facebook.com/', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Reinicializace analyzátoru (spustí se hned po networkidle2)
    await fbBot.initializeAnalyzer();

    // Jedna lidská pauza (2-5 sekund)
    const pauseTime = 2000 + Math.random() * 3000;
    Log.info(`[${user.id}]`, `Čekám ${Math.round(pauseTime/1000)}s po analýze...`);
    await new Promise(resolve => setTimeout(resolve, pauseTime));

    Log.success(`[${user.id}]`, 'KROK 1 DOKONČEN: Jsme na facebook.com');
  }

  /**
   * KROK 2: Kliknout na "Co se vám honí hlavou"
   */
  async step2_clickPostInput(user, fbBot) {
    Log.info(`[${user.id}]`, 'KROK 2: Klikám na "Co se vám honí hlavou"...');

    try {
      await fbBot.pageAnalyzer.clickElementWithText('Co se vám honí hlavou', { matchType: 'startsWith' });
      Log.success(`[${user.id}]`, 'KROK 2 DOKONČEN: Kliknuto na vstupní pole');
    } catch (err) {
      throw new Error(`Nepodařilo se kliknout na element: ${err.message}`);
    }
  }

}