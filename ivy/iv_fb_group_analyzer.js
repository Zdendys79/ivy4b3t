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
      
      // Extrakce názvu skupiny - NEJDŮLEŽITĚJŠÍ pro kategorizaci
      const name = await this.page.evaluate(() => {
        // Prioritní hledání názvu skupiny
        const selectors = [
          'h1[dir="auto"]', // Hlavní název skupiny
          'h1', 
          '[role="banner"] h1',
          '[data-pagelet="GroupsPageBanner"] h1',
          'span[dir="auto"]' // Záložní selector
        ];
        
        for (const selector of selectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent.trim() && 
              !element.textContent.includes('Facebook') &&
              element.textContent.length > 3) {
            return element.textContent.trim();
          }
        }
        
        // Fallback na title
        const title = document.title;
        if (title && !title.includes('Facebook') && title.length > 3) {
          return title.split('|')[0].trim(); // Odstraň " | Facebook" část
        }
        
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
   * Určí typ skupiny - prozatím všechny jako Z (zájmová)
   * Operátoři B3 si je později přeřadí ručně do správných kategorií
   * G = group - cizí skupina pro UTIO příspěvky
   * GV = vlastní skupina - B3 vlastní skupinu, správce je z B3  
   * P = prodejní skupina
   * Z = zájmová skupina - prozatím všechny nové skupiny
   */
  async determineGroupType() {
    try {
      // Prozatím všechny nově objevené skupiny klasifikujeme jako Z
      // Operátoři B3 si je pak přeřadí ručně podle potřeby
      return 'Z';
      
    } catch (err) {
      await Log.warn('[GROUP_ANALYZER]', `Chyba při určování typu: ${err.message}`);
      return 'Z'; // Výchozí zájmová skupina
    }
  }

  /**
   * Uloží informace o skupině do databáze (INSERT ON DUPLICATE KEY UPDATE)
   */
  async saveGroupToDatabase(groupInfo, userId = null) {
    try {
      // Sanitize group name - AGRESIVNĚJŠÍ čištění UTF-8
      const sanitizedName = this.sanitizeString(groupInfo.name);
      
      if (!sanitizedName || sanitizedName.trim().length === 0) {
        await Log.warn('[GROUP_ANALYZER]', `Přeskakuji skupinu s nevalidním názvem: ${groupInfo.fb_id}`);
        return;
      }
      
      await db.safeExecute('groups.upsertGroupInfo', [
        groupInfo.fb_id,
        sanitizedName,
        groupInfo.member_count,
        userId
      ]);
      
      Log.info('[GROUP_ANALYZER]', `Skupina ${sanitizedName} (ID: ${groupInfo.fb_id}) uložena do databáze`);
    } catch (err) {
      await Log.error('[GROUP_ANALYZER]', `Chyba při ukládání: ${err.message}`, {
        fb_id: groupInfo.fb_id,
        name_length: groupInfo.name?.length,
        name_sample: groupInfo.name?.substring(0, 50)
      });
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

  /**
   * Parsuje Facebook ID z názvu skupiny typu Z
   * Název typu Z má formát: "FACEBOOK_ID[oddělovač]NázevSkupiny"
   */
  parseFacebookIdFromName(groupName) {
    if (!groupName || typeof groupName !== 'string') {
      return null;
    }
    
    // Hledej číselné ID na začátku názvu (Facebook ID jsou čísla)
    const match = groupName.match(/^(\d{10,15})/); // Facebook IDs jsou obvykle 10-15 číslic
    
    if (match) {
      const fbId = match[1];
      Log.debug('[GROUP_ANALYZER]', `Extrahoval Facebook ID: ${fbId} z názvu: ${groupName.substring(0, 50)}...`);
      return fbId;
    }
    
    return null;
  }
  
  /**
   * Očistí název skupiny od Facebook ID (pro skupiny typu Z)
   */
  cleanGroupName(groupName, facebookId) {
    if (!groupName || !facebookId) {
      return groupName;
    }
    
    // Odstraň Facebook ID a běžné oddělovače ze začátku názvu
    let cleanName = groupName.replace(new RegExp(`^${facebookId}[^a-zA-ZÀ-žА-я]*`), '');
    
    // Fallback - pokud se nepodařilo odstranit ID, vezmi původní název
    if (!cleanName || cleanName.length < 3) {
      cleanName = groupName;
    }
    
    return cleanName.trim();
  }

  /**
   * Vyčistí string od nevalidních UTF-8 znaků pro bezpečné uložení do databáze
   */
  sanitizeString(str) {
    if (!str || typeof str !== 'string') {
      return '';
    }
    
    // Remove invalid UTF-8 sequences and control characters - AGRESIVNĚJŠÍ ČIŠTĚNÍ
    return str
      // Remove všechny nevalidní znaky včetně \x80, \x00, atd.
      .replace(/[\x00-\x1F\x7F-\xFF]/g, '')
      // Remove invalid UTF-8 sequences
      .replace(/[\uFFFD\uFFFE\uFFFF]/g, '')
      // Remove pouze základní ASCII + češtinu
      .replace(/[^\x20-\x7E\u00C0-\u017F]/g, '')
      // Trim whitespace
      .trim()
      // Limit length for database compatibility
      .substring(0, 250);
  }
}