/**
 * Název souboru: base_post_action.class.js
 * Umístění: ~/ivy/libs/base_post_action.class.js
 *
 * Popis: Společná base třída pro postovací akce (news_post, quote_post)
 * - Jednotný workflow pro všechny postovací akce
 * - Abstract metody pro specifické části každé akce
 * - Společná validace a struktura kroků
 */

import { BaseAction } from './base_action.class.js';
import { Log } from './iv_log.class.js';
import { Wait } from './iv_wait.class.js';

export class BasePostAction extends BaseAction {
  /**
   * Hlavní execute metoda s jednotným workflow
   */
  async execute(user, context, pickedAction) {
    const { fbBot, browser } = context;

    try {
      Log.info(`[${user.id}]`, `Spouštím ${this.actionCode}...`);

      // KROK 0: Vybrat data z databáze (abstract)
      const data = await this.step0_selectData(user);
      if (!data) {
        await Log.error(`[${user.id}]`, 'Žádná dostupná data pro uživatele');
        return false;
      }

      // KROK 1: Otevřít prohlížeč na stránce facebook.com
      await this.step1_openFacebook(user, fbBot);

      // KROK 2: Kliknout na "Co se vám honí hlavou"
      await this.step2_clickPostInput(user, fbBot);

      // KROK 3: Vložit obsah (abstract)
      await this.step3_insertContent(user, fbBot, data);

      // KROK 4: Krátká pauza na kontrolu
      await this.step4_pauseForReview(user);

      // KROK 5: Kliknout na tlačítko "Přidat"
      await this.step5_clickSubmit(user, fbBot);

      // KROK 6: Ověřit úspěšné odeslání
      const success = await this.step6_waitForSuccess(user, fbBot);

      // KROK 7: Zpracovat výsledek
      if (success) {
        await this.handleSuccess(user, data, pickedAction);
        return true;
      } else {
        await this.handleFailure(user, fbBot);
        return false;
      }

    } catch (err) {
      await Log.error(`[${user.id}]`, `Chyba při ${this.actionName}: ${err.message}`);
      return false;
    }
  }

  /**
   * KROK 1: Otevřít prohlížeč na facebook.com
   */
  async step1_openFacebook(user, fbBot) {
    Log.info(`[${user.id}]`, 'KROK 1: Otevírám Facebook...');

    // Přenést FB záložku na popředí
    await fbBot.bringToFront();
    
    // Navigace na Facebook - čekáme na networkidle2
    Log.info(`[${user.id}]`, 'Naviguji na facebook.com...');
    
    const pageReady = await fbBot.navigateToPage('https://www.facebook.com/', {
      waitUntil: 'networkidle2',
      timeout: 30 * 1000 // 30s
    });

    if (!pageReady) {
      throw new Error('Facebook checkpoint detected - cannot continue');
    }

    // Jedna lidská pauza
    await Wait.toSeconds(5, 'Po analýze');

    Log.success(`[${user.id}]`, 'KROK 1 DOKONČEN: Jsme na facebook.com');
  }

  /**
   * KROK 2: Kliknout na "Co se vám honí hlavou"
   */
  async step2_clickPostInput(user, fbBot) {
    Log.info(`[${user.id}]`, 'KROK 2: Klikám na "Co se vám honí hlavou"...');

    const clicked = await fbBot.pageAnalyzer.clickElementWithText('Co se vám honí hlavou', { matchType: 'startsWith' });
    
    if (!clicked) {
      throw new Error('Cannot find post input field - page not ready');
    }
    
    Log.success(`[${user.id}]`, 'KROK 2 DOKONČEN: Kliknuto na vstupní pole');
  }

  /**
   * KROK 4: Pauza na kontrolu
   */
  async step4_pauseForReview(user) {
    Log.info(`[${user.id}]`, 'KROK 4: Pauza na kontrolu příspěvku...');
    
    await Wait.toSeconds(5); // Kontrola příspěvku
    
    Log.success(`[${user.id}]`, 'KROK 4 DOKONČEN: Kontrola dokončena');
  }

  /**
   * KROK 5: Kliknout na "Přidat"
   */
  async step5_clickSubmit(user, fbBot) {
    Log.info(`[${user.id}]`, 'KROK 5: Klikám na tlačítko "Přidat"...');
    
    const clicked = await fbBot.pageAnalyzer.clickElementWithText('Přidat', { matchType: 'exact' });
    
    if (!clicked) {
      throw new Error('Failed to publish post - button not found');
    }
    
    Log.success(`[${user.id}]`, 'KROK 5 DOKONČEN: Kliknuto na "Přidat"');
  }

