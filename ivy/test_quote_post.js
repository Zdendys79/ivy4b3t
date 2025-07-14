/**
 * Název souboru: test_quote_post.js
 * Umístění: ~/ivy/test_quote_post.js
 *
 * Popis: Testovací soubor pro akci quote_post (citování příspěvků)
 */

import { IvDb } from './libs/iv_db.class.js';
import { IvFb } from './libs/iv_fb.class.js';
import { IvUtio } from './libs/iv_utio.class.js';
import { IvActions } from './libs/iv_actions.class.js';
import { Log } from './libs/iv_log.class.js';
import { wait } from './libs/iv_support.js';
import { TEST_QUERIES } from './sql/queries/test_queries.js';

class QuotePostTest {
  constructor() {
    this.db = null;
    this.fbBot = null;
    this.utioBot = null;
    this.actions = null;
    this.testUser = null;
    this.hostname = null;
  }

  async init() {
    try {
      // Inicializace databáze
      this.db = new IvDb();
      await this.db.connect();

      // Inicializace akcí
      this.actions = new IvActions();
      await this.actions.init();

      // Získání hostname
      const hostnameResult = await this.db.query(TEST_QUERIES.getCurrentHostname);
      this.hostname = hostnameResult[0]?.hostname || 'test-host';

      // Výběr uživatele pro test
      this.testUser = await this.selectTestUser();
      if (!this.testUser) {
        throw new Error('Žádný vhodný uživatel pro test quote_post');
      }

      await Log.info('[TEST]', `Vybrán uživatel pro test: ${this.testUser.name} ${this.testUser.surname} (ID: ${this.testUser.id})`);

      // Inicializace botů
      this.fbBot = new IvFb(this.testUser);
      this.utioBot = new IvUtio(this.testUser);

      return true;
    } catch (error) {
      await Log.error('[TEST]', `Chyba při inicializaci testu: ${error.message}`);
      return false;
    }
  }

  async selectTestUser() {
    try {
      const users = await this.db.query(TEST_QUERIES.getUserForActionTest, [
        'quote_post',
        this.hostname,
        this.hostname
      ]);

      return users.length > 0 ? users[0] : null;
    } catch (error) {
      await Log.error('[TEST]', `Chyba při výběru uživatele: ${error.message}`);
      return null;
    }
  }

  async runTest() {
    const startTime = Date.now();
    let success = false;
    let errorMessage = '';

    try {
      await Log.info('[TEST]', '🚀 Spouštím test quote_post akce');

      // 1. Inicializace FB bota
      await Log.info('[TEST]', '1. Inicializace Facebook bota...');
      const fbInitialized = await this.fbBot.init();
      if (!fbInitialized) {
        throw new Error('Nepodařilo se inicializovat FB bot');
      }

      // 2. Inicializace UTIO bota
      await Log.info('[TEST]', '2. Inicializace UTIO bota...');
      const utioInitialized = await this.utioBot.init();
      if (!utioInitialized) {
        throw new Error('Nepodařilo se inicializovat UTIO bot');
      }

      // 3. Získání random článku z UTIO
      await Log.info('[TEST]', '3. Získávám náhodný článek z UTIO...');
      const article = await this.utioBot.getRandomArticle();
      if (!article) {
        throw new Error('Nepodařilo se získat článek z UTIO');
      }
      await Log.info('[TEST]', `Získán článek: ${article.title}`);

      // 4. Navigace na FB timeline
      await Log.info('[TEST]', '4. Navigace na Facebook timeline...');
      await this.fbBot.goToTimeline();
      await wait.delay(2000);

      // 5. Vytvoření citovaného příspěvku
      await Log.info('[TEST]', '5. Vytváření citovaného příspěvku...');
      const quoteText = this.createQuoteText(article);
      const posted = await this.fbBot.postToTimeline(quoteText);
      
      if (!posted) {
        throw new Error('Nepodařilo se vytvořit příspěvek na timeline');
      }

      await Log.info('[TEST]', '✅ Quote post test úspěšně dokončen');
      success = true;

    } catch (error) {
      errorMessage = error.message;
      await Log.error('[TEST]', `❌ Quote post test selhal: ${errorMessage}`);
      success = false;
    }

    // Logování výsledku testu
    const duration = Date.now() - startTime;
    const note = `TEST: quote_post - ${success ? 'SUCCESS' : 'FAILED'} - ${duration}ms${errorMessage ? ` - ${errorMessage}` : ''}`;
    
    await this.db.query(TEST_QUERIES.logTestAction, [
      this.testUser.id,
      'quote_post',
      null,
      note,
      this.hostname
    ]);

    return { success, duration, errorMessage };
  }

  createQuoteText(article) {
    const quotes = [
      `"${article.title}"\n\nZajímavý článek o ${article.category || 'aktuálním tématu'}. Co si o tom myslíte?`,
      `Četl jsem právě: "${article.title}"\n\nStojí za zamyšlení...`,
      `"${article.title}"\n\nTento článek mě zaujal. Jak to vidíte vy?`,
      `Zajímavé čtení: "${article.title}"\n\nDoporučuji k přečtení.`,
      `"${article.title}"\n\nAktuální téma, které určitě stojí za pozornost.`
    ];

    return quotes[Math.floor(Math.random() * quotes.length)];
  }

  async cleanup() {
    try {
      if (this.fbBot) {
        await this.fbBot.close();
      }
      if (this.utioBot) {
        await this.utioBot.close();
      }
      if (this.db) {
        await this.db.close();
      }
      await Log.info('[TEST]', 'Test cleanup dokončen');
    } catch (error) {
      await Log.error('[TEST]', `Chyba při cleanup: ${error.message}`);
    }
  }
}

// Spuštění testu
async function runQuotePostTest() {
  const test = new QuotePostTest();
  
  try {
    await Log.info('[TEST]', '=== QUOTE POST TEST START ===');
    
    const initialized = await test.init();
    if (!initialized) {
      await Log.error('[TEST]', 'Test se nepodařilo inicializovat');
      return;
    }

    const result = await test.runTest();
    
    await Log.info('[TEST]', `=== QUOTE POST TEST END ===`);
    await Log.info('[TEST]', `Výsledek: ${result.success ? 'ÚSPĚCH' : 'SELHÁNÍ'}`);
    await Log.info('[TEST]', `Doba trvání: ${result.duration}ms`);
    
    if (!result.success) {
      await Log.error('[TEST]', `Chyba: ${result.errorMessage}`);
    }

  } catch (error) {
    await Log.error('[TEST]', `Kritická chyba testu: ${error.message}`);
  } finally {
    await test.cleanup();
  }
}

// Spuštění, pokud je soubor volán přímo
if (import.meta.url === `file://${process.argv[1]}`) {
  runQuotePostTest();
}

export { QuotePostTest, runQuotePostTest };