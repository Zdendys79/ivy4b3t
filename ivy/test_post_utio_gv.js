/**
 * Název souboru: test_post_utio_gv.js
 * Umístění: ~/ivy/test_post_utio_gv.js
 *
 * Popis: Testovací soubor pro akci post_utio_gv (postování UTIO článků do skupin typu GV)
 */

import { IvDb } from './libs/iv_db.class.js';
import { IvFb } from './libs/iv_fb.class.js';
import { IvUtio } from './libs/iv_utio.class.js';
import { IvActions } from './libs/iv_actions.class.js';
import { Log } from './libs/iv_log.class.js';
import { wait } from './libs/iv_support.js';
import { TEST_QUERIES } from './sql/queries/test_queries.js';
import { GROUPS } from './sql/queries/groups.js';

class PostUtioGvTest {
  constructor() {
    this.db = null;
    this.fbBot = null;
    this.utioBot = null;
    this.actions = null;
    this.testUser = null;
    this.hostname = null;
    this.selectedGroup = null;
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
        throw new Error('Žádný vhodný uživatel pro test post_utio_gv');
      }

      await Log.info('[TEST]', `Vybrán uživatel pro test: ${this.testUser.name} ${this.testUser.surname} (ID: ${this.testUser.id})`);

      // Inicializace botů
      this.fbBot = new IvFb(this.testUser);
      this.utioBot = new IvUtio(this.testUser);

