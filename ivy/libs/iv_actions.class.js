/**
 * Název souboru: iv_actions.class.js
 * Umístění: ~/ivy/libs/iv_actions.class.js
 *
 * Popis: Třída pro správu jednotlivých akcí včetně nových typů post_utio pro různé typy skupin.
 *        Každá akce odpovídá hodnotě `action_code` z tabulky `action_definitions`.
 *        Refaktorováno z původního iv_actions.js na objekt pro lepší testovatelnost.
 */

import * as wait from '../iv_wait.js';
import * as support from '../iv_support.js';
import * as fbSupport from '../iv_fb_support.js';
import { groupExploreAction } from '../iv_group_explore_action.js';
import { setInvasiveLock, initInvasiveLock, clearInvasiveLock } from '../iv_wheel.js';
import { db } from '../iv_sql.js'
import { SQL } from '../sql/queries/index.js';
import { getAllConfig } from '../iv_config.js';
import { Log } from './iv_log.class.js';
import { getAvailableGroupsForUser, detectMembershipRequest, blockUserGroup } from '../user_group_escalation.js';

export class IvActions {
  constructor(options = {}) {
    this.db = options.db || db;
    this.config = null;
    this.initialized = false;
  }

  /**
   * Inicializuje třídu a načte konfiguraci
   */
  async init() {
    try {
      this.config = await getAllConfig();
      this.initialized = true;
      return true;
    } catch (error) {
      await Log.error('[ACTIONS]', `Chyba při inicializaci IvActions: ${error.message}`);
      return false;
    }
  }

  /**
   * Ověří, že je třída inicializována
   */
  ensureInitialized() {
    if (!this.initialized) {
      throw new Error('IvActions není inicializována. Zavolej init() nejdříve.');
    }
  }

  /**
   * Určuje požadavky konkrétní akce na služby (FB, UTIO)
   * @param {string} actionCode - kód akce
   * @returns {object} - {needsFB: boolean, needsUtio: boolean}
   */
  async getActionRequirements(actionCode) {
    const requirements = {
      needsFB: false,
      needsUtio: false
    };

    switch (actionCode) {
      // Akce vyžadující POUZE FB (bez UTIO)
      case 'group_post':        // Příspěvky do zájmových skupin (bez UTIO)
      case 'timeline_post':
      case 'comment':
      case 'react':
      case 'messenger_check':
      case 'messenger_reply':
      case 'quote_post':
      case 'group_explore':
        requirements.needsFB = true;
        break;

      // Akce vyžadující FB + UTIO
      case 'post_utio_g':       // UTIO post do běžných skupin
      case 'post_utio_gv':      // UTIO post do vlastních skupin
      case 'post_utio_p':       // UTIO post do prodejních skupin
        requirements.needsFB = true;
        requirements.needsUtio = true;
        break;

      // Akce nevyžadující ani FB ani UTIO
      case 'account_delay':
      case 'account_sleep':
        // Tyto akce nepotřebují žádné služby
        break;

      default:
        await Log.warn('[ACTIONS]', `Neznámý action_code: ${actionCode}`);
        break;
    }

    return requirements;
  }

