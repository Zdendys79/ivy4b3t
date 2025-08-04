/**
 * Název souboru: post_utio_g.action.js
 * Umístění: ~/ivy/actions/post_utio_g.action.js
 *
 * Popis: Implementace UTIO post do skupin
 * - Krok za krokem
 * - Bez fallbacků
 * - Minimalistické řešení
 */

import { BasePostAction } from '../libs/base_post_action.class.js';
import { Log } from '../libs/iv_log.class.js';
import { db } from '../iv_sql.js';
import { Wait } from '../libs/iv_wait.class.js';

export class PostUtioGAction extends BasePostAction {
  constructor() {
    super('post_utio_g');
  }

  /**
   * Definuje požadavky akce na služby
   */
  getRequirements() {
    return {
      needsFB: true,
      needsUtio: true
    };
  }

  /**
   * Ověří připravenost akce a správu pracovních dávek
   */
  async verifyReadiness(user, context) {
    // Inicializuj nebo získej pracovní dávku pro uživatele
    await this.initializeBatchSystem(user);
    
    // Zkontroluj zda nepřekračujeme limit dávky
    const canContinue = await this.checkBatchLimit(user);
    if (!canContinue) {
      Log.info(`[${user.id}]`, 'Pracovní dávka dokončena - přeplánuji akci');
      await this.rescheduleFutureAction(user);
      return {
        ready: false,
        reason: 'Pracovní dávka dokončena - akce přeplánována'
      };
    }
    
    return {
      ready: true,
      reason: 'Připraveno'
    };
  }

  /**
   * KROK 0: Vybrat dostupnou skupinu z databáze
   */
  async step0_selectData(user) {
    Log.info(`[${user.id}]`, 'KROK 0: Vybírám dostupnou skupinu z databáze...');
    
    const group = await db.safeQueryFirst('groups.getSingleAvailableGroup', [user.id, 'G']);
    
    if (group) {
      Log.success(`[${user.id}]`, `KROK 0 DOKONČEN: Vybrána skupina ID ${group.id}: ${group.name}`);
    }
    
    return group;
  }

  /**
   * KROK 1: Otevřít Facebook skupinu
   */
  async step1_openFacebook(user, fbBot, group) {
    Log.info(`[${user.id}]`, `KROK 1: Otevírám Facebook skupinu ${group.name}...`);

    // Navigace na Facebook skupinu
    const groupUrl = `https://www.facebook.com/groups/${group.fb_id}`;
    Log.info(`[${user.id}]`, `Naviguji na ${groupUrl}...`);
    
    const pageReady = await fbBot.navigateToPage(groupUrl, {
      waitUntil: 'networkidle2',
      timeout: 30 * 1000 // 30s
    });

    if (!pageReady) {
      throw new Error('Facebook checkpoint detected - cannot continue');
    }

    // Kontrola dostupnosti skupiny
    const pageContent = await fbBot.page.evaluate(() => document.body.textContent);
    if (pageContent.includes('Obsah teď není dostupný')) {
      throw new Error('Group content not available');
    }

    // Jedna lidská pauza
    await Wait.toSeconds(5, 'Po načtení skupiny');

    Log.success(`[${user.id}]`, `KROK 1 DOKONČEN: Jsme ve skupině ${group.name}`);
  }

  /**
   * KROK 2: Kliknout na "Napište něco"
   */
  async step2_clickPostInput(user, fbBot) {
    Log.info(`[${user.id}]`, 'KROK 2: Klikám na "Napište něco"...');

    const clicked = await fbBot.pageAnalyzer.clickElementWithText('Napište něco', { matchType: 'startsWith' });
    
    if (!clicked) {
      throw new Error('Cannot find post input field - page not ready');
    }
    
    Log.success(`[${user.id}]`, 'KROK 2 DOKONČEN: Kliknuto na vstupní pole');
  }

  /**
   * KROK 3: Načíst data z UTIO
   */
  async step3_loadUtioData(user, utioBot) {
    Log.info(`[${user.id}]`, 'KROK 3: Načítám data z UTIO...');
    
    // Přepnout na UTIO záložku
    const frontReady = await utioBot.bringToFront();
    if (!frontReady) {
      throw new Error('Cannot bring UTIO to front');
    }

    // Získat zprávu z UTIO
    const message = await utioBot.getMessage(
      user.portal_id || 1, 
      user.region_id || 5, 
      user.district_id || 0
    );
    
    if (!message || !message.text) {
      throw new Error('No content available from UTIO');
    }

    Log.success(`[${user.id}]`, `KROK 3 DOKONČEN: Načten obsah z UTIO (${message.text.length} znaků)`);
    return message;
  }