  /**
   * KROK 6: Ověřit úspěšné odeslání (použije validaci z quote_post)
   */
  async step6_waitForSuccess(user, fbBot) {
    Log.info(`[${user.id}]`, 'KROK 6: Ověřujem úspěšné odeslání příspěvku...');
    
    // Počkat na reakci po kliknutí - načíst delay z konfigurace
    const verifyDelay = this.config.get('fb_post_verify_delay_s', 7);
    Log.info(`[${user.id}]`, `KROK 6: Čekám ${verifyDelay}s před ověřením odeslání příspěvku`);
    await Wait.toSeconds(verifyDelay);
    
    // 1. Kontrola zmizení KONKRÉTNÍHO tlačítka na které se kliklo (přesný tracking)
    let clickedElementStillVisible = await fbBot.pageAnalyzer.isLastClickedElementStillVisible();
    
    if (clickedElementStillVisible === null) {
      // Fallback - žádný element nebyl trackován, použij původní metodu
      Log.warn(`[${user.id}]`, 'Žádný kliknutý element k ověření - používám fallback detekci');
      const addButtonElement = await fbBot.pageAnalyzer.getElementInfo('Přidat', { matchType: 'exact' });
      clickedElementStillVisible = (addButtonElement !== null);
    }
    
    Log.debug(`[${user.id}]`, `Kliknuté tlačítko "Přidat" ${clickedElementStillVisible ? 'STÁLE VIDITELNÉ' : 'zmizelo'}`);
    
    // 2. Hledat pozitivní indikátory úspěchu - pouze pokud tlačítko zmizelo
    let hasSuccessIndicator = false;
    if (!clickedElementStillVisible) {
      const visibleTexts = await fbBot.pageAnalyzer.getAvailableTexts({ maxResults: 100 });
      const successIndicators = [
        'Váš příspěvek byl zveřejněn',
        'příspěvek byl publikován', 
        'před chvílí',
        'před několika sekundami',
        'teď'
      ];
      
      hasSuccessIndicator = visibleTexts.some(text => 
        successIndicators.some(indicator => text.toLowerCase().includes(indicator.toLowerCase()))
      );
    }
    
    if (!clickedElementStillVisible || hasSuccessIndicator) {
      const reason = !clickedElementStillVisible ? 'kliknuté tlačítko "Přidat" zmizelo' : 'nalezen success indikátor';
      Log.success(`[${user.id}]`, `KROK 6 ÚSPĚCH: Příspěvek byl úspěšně odeslán (${reason})`);
      return true;
    } else {
      await Log.error(`[${user.id}]`, 'KROK 6 SELHAL: Kliknuté tlačítko "Přidat" je stále viditelné - příspěvek nebyl odeslán');
      return false;
    }
  }

  // ==========================================
  // ABSTRACT METODY - MUSÍ IMPLEMENTOVAT KAŽDÁ AKCE
  // ==========================================

  /**
   * KROK 0: Vybrat data z databáze
   * @param {Object} user - Uživatelská data
   * @returns {Promise<Object|null>} Data pro post nebo null
   */
  async step0_selectData(user) {
    throw new Error('step0_selectData must be implemented by subclass');
  }

  /**
   * KROK 3: Vložit obsah do Facebook postu
   * @param {Object} user - Uživatelská data
   * @param {Object} fbBot - Facebook bot instance
   * @param {Object} data - Data z step0_selectData
   */
  async step3_insertContent(user, fbBot, data) {
    throw new Error('step3_insertContent must be implemented by subclass');
  }

  /**
   * Zpracovat úspěšné odeslání
   * @param {Object} user - Uživatelská data
   * @param {Object} data - Data z step0_selectData
   * @param {Object} pickedAction - Informace o akci
   */
  async handleSuccess(user, data, pickedAction) {
    throw new Error('handleSuccess must be implemented by subclass');
  }

  /**
   * Zpracovat selhání
   * @param {Object} user - Uživatelská data
   * @param {Object} fbBot - Facebook bot instance
   */
  async handleFailure(user, fbBot) {
    throw new Error('handleFailure must be implemented by subclass');
  }
}