      return true;
    } catch (error) {
      await Log.error('[TEST]', `Chyba při inicializaci testu: ${error.message}`);
      return false;
    }
  }

  async selectTestUser() {
    try {
      const users = await this.db.query(TEST_QUERIES.getUserForActionTest, [
        'post_utio_gv',
        this.hostname,
        this.hostname
      ]);

      return users.length > 0 ? users[0] : null;
    } catch (error) {
      await Log.error('[TEST]', `Chyba při výběru uživatele: ${error.message}`);
      return null;
    }
  }

  async selectTestGroup() {
    try {
      const groups = await this.db.query(GROUPS.getUnusedByType, ['GV', 2, 1]);
      if (groups.length === 0) {
        // Pokud nejsou nepoužité skupiny, zkus jakoukoliv skupinu typu GV
        const allGroups = await this.db.query(GROUPS.getByType, ['GV']);
        return allGroups.length > 0 ? allGroups[0] : null;
      }
      return groups[0];
    } catch (error) {
      await Log.error('[TEST]', `Chyba při výběru skupiny: ${error.message}`);
      return null;
    }
  }

  async runTest() {
    const startTime = Date.now();
    let success = false;
    let errorMessage = '';

    try {
      await Log.info('[TEST]', '🚀 Spouštím test post_utio_gv akce');

      // 1. Výběr skupiny typu GV
      await Log.info('[TEST]', '1. Výběr skupiny typu GV...');
      this.selectedGroup = await this.selectTestGroup();
      if (!this.selectedGroup) {
        throw new Error('Nebyla nalezena žádná skupina typu GV pro test');
      }
      await Log.info('[TEST]', `Vybrána skupina: ${this.selectedGroup.name}`);

      // 2. Inicializace FB bota
      await Log.info('[TEST]', '2. Inicializace Facebook bota...');
      const fbInitialized = await this.fbBot.init();
      if (!fbInitialized) {
        throw new Error('Nepodařilo se inicializovat FB bot');
      }

      // 3. Inicializace UTIO bota
      await Log.info('[TEST]', '3. Inicializace UTIO bota...');
      const utioInitialized = await this.utioBot.init();
      if (!utioInitialized) {
        throw new Error('Nepodařilo se inicializovat UTIO bot');
      }

      // 4. Získání random článku z UTIO (preferovaně vědeckého obsahu)
      await Log.info('[TEST]', '4. Získávám náhodný vědecký článek z UTIO...');
      const article = await this.utioBot.getRandomArticle('science'); // GV skupiny preferují vědecký obsah
      if (!article) {
        throw new Error('Nepodařilo se získat článek z UTIO');
      }
      await Log.info('[TEST]', `Získán článek: ${article.title}`);

      // 5. Navigace do skupiny
      await Log.info('[TEST]', `5. Navigace do skupiny ${this.selectedGroup.name}...`);
      const navigated = await this.fbBot.goToGroup(this.selectedGroup.fb_id);
      if (!navigated) {
        throw new Error(`Nepodařilo se navigovat do skupiny ${this.selectedGroup.name}`);
      }

      // 6. Analýza skupiny
      await Log.info('[TEST]', '6. Analýza možností ve skupině...');
      const analysis = await this.fbBot.analyzeGroupCapabilities();
      await Log.info('[TEST]', `Analýza: posting=${analysis.posting?.canInteract}, join=${analysis.group?.hasJoinButton}`);

      // 7. Pokus o join, pokud není členem
      if (analysis.group?.hasJoinButton) {
        await Log.info('[TEST]', '7. Pokus o připojení ke skupině...');
        await this.fbBot.joinToGroup();
        await wait.delay(3000);
      }

      // 8. Postování článku s vědeckým kontextem
      await Log.info('[TEST]', '8. Postování vědeckého článku do skupiny...');
      const postText = this.createScientificPostText(article);
      const posted = await this.fbBot.postToGroup(postText);
      
      if (!posted) {
        throw new Error('Nepodařilo se vytvořit příspěvek ve skupině');
      }

      // 9. Aktualizace stavu skupiny
      await this.db.query(GROUPS.updateLastSeen, [this.selectedGroup.id]);
      await this.db.query(GROUPS.updateNextSeen, [45, this.selectedGroup.id]); // GV skupiny mají delší cooldown

      await Log.info('[TEST]', '✅ Post UTIO GV test úspěšně dokončen');
      success = true;

    } catch (error) {
      errorMessage = error.message;
      await Log.error('[TEST]', `❌ Post UTIO GV test selhal: ${errorMessage}`);
      success = false;
    }

    // Logování výsledku testu
    const duration = Date.now() - startTime;
    const note = `TEST: post_utio_gv - ${success ? 'SUCCESS' : 'FAILED'} - ${duration}ms - Group: ${this.selectedGroup?.name || 'N/A'}${errorMessage ? ` - ${errorMessage}` : ''}`;
    
    await this.db.query(TEST_QUERIES.logTestAction, [
      this.testUser.id,
      'post_utio_gv',
      this.selectedGroup?.id || null,
      note,
      this.hostname
    ]);

    return { success, duration, errorMessage, group: this.selectedGroup };
  }

  createScientificPostText(article) {
    const scientificTemplates = [
      `🔬 ${article.title}\n\n${article.summary || 'Zajímavý vědecký poznatek.'}\n\nCo si myslíte o této teorii/výzkumu?\n\n📊 Více informací: ${article.url}`,
      `🧪 Vědecké pozorování: ${article.title}\n\n${article.summary || 'Nové objevy v oblasti vědy.'}\n\nJaké jsou vaše zkušenosti s tímto tématem?\n\n🔗 ${article.url}`,
      `⚗️ ${article.title}\n\n${article.summary || 'Přelomový výzkum.'}\n\nTento objev by mohl změnit naše chápání...\n\n📚 Celý článek: ${article.url}`,
      `🔭 Fascinující výsledky: ${article.title}\n\n${article.summary || 'Nová data ze studie.'}\n\nJak hodnotíte metodologii tohoto výzkumu?\n\n🌐 ${article.url}`,
      `🧬 ${article.title}\n\n${article.summary || 'Vědecké poznatky.'}\n\nMá někdo praktické zkušenosti s touto problematikou?\n\n🔍 ${article.url}`
    ];

    return scientificTemplates[Math.floor(Math.random() * scientificTemplates.length)];
  }

  async cleanup() {
    try {
      if (this.fbBot) {
        await this.fbBot.close();
      }
      if (this.utioBot) {
        await this.utioBot.close();
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
async function runPostUtioGvTest() {
  const test = new PostUtioGvTest();
  
  try {
    await Log.info('[TEST]', '=== POST UTIO GV TEST START ===');
    
    const initialized = await test.init();
    if (!initialized) {
      await Log.error('[TEST]', 'Test se nepodařilo inicializovat');
      return;
    }

    const result = await test.runTest();
    
    await Log.info('[TEST]', `=== POST UTIO GV TEST END ===`);
    await Log.info('[TEST]', `Výsledek: ${result.success ? 'ÚSPĚCH' : 'SELHÁNÍ'}`);
    await Log.info('[TEST]', `Doba trvání: ${result.duration}ms`);
    await Log.info('[TEST]', `Skupina: ${result.group?.name || 'N/A'}`);
    
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
  runPostUtioGvTest();
}

export { PostUtioGvTest, runPostUtioGvTest };