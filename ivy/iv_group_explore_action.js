/**
 * Název souboru: iv_group_explore_action.js
 * Umístění: ~/ivy/iv_group_explore_action.js
 *
 * Popis: Implementace akce group_explore pro prozkoumávání FB skupin
 * Neinvazivní aktivita, která se opakuje nekonečně pokud nejsou dostupné posting akce
 */

import { Log } from './iv_log.class.js';
import { FBGroupAnalyzer } from './iv_fb_group_analyzer.js';
import { db } from './iv_sql.js';
import * as wait from './iv_wait.js';

export class GroupExploreAction {
  constructor() {
    this.actionCode = 'group_explore';
    this.isRunning = false;
  }

  /**
   * Hlavní výkonná funkce akce group_explore
   */
  async execute(user, fbBot, options = {}) {
    if (this.isRunning) {
      Log.info(`[${user.id}]`, '⏸️ Group explore už běží, přeskakuji...');
      return { success: false, reason: 'Already running' };
    }

    this.isRunning = true;

    try {
      Log.info(`[${user.id}]`, '🔍 Spouštím group_explore akci...');

      if (!fbBot || !fbBot.page || fbBot.page.isClosed()) {
        throw new Error('FBBot není dostupný');
      }

      const currentUrl = fbBot.page.url();
      
      // Pokud nejsme ve skupině, zkusíme najít nějakou
      if (!currentUrl.includes('facebook.com/groups/')) {
        const navigated = await this.navigateToRandomGroup(user, fbBot);
        if (!navigated) {
          throw new Error('Nepodařilo se navigovat do žádné skupiny');
        }
      }

      // Inicializace analyzátoru
      const analyzer = new FBGroupAnalyzer(fbBot.page);

      // Analýza současné skupiny
      const groupInfo = await analyzer.analyzeCurrentGroup(user.id);
      if (!groupInfo) {
        throw new Error('Nepodařilo se analyzovat skupinu');
      }

      Log.info(`[${user.id}]`, `📊 Analyzována skupina: ${groupInfo.name} (${groupInfo.member_count} členů)`);

      // Náhodné čekání pro simulaci lidského chování
      await wait.delay(3000, 8000);

      // Rozhodnutí o další aktivitě
      const nextAction = await this.decideNextAction(user, analyzer, options);
      
      switch (nextAction) {
        case 'navigate_to_another':
          const navigated = await analyzer.navigateToRandomGroup();
          if (navigated) {
            Log.info(`[${user.id}]`, '🎯 Navigoval jsem na další skupinu');
            // Analyzuj i tu novou skupinu
            await wait.delay(2000, 4000);
            await analyzer.analyzeCurrentGroup(user.id);
          }
          break;

        case 'scroll_and_read':
          await this.scrollAndReadPosts(user, fbBot);
          break;

        case 'explore_members':
          await this.exploreGroupMembers(user, fbBot);
          break;

        default:
          Log.info(`[${user.id}]`, '😴 Žádná další akce, končím group_explore');
          break;
      }

      // Úspěšné dokončení
      await this.logActionSuccess(user, groupInfo);
      
      // Naplánuj další spuštění (3-8 minut)
      const nextMinutes = Math.floor(Math.random() * 5) + 3;
      await db.updateActionPlan(user.id, this.actionCode, nextMinutes);

      Log.success(`[${user.id}]`, `✅ Group explore dokončen, další za ${nextMinutes} minut`);

      return {
        success: true,
        reason: 'Group explore completed successfully',
        groupInfo: groupInfo,
        nextAction: nextAction,
        nextExecutionInMinutes: nextMinutes
      };

    } catch (err) {
      await Log.error(`[${user.id}]`, `Chyba v group_explore: ${err.message}`);
      
      // Naplánuj opakování za kratší dobu při chybě (1-3 minuty)
      const retryMinutes = Math.floor(Math.random() * 2) + 1;
      await db.updateActionPlan(user.id, this.actionCode, retryMinutes);

      return {
        success: false,
        reason: err.message,
        retryInMinutes: retryMinutes
      };

    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Naviguje na náhodnou skupinu pokud nejsme v žádné
   */
  async navigateToRandomGroup(user, fbBot) {
    try {
      // Získej nějaké známé skupiny z databáze
      const knownGroups = await db.getGroupsForExploration(5);
      
      if (knownGroups.length > 0) {
        const randomGroup = knownGroups[Math.floor(Math.random() * knownGroups.length)];
        const groupUrl = `https://www.facebook.com/groups/${randomGroup.fb_group_id}`;
        
        Log.info(`[${user.id}]`, `🎯 Naviguji na skupinu: ${randomGroup.name}`);
        await fbBot.page.goto(groupUrl, { waitUntil: 'networkidle2' });
        await wait.delay(2000, 4000);
        return true;
      }

      // Fallback - zkus hledat přes FB search
      Log.info(`[${user.id}]`, '🔍 Hledám skupiny přes FB search...');
      await fbBot.page.goto('https://www.facebook.com/search/groups/', { waitUntil: 'networkidle2' });
      await wait.delay(3000, 5000);
      
      // Klikni na první dostupnou skupinu
      const groupLinks = await fbBot.page.$('a[href*="/groups/"]');
      if (groupLinks.length > 0) {
        await groupLinks[0].click();
        await wait.delay(2000, 4000);
        return true;
      }

      return false;

    } catch (err) {
      Log.warn(`[${user.id}]`, `Chyba při navigaci na skupinu: ${err.message}`);
      return false;
    }
  }

  /**
   * Rozhoduje o další aktivitě na základě kontextu
   */
  async decideNextAction(user, analyzer, options) {
    try {
      // Získej statistiky uživatele
      const stats = await analyzer.getUserExplorationStats(user.id);
      
      // Rozhodovací logika
      const actions = ['navigate_to_another', 'scroll_and_read', 'explore_members', 'finish'];
      const weights = [40, 30, 20, 10]; // Procenta pravděpodobnosti

      // Upravuj váhy podle kontextu
      if (stats && stats.groups_discovered < 5) {
        weights[0] += 20; // Více navigace pro nové uživatele
      }

      // Náhodný výběr podle vah
      const random = Math.random() * 100;
      let cumulative = 0;
      
      for (let i = 0; i < actions.length; i++) {
        cumulative += weights[i];
        if (random <= cumulative) {
          return actions[i];
        }
      }

      return 'finish';

    } catch (err) {
      Log.warn(`[${user.id}]`, `Chyba při rozhodování: ${err.message}`);
      return 'finish';
    }
  }

  /**
   * Scrolluje a "čte" příspěvky ve skupině
   */
  async scrollAndReadPosts(user, fbBot) {
    try {
      Log.info(`[${user.id}]`, '📖 Scrolluji a čtu příspěvky...');

      // Simulace čtení - několik scrollů s pauzy
      for (let i = 0; i < 3; i++) {
        await fbBot.page.evaluate(() => {
          window.scrollBy(0, Math.floor(Math.random() * 500) + 300);
        });
        
        await wait.delay(2000, 4000); // Pauza na "čtení"
      }

      Log.info(`[${user.id}]`, '✅ Dokončeno čtení příspěvků');

    } catch (err) {
      Log.warn(`[${user.id}]`, `Chyba při čtení příspěvků: ${err.message}`);
    }
  }

  /**
   * Prozkoumává členy skupiny
   */
  async exploreGroupMembers(user, fbBot) {
    try {
      Log.info(`[${user.id}]`, '👥 Prozkoumávám členy skupiny...');

      // Hledání odkazů na členy
      const memberLinks = await fbBot.page.$$('a[href*="/profile.php"], a[href*="facebook.com/"]:not([href*="/groups/"])');
      
      if (memberLinks.length > 0) {
        // Klikni na náhodný profil
        const randomIndex = Math.floor(Math.random() * Math.min(memberLinks.length, 5));
        await memberLinks[randomIndex].click();
        
        await wait.delay(3000, 6000); // Čas na "prohlédnutí" profilu
        
        // Návrat zpět
        await fbBot.page.goBack();
        await wait.delay(1000, 2000);
        
        Log.info(`[${user.id}]`, '✅ Prozkoumán profil člena');
      }

    } catch (err) {
      Log.warn(`[${user.id}]`, `Chyba při prozkoumávání členů: ${err.message}`);
    }
  }

  /**
   * Loguje úspěšné dokončení akce
   */
  async logActionSuccess(user, groupInfo) {
    try {
      const logText = `Prozkoumána skupina: ${groupInfo.name} (${groupInfo.member_count} členů, ${groupInfo.category || 'neznámá kategorie'})`;
      
      await db.logAction(user.id, this.actionCode, groupInfo.fb_group_id, logText);
      
    } catch (err) {
      Log.warn(`[${user.id}]`, `Chyba při logování: ${err.message}`);
    }
  }

  /**
   * Kontroluje zda je akce dostupná pro uživatele
   */
  async isAvailableForUser(user) {
    try {
      // Group explore je vždy dostupná (neinvazivní)
      return true;
    } catch (err) {
      Log.warn(`[${user.id}]`, `Chyba při kontrole dostupnosti: ${err.message}`);
      return false;
    }
  }

  /**
   * Zjišťuje prioritu akce (nižší když jsou posting akce dostupné)
   */
  async getPriorityForUser(user) {
    try {
      // Získej dostupné akce uživatele
      const actions = await db.getUserActions(user.id);
      const postingActions = actions.filter(action => 
        action.action_code.startsWith('post_utio_') || 
        action.action_code === 'quote_post'
      );

      // Pokud jsou posting akce dostupné, sniž prioritu
      if (postingActions.length > 0) {
        return 1; // Nízká priorita
      }

      return 5; // Standardní priorita když nejsou posting akce
      
    } catch (err) {
      Log.warn(`[${user.id}]`, `Chyba při výpočtu priority: ${err.message}`);
      return 5;
    }
  }
}

// Export singleton instance
export const groupExploreAction = new GroupExploreAction();