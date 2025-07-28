/**
 * Název souboru: news_post.action.js
 * Umístění: ~/ivy/actions/news_post.action.js
 *
 * Popis: Implementace news post akce - postování URL z RSS
 * - Postuje URL z tabulky rss_urls
 * - Vybírá URL s nejnižším used_count a nejmladší
 * - Po použití označí URL jako použitou
 */

import { BaseAction } from '../libs/base_action.class.js';
import { Log } from '../libs/iv_log.class.js';
import { db } from '../iv_sql.js';
import { Wait } from '../libs/iv_wait.class.js';

export class NewsPostAction extends BaseAction {
  constructor() {
    super('news_post');
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
   * Provedení news post - krok po kroku
   */
  async execute(user, context, pickedAction) {
    const { fbBot, browser } = context;

    try {
      Log.info(`[${user.id}]`, 'Spouštím news post (URL z RSS)...');

      // KROK 0: Vybrat URL z databáze
      const newsUrl = await this.step0_selectUrl(user);
      if (!newsUrl) {
        await Log.error(`[${user.id}]`, 'Žádná dostupná URL pro uživatele');
        return false;
      }

      // KROK 1: Otevřít prohlížeč na stránce facebook.com
      await this.step1_openFacebook(user, fbBot);

      // KROK 2: Kliknout na "Co se vám honí hlavou"
      await this.step2_clickPostInput(user, fbBot);

      // KROK 3: Napsat URL
      await this.step3_writeUrl(user, fbBot, newsUrl);

      // KROK 4: Krátká pauza na kontrolu
      await this.step4_pauseForReview(user);

      // KROK 5: Kliknout na tlačítko "Přidat"
      await this.step5_clickSubmit(user, fbBot);

      // KROK 6: Ověřit úspěšné odeslání a počkat
      const success = await this.step6_waitForSuccess(user, fbBot);

      // KROK 7: Zpracovat výsledek
      if (success) {
        await this.handleSuccess(user, newsUrl, pickedAction);
        return true;
      } else {
        await this.handleFailure(user, fbBot);
        return false;
      }

    } catch (err) {
      await Log.error(`[${user.id}]`, `Chyba při news post: ${err.message}`);
      return false;
    }
  }

  /**
   * KROK 0: Vybrat URL z databáze
   */
  async step0_selectUrl(user) {
    Log.info(`[${user.id}]`, 'KROK 0: Vybírám URL z RSS databáze...');
    
    // Vybrat URL s nejnižším used_count, při shodě nejnovější
    const newsUrl = await db.getAvailableNewsUrl();
    
    if (newsUrl) {
      Log.success(`[${user.id}]`, `KROK 0 DOKONČEN: Vybrána URL ID ${newsUrl.id} (${newsUrl.channel_name})`);
    } else {
      Log.warn(`[${user.id}]`, 'KROK 0: Žádná dostupná RSS URL nenalezena');
    }
    
    return newsUrl;
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
   * KROK 3: Vložit URL (paste)
   */
  async step3_writeUrl(user, fbBot, newsUrl) {
    Log.info(`[${user.id}]`, 'KROK 3: Vkládám URL adresu...');
    
    // Zkopírovat URL do schránky a vložit pomocí Ctrl+V
    await fbBot.page.evaluate((url) => {
      navigator.clipboard.writeText(url);
    }, newsUrl.url);
    
    // Malá pauza před vložením
    await Wait.toSeconds(1, 'Před vložením URL');
    
    // Vložit pomocí Ctrl+V
    await fbBot.page.keyboard.down('Control');
    await fbBot.page.keyboard.press('v');
    await fbBot.page.keyboard.up('Control');
    
    Log.success(`[${user.id}]`, 'KROK 3 DOKONČEN: URL vložena');
  }

  /**
   * KROK 4: Pauza na kontrolu (5s minimum)
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
   * KROK 6: Ověřit úspěšné odeslání
   */
  async step6_waitForSuccess(user, fbBot) {
    Log.info(`[${user.id}]`, 'KROK 6: Čekám na potvrzení odeslání...');
    
    // Po kliknutí na Přidat čekat minimálně 5 sekund
    await Wait.toSeconds(5, 'Po kliknutí na Přidat - povinná pauza');
    
    // Prozatím vždy vrátit true (stejně jako v quote_post)
    Log.info(`[${user.id}]`, 'KROK 6: Předpokládám úspěch');
    return true;
  }

  /**
   * Zpracovat úspěch
   */
  async handleSuccess(user, newsUrl, pickedAction) {
    Log.info(`[${user.id}]`, 'Zpracovávám úspěšné odeslání...');
    
    // Označit URL jako použitou
    await db.markNewsUrlAsUsed(newsUrl.id);
    
    // Zapsat úspěšnou akci do action_log
    await db.safeExecute('actions.logAction', [
      user.id,
      'news_post',
      `RSS URL ID: ${newsUrl.id}`,
      newsUrl.id
    ]);
    
    // Naplánovat další akci (30-60 hodin = 1800-3600 minut)
    const minMinutes = pickedAction.min_minutes || 1800;  // 30 hodin
    const maxMinutes = pickedAction.max_minutes || 3600;  // 60 hodin
    const nextMinutes = minMinutes + Math.random() * (maxMinutes - minMinutes);
    
    await db.safeExecute('actions.scheduleNext', [
      Math.round(nextMinutes),
      user.id,
      'news_post'
    ]);
    
    Log.success(`[${user.id}]`, `News post úspěšný! Další akce za ${Math.round(nextMinutes / 60)} hodin`);
  }

  /**
   * Zpracovat selhání
   */
  async handleFailure(user, fbBot) {
    await Log.error(`[${user.id}]`, 'News post selhal');
  }

}