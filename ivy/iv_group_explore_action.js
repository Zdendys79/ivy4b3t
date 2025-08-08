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
      Log.info(`[${user.id}]`, 'Group explore už běží, přeskakuji...');
      return { success: false, reason: 'Already running' };
    }

    this.isRunning = true;

    try {
      Log.info(`[${user.id}]`, 'Spouštím group_explore akci...');

      if (!fbBot || !fbBot.page || fbBot.page.isClosed()) {
        throw new Error('FBBot není dostupný');
      }

      // Přenést FB záložku na popředí
      await fbBot.bringToFront();

      // Vždy navigujeme na první skupinu
      const navigated = await this.navigateToRandomGroup(user, fbBot);
      if (!navigated) {
        throw new Error('Nepodařilo se navigovat do žádné skupiny');
      }

      // Inicializace analyzátoru
      const analyzer = new FBGroupAnalyzer(fbBot.page);

      // Analýza současné skupiny
      const groupInfo = await analyzer.analyzeCurrentGroup(user.id);
      if (!groupInfo) {
        throw new Error('Nepodařilo se analyzovat skupinu');
      }

      Log.info(`[${user.id}]`, `Analyzována skupina: ${groupInfo.name} (${groupInfo.member_count} členů)`);

      // Náhodné čekání pro simulaci lidského chování
      await Wait.toSeconds(8, 'Simulace lidského chování');

      // Rozhodnutí o další aktivitě
      const nextAction = await this.decideNextAction(user, analyzer, options);
      
      switch (nextAction) {
        case 'scroll_and_read':
          await this.scrollAndReadPosts(user, fbBot);
          break;

        case 'explore_members':
          await this.exploreGroupMembers(user, fbBot);
          break;

        case 'finish_session':
          Log.info(`[${user.id}]`, '🏁 Session dokončena, plánuji další group_explore za delší čas');
          // Naplánuj další spuštění za delší dobu (30-60 minut)
          const sessionBreakMinutes = Math.floor(Math.random() * 31) + 30;
          await db.updateActionPlan(user.id, this.actionCode, sessionBreakMinutes);
          
          return {
            success: true,
            reason: 'Exploration session completed',
            groupInfo: groupInfo,
            nextAction: nextAction,
            nextExecutionInMinutes: sessionBreakMinutes
          };

        default:
          Log.info(`[${user.id}]`, '😴 Žádná další akce, končím group_explore');
          break;
      }

      // Úspěšné dokončení
      await this.logActionSuccess(user, groupInfo);
      
      // Naplánuj další spuštění (3-8 minut)
      const nextMinutes = Math.floor(Math.random() * 5) + 3;
      await db.updateActionPlan(user.id, this.actionCode, nextMinutes);

      Log.success(`[${user.id}]`, `Group explore dokončen, další za ${nextMinutes} minut`);

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
   * Najde a naviguje na skupinu pro začátek průzkumu
   * Používá cache nebo načte ze skupinového feedu
   */
  async navigateToRandomGroup(user, fbBot) {
    try {
      // Občas (20% šance) načti nové skupiny ze feedu i když cache není prázdná
      const shouldRefreshFeed = Math.random() < 0.2;
      if (shouldRefreshFeed) {
        Log.info(`[${user.id}]`, '🔄 Obnovuji skupiny ze feedu (náhodná obnova)');
        await this.loadGroupsFromFeed(user, fbBot);
      }
      
      // Pokus o navigaci z cache
      if (await this.navigateFromCache(user, fbBot)) {
        return true;
      }
      
      // Pokud cache je prázdná, načti nové skupiny ze feedu
      await this.loadGroupsFromFeed(user, fbBot);
      
      // Zkus znovu z cache
      if (await this.navigateFromCache(user, fbBot)) {
        return true;
      }
      
      throw new Error('Nepodařilo se načíst žádné skupiny ani z cache ani ze feedu');

    } catch (err) {
      await Log.error(`[${user.id}]`, `Chyba při navigaci na skupinu: ${err.message}`);
      throw err;
    }
  }

  /**
   * Pokusí se navigovat na skupinu z global cache
   */
  async navigateFromCache(user, fbBot) {
    try {
      if (!global.groupUrlsCache || global.groupUrlsCache.length === 0) {
        return false;
      }
      
      // Vyber náhodnou URL z cache
      const randomIndex = Math.floor(Math.random() * global.groupUrlsCache.length);
      const groupUrl = global.groupUrlsCache.splice(randomIndex, 1)[0]; // Odeber z cache
      
      Log.info(`[${user.id}]`, `Naviguji na skupinu z cache: ${groupUrl}`);
      await fbBot.navigateToPage(groupUrl, { waitUntil: 'networkidle2' });
      await Wait.toSeconds(4, 'Načtení skupiny z cache');
      return true;
      
    } catch (err) {
      await Log.warn(`[${user.id}]`, `Chyba při navigaci z cache: ${err.message}`);
      return false;
    }
  }

  /**
   * Načte seznam skupin ze skupinového feedu a uloží do cache
   */
  async loadGroupsFromFeed(user, fbBot) {
    try {
      Log.info(`[${user.id}]`, 'Načítám skupiny ze feedu...');
      
      // Naviguj na skupinový feed
      await fbBot.navigateToPage('https://www.facebook.com/groups/feed/', { 
        waitUntil: 'networkidle2' 
      });
      await Wait.toSeconds(5, 'Načtení skupinového feedu');
      
      // Scrolluj pro načtení více skupin
      for (let i = 0; i < 3; i++) {
        await fbBot.page.evaluate(() => {
          window.scrollBy(0, 800);
        });
        await Wait.toSeconds(2, 'Načtení dalších skupin');
      }
      
      // Extrahuj odkazy na skupiny
      const groupUrls = await fbBot.page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[href*="/groups/"]'))
          .map(a => a.href)
          .filter(href => {
            const match = href.match(/facebook\.com\/groups\/([^\/\?&]+)/);
            return match && match[1] !== 'feed';
          });
        
        return [...new Set(links)]; // Unikátní odkazy
      });
      
      // Uložení do global cache
      if (!global.groupUrlsCache) {
        global.groupUrlsCache = [];
      }
      
      // Filtruj URLs - jen ty které ještě nejsou v cache
      const notInCache = groupUrls.filter(url => !global.groupUrlsCache.includes(url));
      
      // Extrahuj všechna FB ID najednou
      const urlsWithIds = notInCache.map(url => {
        const fbIdMatch = url.match(/facebook\.com\/groups\/([^\/\?&]+)/);
        return {
          url: url,
          fbId: fbIdMatch && fbIdMatch[1] ? fbIdMatch[1] : null
        };
      }).filter(item => item.fbId !== null);
      
      // Jeden SQL dotaz pro všechna ID najednou
      const allFbIds = urlsWithIds.map(item => item.fbId);
      let existingGroups = [];
      
      if (allFbIds.length > 0) {
        // Přímý přístup k databázi pro dynamický SQL s IN klauzulí
        const { pool } = await import('./iv_sql.js');
        const placeholders = allFbIds.map(() => '?').join(',');
        // Vyber skupiny které nemají member_count nebo byly viděny před více než 24 hodinami
        const sql = `SELECT * FROM fb_groups WHERE fb_id IN (${placeholders}) 
                     AND member_count IS NOT NULL 
                     AND last_seen > NOW() - INTERVAL 24 HOUR`;
        const [rows] = await pool.execute(sql, allFbIds);
        existingGroups = rows;
      }
      
      // Vytvoř Set ID skupin, které nepotřebují aktualizaci
      const skipFbIds = new Set(existingGroups.map(group => group.fb_id));
      
      // Filtruj skupiny které potřebují prozkoumání (neznámé nebo staré)
      const urlsToExplore = urlsWithIds
        .filter(item => !skipFbIds.has(item.fbId))
        .map(item => item.url);
      
      const skipCount = urlsWithIds.length - urlsToExplore.length;
      
      // Do cache přidej skupiny k prozkoumání
      global.groupUrlsCache.push(...urlsToExplore);
      
      Log.info(`[${user.id}]`, `Ze feedu: ${groupUrls.length} celkem, ${skipCount} nedávno viděných přeskočeno, ${urlsToExplore.length} přidáno do cache`);
      
    } catch (err) {
      await Log.error(`[${user.id}]`, `Chyba při načítání ze feedu: ${err.message}`);
    }
  }

  /**
   * Rozhoduje o další aktivitě v rámci průzkumu
   * Používá váhy, po použití akce se váha nastaví na 0
   */
  async decideNextAction(user, analyzer, options) {
    try {
      // Inicializace session tracking
      if (!global.exploreSession) {
        global.exploreSession = {};
      }
      if (!global.exploreSession[user.id]) {
        global.exploreSession[user.id] = {
          actionWeights: {
            scroll_and_read: 60,
            explore_members: 30,
            finish: 10
          },
          explorationCount: 0
        };
      }
      
      const session = global.exploreSession[user.id];
      
      // Zvýšení počtu průzkumů
      session.explorationCount++;
      
      // Kontrola limitu průzkumů (10-15)
      const maxExplorations = Math.floor(Math.random() * 6) + 10; // 10-15
      if (session.explorationCount >= maxExplorations) {
        Log.info(`[${user.id}]`, `Dosažen limit průzkumů (${session.explorationCount}/${maxExplorations}), ukončuji session`);
        delete global.exploreSession[user.id]; // Reset pro příští session
        return 'finish_session';
      }
      
      // Vytvoř seznam dostupných akcí s jejich váhami
      const availableActions = [];
      for (const [action, weight] of Object.entries(session.actionWeights)) {
        if (weight > 0) {
          availableActions.push({ action, weight });
        }
      }
      
      // Pokud žádné akce nejsou dostupné, ukončit
      if (availableActions.length === 0) {
        return 'finish';
      }
      
      // Weighted random selection
      const totalWeight = availableActions.reduce((sum, a) => sum + a.weight, 0);
      const random = Math.random() * totalWeight;
      let cumulative = 0;
      
      for (const activityOption of availableActions) {
        cumulative += activityOption.weight;
        if (random <= cumulative) {
          // Nastav váhu na 0 po použití (kromě finish)
          if (activityOption.action !== 'finish') {
            session.actionWeights[activityOption.action] = 0;
          }
          return activityOption.action;
        }
      }

      return 'finish';

    } catch (err) {
      await Log.warn(`[${user.id}]`, `Chyba při rozhodování: ${err.message}`);
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

      Log.info(`[${user.id}]`, 'Dokončeno čtení příspěvků');

    } catch (err) {
      await Log.warn(`[${user.id}]`, `Chyba při čtení příspěvků: ${err.message}`);
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
          
          Log.info(`[${user.id}]`, 'Prozkoumán profil člena');
        }
      }

    } catch (err) {
      await Log.warn(`[${user.id}]`, `Chyba při prozkoumávání členů: ${err.message}`);
    }
  }

  /**
   * Loguje úspěšné dokončení akce
   */
  async logActionSuccess(user, groupInfo) {
    try {
      const logText = `Prozkoumána skupina: ${groupInfo.name} (${groupInfo.member_count} členů, ${groupInfo.category || 'neznámá kategorie'})`;
      
      await db.logAction(user.id, this.actionCode, groupInfo.fb_id || null, logText);
      
    } catch (err) {
      await Log.warn(`[${user.id}]`, `Chyba při logování: ${err.message}`);
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
      await Log.warn(`[${user.id}]`, `Chyba při kontrole dostupnosti: ${err.message}`);
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
      await Log.warn(`[${user.id}]`, `Chyba při výpočtu priority: ${err.message}`);
      return 5;
    }
  }
}

// Export singleton instance
export const groupExploreAction = new GroupExploreAction();