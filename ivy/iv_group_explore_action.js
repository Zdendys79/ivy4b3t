/**
 * Název souboru: iv_group_explore_action.js
 * Umístění: ~/ivy/iv_group_explore_action.js
 *
 * Popis: Implementace akce group_explore pro prozkoumávání FB skupin
 * Neinvazivní aktivita, která se opakuje nekonečně pokud nejsou dostupné posting akce
 */

import { Log } from './libs/iv_log.class.js';
import { FBGroupAnalyzer } from './iv_fb_group_analyzer.js';
import { db } from './iv_sql.js';
import { Wait } from './libs/iv_wait.class.js';

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
      await Wait.toSeconds(8, 'Simulace lidského chování');

      // Rozhodnutí o další aktivitě
      const nextAction = await this.decideNextAction(user, analyzer, options);
      
      switch (nextAction) {
        case 'navigate_to_another':
          const navigated = await analyzer.navigateToRandomGroup();
          if (navigated) {
            Log.info(`[${user.id}]`, '🎯 Navigoval jsem na další skupinu');
            // Analyzuj i tu novou skupinu
            await Wait.toSeconds(4, 'Načtení skupiny');
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
   * Najde a naviguje na novou neznámou skupinu z nalezených URL
   */
  async navigateToRandomGroup(user, fbBot) {
    try {
      // Získej analýzu aktuální stránky včetně všech group URL
      const pageAnalysis = await fbBot.pageAnalyzer.analyzeFullPage();
      
      if (!pageAnalysis.links?.groups || pageAnalysis.links.groups.length === 0) {
        throw new Error('Na aktuální stránce nejsou nalezeny žádné odkazy na skupiny. Nelze pokračovat v exploration.');
      }
      
      Log.info(`[${user.id}]`, `🔍 Nalezeno ${pageAnalysis.links.groups.length} odkazů na skupiny`);
      
      // Vyber náhodnou skupinu z nalezených
      const randomGroupUrl = pageAnalysis.links.groups[Math.floor(Math.random() * pageAnalysis.links.groups.length)];
      
      Log.info(`[${user.id}]`, `🎯 Naviguji na novou skupinu: ${randomGroupUrl}`);
      await fbBot.page.goto(randomGroupUrl, { waitUntil: 'networkidle2' });
      await Wait.toSeconds(4, 'Načtení nové skupiny');
      return true;

    } catch (err) {
      Log.error(`[${user.id}]`, `Chyba při navigaci na novou skupinu: ${err.message}`);
      throw err; // Předej chybu výše - nedostatek URL je problém
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
        
        await Wait.toSeconds(4, 'Načtení skupiny'); // Pauza na "čtení"
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

      // Hledání odkazů na členy pomocí JavaScript evaluation
      const memberLinks = await fbBot.page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[href*="/profile.php"], a[href*="facebook.com/"]:not([href*="/groups/"])'));
        return links.map((link, index) => ({
          index,
          href: link.href,
          text: link.textContent?.trim() || '',
          isVisible: link.offsetParent !== null
        })).filter(link => link.isVisible);
      });
      
      if (memberLinks.length > 0) {
        // Klikni na náhodný profil
        const randomIndex = Math.floor(Math.random() * Math.min(memberLinks.length, 5));
        const selectedLink = memberLinks[randomIndex];
        
        const clickResult = await fbBot.page.evaluate((linkIndex) => {
          const allLinks = document.querySelectorAll('a[href*="/profile.php"], a[href*="facebook.com/"]:not([href*="/groups/"])');
          const targetLink = allLinks[linkIndex];
          if (targetLink && targetLink.offsetParent !== null) {
            targetLink.click();
            return true;
          }
          return false;
        }, selectedLink.index);
        
        if (clickResult) {
          await Wait.toSeconds(6, 'Prohlédnutí profilu');
          
          // Návrat zpět
          await fbBot.page.goBack();
          await Wait.toSeconds(2, 'Návrat zpět');
          
          Log.info(`[${user.id}]`, '✅ Prozkoumán profil člena');
        }
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