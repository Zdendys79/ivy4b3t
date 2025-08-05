/**
 * Název souboru: iv_fb_group_analyzer.js
 * Umístění: ~/ivy/iv_fb_group_analyzer.js
 *
 * Popis: Analyzátor FB skupin - používá tabulku fb_groups
 * - Analyzuje skupiny (název, počet členů, popis, kategorie)
 * - Ukládá data do fb_groups s unikátním fb_id
 * - Naviguje na náhodné skupiny z nalezených odkazů
 */

import { Log } from './libs/iv_log.class.js';
import { Wait } from './libs/iv_wait.class.js';
import { db } from './iv_sql.js';

export class FBGroupAnalyzer {
  constructor(page, fbBot = null) {
    this.page = page;
    this.fbBot = fbBot;
    this.currentGroupInfo = null;
  }

  /**
   * Hlavní funkce pro analýzu skupiny
   */
  async analyzeCurrentGroup(userId) {
    try {
      const groupInfo = await this.extractGroupInfo();
      if (!groupInfo) {
        return null;
      }

      // Ulož/aktualizuj v databázi
      await this.saveGroupToDatabase(groupInfo, userId);
      
      this.currentGroupInfo = groupInfo;
      return groupInfo;
      
    } catch (err) {
      await Log.error('[GROUP_ANALYZER]', `Chyba při analýze skupiny: ${err.message}`);
      return null;
    }
  }

  /**
   * Extrahuje informace o skupině z aktuální stránky
   */
  async extractGroupInfo() {
    try {
      const url = this.page.url();
      const fbIdMatch = url.match(/facebook\.com\/groups\/([^\/\?]+)/);
      
      if (!fbIdMatch) {
        throw new Error('Nejsme na stránce FB skupiny');
      }
      
      const fbId = fbIdMatch[1];
      
      // Extrakce názvu skupiny
      const name = await this.page.evaluate(() => {
        // Hledáš v h1, title a meta tags
        const h1 = document.querySelector('h1');
        if (h1 && h1.textContent.trim()) return h1.textContent.trim();
        
        const title = document.title;
        if (title && !title.includes('Facebook')) return title.trim();
        
        return null;
      });
      
      // Extrakce počtu členů
      const memberCount = await this.page.evaluate(() => {
        const memberTexts = Array.from(document.querySelectorAll('*')).map(el => el.textContent)
          .filter(text => text && (text.includes('člen') || text.includes('member')));
        
        for (const text of memberTexts) {
          const match = text.match(/([\d\s,\.]+)\s*(?:člen|členů|member)/i);
          if (match) {
            const num = match[1].replace(/[\s,\.]/g, '');
            return parseInt(num) || null;
          }
        }
        return null;
      });
      
      // Určení typu skupiny (G/GV)
      const type = await this.determineGroupType();
      
      return {
        fb_id: fbId,
        name: name || 'Neznámý název',
        member_count: memberCount,
        type: type,
        url: url
      };
      
    } catch (err) {
      await Log.error('[GROUP_ANALYZER]', `Chyba při extrakci informací: ${err.message}`);
      return null;
    }
  }

  /**
   * Určí typ skupiny (G = soukromá, GV = veřejná)
   */
  async determineGroupType() {
    try {
      const isPrivate = await this.page.evaluate(() => {
        // Hledáš indikátory soukromé skupiny
        const text = document.body.textContent.toLowerCase();
        return text.includes('soukromá') || text.includes('private') || 
               text.includes('žádost o připojení') || text.includes('request to join');
      });
      
      return isPrivate ? 'G' : 'GV';
    } catch (err) {
      return 'G'; // Výchozí soukromá
    }
  }

  /**
   * Uloží informace o skupině do databáze (INSERT ON DUPLICATE KEY UPDATE)
   */
  async saveGroupToDatabase(groupInfo, userId = null) {
    try {
      await db.safeExecute('groups.upsertGroupInfo', [
        groupInfo.fb_id,
        groupInfo.name,
        groupInfo.member_count,
        groupInfo.type,
        userId
      ]);
      
      Log.info('[GROUP_ANALYZER]', `Skupina ${groupInfo.name} uložena do databáze`);
    } catch (err) {
      await Log.error('[GROUP_ANALYZER]', `Chyba při ukládání: ${err.message}`);
    }
  }
  
  /**
   * Naviguje na náhodnou skupinu z nalezených odkazů
   */
  async navigateToRandomGroup() {
    try {
      // Získej odkazy na skupiny z aktuální stránky
      const groupLinks = await this.page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[href*="/groups/"]'))
          .map(a => a.href)
          .filter(href => href.match(/facebook\.com\/groups\/[^\/\?]+/));
        return [...new Set(links)]; // Unikátní odkazy
      });
      
      if (groupLinks.length === 0) {
        await Log.warn('[GROUP_ANALYZER]', 'Na stránce nejsou žádné odkazy na skupiny');
        return false;
      }
      
      const randomLink = groupLinks[Math.floor(Math.random() * groupLinks.length)];
      
      Log.info('[GROUP_ANALYZER]', `Naviguji na skupinu: ${randomLink}`);
      await this.page.goto(randomLink, { waitUntil: 'networkidle2', timeout: 30000 });
      await Wait.toSeconds(3, 'Načtení nové skupiny');
      
      return true;
      
    } catch (err) {
      await Log.error('[GROUP_ANALYZER]', `Chyba při navigaci: ${err.message}`);
      return false;
    }
  }

  getCurrentGroupInfo() {
    return this.currentGroupInfo;
  }

  /**
   * Statistiky průzkumu uživatele
   */
  async getUserExplorationStats(userId) {
    try {
      const stats = await db.safeQueryFirst('groups.getUserExplorationStats', [userId]);
      return stats || { groups_discovered: 0 };
    } catch (err) {
      await Log.error('[GROUP_ANALYZER]', `Chyba při získávání statistik: ${err.message}`);
      return { groups_discovered: 0 };
    }
  }
}