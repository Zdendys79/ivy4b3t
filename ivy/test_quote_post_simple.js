/**
 * Test pro jednoduchou quote_post akci
 * Testuje krok 1: otevření prohlížeče na facebook.com
 */

import { QuotePostSimpleAction } from './actions/quote_post_simple.action.js';
import { BrowserManager } from './libs/iv_browser_manager.class.js';
import { FBBot } from './libs/iv_fbbot.class.js';
import { Log } from './libs/iv_log.class.js';
import { db } from './iv_sql.js';

async function testQuotePostStep1() {
  let browser = null;
  let fbBot = null;
  
  try {
    // Získat testovacího uživatele
    const user = await db.getUserById(1); // nebo jiné user ID
    if (!user) {
      throw new Error('Uživatel nenalezen');
    }

    Log.info(`[TEST]`, `Testuji quote_post krok 1 pro uživatele ${user.id}`);

    // Otevřít prohlížeč
    const browserManager = new BrowserManager();
    const browserData = await browserManager.openForUser(user);
    browser = browserData.instance;

    // Vytvořit FBBot
    fbBot = new FBBot(user, browser);
    await fbBot.init();

    // Vytvořit kontext pro akci
    const context = {
      fbBot: fbBot,
      browser: browser
    };

    // Spustit akci
    const action = new QuotePostSimpleAction();
    const result = await action.execute(user, context, {});

    if (result) {
      Log.success('[TEST]', 'Test kroku 1 úspěšně dokončen!');
    } else {
      Log.error('[TEST]', 'Test kroku 1 selhal');
    }

  } catch (err) {
    await Log.error('[TEST]', `Chyba při testu: ${err.message}`);
  } finally {
    // Uklidit
    if (fbBot) {
      await fbBot.close();
    }
    if (browser && browser.isConnected()) {
      await browser.close();
    }
    
    // Ukončit databázi
    await db.end();
  }
}

// Spustit test
testQuotePostStep1().catch(console.error);