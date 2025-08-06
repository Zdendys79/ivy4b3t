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
    
    // Vybrat a uložit náhodnou variantu zobrazení
    quote._usedVariant = this.selectDisplayVariant(quote);
    Log.debug(`[${user.id}]`, `Vybrána varianta: ${quote._usedVariant}`);
    
    // Sestavit text podle varianty
    const textToType = this.buildQuoteText(quote, quote._usedVariant);
    Log.debug(`[${user.id}]`, `Text k napsání: ${textToType.substring(0, 50)}...`);
    
    // Pokročilé lidské psaní
    const humanBehavior = await getHumanBehavior(user.id);
    await humanBehavior.typeLikeHuman(fbBot.page, textToType, 'quote_writing');
    
    Log.success(`[${user.id}]`, `KROK 3 DOKONČEN: Citát napsán (varianta: ${quote._usedVariant})`);
  }

  /**
   * Vybrat náhodnou variantu zobrazení citátu
   */
  selectDisplayVariant(quote) {
    // Pokud není originální text, chyba
    if (!quote.original_text) {
      return 'original_only';
    }
    
    // Pokud má překlad, ale není schválený - použij pouze originál
    if (quote.translated_text && !quote.translation_approved) {
      return 'original_only';
    }
    
    // Pokud je to český citát, zobraz originál (česky)
    if (quote.language_code === 'ces' || quote.language_code === 'svk') {
      return 'original_only';
    }
    
    // Cizí jazyk - pokud má schválený překlad, všechny varianty možné
    const variants = (quote.translated_text && quote.translation_approved) ? 
      ['czech_only', 'original_plus_czech', 'original_only'] : 
      ['original_only'];
    
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
   * Náhodné formátování originál + překlad
   */
  formatOriginalPlusTranslation(quote, author) {
    const original = quote.original_text;
    const translation = quote.translated_text;
    
    // 24 různých zábavných variant formátování!
    const formats = [
      // ORIGINÁL PRVNÍ - klasické varianty:
      // 1. Klasické uvozovky
      () => `"${original}"\n\n${translation}${author}`,
      
      // 2. S pomlčkou
      () => `${original}\n\n- ${translation}${author}`,
      
      // 3. Překlad v závorkách
      () => `${original}\n\n(${translation})${author}`,
      
      // 4. Hvězdičky kolem překladu
      () => `${original}\n\n*${translation}*${author}`,
      
      // 5. S šipkou
      () => `${original}\n\n→ ${translation}${author}`,
      
      // 6. ASCII dekorace
      () => `${original}\n\n~ ${translation} ~${author}`,
      
      // ORIGINÁL PRVNÍ - kreativní varianty:
      // 7. S dvojtečkou jako "vysvětlení"
      () => `${original}\n\n: ${translation}${author}`,
      
      // 8. ASCII rámečky
      () => `${original}\n\n[ ${translation} ]${author}`,
      
      // 9. Tři tečky jako pokračování
      () => `${original}...\n\n${translation}${author}`,
      
      // 10. Plus jako "a také"
      () => `${original}\n\n+ ${translation}${author}`,
      
      // 11. Vertikální čára
      () => `${original}\n\n| ${translation}${author}`,
      
      // 12. Equals jako "znamená"
      () => `${original}\n\n= ${translation}${author}`,
      
      // PŘEKLAD PRVNÍ (česká verze první):
      // 13. Překlad první s pomlčkou k originálu
      () => `${translation}\n\n- ${original}${author}`,
      
      // 14. Překlad první, originál v uvozovkách
      () => `${translation}\n\n"${original}"${author}`,
      
      // 15. Překlad první, originál v závorkách
      () => `${translation}\n\n(${original})${author}`,
      
      // 16. Překlad s hvězdičkami, originál normálně
      () => `*${translation}*\n\n${original}${author}`,
      
      // 17. Překlad první s šipkou zpět
      () => `${translation}\n\n← ${original}${author}`,
      
      // 18. Překlad první s tildy
      () => `~ ${translation} ~\n\n${original}${author}`,
      
      // PŘEKLAD PRVNÍ - kreativní varianty:
      // 19. Jako původní myšlenka
      () => `${translation}\n\n(původně: ${original})${author}`,
      
      // 20. Jako vysvětlení
      () => `${translation}\n\n...${original}${author}`,
      
      // 21. V hranatých závorkách jako poznámka
      () => `${translation}\n\n[${original}]${author}`,
      
      // 22. S dvojtečkou jako zdroj
      () => `${translation}\n\n: "${original}"${author}`,
      
      // 23. Jako alternativa
      () => `${translation}\n\n/ ${original}${author}`,
      
      // 24. Retro styl s >> <<
      () => `>> ${translation} <<\n\n${original}${author}`
    ];
    
    // Náhodný výběr formátu
    const randomFormat = formats[Math.floor(Math.random() * formats.length)];
    return randomFormat();
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
    
    // Zaznamenat původní URL před čekáním
    const originalUrl = fbBot.page.url();
    
    // Po kliknutí na Přidat čekat až 10 sekund 
    await Wait.toSeconds(10, 'Po kliknutí na Přidat');
    
    // Zkontrolovat více indikátorů úspěchu
    const currentUrl = fbBot.page.url();
    const visibleTexts = await fbBot.pageAnalyzer.getAvailableTexts({ maxResults: 200 });
    
    // 1. Změna URL může indikovat přesměrování po úspěšném odeslání
    const urlChanged = currentUrl !== originalUrl;
    
    // 2. Hledat pozitivní zprávy o úspěchu
    const successIndicators = visibleTexts.filter(text => 
      text.includes('váš příspěvek') || 
      text.includes('publikovat') ||
      text.includes('sdílet') ||
      text.includes('příspěvek byl') ||
      text.toLowerCase().includes('success') ||
      text.includes('hotovo') ||
      text.includes('dokončeno')
    );
    
    // 3. Hledat tlačítko "Přidat" (záložní kontrola)
    const submitButtonVisible = visibleTexts.some(text => 
      text === 'Přidat' || text.includes('Přidat')
    );
    
    // Vyhodnotit úspěch podle kombinace faktorů
    const hasSuccessSignals = urlChanged || successIndicators.length > 0;
    const noFailureSignals = !submitButtonVisible;
    
    if (hasSuccessSignals || noFailureSignals) {
      Log.info(`[${user.id}]`, `KROK 7 ÚSPĚCH: Příspěvek byl pravděpodobně odeslán (URL změna: ${urlChanged}, úspěšné indikátory: ${successIndicators.length}, tlačítko Přidat: ${submitButtonVisible ? 'viditelné' : 'skryté'})`);
      return true;
    } else {
      await Log.error(`[${user.id}]`, `KROK 7 SELHAL: Příspěvek nebyl odeslán - žádné pozitivní indikátory`);
      Log.debug(`[${user.id}]`, `Debug info: URL ${originalUrl} → ${currentUrl}, indikátory: ${successIndicators.join(', ')}`);
      return false;
    }
  }

  /**
   * Zpracovat úspěch
   */
  async handleSuccess(user, quote, pickedAction) {
    Log.info(`[${user.id}]`, 'Zpracovávám úspěšné odeslání...');
    
    // Nastavit timeout citátu na 30 dní
    await db.safeExecute('quotes.markAsUsed', [30, quote.id]);
    
    // Získat skutečně použitou variantu
    const variant = quote._usedVariant || 'czech_only';
    
    // Zapsat úspěšnou akci do action_log s detaily
    const logDetail = `Quote ID: ${quote.id}, Lang: ${quote.language_code || 'ces'}, Variant: ${variant}`;
    await db.safeExecute('actions.logAction', [
      user.id,
      'quote_post',
      logDetail,
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