  /**
   * Ověří připravenost před spuštěním jakékoliv akce
   * @param {Object} user - Uživatelské data
   * @param {Object} fbBot - FBBot instance
   * @param {string} actionCode - Kód akce
   * @param {Object} options - Další možnosti
   * @returns {Promise<Object>} Výsledek ověření
   */
  async verifyActionReadiness(user, fbBot, actionCode, options = {}) {
    try {
      Log.info(`[${user.id}]`, `🔍 Ověřuji připravenost pro akci: ${actionCode}`);

      const actionRequirements = await this.getActionRequirements(actionCode);

      // Pokud akce nevyžaduje FB, není co ověřovat
      if (!actionRequirements.needsFB) {
        return {
          ready: true,
          reason: 'Akce nevyžaduje FB'
        };
      }

      // Základní ověření FB pomocí nového modulu
      const verificationOptions = {
        requireSpecificGroup: options.targetGroup || null,
        requirePostingCapability: actionCode.includes('post') || actionCode.includes('comment'),
        allowWarnings: actionCode === 'react' || actionCode === 'messenger_check', // Méně kritické akce
        includeDetailedAnalysis: actionCode.includes('utio') // Detailní analýza pro UTIO operace
      };

      const readinessResult = await fbSupport.verifyFBReadiness(user, fbBot, verificationOptions);

      if (!readinessResult.ready) {
        await Log.warn(`[${user.id}]`, `⚠️ Akce ${actionCode} není připravena: ${readinessResult.reason}`);
      } else {
        Log.success(`[${user.id}]`, `✅ Akce ${actionCode} je připravena`);
      }

      return readinessResult;

    } catch (err) {
      await Log.error(`[${user.id}]`, `Chyba při ověřování akce ${actionCode}: ${err.message}`);
      return {
        ready: false,
        reason: `Chyba při ověřování: ${err.message}`,
        critical: true
      };
    }
  }

  /**
   * NOVÁ JEDNODUCHÁ METODA - Postování UTIO zprávy do skupiny
   * Zaměřuje se pouze na "Napište něco" element, žádné složité fallback mechanismy
   * @param {Object} user - Uživatelská data
   * @param {Object} fbBot - FBBot instance
   * @param {Object} utioBot - UtioBot instance
   * @param {string} groupType - Typ skupiny (g, gv, p)
   * @returns {Promise<boolean>} - True pokud byl post úspěšný
   */
  async handleSingleUtioPost(user, fbBot, utioBot, groupType) {
    const actionCode = `post_utio_${groupType}`;
    const joinActionCode = `join_group_${groupType}`;

    const group = await this.db.getSingleAvailableGroup(user.id, groupType.toUpperCase());
    if (!group) {
      await Log.warn(`[${user.id}]`, `Žádné dostupné skupiny typu '${groupType}' pro akci ${actionCode}.`);
      return false;
    }

    Log.info(`[${user.id}]`, `Vybrána skupina: ${group.name} (${group.fb_id})`);

    try {
      // Otevři skupinu
      await fbBot.openGroup(group);
      await wait.delay(300 + Math.random() * 700); // 0.3-1s pro načtení

      // Rychlá kontrola na "Obsah teď není dostupný" hned na začátku
      const pageContent = await fbBot.page.evaluate(() => document.body.textContent);
      if (pageContent.includes('Obsah teď není dostupný')) {
        await Log.warn(`[${user.id}]`, `Skupina ${group.name} je trvale nedostupná`);
        await wait.delay(2000 + Math.random() * 3000);
        await blockUserGroup(user.id, group.id, 'Obsah trvale nedostupný - skupina neexistuje');
        return false;
      }

      // Inicializuj analyzer pro elementy
      fbBot.initializeAnalyzer();
      await wait.delay(500); // Krátká pauza pro inicializaci

      // Zkus najít "Napište něco" element
      Log.info(`[${user.id}]`, `🔍 Hledám "Napište něco" element...`);
      const canPost = await fbBot.pageAnalyzer.clickElementWithText('Napište něco', {
        matchType: 'exact',
        scrollIntoView: false,
        waitAfterClick: false,
        naturalDelay: true,
        dryRun: true // Pouze testuj, neklikej
      });

      if (canPost) {
        Log.info(`[${user.id}]`, `✅ "Napište něco" nalezeno, pokračuji s publikací...`);
        return await this.performSimplePublication(user, fbBot, utioBot, group, actionCode);
      }

      // Pokud není "Napište něco", zkus join tlačítko
      Log.info(`[${user.id}]`, `🔍 "Napište něco" nenalezeno, hledám join tlačítko...`);
      
      const joinTexts = ['Přidat se ke skupině', 'Join Group', 'Připojit se'];
      let joinFound = false;
      
      for (const joinText of joinTexts) {
        const canJoin = await fbBot.pageAnalyzer.clickElementWithText(joinText, {
          matchType: 'contains',
          scrollIntoView: false,
          waitAfterClick: false,
          naturalDelay: false,
          dryRun: true
        });
        
        if (canJoin) {
          joinFound = true;
          break;
        }
      }

      if (joinFound) {
        // Zkontroluj, zda už jsme se nedávno pokoušeli připojit
        const recentJoin = await this.db.getRecentJoinGroupAction(user.id, joinActionCode);
        if (recentJoin) {
          Log.info(`[${user.id}]`, `⏰ Již byla odeslána žádost o členství v posledních 8 hodinách`);
          return true;
        }

        Log.info(`[${user.id}]`, `🚀 Pokouším se přidat do skupiny ${group.name}...`);
        const joinResult = await fbBot.joinToGroup();
        
        if (joinResult) {
          await wait.delay(2000 + Math.random() * 2000);
          await this.db.logAction(user.id, joinActionCode, group.id, `Žádost o členství: ${group.name}`);
          Log.success(`[${user.id}]`, `✅ Žádost o členství odeslána do ${group.name}`);
          return true;
        } else {
          await blockUserGroup(user.id, group.id, 'Failed to click join button');
          return false;
        }
      }

      // Pokud nejsou ani "Napište něco" ani join tlačítka, skupina je problematická
      await Log.warn(`[${user.id}]`, `Skupina ${group.name} nemá dostupné akce - ani postování ani join`);
      await blockUserGroup(user.id, group.id, 'Skupina neobsahuje potřebné elementy pro interakci');
      return false;

    } catch (err) {
      await Log.error(`[${user.id}]`, `Chyba při práci se skupinou ${group.name}: ${err.message}`);
      await blockUserGroup(user.id, group.id, `Systémová chyba: ${err.message}`);
      return false;
    }
  }

