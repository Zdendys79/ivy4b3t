/**
 * Název souboru: post_utio_gv.action.js
 * Umístění: ~/ivy/actions/post_utio_gv.action.js
 *
 * Popis: UTIO post do vlastních skupin (GV)
 * - Implementuje BaseAction
 * - Pouze jedna odpovědnost: post UTIO do vlastních skupin
 * - Žádné fallbacky
 */

import { BaseAction } from '../libs/base_action.class.js';
import { Log } from '../libs/iv_log.class.js';
import { Wait } from '../libs/iv_wait.class.js';
import { getAvailableGroupsForUser, blockUserGroup } from '../user_group_escalation.js';

export class PostUtioGvAction extends BaseAction {
  constructor() {
    super('post_utio_gv');
  }

  /**
   * Definuje požadavky akce na služby
   */
  getRequirements() {
    return {
      needsFB: true,
      needsUtio: true
    };
  }

  /**
   * Ověří připravenost akce
   */
  async verifyReadiness(user, context) {
    const { fbBot } = context;
    
    if (!fbBot) {
      return {
        ready: false,
        reason: 'Chybí FBBot instance',
        critical: true
      };
    }

    // Zkontroluj dostupnost skupin typu GV
    const group = await this.db.getSingleAvailableGroup(user.id, 'GV');
    if (!group) {
      return {
        ready: false,
        reason: 'Žádné dostupné skupiny typu GV',
        critical: false
      };
    }

    return {
      ready: true,
      reason: 'Akce je připravena'
    };
  }

