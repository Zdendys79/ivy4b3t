/**
 * Název souboru: news_post.action.js
 * Umístění: ~/ivy/actions/news_post.action.js
 *
 * Popis: Implementace news post akce - postování URL z RSS
 * - Postuje URL z tabulky rss_urls
 * - Vybírá URL s nejnižším used_count a nejmladší
 * - Po použití označí URL jako použitou
 */

import { BasePostAction } from '../libs/base_post_action.class.js';
import { Log } from '../libs/iv_log.class.js';
import { db } from '../iv_sql.js';
import { Wait } from '../libs/iv_wait.class.js';

export class NewsPostAction extends BasePostAction {
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
   * KROK 0: Vybrat URL z databáze
   */
  async step0_selectData(user) {
    Log.info(`[${user.id}]`, 'KROK 0: Vybírám URL z RSS databáze...');
    
    // Vybrat URL s nejnižším used_count, při shodě nejnovější
    const newsUrl = await db.getAvailableNewsUrl();
    
    if (newsUrl) {
      Log.success(`[${user.id}]`, `KROK 0 DOKONČEN: Vybrána URL ID ${newsUrl.id} (${newsUrl.channel_name})`);
    } else {
      await Log.warn(`[${user.id}]`, 'KROK 0: Žádná dostupná RSS URL nenalezena');
    }
    
    return newsUrl;
  }



  /**
   * KROK 3: Vložit URL (paste)
   */
  async step3_insertContent(user, fbBot, newsUrl) {
    Log.info(`[${user.id}]`, 'KROK 3: Vkládám URL adresu...');
    
    // Zkopírovat URL do schránky a vložit pomocí Ctrl+V
    await fbBot.page.evaluate((url) => {
      navigator.clipboard.writeText(url);
    }, newsUrl.url);
    
    // Malá pauza před vložením
    await Wait.toSeconds(1, 'Před vložením URL');
    
    // Získat délku obsahu PŘED vložením
    const lengthBefore = await fbBot.page.evaluate(() => {
      const input = document.activeElement || document.querySelector('[contenteditable="true"]');
      return input ? (input.innerHTML || input.textContent || input.value || '').length : 0;
    });
    
    // Vložit pomocí Ctrl+V
    await fbBot.page.keyboard.down('Control');
    await fbBot.page.keyboard.press('v');
    await fbBot.page.keyboard.up('Control');
    
    // Okamžitá kontrola změny délky (během několika ms)
    await Wait.toMS(100); // Krátká pauza pro zpracování vložení
    
    const lengthAfter = await fbBot.page.evaluate(() => {
      const input = document.activeElement || document.querySelector('[contenteditable="true"]');
      return input ? (input.innerHTML || input.textContent || input.value || '').length : 0;
    });
    
    const expectedLength = newsUrl.url.length;
    const actualChange = lengthAfter - lengthBefore;
    
    if (actualChange < expectedLength * 0.8) { // Tolerance 80% délky URL
      await Log.error(`[${user.id}]`, `KROK 3 SELHAL: URL nebyla vložena. Délka před: ${lengthBefore}, po: ${lengthAfter}, očekávaná změna: ~${expectedLength}`);
      throw new Error(`URL insertion failed - content length change too small: ${actualChange}`);
    }
    
    Log.debug(`[${user.id}]`, `URL vložení detekováno: délka ${lengthBefore} → ${lengthAfter} (+${actualChange})`);
    
    // Krátká pauza pro stabilizaci před pokračováním
    await Wait.toSeconds(1, 'Stabilizace po vložení URL');
    
    Log.success(`[${user.id}]`, 'KROK 3 DOKONČEN: URL vložena a ověřena');
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