  /**
   * NOVÁ JEDNODUCHÁ PUBLIKACE - Pouze klikni na "Napište něco" a publikuj
   * Bez složitých analýz a doplňkových akcí
   */
  async performSimplePublication(user, fbBot, utioBot, group, actionCode) {
    Log.info(`[${user.id}]`, `📝 Jednoduché publikování do skupiny ${group.name}...`);
    
    try {
      // Klikni na "Napište něco" element
      const clicked = await fbBot.pageAnalyzer.clickElementWithText('Napište něco', {
        matchType: 'exact',
        scrollIntoView: false,
        waitAfterClick: true,
        naturalDelay: true
      });

      if (!clicked) {
        Log.error(`[${user.id}]`, `❌ Nepodařilo se kliknout na "Napište něco"`);
        return false;
      }

      // Počkej na otevření editoru a pak získej zprávu z UTIO
      await wait.delay(1000 + Math.random() * 2000); // 1-3s

      const message = await support.pasteMsg(user, group, fbBot, utioBot);
      if (!message) {
        Log.warn(`[${user.id}]`, '❌ Publikace selhala (pasteMsg vrátilo false)');
        return false;
      }

      await this.db.logAction(user.id, actionCode, group.id, `Post do skupiny: ${group.name}`);
      await support.updatePostStats(group, user, actionCode);
      Log.success(`[${user.id}]`, `✅ Úspěšně publikováno do skupiny ${group.name}!`);
      return true;

    } catch (err) {
      Log.error(`[${user.id}]`, `❌ Chyba při jednoduché publikaci: ${err.message}`);
      return false;
    }
  }

