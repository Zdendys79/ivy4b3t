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
import { TextNormalizer } from './libs/iv_text_normalizer.class.js';

export class FBGroupAnalyzer {
  constructor(page, fbBot = null) {
    this.page = page;
    this.fbBot = fbBot;
    this.currentGroupInfo = null;
    this.textNormalizer = new TextNormalizer();
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
      // Extrakce názvu skupiny a Facebook ID z odkazu skupiny - JEDEN ELEMENT MA OBOJE!
      let groupInfo = await this.page.evaluate(() => {
        // Najdi odkaz na skupinu s názvem - tento element obsahuje URL i název
        // Používáme tabindex="0" jako přesnější selektor pro interaktivní FB linky
        const groupLink = document.querySelector('a[href*="/groups/"][role="link"][tabindex="0"]');
        
        if (groupLink && groupLink.href) {
          const hrefMatch = groupLink.href.match(/facebook\.com\/groups\/([^\/\?]+)/);
          
          if (hrefMatch) {
            // Místo textContent použij jen první textNode nebo specifický element
            let name = null;
            
            // Pokus najít přímý textový obsah (první text node)
            for (const child of groupLink.childNodes) {
              if (child.nodeType === Node.TEXT_NODE && child.textContent.trim()) {
                name = child.textContent.trim();
                break;
              }
            }
            
            // Pokud není přímý text, zkus najít první span/div element
            if (!name) {
              const nameElement = groupLink.querySelector('span, div, strong, h1, h2, h3');
              if (nameElement) {
                // Vezmi jen obsah tohoto elementu, ne jeho potomků
                name = nameElement.childNodes[0]?.textContent?.trim() || nameElement.textContent.trim();
              }
            }
            
            // Fallback na textContent, ale omez délku
            if (!name) {
              const fullText = groupLink.textContent.trim();
              // Vezmi jen prvních N znaků nebo do prvního speciálního znaku
              name = fullText.split(/[\.]{3}|Nepřečteno|Označit|Přivítejme/)[0].trim();
            }
            
            if (name && !name.includes('Facebook') && name.length > 3 && name.length < 100) {
              return {
                fbId: hrefMatch[1],
                name: name
              };
            }
          }
        }
        
        return null;
      });
      
      // Fallback na původní metodu pokud specifický odkaz nebyl nalezen
      if (!groupInfo) {
        const url = this.page.url();
        const fbIdMatch = url.match(/facebook\.com\/groups\/([^\/\?]+)/);
        
        if (!fbIdMatch) {
          throw new Error('Nejsme na stránce FB skupiny');
        }
        
        const fbId = fbIdMatch[1];
        
        // Fallback hledání názvu pomocí obecných selektorů
        const name = await this.page.evaluate(() => {
          const selectors = [
            'h1[dir="auto"]', 'h1', '[role="banner"] h1',
            '[data-pagelet="GroupsPageBanner"] h1', 'span[dir="auto"]'
          ];
          
          for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element && element.textContent.trim() && 
                !element.textContent.includes('Facebook') &&
                element.textContent.length > 3) {
              return element.textContent.trim();
            }
          }
          
          const title = document.title;
          if (title && !title.includes('Facebook') && title.length > 3) {
            return title.split('|')[0].trim();
          }
          
          return null;
        });
        
        if (!name) {
          throw new Error('Nelze extrahovat název skupiny');
        }
        
