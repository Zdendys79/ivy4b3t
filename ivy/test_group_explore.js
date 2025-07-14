/**
 * Název souboru: test_group_explore.js
 * Umístění: ~/ivy/test_group_explore.js
 *
 * Popis: Testovací soubor pro akci group_explore (průzkum nových FB skupin)
 */

import { IvDb } from './libs/iv_db.class.js';
import { IvFb } from './libs/iv_fb.class.js';
import { IvActions } from './libs/iv_actions.class.js';
import { Log } from './libs/iv_log.class.js';
import { wait } from './libs/iv_support.js';
import { TEST_QUERIES } from './sql/queries/test_queries.js';
import { GROUP_DETAILS } from './sql/queries/group_details.js';

class GroupExploreTest {
  constructor() {
    this.db = null;
    this.fbBot = null;
    this.actions = null;
    this.testUser = null;
    this.hostname = null;
    this.selectedGroup = null;
    this.discoveredGroups = [];
  }

  async init() {
    try {
      // Inicializace databáze
      this.db = new IvDb();
      await this.db.connect();

      // Inicializace akcí
      this.actions = new IvActions();
      await this.actions.init();

      // Získání hostname
      const hostnameResult = await this.db.query(TEST_QUERIES.getCurrentHostname);
      this.hostname = hostnameResult[0]?.hostname || 'test-host';

      // Výběr uživatele pro test
      this.testUser = await this.selectTestUser();
      if (!this.testUser) {
        throw new Error('Žádný vhodný uživatel pro test group_explore');
      }

      await Log.info('[TEST]', `Vybrán uživatel pro test: ${this.testUser.name} ${this.testUser.surname} (ID: ${this.testUser.id})`);

      // Inicializace FB bota
      this.fbBot = new IvFb(this.testUser);

      return true;
    } catch (error) {
      await Log.error('[TEST]', `Chyba při inicializaci testu: ${error.message}`);
      return false;
    }
  }

  async selectTestUser() {
    try {
      const users = await this.db.query(TEST_QUERIES.getUserForActionTest, [
        'group_explore',
        this.hostname,
        this.hostname
      ]);

      return users.length > 0 ? users[0] : null;
    } catch (error) {
      await Log.error('[TEST]', `Chyba při výběru uživatele: ${error.message}`);
      return null;
    }
  }

  async selectGroupForExploration() {
    try {
      const groups = await this.db.query(GROUP_DETAILS.getGroupsForExploration, [3]);
      if (groups.length === 0) {
        throw new Error('Nejsou dostupné skupiny pro průzkum');
      }
      
      return groups[Math.floor(Math.random() * groups.length)];
    } catch (error) {
      await Log.error('[TEST]', `Chyba při výběru skupiny pro průzkum: ${error.message}`);
      return null;
    }
  }