  /**
   * PŮVODNÍ KOMPLEXNÍ PUBLIKACE - Zachována pro kompatibilitu
   */
  async performPublication(user, fbBot, utioBot, group, actionCode) {
    Log.info(`[${user.id}]`, `Zahajuji publikaci do skupiny ${group.name}...`);
    
    // Zpracování doplňkových akcí před postováním
    const analysis = await fbBot.pageAnalyzer.lastAnalysis;
    if (analysis && analysis.supplementary_actions && analysis.supplementary_actions.length > 0) {
      for (const action of analysis.supplementary_actions) {
        if (action.type === 'ACCEPT_EXPERT_INVITE') {
          await Log.info(`[${user.id}]`, 'Detekována doplňková akce: Přijetí pozvánky experta.');
          await fbBot.handleAcceptExpertInvite();
        }
      }
    }

    // Fáze 3: Publikování
    const message = await support.pasteMsg(user, group, fbBot, utioBot);
    if (!message) {
      // Logika v pasteMsg už by měla zalogovat specifickou chybu
      await Log.warn(`[${user.id}]`, 'Publikace selhala (pasteMsg vrátilo false).');
      return false;
    }

    await this.db.logAction(user.id, actionCode, group.id, `Post do skupiny: ${group.name}`);
    await support.updatePostStats(group, user, actionCode);
    Log.success(`[${user.id}]`, `✅ Úspěšně publikováno do skupiny ${group.name}!`);
    return true;
  }

  /**
   * HLAVNÍ FUNKCE - Spouští konkrétní akci na základě action_code
   * @param {Object} user - Uživatelské data
   * @param {string} actionCode - Kód akce k provedení
   * @param {Object} context - Kontext s instancemi botů
   * @param {Object} pickedAction - Vybraná akce z wheel of fortune
   * @returns {Promise<boolean>} True pokud byla akce úspěšná
   */
  async runAction(user, actionCode, context, pickedAction) {
    this.ensureInitialized();
    
    try {
      Log.info(`[${user.id}]`, `🎬 Spouštím akci: ${actionCode}`);

      const { fbBot, utioBot } = context;

      // Předběžné ověření připravenosti akce
      const readinessCheck = await this.verifyActionReadiness(user, fbBot, actionCode);
      if (!readinessCheck.ready && readinessCheck.critical) {
        await Log.error(`[${user.id}]`, `❌ Akce ${actionCode} není připravena: ${readinessCheck.reason}`);
        return false;
      }

      let result = false;

      switch (actionCode) {
        case 'post_utio_g':
          result = await this.handleSingleUtioPost(user, fbBot, utioBot, 'g');
          break;

        case 'post_utio_gv':
          result = await this.handleSingleUtioPost(user, fbBot, utioBot, 'gv');
          break;

        case 'post_utio_p':
          // result = await this.handleSingleUtioPost(user, fbBot, utioBot, 'p');
          await Log.warn(`[${user.id}]`, 'Akce post_utio_p není zatím plně implementována s novou logikou.');
          result = false;
          break;

        case 'quote_post':
          result = await this.quotePost(user, fbBot);
          break;

        case 'account_delay':
          const delayMinutes = 60 + Math.random() * 180; // 1-4 hodiny
          await this.db.updateUserWorktime(user.id, delayMinutes);
          Log.info(`[${user.id}]`, `⏳ Account delay: ${Math.round(delayMinutes)}min`);
          result = true;
          break;

        case 'account_sleep':
          const sleepMinutes = 1440 + Math.random() * 2880; // 1-3 dny
          await this.db.updateUserWorktime(user.id, sleepMinutes);
          Log.info(`[${user.id}]`, `😴 Account sleep: ${Math.round(sleepMinutes / 60)}h`);
          result = true;
          break;

        // Placeholder akce
        case 'group_post':
          result = await this.groupPost(user, fbBot);
          break;

        case 'timeline_post':
          result = await this.timelinePost(user, fbBot);
          break;

        case 'comment':
          result = await this.comment(user, fbBot);
          break;

        case 'react':
          result = await this.react(user, fbBot);
          break;

        case 'messenger_check':
          result = await this.messengerCheck(user, fbBot);
          break;

        case 'messenger_reply':
          result = await this.messengerReply(user, fbBot);
          break;

        case 'group_explore':
          result = await this.groupExplore(user, fbBot);
          break;

        default:
          await Log.error(`[${user.id}]`, `Neznámá akce: ${actionCode}`);
          return false;
      }

      // Logování kvality akce
      await this.logActionQuality(user, actionCode, result, {
        verificationUsed: readinessCheck.ready,
        preChecksPassed: readinessCheck.ready,
        reason: result ? 'Success' : 'Failed'
      });

      Log.debug('[DIAGNOSTIC]', `Picked action object in runAction: ${JSON.stringify(pickedAction)}`);
      if (result && pickedAction.invasive) {
        try {
          const cooldownConfig = this.config.cfg_posting_cooldown || { min_seconds: 120, max_seconds: 240 };
          const cooldownMs = (cooldownConfig.min_seconds + 
                            Math.random() * (cooldownConfig.max_seconds - cooldownConfig.min_seconds)) * 1000;
          
          setInvasiveLock(cooldownMs);
          Log.info(`[${user.id}]`, `🔒 Invasive lock nastaven na ${Math.round(cooldownMs / 1000)}s po úspěšné akci ${actionCode}`);
        } catch (err) {
          await Log.warn(`[${user.id}]`, `Nepodařilo se nastavit invasive lock: ${err.message}`);
        }
      }

      return result;

    } catch (err) {
      await Log.error(`[${user.id}] runAction`, err);
      await this.logActionQuality(user, actionCode, false, {
        reason: err.message,
        verificationUsed: false,
        preChecksPassed: false
      });
      return false;
    }
  }

