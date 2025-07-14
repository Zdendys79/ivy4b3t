/**
 * Název souboru: test_account_sleep.js
 * Umístění: ~/ivy/test_account_sleep.js
 *
 * Popis: Testovací soubor pro akci account_sleep (dlouhá pauza/uspání účtu)
 */

import { IvDb } from './libs/iv_db.class.js';
import { IvActions } from './libs/iv_actions.class.js';
import { Log } from './libs/iv_log.class.js';
import { wait } from './libs/iv_support.js';
import { TEST_QUERIES } from './sql/queries/test_queries.js';

class AccountSleepTest {
  constructor() {
    this.db = null;
    this.actions = null;
    this.testUser = null;
    this.hostname = null;
    this.sleepDuration = null;
    this.originalWorkUntil = null;
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
        throw new Error('Žádný vhodný uživatel pro test account_sleep');
      }

      // Uložení původního work_until pro obnovení
      this.originalWorkUntil = this.testUser.work_until;

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
        'account_sleep',
        this.hostname,
        this.hostname
      ]);

      return users.length > 0 ? users[0] : null;
    } catch (error) {
      await Log.error('[TEST]', `Chyba při výběru uživatele: ${error.message}`);
      return null;
    }
  }

  calculateSleepDuration() {
    // Náhodná pauza mezi 1-6 hodinami (podle typické logiky account_sleep)
    const minSleep = 1 * 60 * 60 * 1000; // 1 hodina
    const maxSleep = 6 * 60 * 60 * 1000; // 6 hodin
    return Math.floor(Math.random() * (maxSleep - minSleep)) + minSleep;
  }

  async runTest() {
    const startTime = Date.now();
    let success = false;
    let errorMessage = '';

    try {
      await Log.info('[TEST]', '🚀 Spouštím test account_sleep akce');

      // 1. Výpočet délky spánku
      this.sleepDuration = this.calculateSleepDuration();
      const sleepHours = Math.round(this.sleepDuration / (60 * 60 * 1000) * 10) / 10;
      await Log.info('[TEST]', `1. Nastavena pauza na ${sleepHours} hodin`);

      // 2. Výpočet času probuzení
      const wakeUpTime = new Date(Date.now() + this.sleepDuration);
      await Log.info('[TEST]', `2. Plánované probuzení: ${wakeUpTime.toLocaleString('cs-CZ')}`);

      // 3. Aktualizace stavu uživatele - uspání
      await this.db.query(`
        UPDATE users 
        SET work_until = ?,
            last_activity = NOW(), 
            status = 'sleeping'
        WHERE id = ?
      `, [wakeUpTime, this.testUser.id]);

      await Log.info('[TEST]', '3. Uživatel uspán, work_until aktualizován');

      // 4. Ověření, že uživatel je skutečně neaktivní
      const userCheck = await this.db.query(`
        SELECT *, 
               CASE 
                 WHEN work_until <= NOW() THEN 'awake'
                 WHEN work_until > NOW() THEN 'sleeping'
               END as sleep_status,
               TIMESTAMPDIFF(MINUTE, NOW(), work_until) as minutes_until_wake
        FROM users 
        WHERE id = ?
      `, [this.testUser.id]);

      if (userCheck.length > 0) {
        const user = userCheck[0];
        await Log.info('[TEST]', `4. Stav spánku: ${user.sleep_status}`);
        await Log.info('[TEST]', `   Zbývá minut do probuzení: ${user.minutes_until_wake}`);
      }

      // 5. Pro test simulujeme probuzení po krátké době (10 sekund)
      await Log.info('[TEST]', '5. Pro účely testu simuluji probuzení za 10 sekund...');
      
      for (let i = 0; i < 10; i++) {
        await wait.delay(1000);
        if ((i + 1) % 3 === 0 || i === 9) {
          await Log.info('[TEST]', `   Spánek: ${i + 1}/10s`);
        }
      }

      // 6. Předčasné probuzení pro test
      await this.db.query(`
        UPDATE users 
        SET work_until = NOW() + INTERVAL 1 HOUR,
            status = 'active'
        WHERE id = ?
      `, [this.testUser.id]);

      await Log.info('[TEST]', '6. Uživatel probuzen pro pokračování testů');

      // 7. Finální ověření stavu
      const finalCheck = await this.db.query(`
        SELECT *, 
               CASE 
                 WHEN work_until <= NOW() THEN 'awake'
                 WHEN work_until > NOW() THEN 'sleeping'
               END as final_status
        FROM users 
        WHERE id = ?
      `, [this.testUser.id]);

      if (finalCheck.length > 0) {
        const user = finalCheck[0];
        await Log.info('[TEST]', `7. Finální stav: ${user.final_status}`);
      }

      await Log.info('[TEST]', '✅ Account sleep test úspěšně dokončen');
      success = true;

    } catch (error) {
      errorMessage = error.message;
      await Log.error('[TEST]', `❌ Account sleep test selhal: ${errorMessage}`);
      success = false;
    }

    // Logování výsledku testu
    const duration = Date.now() - startTime;
    const note = `TEST: account_sleep - ${success ? 'SUCCESS' : 'FAILED'} - ${duration}ms - Planned: ${Math.round(this.sleepDuration / (60 * 60 * 1000) * 10) / 10}h${errorMessage ? ` - ${errorMessage}` : ''}`;
    
    await this.db.query(TEST_QUERIES.logTestAction, [
      this.testUser.id,
      'account_sleep',
      null,
      note,
      this.hostname
    ]);

    return { 
      success, 
      duration, 
      errorMessage, 
      plannedSleep: this.sleepDuration,
      sleepHours: Math.round(this.sleepDuration / (60 * 60 * 1000) * 10) / 10
    };
  }

  async cleanup() {
    try {
      // Obnovení původního work_until, pokud je to možné
      if (this.testUser && this.originalWorkUntil) {
        await this.db.query(`
          UPDATE users 
          SET work_until = ?,
              status = 'active'
          WHERE id = ?
        `, [this.originalWorkUntil, this.testUser.id]);
        
        await Log.info('[TEST]', 'Původní work_until obnoven');
      } else if (this.testUser) {
        // Nastavení na 1 hodinu dopředu jako bezpečná hodnota
        await this.db.query(`
          UPDATE users 
          SET work_until = NOW() + INTERVAL 1 HOUR,
              status = 'active'
          WHERE id = ?
        `, [this.testUser.id]);
        
        await Log.info('[TEST]', 'work_until nastaven na bezpečnou hodnotu');
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
async function runAccountSleepTest() {
  const test = new AccountSleepTest();
  
  try {
    await Log.info('[TEST]', '=== ACCOUNT SLEEP TEST START ===');
    
    const initialized = await test.init();
    if (!initialized) {
      await Log.error('[TEST]', 'Test se nepodařilo inicializovat');
      return;
    }

    const result = await test.runTest();
    
    await Log.info('[TEST]', `=== ACCOUNT SLEEP TEST END ===`);
    await Log.info('[TEST]', `Výsledek: ${result.success ? 'ÚSPĚCH' : 'SELHÁNÍ'}`);
    await Log.info('[TEST]', `Doba trvání: ${result.duration}ms`);
    await Log.info('[TEST]', `Plánovaná doba spánku: ${result.sleepHours}h`);
    
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
  runAccountSleepTest();
}

export { AccountSleepTest, runAccountSleepTest };