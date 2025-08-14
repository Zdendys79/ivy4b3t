/**
 * Název souboru: universal_post.action.js
 * Umístění: ~/ivy/actions/universal_post.action.js
 *
 * Popis: Univerzální post akce pro quote_post i news_post
 * - Rozlišení typu pomocí parametru postType
 * - Sdílený workflow, pouze step0 a step3 se liší podle typu
 */

import { BasePostAction } from '../libs/base_post_action.class.js';
import { Log } from '../libs/iv_log.class.js';
import { db } from '../iv_sql.js';
import { Wait } from '../libs/iv_wait.class.js';
import { getHumanBehavior } from '../iv_human_behavior_advanced.js';

export class UniversalPostAction extends BasePostAction {
  constructor(postType = 'quote') {
    super(`${postType}_post`);
    this.postType = postType; // 'quote' nebo 'news'
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
   * KROK 0: Vybrat data z databáze (podle typu)
   */
  async step0_selectData(user) {
    if (this.postType === 'quote') {
      return await this._selectQuote(user);
    } else if (this.postType === 'news') {
      return await this._selectNewsUrl(user);
    } else {
      throw new Error(`Neznámý postType: ${this.postType}`);
    }
  }

  /**
   * KROK 3: Vložit obsah (podle typu)
   */
  async step3_insertContent(user, fbBot, data) {
    if (this.postType === 'quote') {
      return await this._insertQuote(user, fbBot, data);
    } else if (this.postType === 'news') {
      return await this._insertNewsUrl(user, fbBot, data);
    } else {
      throw new Error(`Neznámý postType: ${this.postType}`);
    }
  }

  /**
   * Zpracovat úspěch (podle typu)
   */
  async handleSuccess(user, data, pickedAction) {
    if (this.postType === 'quote') {
      return await this._handleQuoteSuccess(user, data, pickedAction);
    } else if (this.postType === 'news') {
      return await this._handleNewsSuccess(user, data, pickedAction);
    }
  }

  /**
   * Zpracovat selhání
   */
  async handleFailure(user, fbBot) {
    await Log.error(`[${user.id}]`, `${this.postType}_post selhal`);
  }

  // ==========================================
  // QUOTE POST METODY
  // ==========================================

  /**
   * Vybrat citát z databáze
   */
  async _selectQuote(user) {
    Log.info(`[${user.id}]`, 'KROK 0: Vybírám citát z databáze...');
    
    const quote = await db.safeQueryFirst('quotes.getRandomForUser', [user.id]);
    
    if (quote) {
      Log.success(`[${user.id}]`, `KROK 0 DOKONČEN: Vybrán citát ID ${quote.id}`);
    }
    
    return quote;
  }

  /**
   * Vložit citát (lidské psaní)
   */
  async _insertQuote(user, fbBot, quote) {
    Log.info(`[${user.id}]`, 'KROK 3: Píšu citát...');
    
    // Vybrat a uložit náhodnou variantu zobrazení
    quote._usedVariant = this.selectDisplayVariant(quote);
    Log.debug(`[${user.id}]`, `Vybrána varianta: ${quote._usedVariant}`);
    
    // Sestavit text podle varianty
    const textToType = this.buildQuoteText(quote, quote._usedVariant);
    Log.debug(`[${user.id}]`, `Text k napsání: ${textToType.substring(0, 50)}...`);
    
    // Pokročilé lidské psaní
    const humanBehavior = await getHumanBehavior(user.id);
    await humanBehavior.typeLikeHuman(fbBot.page, textToType, 'quote_writing');
    
    Log.success(`[${user.id}]`, 'KROK 3 DOKONČEN: Citát napsán');
  }

  /**
   * Zpracovat úspěch citátu
   */
  async _handleQuoteSuccess(user, quote, pickedAction) {
    Log.info(`[${user.id}]`, 'Zpracovávám úspěšné odeslání...');
    
    // Nastavit timeout citátu na 30 dní
    await db.safeExecute('quotes.markAsUsed', [30, quote.id]);
    
    // Zapsat úspěšnou akci do action_log
    await db.safeExecute('actions.logAction', [
      user.id,
      'quote_post',
      `Varianta: ${quote._usedVariant}`,
      quote.id
    ]);
    
    // Naplánovat další akci (4-8 hodin = 240-480 minut)
    if (!pickedAction.min_minutes || !pickedAction.max_minutes) {
      throw new Error(`Akce ${this.actionCode} nemá nastavené min_minutes nebo max_minutes`);
    }
    const minMinutes = pickedAction.min_minutes;  // 4 hodiny
    const maxMinutes = pickedAction.max_minutes;  // 8 hodin
    const nextMinutes = minMinutes + Math.random() * (maxMinutes - minMinutes);
    
    await db.safeExecute('actions.scheduleNext', [
      Math.round(nextMinutes),
      user.id,
      'quote_post'
    ]);
    
    Log.success(`[${user.id}]`, `Quote post úspěšný! Další akce za ${Math.round(nextMinutes / 60)} hodin`);
  }

  // ==========================================
  // NEWS POST METODY
  // ==========================================

  /**
   * Vybrat URL z RSS databáze
   */
  async _selectNewsUrl(user) {
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
   * Vložit URL (paste)
   */
  async _insertNewsUrl(user, fbBot, newsUrl) {
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
   * Zpracovat úspěch news URL
   */
  async _handleNewsSuccess(user, newsUrl, pickedAction) {
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
    if (!pickedAction.min_minutes || !pickedAction.max_minutes) {
      throw new Error(`Akce ${this.actionCode} nemá nastavené min_minutes nebo max_minutes`);
    }
    const minMinutes = pickedAction.min_minutes;  // 30 hodin
    const maxMinutes = pickedAction.max_minutes;  // 60 hodin
    const nextMinutes = minMinutes + Math.random() * (maxMinutes - minMinutes);
    
    await db.safeExecute('actions.scheduleNext', [
      Math.round(nextMinutes),
      user.id,
      'news_post'
    ]);
    
    Log.success(`[${user.id}]`, `News post úspěšný! Další akce za ${Math.round(nextMinutes / 60)} hodin`);
  }

  // ==========================================
  // QUOTE POST POMOCNÉ METODY (ze starého quote_post)
  // ==========================================

  /**
   * Vybrat náhodnou variantu zobrazení citátu
   */
  selectDisplayVariant(quote) {
    // Kontrola dostupnosti překladů - MUSÍ BÝT SCHVÁLEN!
    const hasApprovedTranslation = quote.translated_text && 
                                   quote.translated_text.trim() !== '' && 
                                   quote.translation_approved === 1;
    const hasOriginal = quote.original_text && quote.original_text.trim() !== '';
    
    // Pokud má překlad, ale NENÍ schválen - pouze originál (pokud existuje)
    if (quote.translated_text && quote.translation_approved !== 1) {
      if (hasOriginal) {
        return 'original_only';
      } else {
        throw new Error('Citát má neschválený překlad a neexistuje originál');
      }
    }
    
    // Definice variant podle dostupnosti dat
    let variants = [];
    
    if (hasApprovedTranslation) {
      variants.push('czech_only');
    }
    
    if (hasApprovedTranslation && hasOriginal) {
      variants.push('original_plus_czech');
    }
    
    if (hasOriginal) {
      variants.push('original_only');
    }
    
    // Fallback pokud nejsou definované žádné varianty
    if (variants.length === 0) {
      if (hasOriginal) {
        variants = ['original_only'];
      } else {
        throw new Error('Citát nemá ani originál ani schválený překlad');
      }
    }
    
    const randomIndex = Math.floor(Math.random() * variants.length);
    return variants[randomIndex];
  }

  /**
   * Sestavit text citátu podle vybrané varianty
   */
  buildQuoteText(quote, variant) {
    const author = quote.author ? `\n\n- ${quote.author}` : '';
    
    switch (variant) {
      case 'czech_only':
        // Varianta 1: Pouze český překlad
        return `${quote.translated_text}${author}`;
        
      case 'original_plus_czech':
        // Varianta 2: Originál + český překlad (náhodné formátování)
        return this.formatOriginalPlusTranslation(quote, author);
        
      case 'original_only':
        // Varianta 3: Pouze originál
        return `${quote.original_text}${author}`;
        
      default:
        // Fallback na českou variantu
        return `${quote.translated_text}${author}`;
    }
  }

  /**
   * Formátovat originál + překlad v náhodném stylu
   */
  formatOriginalPlusTranslation(quote, author) {
    // Náhodný výběr formátovacího stylu
    const formats = [
      // Styl 1: "originál" (překlad)
      () => `"${quote.original_text}" (${quote.translated_text})${author}`,
      
      // Styl 2: originál\n\n(překlad)
      () => `${quote.original_text}\n\n(${quote.translated_text})${author}`,
      
      // Styl 3: překlad\n\n— originál
      () => `${quote.translated_text}\n\n— ${quote.original_text}${author}`
    ];
    
    const randomFormat = formats[Math.floor(Math.random() * formats.length)];
    return randomFormat();
  }
}