  /**
   * Navigace na FB homepage
   */
  async navigateToHomepage(user, fbBot) {
    try {
      Log.info(`[${user.id}]`, 'Naviguji na FB homepage...');

      await fbBot.page.goto('https://www.facebook.com/', {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });

      await wait.delay(2000 + Math.random() * 3000);

      // Reinicializace analyzátoru pro novou stránku
      fbBot.initializeAnalyzer();

      const newUrl = fbBot.page.url();
      if (!(newUrl === 'https://www.facebook.com/' ||
        newUrl === 'https://www.facebook.com' ||
        newUrl.startsWith('https://www.facebook.com/?'))) {
        throw new Error(`Navigace neúspěšná, stále nejsme na homepage. Aktuální URL: ${newUrl}`);
      }

      Log.success(`[${user.id}]`, 'Úspěšně přešel na FB homepage');
      return true;

    } catch (err) {
      await Log.error(`[${user.id}] navigateToHomepage`, err);
      return false;
    }
  }

  /**
   * Quote post akce
   */
  async quotePost(user, fbBot) {
    try {
      const quote = await this.db.getRandomQuote(user.id);
      if (!quote) {
        await Log.warn(`[${user.id}]`, 'Žádný vhodný citát k dispozici.');
        return false;
      }

      Log.info(`[${user.id}]`, 'Začínám psát citát...');

      // Přejdi na homepage
      if (!await this.navigateToHomepage(user, fbBot)) {
        await Log.error(`[${user.id}]`, 'Nepodařilo se přejít na homepage před psaním citátu.');
        return false;
      }

      const postText = `${quote.text}${quote.author ? `\n– ${quote.author}` : ''}`;

      // Píšeme citát místo vkládání ze schránky
      const result = await support.writeMsg(user, postText, fbBot);

      if (!result) {
        await Log.error(`[${user.id}]`, 'Nepodařilo se napsat citát.');
        return false;
      }

      await support.updatePostStats(null, user, 'quote_post');
      await this.db.markQuoteAsUsed(quote.id, user.id);

      Log.success(`[${user.id}]`, `✅ Citát úspěšně publikován: "${quote.text.substring(0, 50)}..."`);
      return true;

    } catch (err) {
      await Log.error(`[${user.id}] quotePost`, err);
      return false;
    }
  }

  /**
   * Sleduje úspěšnost akcí a doporučuje optimalizace
   */
  async logActionQuality(user, actionCode, success, details = {}) {
    try {
      const qualityData = {
        user_id: user.id,
        action_code: actionCode,
        success: success,
        timestamp: new Date().toISOString(),
        details: JSON.stringify(details),
        verification_used: details.verificationUsed || false,
        pre_checks_passed: details.preChecksPassed || false
      };

      // Uložení do databáze pro analýzu kvality
      await this.db.logActionQuality(qualityData);

      // Reporting pro monitoring
      if (!success) {
        await Log.warn(`[${user.id}]`, `📊 Neúspěšná akce ${actionCode}: ${details.reason || 'Neznámý důvod'}`);
      }

    } catch (err) {
      await Log.error(`[${user.id}]`, `Chyba při logování kvality akce: ${err.message}`);
    }
  }

