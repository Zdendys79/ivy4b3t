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
import { db } from '../iv_sql.js';
import { Wait } from '../libs/iv_wait.class.js';
import { getHumanBehavior } from '../iv_human_behavior_advanced.js';

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

      // KROK 0: Vybrat citát z databáze
      const quote = await this.step0_selectQuote(user);
      if (!quote) {
        await Log.error(`[${user.id}]`, 'Žádný dostupný citát pro uživatele');
        return false;
      }

      // KROK 1: Otevřít prohlížeč na stránce facebook.com
      await this.step1_openFacebook(user, fbBot);

      // KROK 2: Kliknout na "Co se vám honí hlavou"
      await this.step2_clickPostInput(user, fbBot);

      // KROK 3: Napsat citát
      await this.step3_writeQuote(user, fbBot, quote);

      // KROK 4: Přidat autora (pokud existuje)
      if (quote.author) {
        await this.step4_addAuthor(user, fbBot, quote.author);
      }

      // KROK 5: Krátká pauza na kontrolu
      await this.step5_pauseForReview(user);

      // KROK 6: Kliknout na tlačítko "Přidat"
      await this.step6_clickSubmit(user, fbBot);

      // KROK 7: Počkat na zmizení tlačítka (max 5s)
      const success = await this.step7_waitForSuccess(user, fbBot);

      // KROK 8: Zpracovat výsledek
      if (success) {
        await this.handleSuccess(user, quote, pickedAction);
        return true;
      } else {
        await this.handleFailure(user, fbBot);
        return false;
      }
      
      // Čekání 60s nebo do zavření prohlížeče - použít browser management
      Log.info(`[${user.id}]`, 'Čekám 60s nebo do zavření prohlížeče...');
      
      // Import BrowserManager
      const { BrowserManager } = await import('../libs/iv_browser_manager.class.js');
      const browserManager = new BrowserManager();
      
      const result = await browserManager.waitForBrowserCloseOrTimeout(user, browser, 60 * 1000); // 60s
      
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
  async step0_selectQuote(user) {
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
  async step3_writeQuote(user, fbBot, quote) {
    Log.info(`[${user.id}]`, 'KROK 3: Píšu citát...');
    
    // Pokročilé lidské psaní s chybami a databázovými profily
    const humanBehavior = await getHumanBehavior(user.id);
    await humanBehavior.typeLikeHuman(fbBot.page, quote.text, 'quote_writing');
    
    Log.success(`[${user.id}]`, 'KROK 3 DOKONČEN: Citát napsán');
  }

  /**
   * KROK 4: Přidat autora
   */
  async step4_addAuthor(user, fbBot, author) {
    Log.info(`[${user.id}]`, 'KROK 4: Přidávám autora...');
    
    // Přidat nový řádek
    await fbBot.page.keyboard.press('Enter');
    await fbBot.page.keyboard.press('Enter');
    
    // Pokročilé lidské psaní autora
    const humanBehavior = await getHumanBehavior(user.id);
    await humanBehavior.typeLikeHuman(fbBot.page, `- ${author}`, 'author_writing');
    
    Log.success(`[${user.id}]`, 'KROK 4 DOKONČEN: Autor přidán');
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
    
    const clicked = await fbBot.pageAnalyzer.clickElementWithText('Přidat', { matchType: 'exact' });
    
    if (!clicked) {
      throw new Error('Failed to publish post - button not found');
    }
    
    Log.success(`[${user.id}]`, 'KROK 6 DOKONČEN: Kliknuto na "Přidat"');
  }

  /**
   * KROK 7: Počkat na zmizení tlačítka
   */
  async step7_waitForSuccess(user, fbBot) {
    Log.info(`[${user.id}]`, 'KROK 7: Čekám na zmizení tlačítka "Přidat"...');
    
    const startTime = Date.now();
    const maxWait = 5 * 1000; // 5 sekund
    
    while (Date.now() - startTime < maxWait) {
      const buttonExists = await fbBot.pageAnalyzer.elementExists('Přidat', { matchType: 'exact' });
      
      if (!buttonExists) {
        Log.success(`[${user.id}]`, 'KROK 7 DOKONČEN: Tlačítko zmizelo - příspěvek odeslán!');
        return true;
      }
      
      await Wait.toSeconds(1);
    }
    
    await Log.warn(`[${user.id}]`, 'KROK 7: Tlačítko nezmizelo po 5s');
    return false;
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
    await Log.error(`[${user.id}]`, 'Quote post selhal - zapisuji debug informace...');
    
    try {
      // Zapsat do debug_incidents
      await db.safeExecute('system.insertDebugIncident', [
        user.id,
        'quote_post_failed',
        JSON.stringify({
          visibleTexts: fbBot.pageAnalyzer.getAvailableTexts({ maxResults: 100 }),
          url: fbBot.page.url(),
          timestamp: new Date().toISOString()
        }),
        await fbBot.page.screenshot({ encoding: 'base64' })
      ]);
      
      Log.info(`[${user.id}]`, 'Debug informace uloženy do debug_incidents');
    } catch (err) {
      await Log.error(`[${user.id}]`, `Chyba při ukládání debug informací: ${err.message}`);
    }
  }

}