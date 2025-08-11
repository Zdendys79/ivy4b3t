/**
 * Název souboru: iv_group_name_extractor.class.js
 * Umístění: ~/ivy/libs/iv_group_name_extractor.class.js
 *
 * Popis: Univerzální extraktor názvu Facebook skupiny z aktuální stránky
 * - Používá matching podle group ID z URL pro maximální přesnost
 * - Selektivní extrakce textu (bez notifikací a jiného UI obsahu)
 * - Použitelný v group_explore, utio_post a dalších akcích
 */

export class GroupNameExtractor {
  /**
   * Extrahuje název aktuální Facebook skupiny ze stránky
   * @param {Object} page - Puppeteer page instance
   * @returns {Promise<{name: string, fbId: string}|null>} Název a ID skupiny nebo null
   */
  static async extractGroupName(page) {
    try {
      return await page.evaluate(() => {
        // Nejprve zjistíme ID aktuální skupiny z URL stránky
        const currentUrl = window.location.href;
        const currentGroupIdMatch = currentUrl.match(/facebook\.com\/groups\/([^\/\?]+)/);
        
        if (!currentGroupIdMatch) {
          return null; // Nejsme na stránce skupiny
        }
        
        const currentGroupId = currentGroupIdMatch[1];
        
        // Najdi odkaz který má STEJNÉ ID skupiny jako aktuální stránka
        // Tento odkaz bude obsahovat název skupiny
        const groupLink = document.querySelector(`a[href*="/groups/${currentGroupId}"][role="link"][tabindex="0"]`);
        
        if (groupLink && groupLink.href) {
          const hrefMatch = groupLink.href.match(/facebook\.com\/groups\/([^\/\?]+)/);
          
          if (hrefMatch && hrefMatch[1] === currentGroupId) {
            // Selektivní extrakce názvu - místo textContent použij specifické metody
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
            
            // Fallback na textContent, ale omez délku a odfiltruj UI text
            if (!name) {
              const fullText = groupLink.textContent.trim();
              // Vezmi jen prvních N znaků nebo do prvního speciálního znaku
              name = fullText.split(/[\.]{3}|Nepřečteno|Označit|Přivítejte|Přivítejme|TeĎ ve skupině/)[0].trim();
            }
            
            // Validace a čištění názvu
            if (name && !name.includes('Facebook') && name.length > 3 && name.length < 100) {
              return {
                fbId: currentGroupId,
                name: name
              };
            }
          }
        }
        
        return null;
      });
      
    } catch (err) {
      console.error('[GROUP_NAME_EXTRACTOR]', `Chyba při extrakci názvu skupiny: ${err.message}`);
      return null;
    }
  }
  
  /**
   * Extrahuje pouze název skupiny (bez ID)
   * @param {Object} page - Puppeteer page instance  
   * @returns {Promise<string|null>} Název skupiny nebo null
   */
  static async extractGroupNameOnly(page) {
    const result = await this.extractGroupName(page);
    return result ? result.name : null;
  }
  
  /**
   * Extrahuje pouze Facebook ID skupiny z URL
   * @param {Object} page - Puppeteer page instance
   * @returns {Promise<string|null>} Facebook ID skupiny nebo null
   */
  static async extractGroupId(page) {
    try {
      return await page.evaluate(() => {
        const currentUrl = window.location.href;
        const match = currentUrl.match(/facebook\.com\/groups\/([^\/\?]+)/);
        return match ? match[1] : null;
      });
    } catch (err) {
      console.error('[GROUP_NAME_EXTRACTOR]', `Chyba při extrakci ID skupiny: ${err.message}`);
      return null;
    }
  }
}