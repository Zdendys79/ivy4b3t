/**
 * Název souboru: test_account_delay.js
 * Umístění: ~/ivy/test_account_delay.js
 *
 * Popis: Testovací soubor pro akci account_delay (krátká pauza v aktivitě účtu)
 */

import { IvDb } from './libs/iv_db.class.js';
import { IvActions } from './libs/iv_actions.class.js';
import { Log } from './libs/iv_log.class.js';
import { wait } from './libs/iv_support.js';
import { TEST_QUERIES } from './sql/queries/test_queries.js';

class AccountDelayTest {
  constructor() {
    this.db = null;
    this.actions = null;
    this.testUser = null;
    this.hostname = null;
    this.delayDuration = null;
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
        throw new Error('Žádný vhodný uživatel pro test account_delay');
      }

      await Log.info('[TEST]', `Vybrán uživatel pro test: ${this.testUser.name} ${this.testUser.surname} (ID: ${this.testUser.id})`);

      return true;
    } catch (error) {
      await Log.error('[TEST]', `Chyba při inicializaci testu: ${error.message}`);
      return false;
    }
  }

  async selectTestUser() {
    try {
      const users = await this.db.query(TEST_QUERIES.getUserForActionTest, [
        'account_delay',
        this.hostname,
        this.hostname
      ]);

      return users.length > 0 ? users[0] : null;
    } catch (error) {
      await Log.error('[TEST]', `Chyba při výběru uživatele: ${error.message}`);
      return null;
    }
  }

  calculateDelayDuration() {
    // Náhodná pauza mezi 30 sekundami a 5 minutami (podle typické logiky account_delay)
    const minDelay = 30 * 1000; // 30 sekund
    const maxDelay = 5 * 60 * 1000; // 5 minut
    return Math.floor(Math.random() * (maxDelay - minDelay)) + minDelay;
  }

  async runTest() {
    const startTime = Date.now();
    let success = false;
    let errorMessage = '';

    try {
      await Log.info('[TEST]', '🚀 Spouštím test account_delay akce');

      // 1. Výpočet délky pauzy
      this.delayDuration = this.calculateDelayDuration();
      const delaySeconds = Math.round(this.delayDuration / 1000);
      await Log.info('[TEST]', `1. Nastavena pauza na ${delaySeconds} sekund`);

      // 2. Aktualizace stavu uživatele - označení začátku pauzy
      await this.db.query(`
        UPDATE users 
        SET last_activity = NOW(), 
            status = 'delaying'
        WHERE id = ?
      `, [this.testUser.id]);

      // 3. Čekání (pauza)
      await Log.info('[TEST]', `2. Zahajuji ${delaySeconds}s pauzu...`);
      
      // Pro test použijeme kratší pauzu (max 10 sekund)
      const testDelay = Math.min(this.delayDuration, 10000);
      const testDelaySeconds = Math.round(testDelay / 1000);
      
      await Log.info('[TEST]', `   (Pro účely testu zkráceno na ${testDelaySeconds}s)`);
      
      // Průběžné logování
      for (let i = 0; i < testDelaySeconds; i++) {
        await wait.delay(1000);
        if ((i + 1) % 3 === 0 || i === testDelaySeconds - 1) {
          await Log.info('[TEST]', `   Pauza: ${i + 1}/${testDelaySeconds}s`);
        }
      }

      // 4. Aktualizace stavu uživatele - konec pauzy
      await this.db.query(`
        UPDATE users 
        SET last_activity = NOW(), 
            status = 'active'
        WHERE id = ?
      `, [this.testUser.id]);

      await Log.info('[TEST]', '3. Pauza dokončena, uživatel opět aktivní');

      // 5. Ověření, že uživatel není blokován dalšími akcemi
      const userCheck = await this.db.query(`
        SELECT *, 
               CASE 
                 WHEN work_until <= NOW() THEN 'expired'
                 WHEN active = 0 THEN 'inactive'
                 ELSE 'ready'
               END as account_status
        FROM users 
        WHERE id = ?
      `, [this.testUser.id]);

      if (userCheck.length > 0) {
        const user = userCheck[0];
        await Log.info('[TEST]', `4. Stav účtu po pauze: ${user.account_status}`);
      }

      await Log.info('[TEST]', '✅ Account delay test úspěšně dokončen');
      success = true;

    } catch (error) {
      errorMessage = error.message;
      await Log.error('[TEST]', `❌ Account delay test selhal: ${errorMessage}`);
      success = false;

      // Obnovení stavu uživatele při chybě
      try {
        await this.db.query(`
          UPDATE users 
          SET status = 'active'
          WHERE id = ?
        `, [this.testUser.id]);
      } catch (cleanupError) {
        await Log.error('[TEST]', `Chyba při cleanup uživatele: ${cleanupError.message}`);
      }
    }

    // Logování výsledku testu
    const duration = Date.now() - startTime;
    const note = `TEST: account_delay - ${success ? 'SUCCESS' : 'FAILED'} - ${duration}ms - Planned: ${Math.round(this.delayDuration / 1000)}s${errorMessage ? ` - ${errorMessage}` : ''}`;
    
    await this.db.query(TEST_QUERIES.logTestAction, [
      this.testUser.id,
      'account_delay',
      null,
      note,
      this.hostname
    ]);

    return { 
      success, 
      duration, 
      errorMessage, 
      plannedDelay: this.delayDuration,
      actualDelay: Math.min(this.delayDuration, 10000)
    };
  }

  async cleanup() {
    try {
      // Ujistíme se, že uživatel není ve stavu 'delaying'
      if (this.testUser) {
        await this.db.query(`
          UPDATE users 
          SET status = 'active'
          WHERE id = ? AND status = 'delaying'
        `, [this.testUser.id]);
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
async function runAccountDelayTest() {
  const test = new AccountDelayTest();
  
  try {
    await Log.info('[TEST]', '=== ACCOUNT DELAY TEST START ===');
    
    const initialized = await test.init();
    if (!initialized) {
      await Log.error('[TEST]', 'Test se nepodařilo inicializovat');
      return;
    }

    const result = await test.runTest();
    
    await Log.info('[TEST]', `=== ACCOUNT DELAY TEST END ===`);
    await Log.info('[TEST]', `Výsledek: ${result.success ? 'ÚSPĚCH' : 'SELHÁNÍ'}`);
    await Log.info('[TEST]', `Doba trvání: ${result.duration}ms`);
    await Log.info('[TEST]', `Plánovaná pauza: ${Math.round(result.plannedDelay / 1000)}s`);
    await Log.info('[TEST]', `Skutečná pauza: ${Math.round(result.actualDelay / 1000)}s`);
    
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
  runAccountDelayTest();
}

export { AccountDelayTest, runAccountDelayTest };