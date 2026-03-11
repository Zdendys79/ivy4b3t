// fb_navigation.js – Navigation mixin for FBBot

import { Log } from '../iv_log.class.js';
import { Wait } from '../iv_wait.class.js';
import { db } from '../../iv_sql.js';

export const NavigationMixin = {

  /**
   * Rychlá navigace s výchozími parametry pro FB stránky
   * @param {string} url - cílová URL
   * @returns {Promise<boolean>} true pokud navigace uspěla
   */
  async navigateQuick(url) {
    return this.navigateToPage(url, {
      waitUntil: 'domcontentloaded',
      timeout: 10000
    });
  },

  /**
   * Navigace na FB skupinu s optimálními parametry
   * @param {string} groupId - FB ID skupiny
   * @param {boolean} isBuySell - true pokud je to buy/sell skupina
   * @returns {Promise<boolean>} true pokud navigace uspěla
   */
  async navigateToGroup(groupId, isBuySell = false) {
    let url = `https://www.facebook.com/groups/${groupId}`;
    if (isBuySell) {
      url += '/buy_sell_discussion';
    }
    return this.navigateQuick(url);
  },

  /**
   * Navigace na hlavní FB stránku
   * @returns {Promise<boolean>} true pokud navigace uspěla
   */
  async navigateToHome() {
    return this.navigateQuick('https://www.facebook.com/');
  },

  /**
   * Naviguje na URL a ověří zdraví stránky pomocí analýzy
   * @param {string} url - cílová URL
   * @param {object} options - Puppeteer goto options
   * @returns {Promise<boolean>} true pokud je stránka zdravá nebo byl problém vyřešen
   */
  async navigateToPage(url, options = {}) {
    try {
      // Výchozí nastavení pro bezpečnou navigaci
      const safeOptions = {
        waitUntil: options.waitUntil || 'domcontentloaded',
        timeout: options.timeout || 10000 // 10s timeout - stránka musí být načtena rychle
      };

      Log.debug('[FB]', `Navigace na ${url} s options:`, safeOptions);

      // a) Navigace na stránku s timeoutem
      await this.page.goto(url, safeOptions);

      // V UI režimu neprovádět žádnou analýzu
      if (this.disableAnalysis) {
        Log.success('[FB]', `Navigace na ${url} úspěšná (UI režim - bez analýzy)`);
        return true;
      }

      // Inicializace analyzeru pokud ještě není (pouze pokud není zakázána analýza)
      if (!this.pageAnalyzer && !this.disableAnalysis) {
        await this.initializeAnalyzer();
      }

      // Rozlišení mezi prvním otevřením FB a navigací na skupiny
      const isMainFacebookPage = url === 'https://www.facebook.com/' || url === 'https://facebook.com/';

      // b) Komplexní analýza pouze pro hlavní FB stránku, pro skupiny jen základní kontrola
      let analysis;
      if (isMainFacebookPage) {
        // Plná analýza včetně cookies/login detekce pouze pro hlavní FB stránku
        analysis = await this.pageAnalyzer.analyzeFullPage({
          includePostingCapability: false
        });
      } else {
        // Pro skupiny pouze základní kontrola bez cookies/login vzorů
        analysis = await this.pageAnalyzer.analyzeBasicPage();
      }

      if (analysis.complexity.isNormal && !analysis.complexity.suspiciouslySimple) {
        Log.success('[FB]', `Navigace na ${url} úspěšná - stránka je v pořádku`);
        return true;
      } else {
        Log.info('[FB]', `Stránka ${url} vypadá podezřele - provádím další analýzu`);
        return await this.handlePageIssues(analysis);
      }

    } catch (err) {
      await Log.error('[FB]', `Chyba při navigaci na ${url}: ${err.message}`);
      throw err;
    }
  },

  async openFB(user) {
    try {
      await this.bringToFront();

      await this.navigateToPage('https://www.facebook.com/', { waitUntil: 'domcontentloaded' });
      await Wait.toSeconds(3);
      return true;
    } catch (err) {
      await Log.error('[FB]', `Chyba při otevírání stránky Facebooku: ${err.message}`);
      return false;
    }
  },

  async openGroup(group) {
    try {


      await this.bringToFront();

      let fbGroupUrl;
      if (group.type === "P") {
        fbGroupUrl = `https://FB.com/${group.fb_id}`;
      } else if (group.is_buy_sell_group) {
        fbGroupUrl = `https://FB.com/groups/${group.fb_id}/buy_sell_discussion`;
        Log.info('[FB]', `Používám optimalizovanou navigaci pro prodejní skupinu`);
      } else {
        fbGroupUrl = `https://FB.com/groups/${group.fb_id}`;
      }

      // Lidská pauza před navigací na skupinu
      await Wait.toSeconds(15, `Před navigací na skupinu ${group.name}`);

      Log.info('[FB]', `Otevírám skupinu: ${fbGroupUrl}`);

      await this.navigateToPage(fbGroupUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });

      await Wait.toSeconds(8, 'Náhodná pauza 5-8s');

      // NOVÉ - Analýza skupiny po načtení
      if (this.pageAnalyzer) {
        const analysis = await this.pageAnalyzer.analyzeFullPage({ forceRefresh: true });
        Log.info('[FB]', `Analýza skupiny dokončena - stav: ${analysis.status}`);

        // Uložení detailů o skupině, pokud je to skutečně skupina
        if (analysis.group?.isGroup) {
          await db.saveGroupExplorationDetails(analysis, this.userId);
          Log.info('[FB]', `Uloženy detaily pro skupinu ${group.fb_id}`);
        }

        // Uložení objevených odkazů
        if (analysis.links?.groups?.length > 0) {
          await db.saveDiscoveredLinks(analysis.links.groups, this.userId);
          Log.info('[FB]', `Uloženo ${analysis.links.groups.length} nových odkazů na skupiny.`);
        }
      }

      Log.success('[FB]', `Skupina ${group.fb_id} úspěšně otevřena`);
      return true;

    } catch (err) {
      await Log.error('[FB]', `Chyba při otevírání skupiny ${group.fb_id}: ${err.message}`);
      return false;
    }
  }
};
