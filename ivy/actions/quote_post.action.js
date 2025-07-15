/**
 * Název souboru: quote_post.action.js
 * Umístění: ~/ivy/actions/quote_post.action.js
 *
 * Popis: Quote post akce - publikování citátů na timeline
 * - Implementuje BaseAction
 * - Pouze jedna odpovědnost: publikování citátů
 * - Žádné fallbacky
 */

import { BaseAction } from '../libs/base_action.class.js';
import { Log } from '../libs/iv_log.class.js';
import * as support from '../iv_support.js';

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
   * Ověří připravenost akce - žádné předběžné kontroly
   */
  async verifyReadiness(user, context) {
    return {
      ready: true,
      reason: 'Žádné předběžné verifikace'
    };
  }

  /**
   * Provedení quote post
   */
  async execute(user, context, pickedAction) {
    const { fbBot } = context;

    try {
      Log.info(`[${user.id}]`, 'Začínám psát citát...');

      // Získej citát - jediná kontrola
      const quote = await this.db.getRandomQuote(user.id);
      if (!quote) {
        throw new Error('Žádný vhodný citát k dispozici');
      }

      // Přejdi na homepage
      await this.navigateToHomepage(user, fbBot);

      // Vytvoř text příspěvku
      const postText = `${quote.text}${quote.author ? `\n– ${quote.author}` : ''}`;

      // Napiš citát
      const publishResult = await support.writeMsg(user, postText, fbBot);
      
      // JEDINÁ VERIFIKACE: Zkontroluj zda tlačítko zmizelo = úspěšné odeslání
      if (!publishResult || !publishResult.success) {
        throw new Error('Publikace citátu selhala - tlačítko nezmizelo');
      }

      // Aktualizuj statistiky pouze při úspěchu
      await support.updatePostStats(null, user, this.actionCode);
      await this.db.markQuoteAsUsed(quote.id, user.id);
      await this.logAction(user, null, `Citát: "${quote.text.substring(0, 50)}..."`);

      Log.success(`[${user.id}]`, `✅ Citát úspěšně publikován: "${quote.text.substring(0, 50)}..."`);
      return true;

    } catch (err) {
      await Log.error(`[${user.id}]`, `Chyba při quote post: ${err.message}`);
      return false;
    }
  }

  /**
   * Navigace na FB homepage - bez verifikace URL
   */
  async navigateToHomepage(user, fbBot) {
    Log.info(`[${user.id}]`, 'Naviguji na FB homepage...');

    await fbBot.page.goto('https://www.facebook.com/', {
      waitUntil: 'domcontentloaded',
      timeout: this.config.get('action_timeout_minutes', 5) * 60 * 1000
    });

    await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));

    // Reinicializace analyzátoru pro novou stránku
    fbBot.initializeAnalyzer();

    Log.success(`[${user.id}]`, 'Navigace na FB homepage dokončena');
  }
}