  /**
   * KROK 4: Vložit obsah z UTIO do Facebook pole (pomocí schránky)
   */
  async step4_insertContent(user, fbBot, message) {
    Log.info(`[${user.id}]`, 'KROK 4: Vkládám obsah z UTIO...');
    
    const textToInsert = message.text;
    Log.debug(`[${user.id}]`, `Text k vložení: ${textToInsert.substring(0, 50)}...`);
    
    // Zkopírovat text do schránky (vzor z news_post)
    await fbBot.page.evaluate((text) => {
      navigator.clipboard.writeText(text);
    }, textToInsert);
    
    // Malá pauza před vložením
    await Wait.toSeconds(1, 'Před vložením textu');
    
    // Získat délku obsahu PŘED vložením
    const lengthBefore = await fbBot.page.evaluate(() => {
      const input = document.activeElement || document.querySelector('[contenteditable="true"]');
      return input ? (input.innerHTML || input.textContent || input.value || '').length : 0;
    });
    
    // Vložit pomocí Ctrl+V (vzor z news_post)
    await fbBot.page.keyboard.down('Control');
    await fbBot.page.keyboard.press('v');
    await fbBot.page.keyboard.up('Control');
    
    // Kontrola úspěšnosti vložení
    await Wait.toMS(100); // Krátká pauza pro zpracování vložení
    
    const lengthAfter = await fbBot.page.evaluate(() => {
      const input = document.activeElement || document.querySelector('[contenteditable="true"]');
      return input ? (input.innerHTML || input.textContent || input.value || '').length : 0;
    });
    
    const expectedLength = textToInsert.length;
    const actualChange = lengthAfter - lengthBefore;
    
    if (actualChange < expectedLength * 0.8) { // Tolerance 80% délky textu
      await Log.error(`[${user.id}]`, `KROK 4 SELHAL: Text nebyl vložen. Délka před: ${lengthBefore}, po: ${lengthAfter}, očekávaná změna: ~${expectedLength}`);
      throw new Error(`Text insertion failed - content length change too small: ${actualChange}`);
    }
    
    Log.debug(`[${user.id}]`, `Text vložení detekováno: délka ${lengthBefore} → ${lengthAfter} (+${actualChange})`);
    
    // Krátká pauza pro stabilizaci před pokračováním
    await Wait.toSeconds(1, 'Stabilizace po vložení textu');
    
    Log.success(`[${user.id}]`, 'KROK 4 DOKONČEN: Obsah vložen a ověřen');
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
    
    // Ověřit že tlačítko existuje
    const buttonExists = await fbBot.pageAnalyzer.elementExists('Přidat', { 
      matchType: 'exact'
    });
    
    if (!buttonExists) {
      await Log.error(`[${user.id}]`, 'KROK 6 SELHAL: Tlačítko "Přidat" nebylo nalezeno!');
      throw new Error('Button "Přidat" not found on page');
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
    
    // Ověření kliknutí
    await Wait.toSeconds(1, 'Ověření kliknutí');
    
    Log.success(`[${user.id}]`, 'KROK 6 DOKONČEN: Kliknuto na "Přidat"');
  }

  /**
   * KROK 7: Ověřit úspěšné odeslání
   */
  async step7_waitForSuccess(user, fbBot) {
    Log.info(`[${user.id}]`, 'KROK 7: Čekám na potvrzení odeslání...');
    
    // Čekat na dokončení odeslání
    await Wait.toSeconds(10, 'Po kliknutí na Přidat');
    
    // Zkontrolovat zda tlačítko "Přidat" zmizelo
    const visibleTexts = await fbBot.pageAnalyzer.getAvailableTexts({ maxResults: 200 });
    
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
  async handleSuccess(user, group, pickedAction) {
    Log.info(`[${user.id}]`, 'Zpracovávám úspěšné odeslání...');
    
    // Zapsat úspěšnou akci do action_log
    const logDetail = `Group: ${group.name} (${group.fb_id})`;
    await db.safeExecute('actions.logAction', [
      user.id,
      'post_utio_g',
      logDetail,
      group.id
    ]);
    
    // Aktualizuj počítadlo v dávce
    await this.incrementBatchCounter(user);
    
    // Naplánovat další akci
    const minMinutes = pickedAction.min_minutes || 60;
    const maxMinutes = pickedAction.max_minutes || 120;
    const nextMinutes = minMinutes + Math.random() * (maxMinutes - minMinutes);
    
    await db.safeExecute('actions.scheduleNext', [
      Math.round(nextMinutes),
      user.id,
      'post_utio_g'
    ]);
    
    Log.success(`[${user.id}]`, `UTIO post úspěšný! Další akce za ${Math.round(nextMinutes)} minut`);
  }

  /**
   * Zpracovat selhání
   */
  async handleFailure(user, fbBot) {
    await Log.error(`[${user.id}]`, 'UTIO post selhal');
  }

  // ==========================================
  // SYSTÉM PRACOVNÍCH DÁVEK
  // ==========================================

  /**
   * Inicializuje systém pracovních dávek pro uživatele
   */
  async initializeBatchSystem(user) {
    // Zkontroluj zda už existuje dávka pro tohoto uživatele
    if (!global.postUtioBatches) {
      global.postUtioBatches = {};
    }

    if (global.postUtioBatches[user.id]) {
      return; // Dávka už existuje
    }

    // Získej denní limit pro typ "G" z databáze
    let userLimit = await db.safeQueryFirst('limits.getUserLimit', [user.id, 'G']);
    if (!userLimit) {
      Log.warn(`[${user.id}]`, 'Nebyl nalezen denní limit pro typ G - použiji výchozí hodnotu 3');
      // Vytvoř výchozí limit
      await db.safeExecute('limits.upsertLimit', [user.id, 'G', 3, 24]);
      userLimit = { max_posts: 3 };
    }

    // Vypočítej velikost dávky: náhodné číslo mezi 1/5 a 1/2 denního limitu (minimálně 1)
    const minBatchSize = Math.max(1, Math.ceil(userLimit.max_posts / 5));
    const maxBatchSize = Math.max(1, Math.ceil(userLimit.max_posts / 2));
    const batchSize = Math.floor(minBatchSize + Math.random() * (maxBatchSize - minBatchSize + 1));

    // Ulož do global
    global.postUtioBatches[user.id] = {
      batchSize: batchSize,
      currentCount: 0,
      dailyLimit: userLimit.max_posts,
      startedAt: new Date()
    };

    Log.info(`[${user.id}]`, `Inicializována pracovní dávka: ${batchSize} akcí (z denního limitu ${userLimit.max_posts})`);
  }

  /**
   * Zkontroluje zda můžeme pokračovat v dávce
   */
  async checkBatchLimit(user) {
    const batch = global.postUtioBatches[user.id];
    if (!batch) {
      return false; // Nemělo by se stát
    }

    Log.debug(`[${user.id}]`, `Kontrola dávky: ${batch.currentCount}/${batch.batchSize}`);
    
    return batch.currentCount < batch.batchSize;
  }

  /**
   * Zvýší počítadlo v dávce
   */
  async incrementBatchCounter(user) {
    const batch = global.postUtioBatches[user.id];
    if (!batch) {
      return;
    }

    batch.currentCount++;
    Log.debug(`[${user.id}]`, `Dávka aktualizována: ${batch.currentCount}/${batch.batchSize}`);

    // Pokud je dávka dokončena, vymaž ji
    if (batch.currentCount >= batch.batchSize) {
      delete global.postUtioBatches[user.id];
      Log.info(`[${user.id}]`, `Pracovní dávka dokončena (${batch.currentCount}/${batch.batchSize})`);
    }
  }

  /**
   * Přeplánuje akci do budoucnosti podle času
   */
  async rescheduleFutureAction(user) {
    const currentHour = new Date().getHours();
    const isNight = currentHour >= 21 || currentHour < 6;
    
    let hoursToAdd;
    if (isNight) {
      // Noc (21-6h): naplánuj za 8-12h
      hoursToAdd = 8 + Math.random() * 4; // 8-12h
    } else {
      // Den (6-21h): naplánuj za 4-8h  
      hoursToAdd = 4 + Math.random() * 4; // 4-8h
    }

    const futureTime = new Date();
    futureTime.setHours(futureTime.getHours() + hoursToAdd);

    // Aktualizuj v user_action_plan
    await db.safeExecute('actions.scheduleSpecific', [
      futureTime.toISOString().slice(0, 19).replace('T', ' '),
      user.id,
      'post_utio_g'
    ]);

    // Vymaž dokončenou dávku
    if (global.postUtioBatches && global.postUtioBatches[user.id]) {
      delete global.postUtioBatches[user.id];
    }

    const timeInfo = isNight ? 'noc - za 8-12h' : 'den - za 4-8h';
    Log.info(`[${user.id}]`, `Akce post_utio_g přeplánována na ${futureTime.toLocaleString()} (${timeInfo})`);
  }
}