/**
 * Název souboru: post_utio_g.action.js
 * Umístění: ~/ivy/actions/post_utio_g.action.js
 *
 * Popis: Implementace UTIO post do skupin
 * - Podle vzoru quote_post.action.js
 * - Krok za krokem
 * - Bez fallbacků
 * - Minimalistické řešení
 * - Systém pracovních dávek
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
   * KROK 1: Otevřít Facebook skupinu (overridden z BasePostAction)
   */
  async step1_openFacebook(user, fbBot, group) {
    Log.info(`[${user.id}]`, `KROK 1: Otevírám Facebook skupinu ${group.name}...`);

    // Přepnout na Facebook záložku (UTIO zůstává navrchu po inicializaci)
    const fbFrontReady = await fbBot.bringToFront();
    if (!fbFrontReady) {
      throw new Error('Cannot bring Facebook to front at start');
    }

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
   * Override execute pro předání utioBot
   */
  async execute(user, context, pickedAction) {
    const { fbBot, utioBot } = context;
    let data = null; // Definovat data pro celou funkci

    try {
      Log.info(`[${user.id}]`, `Spouštím post_utio_g...`);

      // Kontrola připravenosti a správy dávek
      const readiness = await this.verifyReadiness(user, context);
      if (!readiness.ready) {
        Log.info(`[${user.id}]`, `Akce přeskočena: ${readiness.reason}`);
        return false;
      }

      // KROK 0: Vybrat data z databáze (abstract)
      data = await this.step0_selectData(user);
      if (!data) {
        await Log.error(`[${user.id}]`, 'Žádná dostupná data pro uživatele');
        return false;
      }

      // KROK 1: Otevřít prohlížeč na stránce facebook.com
      await this.step1_openFacebook(user, fbBot, data);

      // KROK 2: Kliknout na "Co se vám honí hlavou"
      await this.step2_clickPostInput(user, fbBot);

      // KROK 3: Vložit obsah (abstract)
      await this.step3_insertContent(user, fbBot, data, utioBot);

      // KROK 4: Krátká pauza na kontrolu
      await this.step4_pauseForReview(user);

      // KROK 5: Kliknout na tlačítko "Přidat"
      await this.step5_clickSubmit(user, fbBot);

      // KROK 6: Ověřit úspěšné odeslání
      const success = await this.step6_waitForSuccess(user, fbBot);

      // KROK 7: Zpracovat výsledek
      if (success) {
        await this.handleSuccess(user, data, pickedAction);
        return true;
      } else {
        await this.handleFailure(user, fbBot, data);
        return false;
      }

    } catch (err) {
      await Log.error(`[${user.id}]`, `Chyba při post_utio_g: ${err.message}`);
      
      // Pokud se pokusilo o skupinu, zablokuj ji
      if (data) {
        await this.handleFailure(user, fbBot, data);
      }
      
      return false;
    }
  }

  /**
   * KROK 3: Načíst a vložit obsah z UTIO
   */
  async step3_insertContent(user, fbBot, data, utioBot) {
    Log.info(`[${user.id}]`, 'KROK 3: Načítám a vkládám obsah z UTIO...');
    
    if (!utioBot) {
      throw new Error('UtioBot není k dispozici');
    }

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
    
    if (!message || !message.length) {
      throw new Error('No content available from UTIO');
    }

    // Převeď na text
    const textToInsert = Array.isArray(message) ? message.join('\n') : message;
    Log.debug(`[${user.id}]`, `Text k vložení: ${textToInsert.substring(0, 50)}...`);
    
    // Vrátit se na Facebook záložku
    const fbFrontReady = await fbBot.bringToFront();
    if (!fbFrontReady) {
      throw new Error('Cannot bring Facebook to front');
    }
    
    // Zkopírovat text do schránky
    await fbBot.page.evaluate((text) => {
      navigator.clipboard.writeText(text);
    }, textToInsert);
    
    // Malá pauza před vložením
    await Wait.toSeconds(1);
    
    // Vložit pomocí Ctrl+V
    await fbBot.page.keyboard.down('Control');
    await fbBot.page.keyboard.press('v');
    await fbBot.page.keyboard.up('Control');
    
    // Krátká pauza pro stabilizaci
    await Wait.toSeconds(1);
    
    Log.success(`[${user.id}]`, 'KROK 3 DOKONČEN: Obsah z UTIO vložen');
  }

  /**
   * KROK 5: Kliknout na "Zveřejnit" (override z BasePostAction)
   */
  async step5_clickSubmit(user, fbBot) {
    Log.info(`[${user.id}]`, 'KROK 5: Klikám na tlačítko "Zveřejnit"...');
    
    const clicked = await fbBot.pageAnalyzer.clickElementWithText('Zveřejnit', { matchType: 'exact' });
    
    if (!clicked) {
      throw new Error('Failed to publish post - "Zveřejnit" button not found');
    }
    
    Log.success(`[${user.id}]`, 'KROK 5 DOKONČEN: Kliknuto na "Zveřejnit"');
  }

  /**
   * KROK 6: Ověřit úspěšné odeslání (override z BasePostAction)
   */
  async step6_waitForSuccess(user, fbBot) {
    Log.info(`[${user.id}]`, 'KROK 6: Ověřujem úspěšné odeslání příspěvku...');
    
    // Počkat na reakci po kliknutí
    await Wait.toSeconds(3);
    
    const visibleTexts = await fbBot.pageAnalyzer.getAvailableTexts({ maxResults: 200 });
    
    // 1. Kontrola zmizení tlačítka "Zveřejnit" (hlavní indikátor)
    const publishButtonVisible = visibleTexts.some(text => 
      text === 'Zveřejnit' || text.includes('Zveřejnit')
    );
    
    // 2. Hledat pozitivní indikátory úspěchu
    const successIndicators = [
      'Váš příspěvek byl zveřejněn',
      'příspěvek byl publikován',
      'před chvílí',
      'před několika sekundami',
      'teď'
    ];
    
    const hasSuccessIndicator = visibleTexts.some(text => 
      successIndicators.some(indicator => text.toLowerCase().includes(indicator.toLowerCase()))
    );
    
    if (!publishButtonVisible || hasSuccessIndicator) {
      Log.success(`[${user.id}]`, 'KROK 6 ÚSPĚCH: Příspěvek byl úspěšně odeslán');
      return true;
    } else {
      await Log.error(`[${user.id}]`, 'KROK 6 SELHAL: Tlačítko "Zveřejnit" je stále viditelné - příspěvek nebyl odeslán');
      return false;
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
      group.id,      // reference_id (krátké)
      logDetail      // text (dlouhé)
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
  async handleFailure(user, fbBot, group) {
    await Log.error(`[${user.id}]`, 'UTIO post selhal');
    
    if (group) {
      // Zablokovat skupinu pro uživatele na 24 hodin
      const blockUntil = new Date();
      blockUntil.setHours(blockUntil.getHours() + 24);
      
      await db.safeExecute('userGroupBlocking.blockUserGroup', [
        blockUntil.toISOString().slice(0, 19).replace('T', ' '),
        'UTIO post failed - Facebook checkpoint or other issue',
        user.id,
        group.id
      ]);
      
      Log.info(`[${user.id}]`, `Skupina ${group.name} (${group.id}) zablokována kvůli selhání`);
    }
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