  // Placeholder funkce pro neimplementované akce
  async groupPost(user, fbBot) {
    await Log.warn(`[${user.id}]`, 'groupPost není zatím implementováno.');
    return false;
  }

  async timelinePost(user, fbBot) {
    await Log.warn(`[${user.id}]`, 'timelinePost není zatím implementováno.');
    return false;
  }

  async comment(user, fbBot) {
    await Log.warn(`[${user.id}]`, 'comment není zatím implementováno.');
    return false;
  }

  async react(user, fbBot) {
    await Log.warn(`[${user.id}]`, 'react není zatím implementováno.');
    return false;
  }

  async messengerCheck(user, fbBot) {
    await Log.warn(`[${user.id}]`, 'messengerCheck není zatím implementováno.');
    return false;
  }

  async messengerReply(user, fbBot) {
    await Log.warn(`[${user.id}]`, 'messengerReply není zatím implementováno.');
    return false;
  }

  async groupExplore(user, fbBot) {
    try {
      const result = await groupExploreAction.execute(user, fbBot);
      return result.success;
    } catch (err) {
      await Log.error(`[${user.id}] groupExplore`, err);
      return false;
    }
  }

  /**
   * Provádí neinvazivní aktivitu během pauzy mezi posty
   * @param {Object} user - Uživatelské data
   * @param {Object} fbBot - FBBot instance
   * @param {number} totalPauseTime - Celková doba pauzy v ms
   */
  async performNonInvasiveActivity(user, fbBot, totalPauseTime) {
    try {
      Log.info(`[${user.id}]`, '🔍 Zahajuji neinvazivní aktivitu během pauzy...');
      
      // Rychlá kontrola zda je stránka úplně načtená (bez kompletní analýzy)
      try {
        const elementCount = await fbBot.page.evaluate(() => document.querySelectorAll('*').length);
        if (elementCount < 100) {
          Log.info(`[${user.id}]`, `⚠️ Stránka má málo elementů (${elementCount}) - přecházím na výchozí FB`);
          await fbBot.page.goto('https://www.facebook.com', { waitUntil: 'domcontentloaded' });
          await fbBot.wait(2000, 4000); // Krátké čekání na načtení
        }
      } catch (checkErr) {
        Log.debug(`[${user.id}]`, `Rychlá kontrola elementů selhala: ${checkErr.message}`);
      }
      
      const activities = [
        'visit_random_group',
        'visit_random_profile', 
        'scroll_feed',
        'visit_notifications'
      ];
      
      // Vyber náhodnou aktivitu
      const selectedActivity = activities[Math.floor(Math.random() * activities.length)];
      
      // Rozdělíme pauzu: 60-90% na aktivitu, zbytek na čekání
      const activityTime = Math.floor(totalPauseTime * (0.6 + Math.random() * 0.3));
      const remainingTime = totalPauseTime - activityTime;
      
      Log.info(`[${user.id}]`, `🎯 Aktivita: ${selectedActivity} (${Math.round(activityTime / 1000)}s), pak čekání ${Math.round(remainingTime / 1000)}s`);
      
      switch (selectedActivity) {
        case 'visit_random_group':
          await this.visitRandomGroup(user, fbBot, activityTime);
          break;
        case 'visit_random_profile':
          await this.visitRandomProfile(user, fbBot, activityTime);
          break;
        case 'scroll_feed':
          await this.scrollFeed(user, fbBot, activityTime);
          break;
        case 'visit_notifications':
          await this.visitNotifications(user, fbBot, activityTime);
          break;
      }
      
      // Zbytek času jen čekáme
      if (remainingTime > 1000) {
        Log.info(`[${user.id}]`, `😴 Dokončuji pauzu - zbývá ${Math.round(remainingTime / 1000)}s...`);
        await wait.delay(remainingTime);
      }
      
      Log.info(`[${user.id}]`, '✅ Neinvazivní aktivita dokončena');
      
    } catch (err) {
      await Log.warn(`[${user.id}]`, `Chyba při neinvazivní aktivitě: ${err.message} - pokračuji klasickou pauzou`);
      // Fallback na obyčejné čekání
      await wait.delay(totalPauseTime);
    }
  }

