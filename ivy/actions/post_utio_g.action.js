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
import { getHumanBehavior } from '../iv_human_behavior_advanced.js';

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
   * Ověří připravenost akce
   */
  async verifyReadiness(user, context) {
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
   * KROK 3: Otevřít UTIO záložku a načíst data
   */
  async step3_loadUtioData(user, utioBot) {
    Log.info(`[${user.id}]`, 'KROK 3: Načítám data z UTIO...');
    
    // Otevřít UTIO stránku (nebo použít existující záložku)
    const utioReady = await utioBot.ensureUtioPage();
    
    if (!utioReady) {
      throw new Error('Cannot open UTIO page');
    }

    // Načíst data z UTIO stránky
    const utioData = await utioBot.extractCurrentContent();
    
    if (!utioData || !utioData.text) {
      throw new Error('No content available from UTIO');
    }

    Log.success(`[${user.id}]`, `KROK 3 DOKONČEN: Načten obsah z UTIO (${utioData.text.length} znaků)`);
    return utioData;
  }

  /**
   * KROK 4: Vložit obsah z UTIO do Facebook pole
   */
  async step4_insertContent(user, fbBot, utioData) {
    Log.info(`[${user.id}]`, 'KROK 4: Vkládám obsah z UTIO...');
    
    const textToType = utioData.text;
    Log.debug(`[${user.id}]`, `Text k vložení: ${textToType.substring(0, 50)}...`);
    
    // Pokročilé lidské psaní
    const humanBehavior = await getHumanBehavior(user.id);
    await humanBehavior.typeLikeHuman(fbBot.page, textToType, 'utio_posting');
    
    Log.success(`[${user.id}]`, 'KROK 4 DOKONČEN: Obsah vložen');
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
}