  async runTest() {
    const startTime = Date.now();
    let success = false;
    let errorMessage = '';

    try {
      await Log.info('[TEST]', '🚀 Spouštím test group_explore akce');

      // 1. Výběr skupiny pro průzkum
      await Log.info('[TEST]', '1. Výběr skupiny pro průzkum...');
      this.selectedGroup = await this.selectGroupForExploration();
      if (!this.selectedGroup) {
        throw new Error('Nebyla nalezena žádná skupina pro průzkum');
      }
      await Log.info('[TEST]', `Vybrána skupina: ${this.selectedGroup.name || this.selectedGroup.fb_id}`);

      // 2. Inicializace FB bota
      await Log.info('[TEST]', '2. Inicializace Facebook bota...');
      const fbInitialized = await this.fbBot.init();
      if (!fbInitialized) {
        throw new Error('Nepodařilo se inicializovat FB bot');
      }

      // 3. Navigace do skupiny
      await Log.info('[TEST]', `3. Navigace do skupiny...`);
      const navigated = await this.fbBot.goToGroup(this.selectedGroup.fb_id);
      if (!navigated) {
        throw new Error(`Nepodařilo se navigovat do skupiny`);
      }

      // 4. Analýza skupiny
      await Log.info('[TEST]', '4. Analýza skupiny...');
      const analysis = await this.fbBot.analyzeGroupCapabilities();
      await Log.info('[TEST]', `Analýza dokončena: členů=${analysis.group?.memberCount}, posting=${analysis.posting?.canInteract}`);

      // 5. Aktualizace databáze s informacemi o skupině
      if (analysis.group?.memberCount) {
        await this.db.query(`
          UPDATE group_details 
          SET member_count = ?, last_analyzed = NOW()
          WHERE fb_id = ?
        `, [analysis.group.memberCount, this.selectedGroup.fb_id]);
      }

      // 6. Hledání souvisejících skupin
      await Log.info('[TEST]', '5. Hledání souvisejících skupin...');
      const relatedGroups = await this.fbBot.findRelatedGroups();
      
      if (relatedGroups && relatedGroups.length > 0) {
        await Log.info('[TEST]', `Nalezeno ${relatedGroups.length} souvisejících skupin`);
        this.discoveredGroups = relatedGroups;

        // 7. Uložení nově objevených skupin
        for (const groupUrl of relatedGroups) {
          try {
            await this.db.query(`
              INSERT IGNORE INTO discovered_group_links (url, discovered_at, source_group_id)
              VALUES (?, NOW(), ?)
            `, [groupUrl, this.selectedGroup.fb_id]);
          } catch (err) {
            await Log.warning('[TEST]', `Nepodařilo se uložit skupinu ${groupUrl}: ${err.message}`);
          }
        }
      } else {
        await Log.info('[TEST]', 'Nebyly nalezeny žádné nové skupiny');
      }

      // 8. Pokus o členství, pokud má smysl
      if (analysis.group?.hasJoinButton && analysis.group?.memberCount > 1000) {
        await Log.info('[TEST]', '6. Pokus o připojení ke skupině...');
        try {
          await this.fbBot.joinToGroup();
          await wait.delay(2000);
        } catch (joinError) {
          await Log.warning('[TEST]', `Join selhal: ${joinError.message}`);
        }
      }

      // 9. Označení skupiny jako prozkoumanou
      await this.db.query(`
        UPDATE group_details 
        SET is_relevant = 1, last_explored = NOW()
        WHERE fb_id = ?
      `, [this.selectedGroup.fb_id]);

      await Log.info('[TEST]', '✅ Group explore test úspěšně dokončen');
      success = true;

    } catch (error) {
      errorMessage = error.message;
      await Log.error('[TEST]', `❌ Group explore test selhal: ${errorMessage}`);
      success = false;
    }

    // Logování výsledku testu
    const duration = Date.now() - startTime;
    const note = `TEST: group_explore - ${success ? 'SUCCESS' : 'FAILED'} - ${duration}ms - Discovered: ${this.discoveredGroups.length} groups${errorMessage ? ` - ${errorMessage}` : ''}`;
    
    await this.db.query(TEST_QUERIES.logTestAction, [
      this.testUser.id,
      'group_explore',
      this.selectedGroup?.fb_id || null,
      note,
      this.hostname
    ]);

    return { 
      success, 
      duration, 
      errorMessage, 
      group: this.selectedGroup,
      discoveredCount: this.discoveredGroups.length
    };
  }

  async cleanup() {
    try {
      if (this.fbBot) {
        await this.fbBot.close();
      }
      if (this.db) {
        await this.db.close();
      }
      await Log.info('[TEST]', 'Test cleanup dokončen');
    } catch (error) {
      await Log.error('[TEST]', `Chyba při cleanup: ${error.message}`);
    }
  }
}

// Spuštění testu
async function runGroupExploreTest() {
  const test = new GroupExploreTest();
  
  try {
    await Log.info('[TEST]', '=== GROUP EXPLORE TEST START ===');
    
    const initialized = await test.init();
    if (!initialized) {
      await Log.error('[TEST]', 'Test se nepodařilo inicializovat');
      return;
    }

    const result = await test.runTest();
    
    await Log.info('[TEST]', `=== GROUP EXPLORE TEST END ===`);
    await Log.info('[TEST]', `Výsledek: ${result.success ? 'ÚSPĚCH' : 'SELHÁNÍ'}`);
    await Log.info('[TEST]', `Doba trvání: ${result.duration}ms`);
    await Log.info('[TEST]', `Skupina: ${result.group?.name || result.group?.fb_id || 'N/A'}`);
    await Log.info('[TEST]', `Objeveno skupin: ${result.discoveredCount}`);
    
    if (!result.success) {
      await Log.error('[TEST]', `Chyba: ${result.errorMessage}`);
    }

  } catch (error) {
    await Log.error('[TEST]', `Kritická chyba testu: ${error.message}`);
  } finally {
    await test.cleanup();
  }
}

// Spuštění, pokud je soubor volán přímo
if (import.meta.url === `file://${process.argv[1]}`) {
  runGroupExploreTest();
}

export { GroupExploreTest, runGroupExploreTest };