  /**
   * Navštíví náhodnou skupinu a trochu se v ní rozhlédne
   */
  async visitRandomGroup(user, fbBot, timeLimit) {
    try {
      let groupUrl = null;
      let source = 'databáze';

      // Priorita 1: Zkusit získat odkaz z poslední analýzy aktuální stránky
      if (fbBot.pageAnalyzer && fbBot.pageAnalyzer.lastAnalysis && fbBot.pageAnalyzer.lastAnalysis.links) {
          const groupLinks = fbBot.pageAnalyzer.lastAnalysis.links.groups;
          if (groupLinks && groupLinks.length > 0) {
              groupUrl = groupLinks[Math.floor(Math.random() * groupLinks.length)];
              source = 'aktuální stránky';
          }
      }

      // Priorita 2: Fallback na databázi, pokud se nepodařilo najít odkaz na stránce
      if (!groupUrl) {
          const groupTypes = ['G', 'GV', 'P'];
          const randomType = groupTypes[Math.floor(Math.random() * groupTypes.length)];
          const groups = await this.db.safeQueryAll('groups.getAvailableByTypeSimple', [randomType, 3]);
          if (!groups || groups.length === 0) {
            throw new Error('Žádné skupiny k dispozici v databázi');
          }
          const randomGroup = groups[Math.floor(Math.random() * groups.length)];
          groupUrl = `https://www.facebook.com/groups/${randomGroup.fb_id}`;
      }
      
      Log.info(`[${user.id}]`, `🎯 Navštěvuji skupinu (zdroj: ${source}): ${groupUrl}`);
      
      await fbBot.page.goto(groupUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await wait.delay(3000, 5000);
      
      // Trochu scrolluj, aby to vypadalo jako reálná aktivita
      const scrollTime = Math.min(timeLimit - 8000, 25000); // Max 25s scrollování
      if (scrollTime > 2000) {
        await this.scrollPageRandomly(fbBot, scrollTime);
      }
      
    } catch (err) {
      Log.info(`[${user.id}]`, `Nepodařilo se navštívit skupinu: ${err.message}`);
    }
  }

  /**
   * Navštíví náhodný profil (pokud možno z přátel nebo nedávných interakcí)
   */
  async visitRandomProfile(user, fbBot, timeLimit) {
    try {
      // Zkus najít odkazy na profily na aktuální stránce
      const profileLinks = await fbBot.page.$$eval('a[href*="/profile.php"], a[href*="facebook.com/"]:not([href*="/groups/"]):not([href*="/pages/"])', 
        links => links.slice(0, 5).map(link => link.href).filter(href => 
          href.includes('/profile.php') || (href.includes('facebook.com/') && !href.includes('/groups/') && !href.includes('/pages/'))
        )
      );
      
      if (profileLinks.length > 0) {
        const randomProfile = profileLinks[Math.floor(Math.random() * profileLinks.length)];
        
        Log.info(`[${user.id}]`, `👤 Navštěvuji profil...`);
        
        await fbBot.page.goto(randomProfile, { waitUntil: 'domcontentloaded', timeout: 10000 });
        await wait.delay(3000, 6000);
        
        // Krátké scrollování
        const scrollTime = Math.min(timeLimit - 9000, 10000);
        if (scrollTime > 2000) {
          await this.scrollPageRandomly(fbBot, scrollTime);
        }
      } else {
        throw new Error('Žádné profily nenalezeny');
      }
      
    } catch (err) {
      Log.info(`[${user.id}]`, `Nepodařilo se navštívit profil: ${err.message}`);
    }
  }

  /**
   * Scrolluje ve feedu
   */
  async scrollFeed(user, fbBot, timeLimit) {
    try {
      Log.info(`[${user.id}]`, `📰 Scrolluji ve feedu...`);
      
      // Jdi na homepage
      await fbBot.page.goto('https://www.facebook.com/', { waitUntil: 'domcontentloaded', timeout: 10000 });
      await wait.delay(2000);
      
      await this.scrollPageRandomly(fbBot, timeLimit - 2000);
      
    } catch (err) {
      Log.info(`[${user.id}]`, `Nepodařilo se scrollovat feed: ${err.message}`);
    }
  }

  /**
   * Navštíví notifikace
   */
  async visitNotifications(user, fbBot, timeLimit) {
    try {
      Log.info(`[${user.id}]`, `🔔 Kontroluji notifikace...`);
      
      await fbBot.page.goto('https://www.facebook.com/notifications', { waitUntil: 'domcontentloaded', timeout: 10000 });
      await wait.delay(3000, 6000);
      
      // Krátké scrollování v notifikacích
      const scrollTime = Math.min(timeLimit - 9000, 8000);
      if (scrollTime > 2000) {
        await this.scrollPageRandomly(fbBot, scrollTime);
      }
      
    } catch (err) {
      Log.info(`[${user.id}]`, `Nepodařilo se navštívit notifikace: ${err.message}`);
    }
  }

  /**
   * Pomocná funkce pro náhodné scrollování
   */
  async scrollPageRandomly(fbBot, duration) {
    try {
      const endTime = Date.now() + duration;
      
      while (Date.now() < endTime) {
        // Náhodný scroll směrem dolů
        await fbBot.page.evaluate(() => {
          const scrollAmount = Math.floor(Math.random() * 400) + 200; // 200-600px
          window.scrollBy(0, scrollAmount);
        });
        
        // Pauza mezi scrolly
        await wait.delay(1500, 4000);
      }
      
    } catch (err) {
      // Ignoruj chyby při scrollování
    }
  }

  /**
   * Detekuje a označí skupinu jako buy/sell pokud se po kliknutí na diskuzi objevila možnost postovat
   * @param {Object} group - Objekt skupiny z databáze
   */
  async detectAndMarkBuySellGroup(group) {
    try {
      // Zkontroluj zda skupina už není označena jako buy/sell
      if (group.is_buy_sell_group) {
        return; // Už je označená, nepotřebujeme nic dělat
      }

      // Označ skupinu jako buy/sell
      await this.db.query(SQL.groups.updateBuySellFlag, [true, group.id]);
      
      await Log.success('[DETECT]', `🛒 Skupina "${group.name}" označena jako prodejní (buy/sell) - přímý přístup k diskuzi možný přes /buy_sell_discuss`);
      
      // Log do systému pro statistiky
      await this.db.logSystemEvent(
        'BUY_SELL_GROUP_DETECTED', 
        'INFO',
        `Auto-detected buy/sell group: ${group.name} (ID: ${group.id})`,
        {
          group_id: group.id,
          group_name: group.name,
          fb_id: group.fb_id,
          detection_method: 'discussion_tab_click'
        }
      );

    } catch (err) {
      await Log.error('[DETECT]', `Chyba při označení buy/sell skupiny ${group.name}: ${err.message}`);
    }
  }
}

// Export pro kompatibilitu s původním kódem
export async function getActionRequirements(actionCode) {
  const actions = new IvActions();
  await actions.init();
  return await actions.getActionRequirements(actionCode);
}

export async function runAction(user, actionCode, context, pickedAction) {
  const actions = new IvActions();
  await actions.init();
  return await actions.runAction(user, actionCode, context, pickedAction);
}

export async function performNonInvasiveActivity(user, fbBot, totalPauseTime) {
  const actions = new IvActions();
  await actions.init();
  return await actions.performNonInvasiveActivity(user, fbBot, totalPauseTime);
}