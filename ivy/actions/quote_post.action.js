/**
 * Název souboru: quote_post.action.js
 * Umístění: ~/ivy/actions/quote_post.action.js
 *
 * Popis: Implementace quote post akce
 * - Krok za krokem
 * - Bez fallbacků
 * - Minimalistické řešení
 */

import { BasePostAction } from '../libs/base_post_action.class.js';
import { Log } from '../libs/iv_log.class.js';
import { db } from '../iv_sql.js';
import { Wait } from '../libs/iv_wait.class.js';
import { getHumanBehavior } from '../iv_human_behavior_advanced.js';

export class QuotePostAction extends BasePostAction {
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
   * KROK 1: Otevřít prohlížeč na facebook.com
   */
  async step1_openFacebook(user, fbBot) {
    Log.info(`[${user.id}]`, 'KROK 1: Otevírám Facebook...');

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
   * KROK 0: Vybrat citát z databáze
   */
  async step0_selectData(user) {
    Log.info(`[${user.id}]`, 'KROK 0: Vybírám citát z databáze...');
    
    const quote = await db.safeQueryFirst('quotes.getRandomForUser', [user.id]);
    
    if (quote) {
      Log.success(`[${user.id}]`, `KROK 0 DOKONČEN: Vybrán citát ID ${quote.id}`);
    }
    
    return quote;
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
   * KROK 3: Napsat citát (lidsky)
   */
  async step3_insertContent(user, fbBot, quote) {
    Log.info(`[${user.id}]`, 'KROK 3: Píšu citát...');
    
    // Pokročilé lidské psaní s chybami a databázovými profily
    const humanBehavior = await getHumanBehavior(user.id);
    await humanBehavior.typeLikeHuman(fbBot.page, quote.text, 'quote_writing');
    
    Log.success(`[${user.id}]`, 'KROK 3 DOKONČEN: Citát napsán');

    // Přidat autora (pokud existuje)
    if (quote.author) {
      await this.addAuthor(user, fbBot, quote.author);
    }
  }

  /**
   * Přidat autora citátu
   */
  async addAuthor(user, fbBot, author) {
    Log.info(`[${user.id}]`, 'Přidávám autora...');
    
    // Přidat nový řádek
    await fbBot.page.keyboard.press('Enter');
    await fbBot.page.keyboard.press('Enter');
    
    // Pokročilé lidské psaní autora
    const humanBehavior = await getHumanBehavior(user.id);
    await humanBehavior.typeLikeHuman(fbBot.page, `- ${author}`, 'author_writing');
    
    Log.success(`[${user.id}]`, 'Autor přidán');
  }


  /**
   * KROK 5: Pauza na kontrolu
   */
  async step5_pauseForReview(user) {
    Log.info(`[${user.id}]`, 'KROK 5: Pauza na kontrolu příspěvku...');
    
    await Wait.toSeconds(5); // Kontrola příspěvku
    
    Log.success(`[${user.id}]`, 'KROK 5 DOKONČEN: Kontrola dokončena');
  }

  /**
   * KROK 6: Kliknout na "Přidat"
   */
  async step6_clickSubmit(user, fbBot) {
    Log.info(`[${user.id}]`, 'KROK 6: Klikám na tlačítko "Přidat"...');
    
    // Nejdřív ověřit že tlačítko existuje
    const buttonExists = await fbBot.pageAnalyzer.elementExists('Přidat', { 
      matchType: 'exact'
    });
    
    if (!buttonExists) {
      await Log.error(`[${user.id}]`, 'KROK 6 SELHAL: Tlačítko "Přidat" nebylo nalezeno!');
      throw new Error('Button "Přidat" not found on page');
    }
    
    Log.info(`[${user.id}]`, 'Tlačítko "Přidat" nalezeno, pokouším se kliknout...');
    
    // Získat info o tlačítku před kliknutím
    const buttonInfo = await fbBot.pageAnalyzer.getElementInfo('Přidat', { matchType: 'exact' });
    if (buttonInfo) {
      Log.debug(`[${user.id}]`, `Info o tlačítku: ${buttonInfo.tagName}, pozice: ${buttonInfo.position || 'neznámá'}`);
    }
    
    // Kliknout na tlačítko
    const clicked = await fbBot.pageAnalyzer.clickElementWithText('Přidat', { 
      matchType: 'exact',
      timeout: 10000
    });
    
    if (!clicked) {
      await Log.error(`[${user.id}]`, 'KROK 6 SELHAL: Kliknutí na "Přidat" se nezdařilo!');
      throw new Error('Failed to click on "Přidat" button');
    }
    
    // Ověřit že kliknutí proběhlo - počkat malou chvíli
    await Wait.toSeconds(1, 'Ověření kliknutí');
    
    // Zkontrolovat zda tlačítko stále existuje
    const stillExists = await fbBot.pageAnalyzer.elementExists('Přidat', { 
      matchType: 'exact'
    });
    
    if (stillExists) {
      await Log.warn(`[${user.id}]`, 'VAROVÁNÍ: Tlačítko "Přidat" je stále viditelné po kliknutí!');
    }
    
    Log.success(`[${user.id}]`, 'KROK 6 DOKONČEN: Kliknuto na "Přidat"');
  }

  /**
   * KROK 7: Ověřit úspěšné odeslání
   */
  async step7_waitForSuccess(user, fbBot) {
    Log.info(`[${user.id}]`, 'KROK 7: Čekám na potvrzení odeslání...');
    
    // Po kliknutí na Přidat čekat až 10 sekund než tlačítko zmizí
    await Wait.toSeconds(10, 'Po kliknutí na Přidat');
    
    // Zkontrolovat zda tlačítko "Přidat" zmizelo (což znamená úspěch)
    const visibleTexts = await fbBot.pageAnalyzer.getAvailableTexts({ maxResults: 200 });
    const currentUrl = fbBot.page.url();
    
    // Hledat tlačítko "Přidat" v textech
    const submitButtonVisible = visibleTexts.some(text => 
      text === 'Přidat' || text.includes('Přidat')
    );
    
    
    if (submitButtonVisible) {
      await Log.error(`[${user.id}]`, 'KROK 7 SELHAL: Tlačítko "Přidat" je stále viditelné - příspěvek nebyl odeslán');
      return false;
    } else {
      Log.info(`[${user.id}]`, 'KROK 7 ÚSPĚCH: Tlačítko "Přidat" zmizelo - příspěvek byl odeslán');
      return true;
    }
  }

  /**
   * Zpracovat úspěch
   */
  async handleSuccess(user, quote, pickedAction) {
    Log.info(`[${user.id}]`, 'Zpracovávám úspěšné odeslání...');
    
    // Nastavit timeout citátu na 30 dní
    await db.safeExecute('quotes.markAsUsed', [30, quote.id]);
    
    // Zapsat úspěšnou akci do action_log
    await db.safeExecute('actions.logAction', [
      user.id,
      'quote_post',
      `Quote ID: ${quote.id}`,
      quote.id
    ]);
    
    // Naplánovat další akci
    const minMinutes = pickedAction.min_minutes || 60;
    const maxMinutes = pickedAction.max_minutes || 120;
    const nextMinutes = minMinutes + Math.random() * (maxMinutes - minMinutes);
    
    await db.safeExecute('actions.scheduleNext', [
      Math.round(nextMinutes),
      user.id,
      'quote_post'
    ]);
    
    Log.success(`[${user.id}]`, `Quote post úspěšný! Další akce za ${Math.round(nextMinutes)} minut`);
  }

  /**
   * Zpracovat selhání
   */
  async handleFailure(user, fbBot) {
    await Log.error(`[${user.id}]`, 'Quote post selhal');
    // ODSTRANĚNO: zapisování debug informací - není potřeba
  }

}