  /**
   * Provedení UTIO post do vlastní skupiny
   */
  async execute(user, context, pickedAction) {
    const { fbBot, utioBot } = context;
    const joinActionCode = 'join_group_gv';

    try {
      // Získej dostupnou skupinu typu GV
      const group = await this.db.getSingleAvailableGroup(user.id, 'GV');
      if (!group) {
        await Log.warn(`[${user.id}]`, 'Žádné dostupné skupiny typu GV');
        return false;
      }

      Log.info(`[${user.id}]`, `Vybrána vlastní skupina: ${group.name} (${group.fb_id})`);

      // Otevři skupinu
      await fbBot.openGroup(group);
      await Wait.toSeconds(1, 'Po otevření skupiny');

      // Rychlá kontrola na "Obsah teď není dostupný"
      const pageContent = await fbBot.page.evaluate(() => document.body.textContent);
      if (pageContent.includes('Obsah teď není dostupný')) {
        await Log.warn(`[${user.id}]`, `Skupina ${group.name} je trvale nedostupná`);
        await blockUserGroup(user.id, group.id, 'Obsah trvale nedostupný - skupina neexistuje');
        return false;
      }

      // Inicializuj analyzer
      fbBot.initializeAnalyzer();
      await Wait.toSeconds(1, 'Po inicializaci analyzátoru');

      // Zkus kliknout na "Napište něco"
      Log.info(`[${user.id}]`, 'Pokouším se kliknout na "Napište něco"...');
      const postClicked = await fbBot.pageAnalyzer.clickElementWithText('Napište něco', {
        matchType: 'startsWith',
        scrollIntoView: false,
        waitAfterClick: true,
        naturalDelay: true
      });

      if (postClicked) {
        Log.info(`[${user.id}]`, 'Úspěšně kliknuto na "Napište něco", pokračuji s publikací...');
        return await this.performDirectPublication(user, fbBot, utioBot, group);
      }

      // Pokud není "Napište něco", zkus "Diskuze" nejdřív
      Log.info(`[${user.id}]`, '"Napište něco" nenalezeno, zkouším "Diskuze"...');
      
      const discussionTexts = ['Diskuze', 'Discussion', 'Diskuse'];
      let discussionWorked = false;
      
      for (const discussionText of discussionTexts) {
        const canDiscuss = await fbBot.pageAnalyzer.clickElementWithText(discussionText, {
          matchType: 'contains',
          scrollIntoView: false,
          waitAfterClick: true,
          naturalDelay: true
        });
        
        if (canDiscuss) {
          Log.info(`[${user.id}]`, 'Úspěšně kliknuto na "Diskuze", zkouším "Napište něco" znovu...');
          await Wait.toSeconds(3, 'Po kliknutí na Diskuze');
          
          // Po kliknutí na diskuze zkus "Napište něco" znovu
          const postClickedAfterDiscussion = await fbBot.pageAnalyzer.clickElementWithText('Napište něco', {
            matchType: 'startsWith',
            scrollIntoView: false,
            waitAfterClick: true,
            naturalDelay: true
          });
          
          if (postClickedAfterDiscussion) {
            Log.info(`[${user.id}]`, '"Napište něco" funguje po přechodu do diskuze!');
            return await this.performDirectPublication(user, fbBot, utioBot, group);
          }
          discussionWorked = true;
          break;
        }
      }
      
      // Pouze pokud diskuze nefunguje, zkus "Přidat se ke skupině" jako poslední možnost
      if (!discussionWorked) {
        Log.info(`[${user.id}]`, '"Diskuze" nenalezena, zkouším "Přidat se ke skupině" jako poslední možnost...');
        
        const joinTexts = ['Přidat se ke skupině', 'Join Group', 'Připojit se'];
        for (const joinText of joinTexts) {
          const canJoin = await fbBot.pageAnalyzer.clickElementWithText(joinText, {
            matchType: 'contains',
            scrollIntoView: false,
            waitAfterClick: false,
            naturalDelay: false,
            dryRun: true
          });
          
          if (canJoin) {
            // Zkontroluj nedávný join pokus
            const recentJoin = await this.db.getRecentJoinGroupAction(user.id, joinActionCode);
            if (recentJoin) {
              Log.info(`[${user.id}]`, '⏰ Již byla odeslána žádost o členství v posledních 8 hodinách');
              return true;
            }

            Log.info(`[${user.id}]`, `Pokouším se přidat do skupiny ${group.name} jako poslední možnost...`);
            const joinResult = await fbBot.joinToGroup();
            
            if (joinResult) {
              await Wait.toSeconds(4, 'Po přidání do skupiny');
              
              // Zapiš do action_log (pro 8h limit)
              await this.logAction(user, group.id, `Žádost o členství: ${group.name}`);
              
              // Zapiš do user_groups (pro vztah uživatel-skupina)
              await this.db.insertUserGroupMembership(user.id, group.id, `Žádost o členství: ${group.name}`);
              
              Log.success(`[${user.id}]`, `Žádost o členství odeslána do ${group.name}`);
              return true;
            } else {
              await blockUserGroup(user.id, group.id, 'Failed to click join button');
              return false;
            }
          }
        }
      }

      // Žádné dostupné akce
      await Log.warn(`[${user.id}]`, `Skupina ${group.name} nemá dostupné akce`);
      await blockUserGroup(user.id, group.id, 'Skupina neobsahuje potřebné elementy pro interakci');
      return false;

    } catch (err) {
      await Log.error(`[${user.id}]`, `Chyba při UTIO post GV: ${err.message}`);
      return false;
    }
  }

  /**
   * Přímá publikace - editor je už otevřený
   */
  async performDirectPublication(user, fbBot, utioBot, group) {
    Log.info(`[${user.id}]`, `📝 Editor je otevřený, publikuji do vlastní skupiny ${group.name}...`);
    
    try {
      // Získej zprávu z UTIO a publikuj
      // TODO: Implementovat pasteMsg bez fallback mechanismů
      const error = new Error('support.pasteMsg() byla odstraněna kvůli fallback mechanismům. Nutné přepsat bez fallbacků.');
      await Log.error(`[${user.id}]`, error);
      throw error;
      if (!message) {
        await Log.warn(`[${user.id}]`, '❌ Publikace selhala (pasteMsg vrátilo false)');
        return false;
      }

      await this.logAction(user, group.id, `Post do vlastní skupiny: ${group.name}`);
      // TODO: Implementovat updatePostStats bez fallback mechanismů
      Log.info(`[${user.id}]`, 'TODO: updatePostStats() byla odstraněna kvůli fallback mechanismům.');
      Log.success(`[${user.id}]`, `Úspěšně publikováno do vlastní skupiny ${group.name}!`);
      return true;

    } catch (err) {
      await Log.error(`[${user.id}]`, `❌ Chyba při přímé publikaci: ${err.message}`);
      return false;
    }
  }
}