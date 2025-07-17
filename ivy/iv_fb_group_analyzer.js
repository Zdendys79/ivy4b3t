/**
 * Název souboru: iv_fb_group_analyzer.js
 * Umístění: ~/ivy/iv_fb_group_analyzer.js
 *
 * Popis: Analyzátor FB skupin pro sběr detailních informací
 * Sbírá název, počet členů, popis, kategorie a další metadata
 */

import { Log } from './libs/iv_log.class.js';
import { db } from './iv_sql.js';
import { Wait } from './libs/iv_wait.class.js';

export class FBGroupAnalyzer {
  constructor(page) {
    this.page = page;
    this.currentGroupInfo = null;
  }

  /**
   * Hlavní funkce pro analýzu skupiny
   */
  async analyzeCurrentGroup(userId) {
    try {
      if (!this.page || this.page.isClosed()) {
        throw new Error('Page není dostupná');
      }

      const currentUrl = this.page.url();
      if (!currentUrl.includes('facebook.com/groups/')) {
        throw new Error('Nejsme na stránce FB skupiny');
      }

      Log.info('[GROUP_ANALYZER]', '🔍 Začínám analýzu skupiny...');

      // Extrakce FB ID skupiny z URL
      const fbGroupId = this.extractGroupIdFromUrl(currentUrl);
      if (!fbGroupId) {
        throw new Error('Nepodařilo se extrahovat FB ID skupiny');
      }

      // Kontrola zda už skupinu máme v databázi
      const existingGroup = await db.safeQueryFirst('group_details.getGroupByFbId', [fbGroupId]);
      
      // Sběr základních informací o skupině
      const groupInfo = await this.collectGroupBasicInfo(fbGroupId);
      
      // Sběr pokročilých informací (pokud je to možné)
      const advancedInfo = await this.collectGroupAdvancedInfo();
      
      // Kombinace informací
      const completeInfo = {
        ...groupInfo,
        ...advancedInfo,
        discovered_by_user_id: userId,
        last_updated: new Date()
      };

      // Uložení do databáze
      await this.saveGroupToDatabase(completeInfo, existingGroup);

      Log.success('[GROUP_ANALYZER]', `✅ Skupina "${completeInfo.name}" úspěšně analyzována`);
      
      this.currentGroupInfo = completeInfo;
      return completeInfo;

    } catch (err) {
      await Log.error('[GROUP_ANALYZER]', `Chyba při analýze skupiny: ${err.message}`);
      return null;
    }
  }

  /**
   * Extrahuje FB ID skupiny z URL
   */
  extractGroupIdFromUrl(url) {
    try {
      // Různé formáty URL skupin:
      // https://www.facebook.com/groups/123456789012345/
      // https://www.facebook.com/groups/group.name/
      // https://m.facebook.com/groups/123456789012345/?ref=bookmarks
      
      const patterns = [
        /facebook\.com\/groups\/([^\/\?]+)/,
        /\/groups\/([^\/\?]+)/
      ];

      for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
          return match[1];
        }
      }