        groupInfo = { fbId, name };
      }
      
      // Extrakce počtu členů pomocí robustní metody
      const memberCount = await this.readUserCounter();
      
      // Detekce kategorie/oboru skupiny ze jména
      const category = this.detectGroupCategory(groupInfo.name);

      return {
        fb_id: groupInfo.fbId,
        name: groupInfo.name || 'Neznámý název',
        member_count: memberCount,
        type: 'Z', // Všechny nové skupiny jsou typ Z
        category: category,
        url: this.page.url()
      };
      
    } catch (err) {
      await Log.error('[GROUP_ANALYZER]', `Chyba při extrakci informací: ${err.message}`);
      return null;
    }
  }

  /**
   * Extrahuje klíčová slova z názvu skupiny pro databázové ukládání
   */
  extractKeywords(groupName) {
    if (!groupName || typeof groupName !== 'string') {
      return [];
    }

    // Normalizace textu
    const normalized = this.textNormalizer.normalize(groupName.toLowerCase());
    
    // Rozdělení na slova, odstranění interpunkce a krátkých slov
    const words = normalized
      .split(/[\s\-_.,!?()[\]{}]+/)
      .filter(word => word.length >= 2)
      .map(word => word.trim())
      .filter(word => word.length > 0);

    // Odstranění duplicit zachováním pořadí
    return [...new Set(words)];
  }

  /**
   * Uloží klíčová slova ze skupiny do databáze
   */
  async saveKeywordsToDatabase(groupId, keywords) {
    if (!keywords || keywords.length === 0) return;

    try {
      for (let i = 0; i < keywords.length; i++) {
        const word = keywords[i];
        
        // Ulož/aktualizuj klíčové slovo
        await db.safeExecute(`
          INSERT INTO group_keywords (word, frequency) 
          VALUES (?, 1)
          ON DUPLICATE KEY UPDATE frequency = frequency + 1
        `, [word]);
        
        // Získej ID klíčového slova
        const keywordRow = await db.safeQueryFirst(`
          SELECT id FROM group_keywords WHERE word = ?
        `, [word]);
        
        if (keywordRow) {
          // Vytvoř asociaci mezi skupinou a klíčovým slovem
          await db.safeExecute(`
            INSERT IGNORE INTO group_word_associations (group_id, keyword_id, position_in_name)
            VALUES (?, ?, ?)
          `, [groupId, keywordRow.id, i]);
        }
      }
      
      Log.debug('[GROUP_ANALYZER]', `Uloženo ${keywords.length} klíčových slov pro skupinu ${groupId}`);
    } catch (err) {
      await Log.error('[GROUP_ANALYZER]', `Chyba při ukládání klíčových slov: ${err.message}`);
    }
  }

  /**
   * Detekce kategorie/oboru skupiny podle názvu - nyní může vrátit více kategorií
   */
  detectGroupCategory(groupName) {
    if (!groupName || typeof groupName !== 'string') {
      return null;
    }

    const name = groupName.toLowerCase();

    // Kategorie podle klíčových slov v názvu
    const categoryMap = {
      'Bazar/Prodej': ['bazar', 'prodej', 'inzerce', 'inzerát', 'koupit', 'prodat', 'výkup', 'market', 'obchod', 'aukce'],
      'Technologie/IT': ['linux', 'windows', 'android', 'ios', 'programming', 'programování', 'developer', 'it ', 'tech', 'software', 'hardware', 'computer', 'počítač'],
      'Fotografie': ['foto', 'fotograf', 'photography', 'camera', 'canon', 'nikon', 'sony', 'objektiv'],
      'Auta/Motorky': ['auto', 'car', 'motor', 'bmw', 'audi', 'škoda', 'ford', 'tuning', 'motocykl', 'bike'],
      'Zdraví/Fitness': ['fitness', 'gym', 'cvičení', 'zdraví', 'sport', 'běh', 'yoga', 'wellness'],
      'Cestování': ['cestování', 'travel', 'dovolená', 'výlet', 'turistika', 'backpack'],
      'Vaření/Jídlo': ['vaření', 'recept', 'jídlo', 'kuchyň', 'food', 'cooking', 'chef'],
      'Zvířata': ['pes', 'kočka', 'dog', 'cat', 'zvířata', 'pets', 'veterinář'],
      'Hudba': ['hudba', 'music', 'koncert', 'kapela', 'band', 'festival'],
      'Rodiče/Děti': ['maminky', 'rodiče', 'děti', 'baby', 'těhotenství', 'family'],
      'Lokální': ['praha', 'brno', 'ostrava', 'plzeň', 'liberec', 'hradec', 'pardubice', 'zlín', 'olomouc', 'ústí', 'město', 'okres', 'region']
    };

    // Najdi VŠECHNY odpovídající kategorie
    const foundCategories = [];
    for (const [category, keywords] of Object.entries(categoryMap)) {
      for (const keyword of keywords) {
        if (name.includes(keyword)) {
          foundCategories.push(category);
          break; // Další klíčová slova ze stejné kategorie už nehledej
        }
      }
    }

    // Vrať kategorie oddělené čárkami nebo null
    const result = foundCategories.length > 0 ? foundCategories.join(', ') : null;
    
    if (result) {
      Log.debug('[GROUP_ANALYZER]', `Detekované kategorie pro "${groupName}": ${result}`);
    } else {
      Log.debug('[GROUP_ANALYZER]', `Žádná kategorie detekována pro: "${groupName}"`);
    }
    
    return result;
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
      
      const result = await db.safeExecute('groups.upsertGroupInfo', [
        groupInfo.fb_id,
        sanitizedName,
        groupInfo.member_count,
        groupInfo.category || null
      ]);
      
      // Pokud byla skupina nově vytvořena, ulož klíčová slova
      if (result && (result.insertId || result.affectedRows > 0)) {
        const keywords = this.extractKeywords(groupInfo.name);
        if (keywords.length > 0) {
          // Potřebujeme ID skupiny - buď z insertId nebo z databázového dotazu
          let groupDbId = result.insertId;
          if (!groupDbId) {
            const groupRow = await db.safeQueryFirst('SELECT id FROM fb_groups WHERE fb_id = ?', [groupInfo.fb_id]);
            groupDbId = groupRow?.id;
          }
          
          if (groupDbId) {
            await this.saveKeywordsToDatabase(groupDbId, keywords);
          }
        }
      }
      
      const categoryInfo = groupInfo.category ? ` [${groupInfo.category}]` : ' [bez kategorie]';
      Log.info('[GROUP_ANALYZER]', `Skupina ${sanitizedName} (ID: ${groupInfo.fb_id})${categoryInfo} uložena do databáze`);
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
   * Čte počet členů skupiny z různých možných formátů
   * Podporuje formáty: "1,6 tis. členů", "1234 členů", "sledujících" atd.
   */
  async readUserCounter() {
    try {
      // Pokus o nalezení počtu členů
      const memberCount = await this.page.evaluate(() => {
        // Hledání všech elementů obsahujících text s počtem členů/sledujících
        const elements = Array.from(document.querySelectorAll('span, div'))
          .filter(el => {
            const text = el.textContent || '';
            return text.includes('členů') || text.includes('člen') || 
                   text.includes('sledujících') || text.includes('sledující');
          });
        
        for (const element of elements) {
          const text = element.textContent || '';
          // Hledání číselné hodnoty před klíčovým slovem
          const regex = /([0-9]+(?:[,\.\s][0-9]+)*)\s*(?:tis\.?)?\s*(?:členů|člen|sledujících|sledující)/i;
          const match = text.match(regex);
          
          if (match) {
            return {
              rawText: text,
              numberPart: match[1],
              hasTis: text.includes('tis.')
            };
          }
        }
        return null;
      });
      
      if (!memberCount) {
        Log.warn('[GROUP_ANALYZER]', 'Nepodařilo se najít počet členů skupiny');
        return null;
      }
      
      // Převod na číslo pomocí getCounterValue
      const parsedCount = this.getCounterValue(memberCount.rawText);
      
      return parsedCount;
      
    } catch (err) {
      Log.error('[GROUP_ANALYZER]', `Chyba při čtení počtu členů: ${err.message}`);
      return null;
    }
  }
  
  /**
   * Převede textový formát počtu členů na číslo
   * Např. "2.6 tis. členů" -> 2600
   */
  getCounterValue(str) {
    try {
      if (!str) return null;
      
      // Najdi specifický pattern pro počet členů
      const memberRegex = /(\d+(?:[,\.]\d+)?)\s*(?:tis\.?|tisíc)?\s*(?:členů|člen)/i;
      const match = str.match(memberRegex);
      
      if (!match) {
        return null;
      }
      
      // Vezmi číselnou část a normalizuj
      let numberStr = match[1].replace(/,/g, '.');
      let value = parseFloat(numberStr);
      
      // Pokud text obsahuje "tis." nebo "tisíc", vynásob 1000
      if (str.includes('tis.') || str.includes('tisíc')) {
        value *= 1000;
      }
      
      // Pokud text obsahuje "mil.", vynásob 1000000
      if (str.includes('mil.')) {
        value *= 1000000;
      }
      
      return Math.round(value);
      
    } catch (err) {
      Log.error('[GROUP_ANALYZER]', `Chyba při parsování počtu: ${err.message}`);
      return null;
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
   * Vyčistí string pomocí TextNormalizer - správná funkce pro ASCII+české znaky
   */
  sanitizeString(str) {
    if (!str || typeof str !== 'string') {
      return '';
    }
    
    // Použij existující TextNormalizer místo vlastní logiky
    const normalized = this.textNormalizer.normalize(str);
    
    // Dodatečné omezení délky pro databázi
    return normalized.substring(0, 250).trim();
  }
}