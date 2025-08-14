/**
 * Název souboru: stories_view.action.js
 * Umístění: ~/ivy/actions/stories_view.action.js
 *
 * Popis: Stories view akce - prohlížení FB Stories
 * - Neinvazivní aktivita pro přirozené chování
 * - Simuluje lidské prohlížení stories přátel
 * - Žádné reakce nebo interakce, pouze konzumace obsahu
 */

import { BaseAction } from '../libs/base_action.class.js';
import { Log } from '../libs/iv_log.class.js';
import { Wait } from '../libs/iv_wait.class.js';

export class StoriesViewAction extends BaseAction {
  constructor() {
    super('stories_view');
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
    const { fbBot } = context;
    
    if (!fbBot) {
      return {
        ready: false,
        reason: 'Chybí FBBot instance',
        critical: true
      };
    }

    return {
      ready: true,
      reason: 'Akce je připravena'
    };
  }

  /**
   * Provedení stories viewing
   */
  async execute(user, context, pickedAction) {
    const { fbBot } = context;

    try {
      Log.info(`[${user.id}]`, '👀 Spouštím prohlížení Stories...');

      // Přenést FB záložku na popředí
      await fbBot.bringToFront();

      // Přejít na hlavní Facebook stránku
      await fbBot.navigateToPage('https://www.facebook.com', { 
        waitUntil: 'networkidle2' 
      });
      await Wait.toSeconds(3, 'Načtení hlavní stránky');

      // Najít stories sekci
      const storiesFound = await this.findStoriesSection(user, fbBot);
      if (!storiesFound) {
        Log.info(`[${user.id}]`, 'Stories sekce nenalezena - ukončuji bez chyby');
        return true;
      }

      // Prohlížet náhodný počet stories (2-5)
      const storiesToView = Math.floor(Math.random() * 4) + 2; // 2-5 stories
      const viewedCount = await this.viewRandomStories(user, fbBot, storiesToView);

      Log.success(`[${user.id}]`, `Stories viewing dokončen - prohlédnuto ${viewedCount} stories`);
      return true;

    } catch (err) {
      await Log.error(`[${user.id}]`, `Chyba při prohlížení Stories: ${err.message}`);
      return false;
    }
  }

  /**
   * Najde stories sekci na Facebook stránce
   */
  async findStoriesSection(user, fbBot) {
    try {
      // Hledání stories kontejneru - různé možné selektory
      const storiesSelectors = [
        '[aria-label*="Stories"]',
        '[data-pagelet="Stories"]', 
        '.stories_tray',
        '[role="main"] [data-testid*="story"]',
        'div[data-pagelet="Stories"] div[role="button"]'
      ];

      for (const selector of storiesSelectors) {
        const found = await fbBot.page.$(selector);
        if (found) {
          Log.debug(`[${user.id}]`, `Stories sekce nalezena: ${selector}`);
          return true;
        }
      }

      Log.info(`[${user.id}]`, 'Stories sekce nenalezena na stránce');
      return false;

    } catch (err) {
      await Log.warn(`[${user.id}]`, `Chyba při hledání stories: ${err.message}`);
      return false;
    }
  }

  /**
   * Prohlíží náhodný počet stories
   */
  async viewRandomStories(user, fbBot, targetCount) {
    let viewedCount = 0;

    try {
      // Najdi všechny dostupné story prvky
      const storyElements = await fbBot.page.$$('[role="button"][aria-label*="story" i], [role="button"][aria-label*="Story" i], div[data-pagelet="Stories"] div[role="button"]');
      
      if (storyElements.length === 0) {
        Log.info(`[${user.id}]`, 'Žádné story prvky nenalezeny');
        return 0;
      }

      Log.info(`[${user.id}]`, `Nalezeno ${storyElements.length} story prvků, cíl: ${targetCount}`);

      // Náhodně vybrat a prohlédnout stories
      const indicesToView = this.selectRandomIndices(storyElements.length, Math.min(targetCount, storyElements.length));
      
      for (const index of indicesToView) {
        try {
          await this.viewSingleStory(user, fbBot, storyElements[index], viewedCount + 1);
          viewedCount++;
          
          // Pauza mezi stories (1-3s)
          await Wait.toSeconds(1 + Math.random() * 2, 'Pauza mezi stories');
          
        } catch (storyErr) {
          await Log.warn(`[${user.id}]`, `Chyba při prohlížení story ${index + 1}: ${storyErr.message}`);
          // Pokračovat s dalšími stories
        }
      }

    } catch (err) {
      await Log.error(`[${user.id}]`, `Chyba při prohlížení stories: ${err.message}`);
    }

    return viewedCount;
  }

  /**
   * Prohlédne jednu story
   */
  async viewSingleStory(user, fbBot, storyElement, storyNumber) {
    try {
      Log.debug(`[${user.id}]`, `Prohlížím story #${storyNumber}...`);

      // Klikni na story element
      await storyElement.click();
      await Wait.toSeconds(2, 'Načtení story');

      // Simuluj sledování story (5-15 sekund)
      const viewDuration = 5 + Math.random() * 10; // 5-15s
      await Wait.toSeconds(viewDuration, `Sledování story ${storyNumber}`);

      // Zavři story (ESC klávesa nebo klik mimo)
      await fbBot.page.keyboard.press('Escape');
      await Wait.toSeconds(1, 'Zavření story');

      Log.debug(`[${user.id}]`, `Story #${storyNumber} prohlédnuta (${Math.round(viewDuration)}s)`);

    } catch (err) {
      await Log.warn(`[${user.id}]`, `Chyba při prohlížení single story: ${err.message}`);
      // Pokus o násilné zavření
      try {
        await fbBot.page.keyboard.press('Escape');
      } catch (escErr) {
        // Ignorovat chybu ESC
      }
    }
  }

  /**
   * Vybere náhodné indexy pro prohlížení
   */
  selectRandomIndices(totalCount, selectCount) {
    const allIndices = Array.from({ length: totalCount }, (_, i) => i);
    const selected = [];

    for (let i = 0; i < selectCount; i++) {
      const randomIndex = Math.floor(Math.random() * allIndices.length);
      selected.push(allIndices.splice(randomIndex, 1)[0]);
    }

    return selected.sort((a, b) => a - b); // Seřadit pro přirozené procházení
  }
}