      return null;
    } catch (err) {
      Log.warn('[GROUP_ANALYZER]', `Chyba při extrakci group ID: ${err.message}`);
      return null;
    }
  }

  /**
   * Sbírá základní informace o skupině
   */
  async collectGroupBasicInfo(fbGroupId) {
    try {
      const info = await this.page.evaluate(() => {
        const result = {
          fb_group_id: null,
          name: null,
          member_count: null,
          description: null,
          privacy_type: 'public'
        };

        // Název skupiny - více selektorů pro různé layouty
        const nameSelectors = [
          'h1[data-testid="group-name"]',
          'h1 span',
          '[data-testid="page-title"] h1',
          'h1.x1heor9g',
          'h1',
          '[role="main"] h1'
        ];

        for (const selector of nameSelectors) {
          const nameEl = document.querySelector(selector);
          if (nameEl && nameEl.textContent.trim()) {
            result.name = nameEl.textContent.trim();
            break;
          }
        }

        // Počet členů - hledání textu s "členů", "members"
        const memberSelectors = [
          '[data-testid="group-member-count"]',
          'a[href*="/members"]',
          'span:contains("členů")',
          'span:contains("members")'
        ];

        // Fallback - hledání textů obsahujících čísla a "členů"/"members"
        const allTexts = Array.from(document.querySelectorAll('*')).map(el => el.textContent);
        const memberTexts = allTexts.filter(text => 
          text && (text.includes('členů') || text.includes('members') || text.includes('členy'))
        );

        for (const text of memberTexts) {
          const match = text.match(/([0-9\s,.]+)\s*(členů|members|členy)/i);
          if (match) {
            const numberStr = match[1].replace(/[\s,.]/g, '');
            const number = parseInt(numberStr);
            if (!isNaN(number) && number > 0) {
              result.member_count = number;
              break;
            }
          }
        }

        // Popis skupiny - hledání v About sekci
        const descriptionSelectors = [
          '[data-testid="group-description"]',
          '[data-testid="about-section"] div',
          '.x1ey2m1c div', 
          '[aria-label*="About"] div'
        ];

        for (const selector of descriptionSelectors) {
          const descEl = document.querySelector(selector);
          if (descEl && descEl.textContent.trim().length > 20) {
            result.description = descEl.textContent.trim().substring(0, 500);
            break;
          }
        }

        // Typ soukromí - hledání ikonek nebo textů
        const privacyIndicators = document.body.textContent.toLowerCase();
        if (privacyIndicators.includes('soukromá') || privacyIndicators.includes('private')) {
          result.privacy_type = 'private';
        } else if (privacyIndicators.includes('uzavřená') || privacyIndicators.includes('closed')) {
          result.privacy_type = 'closed';
        }

        return result;
      });

      // Doplnění FB ID pokud se nepodařilo získat
      if (!info.fb_group_id) {
        info.fb_group_id = fbGroupId;
      }

      return info;

    } catch (err) {
      Log.warn('[GROUP_ANALYZER]', `Chyba při sběru základních info: ${err.message}`);
      return {
        fb_group_id: fbGroupId,
        name: 'Neznámá skupina',
        member_count: null,
        description: null,
        privacy_type: 'public'
      };
    }
  }

  /**
   * Sbírá pokročilé informace o skupině
   */
  async collectGroupAdvancedInfo() {
    try {
      const advancedInfo = await this.page.evaluate(() => {
        const result = {
          category: null,
          language: 'cs',
          activity_level: null,
          posting_allowed: null
        };

        // Kategorie - hledání v About nebo Rules sekci
        const pageText = document.body.textContent.toLowerCase();
        
        // Detekce kategorií podle klíčových slov
        const categories = [
          { keywords: ['prodej', 'bazos', 'inzerát', 'prodám', 'koupím'], category: 'Prodej/Bazar' },
          { keywords: ['bydlení', 'byty', 'pronájem', 'realit'], category: 'Bydlení' },
          { keywords: ['práce', 'brigád', 'zaměstnání', 'hledám práci'], category: 'Práce' },
          { keywords: ['auto', 'automobil', 'motorka', 'doprava'], category: 'Auta/Doprava' },
          { keywords: ['zvířata', 'psi', 'kočky', 'domácí'], category: 'Zvířata' },
          { keywords: ['hobby', 'zálib', 'sport', 'fotbal'], category: 'Hobby/Sport' },
          { keywords: ['mamy', 'děti', 'rodič', 'těhotenství'], category: 'Rodiče/Děti' },
          { keywords: ['kulinář', 'recepty', 'vaření', 'jídlo'], category: 'Vaření' },
          { keywords: ['místní', 'region', 'město', 'okres'], category: 'Místní/Regionální' }
        ];

        for (const cat of categories) {
          if (cat.keywords.some(keyword => pageText.includes(keyword))) {
            result.category = cat.category;
            break;
          }
        }

        // Detekce jazyka
        if (pageText.includes('the ') || pageText.includes('and ') || pageText.includes('this ')) {
          result.language = 'en';
        } else if (pageText.includes('der ') || pageText.includes('und ') || pageText.includes('das ')) {
          result.language = 'de';
        }

        // Úroveň aktivity - podle počtu viditelných příspěvků
        const posts = document.querySelectorAll('[data-testid*="post"], [role="article"]');
        if (posts.length > 10) {
          result.activity_level = 'high';
        } else if (posts.length > 3) {
          result.activity_level = 'medium';
        } else {
          result.activity_level = 'low';
        }

        // Možnost postování - hledání posting boxu
        const postingElements = document.querySelectorAll(
          '[data-testid*="status"], [placeholder*="What"], [placeholder*="Co"], [contenteditable="true"]'
        );
        result.posting_allowed = postingElements.length > 0;

        return result;
      });

      return advancedInfo;

    } catch (err) {
      Log.warn('[GROUP_ANALYZER]', `Chyba při sběru pokročilých info: ${err.message}`);
      return {
        category: null,
        language: 'cs',
        activity_level: null,
        posting_allowed: null
      };
    }
  }

  /**
   * Uloží informace o skupině do databáze
   */
  async saveGroupToDatabase(groupInfo, existingGroup) {
    try {
      const params = [
        groupInfo.fb_group_id,
        groupInfo.name,
        groupInfo.member_count,
        groupInfo.description,
        groupInfo.category,
        groupInfo.privacy_type,
        groupInfo.discovered_by_user_id,
        `Analyzováno ${new Date().toLocaleString()}`,
        null, // is_relevant - zatím nehodnotíme
        groupInfo.posting_allowed,
        groupInfo.language,
        groupInfo.activity_level
      ];

      await db.safeExecute('group_details.insertGroup', params);

      if (existingGroup) {
        Log.info('[GROUP_ANALYZER]', '📝 Aktualizovány informace o existující skupině');
      } else {
        Log.success('[GROUP_ANALYZER]', '🆕 Nová skupina přidána do databáze');
      }

      // Logování akce
      await db.logAction(
        groupInfo.discovered_by_user_id,
        'group_explore',
        groupInfo.fb_group_id,
        `Analyzována skupina: ${groupInfo.name}`
      );

    } catch (err) {
      Log.error('[GROUP_ANALYZER]', `Chyba při ukládání do DB: ${err.message}`);
      throw err;
    }
  }

  /**
   * Naviguje na náhodnou doporučenou skupinu
   */
  async navigateToRandomGroup() {
    try {
      // Hledání odkazů na další skupiny na současné stránce
      const groupLinks = await this.page.evaluate(() => {
        const links = [];
        const anchors = document.querySelectorAll('a[href*="/groups/"]');
        
        for (const anchor of anchors) {
          const href = anchor.href;
          const text = anchor.textContent.trim();
          
          if (href.includes('/groups/') && text.length > 0 && text.length < 100) {
            links.push({
              url: href,
              text: text
            });
          }
        }
        
        return links.slice(0, 10); // Max 10 odkazů
      });

      if (groupLinks.length === 0) {
        Log.info('[GROUP_ANALYZER]', '🔍 Žádné odkazy na skupiny nenalezeny');
        return false;
      }

      // Vybere náhodný odkaz
      const randomLink = groupLinks[Math.floor(Math.random() * groupLinks.length)];
      
      Log.info('[GROUP_ANALYZER]', `🎯 Navigace na skupinu: ${randomLink.text}`);
      
      await this.page.goto(randomLink.url, { waitUntil: 'networkidle' });
      await Wait.toSeconds(4, 'Čekání na načtení');
      
      return true;

    } catch (err) {
      Log.warn('[GROUP_ANALYZER]', `Chyba při navigaci: ${err.message}`);
      return false;
    }
  }

  /**
   * Vrací aktuální informace o skupině
   */
  getCurrentGroupInfo() {
    return this.currentGroupInfo;
  }

  /**
   * Získá statistiky o prozkoumávaných skupinách pro uživatele
   */
  async getUserExplorationStats(userId) {
    try {
      const stats = await db.safeQueryFirst('group_details.getUserExplorationStats', [userId]);
      return stats || {
        groups_discovered: 0,
        relevant_found: 0,
        last_discovery: null
      };
    } catch (err) {
      Log.error('[GROUP_ANALYZER]', `Chyba při načítání statistik: ${err.message}`);
      return null;
    }
  }
}