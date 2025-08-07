/**
 * Název souboru: base_utio_post_action.class.js
 * Umístění: ~/ivy/libs/base_utio_post_action.class.js
 *
 * Popis: Společná base třída pro UTIO postovací akce (post_utio_g, post_utio_gv)
 * - Sdílená logika pro všechny UTIO akce
 * - Parametrizovatelné rozdíly (typ skupiny, název akce)
 * - Systém pracovních dávek
 * - Facebook a UTIO integrace
 */

import { BasePostAction } from './base_post_action.class.js';
import { Log } from './iv_log.class.js';
import { db } from '../iv_sql.js';
import { Wait } from './iv_wait.class.js';

export class BaseUtioPostAction extends BasePostAction {
  constructor(actionName, groupType) {
    super(actionName);
    this.groupType = groupType;
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
    
    const group = await db.safeQueryFirst('groups.getSingleAvailableGroup', [user.id, this.groupType]);
    
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

    // Navigace na Facebook skupinu - s kontrolou buy_sell
    let groupUrl = `https://www.facebook.com/groups/${group.fb_id}`;
    if (group.is_buy_sell_group === 1) {
      groupUrl += '/buy_sell_discussion';
      Log.info(`[${user.id}]`, `Skupina je buy_sell - přidávám /buy_sell_discussion`);
    }
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
   * KROK 2: Pokus o postování s workflow buy_sell skupin
   */
  async step2_clickPostInput(user, fbBot, group) {
    Log.info(`[${user.id}]`, 'KROK 2: Klikám na "Napište něco"...');

    // Krok 4.1: Pokus o "Napište něco"
    const postClicked = await fbBot.pageAnalyzer.clickElementWithText('Napište něco', { matchType: 'startsWith' });
    
    if (postClicked) {
      Log.success(`[${user.id}]`, 'KROK 2 DOKONČEN: Kliknuto na vstupní pole');
      return;
    }

    // Krok 4.2: "Napište něco" neexistuje - zkusit "Diskuze"
    Log.info(`[${user.id}]`, '"Napište něco" nenalezeno - zkouším "Diskuze"...');
    const discussionClicked = await fbBot.pageAnalyzer.clickElementWithText('Diskuze');
    
    if (discussionClicked) {
      Log.info(`[${user.id}]`, '"Diskuze" stisknuto - označuji skupinu jako buy_sell a čekám 5s');
      
      // Označit skupinu jako buy_sell v databázi
      await db.safeExecute('groups.updateBuySellFlag', [1, group.id]);
      
      // Počkat 5 sekund
      await Wait.toSeconds(5, 'Po kliknutí na Diskuze');
      
      // Krok 5: Druhý pokus o "Napište něco"
      Log.info(`[${user.id}]`, 'Druhý pokus o "Napište něco"...');
      const secondPostClicked = await fbBot.pageAnalyzer.clickElementWithText('Napište něco', { matchType: 'startsWith' });
      
      if (secondPostClicked) {
        Log.success(`[${user.id}]`, 'KROK 2 DOKONČEN: Kliknuto na vstupní pole (druhý pokus)');
        return;
      }
      
      // Třetí pokus - "Přidat se ke skupině" (s cooldown kontrolou)
      Log.info(`[${user.id}]`, 'Druhý pokus o "Napište něco" selhal - zkouším "Přidat se ke skupině"...');
      
      // Kontrola cooldown před pokusem o join
      const canJoin = await this._checkGroupJoinCooldown(user);
      if (!canJoin.allowed) {
        Log.warn(`[${user.id}]`, `Join cooldown aktivní - zbývá ${canJoin.minutesRemaining} minut`);
        throw new Error(`Group join cooldown active - ${canJoin.minutesRemaining} minutes remaining`);
      }
      
      const joinClicked = await fbBot.pageAnalyzer.clickElementWithText('Přidat se ke skupině');
      if (joinClicked) {
        // Aktualizuj timestamp při úspěšném joinu
        await db.safeExecute('users.updateLastGroupJoin', [user.id]);
        Log.info(`[${user.id}]`, 'Úspěšně kliknuto na "Přidat se ke skupině" - cooldown nastaven');
      }
    }

    // Nic nefunguje - zablokovat skupinu a skončit
    throw new Error('Cannot find post input field or discussion - blocking group');
  }

  /**
   * Override execute pro předání utioBot
   */
  async execute(user, context, pickedAction) {
    const { fbBot, utioBot } = context;
    let data = null; // Definovat data pro celou funkci

    try {
      Log.info(`[${user.id}]`, `Spouštím ${this.actionCode}...`);

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
      await this.step2_clickPostInput(user, fbBot, data);

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
      await Log.error(`[${user.id}]`, `Chyba při ${this.actionCode}: ${err.message}`);
      
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

    // Převeď na text a přidej mezeru na konec
    const textToInsert = (Array.isArray(message) ? message.join('\n') : message) + ' ';
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
    
    // Počkat na reakci po kliknutí (větší pauza pro UTIO)
    await Wait.toSeconds(12);
    
    Log.success(`[${user.id}]`, 'KROK 5 DOKONČEN: Kliknuto na "Zveřejnit"');
  }

  /**
   * KROK 6: Ověřit úspěšné odeslání (override z BasePostAction)
   */
  async step6_waitForSuccess(user, fbBot) {
    Log.info(`[${user.id}]`, 'KROK 6: Ověřujem úspěšné odeslání příspěvku...');
    
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
      this.actionCode,
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
      this.actionCode
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
        user.id,
        group.id,
        blockUntil.toISOString().slice(0, 19).replace('T', ' '),
        'UTIO post failed - Facebook checkpoint or other issue'
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
    // Zkontroluj zda už existuje sloučený objekt pro všechny UTIO dávky
    if (!global.utioBatches) {
      global.utioBatches = {};
    }

    // Klíč je kombinace user.id a groupType
    const batchKey = `${user.id}_${this.groupType}`;
    if (global.utioBatches[batchKey]) {
      return; // Dávka už existuje
    }

    // Získej denní limit pro typ z databáze
    let userLimit = await db.safeQueryFirst('limits.getUserLimit', [user.id, this.groupType]);
    if (!userLimit) {
      Log.warn(`[${user.id}]`, `Nebyl nalezen denní limit pro typ ${this.groupType} - použiji výchozí hodnotu 3`);
      // Vytvoř výchozí limit
      await db.safeExecute('limits.upsertLimit', [user.id, this.groupType, 3, 24]);
      userLimit = { max_posts: 3 };
    }

    // Vypočítej velikost dávky: náhodné číslo mezi 1/5 a 1/2 denního limitu (minimálně 1)
    const minBatchSize = Math.max(1, Math.ceil(userLimit.max_posts / 5));
    const maxBatchSize = Math.max(1, Math.ceil(userLimit.max_posts / 2));
    const batchSize = Math.floor(minBatchSize + Math.random() * (maxBatchSize - minBatchSize + 1));

    // Ulož do global sloučeného objektu
    global.utioBatches[batchKey] = {
      batchSize: batchSize,
      currentCount: 0,
      dailyLimit: userLimit.max_posts,
      startedAt: new Date(),
      userId: user.id,
      groupType: this.groupType
    };

    Log.info(`[${user.id}]`, `Inicializována pracovní dávka: ${batchSize} akcí (z denního limitu ${userLimit.max_posts})`);
  }

  /**
   * Zkontroluje zda můžeme pokračovat v dávce
   */
  async checkBatchLimit(user) {
    const batchKey = `${user.id}_${this.groupType}`;
    const batch = global.utioBatches?.[batchKey];
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
    const batchKey = `${user.id}_${this.groupType}`;
    const batch = global.utioBatches?.[batchKey];
    if (!batch) {
      return;
    }

    batch.currentCount++;
    Log.debug(`[${user.id}]`, `Dávka aktualizována: ${batch.currentCount}/${batch.batchSize}`);

    // Pokud je dávka dokončena, vymaž ji
    if (batch.currentCount >= batch.batchSize) {
      delete global.utioBatches[batchKey];
      Log.info(`[${user.id}]`, `Pracovní dávka ${this.groupType} dokončena (${batch.currentCount}/${batch.batchSize})`);
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
      this.actionCode
    ]);

    // Vymaž dokončenou dávku
    const batchKey = `${user.id}_${this.groupType}`;
    if (global.utioBatches && global.utioBatches[batchKey]) {
      delete global.utioBatches[batchKey];
    }

    const timeInfo = isNight ? 'noc - za 8-12h' : 'den - za 4-8h';
    Log.info(`[${user.id}]`, `Akce ${this.actionCode} přeplánována na ${futureTime.toLocaleString()} (${timeInfo})`);
  }

  /**
   * Zkontroluje zda může uživatel použít "Přidat se ke skupině"
   */
  async _checkGroupJoinCooldown(user) {
    try {
      // Získej cooldown z variables
      const cooldownHours = await db.getVariable('join_cooldown_hours', 6);
      
      // Zkontroluj poslední join
      const result = await db.safeQueryFirst('users.canJoinGroup', [
        cooldownHours, 
        cooldownHours, 
        user.id
      ]);
      
      if (!result) {
        return { allowed: true, minutesRemaining: 0 };
      }
      
      return {
        allowed: result.can_join === 1,
        minutesRemaining: Math.max(0, -result.minutes_remaining)
      };
    } catch (err) {
      Log.error(`[${user.id}]`, `Chyba při kontrole join cooldown: ${err.message}`);
      return { allowed: true, minutesRemaining: 0 }; // V případě chyby povolit
    }
  }
}