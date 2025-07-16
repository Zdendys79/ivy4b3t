/**
 * Název souboru: test_runner.js
 * Umístění: ~/ivy/test_runner.js
 *
 * Popis: Hlavní test runner pro spuštění všech testovacích souborů wheel of fortune akcí
 */

import { Log } from './libs/iv_log.class.js';
import { runPostUtioGTest } from './test_post_utio_g.js';
import { runPostUtioGvTest } from './test_post_utio_gv.js';
import { runGroupExploreTest } from './test_group_explore.js';
import { runAccountDelayTest } from './test_account_delay.js';
import { runAccountSleepTest } from './test_account_sleep.js';

class TestRunner {
  constructor() {
    this.testResults = [];
    this.startTime = null;
  }

  /**
   * Spustí všechny dostupné testy
   */
  async runAllTests() {
    this.startTime = Date.now();
    
    await Log.info('[TEST_RUNNER]', '🚀 ===== SPOUŠTÍM VŠECHNY TESTY =====');
    
    const tests = [
      { name: 'Post UTIO G', runner: runPostUtioGTest, weight: 400 },
      { name: 'Post UTIO GV', runner: runPostUtioGvTest, weight: 400 },
      { name: 'Group Explore', runner: runGroupExploreTest, weight: 200 },
      { name: 'Account Delay', runner: runAccountDelayTest, weight: 100 },
      { name: 'Account Sleep', runner: runAccountSleepTest, weight: 100 }
    ];

    // Seřaď testy podle váhy (nejdůležitější první)
    tests.sort((a, b) => b.weight - a.weight);

    for (const test of tests) {
      await this.runSingleTest(test.name, test.runner, test.weight);
      
      // Krátká pauza mezi testy
      await this.delay(3000);
    }

    await this.generateSummary();
  }

  /**
   * Spustí jednotlivý test
   */
  async runSingleTest(testName, testRunner, weight) {
    const testStart = Date.now();
    
    await Log.info('[TEST_RUNNER]', `📋 Spouštím test: ${testName} (váha: ${weight})`);
    
    try {
      await testRunner();
      
      const duration = Date.now() - testStart;
      this.testResults.push({
        name: testName,
        status: 'SUCCESS',
        duration: duration,
        weight: weight,
        error: null
      });
      
      await Log.success('[TEST_RUNNER]', `✅ ${testName} - ÚSPĚCH (${Math.round(duration/1000)}s)`);
      
    } catch (error) {
      const duration = Date.now() - testStart;
      this.testResults.push({
        name: testName,
        status: 'FAILED',
        duration: duration,
        weight: weight,
        error: error.message
      });
      
      await Log.error('[TEST_RUNNER]', `❌ ${testName} - SELHÁNÍ (${Math.round(duration/1000)}s): ${error.message}`);
    }
  }

  /**
   * Spustí pouze testy s vysokou váhou (kritické akce)
   */
  async runCriticalTests() {
    this.startTime = Date.now();
    
    await Log.info('[TEST_RUNNER]', '🔥 ===== SPOUŠTÍM KRITICKÉ TESTY =====');
    
    const criticalTests = [
      { name: 'Quote Post', runner: runQuotePostTest, weight: 500 },
      { name: 'Post UTIO G', runner: runPostUtioGTest, weight: 400 },
      { name: 'Post UTIO GV', runner: runPostUtioGvTest, weight: 400 }
    ];

    for (const test of criticalTests) {
      await this.runSingleTest(test.name, test.runner, test.weight);
      await this.delay(2000);
    }

    await this.generateSummary();
  }

  /**
   * Spustí pouze testy neinvazivních akcí
   */
  async runNonInvasiveTests() {
    this.startTime = Date.now();
    
    await Log.info('[TEST_RUNNER]', '🕊️ ===== SPOUŠTÍM NEINVAZIVNÍ TESTY =====');
    
    const nonInvasiveTests = [
      { name: 'Group Explore', runner: runGroupExploreTest, weight: 200 },
      { name: 'Account Delay', runner: runAccountDelayTest, weight: 100 },
      { name: 'Account Sleep', runner: runAccountSleepTest, weight: 100 }
    ];

    for (const test of nonInvasiveTests) {
      await this.runSingleTest(test.name, test.runner, test.weight);
      await this.delay(1000);
    }

    await this.generateSummary();
  }

  /**
   * Vygeneruje souhrn výsledků
   */
  async generateSummary() {
    const totalDuration = Date.now() - this.startTime;
    const successful = this.testResults.filter(t => t.status === 'SUCCESS').length;
    const failed = this.testResults.filter(t => t.status === 'FAILED').length;
    const total = this.testResults.length;
    
    await Log.info('[TEST_RUNNER]', '📊 ===== SOUHRN TESTOVÁNÍ =====');
    await Log.info('[TEST_RUNNER]', `Celková doba: ${Math.round(totalDuration/1000)}s`);
    await Log.info('[TEST_RUNNER]', `Úspěšné: ${successful}/${total}`);
    await Log.info('[TEST_RUNNER]', `Neúspěšné: ${failed}/${total}`);
    await Log.info('[TEST_RUNNER]', `Úspěšnost: ${Math.round((successful/total)*100)}%`);
    
    if (failed > 0) {
      await Log.warn('[TEST_RUNNER]', '❌ NEÚSPĚŠNÉ TESTY:');
      for (const test of this.testResults.filter(t => t.status === 'FAILED')) {
        await Log.error('[TEST_RUNNER]', `  ${test.name}: ${test.error}`);
      }
    }
    
    await Log.info('[TEST_RUNNER]', '📋 DETAILY VŠECH TESTŮ:');
    for (const test of this.testResults) {
      const status = test.status === 'SUCCESS' ? '✅' : '❌';
      const duration = Math.round(test.duration/1000);
      await Log.info('[TEST_RUNNER]', `  ${status} ${test.name} (váha: ${test.weight}) - ${duration}s`);
    }
    
    await Log.info('[TEST_RUNNER]', '===== TESTOVÁNÍ DOKONČENO =====');
  }

  /**
   * Pomocná funkce pro čekání
   */
  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Funkce pro spuštění testů z příkazové řádky
 */
async function main() {
  const runner = new TestRunner();
  
  // Načti argumenty z příkazové řádky
  const args = process.argv.slice(2);
  const testType = args[0] || 'all';
  
  try {
    switch (testType) {
      case 'all':
        await runner.runAllTests();
        break;
      case 'critical':
        await runner.runCriticalTests();
        break;
      case 'non-invasive':
        await runner.runNonInvasiveTests();
        break;
      default:
        await Log.error('[TEST_RUNNER]', `Neznámý typ testu: ${testType}`);
        await Log.info('[TEST_RUNNER]', 'Dostupné typy: all, critical, non-invasive');
        process.exit(1);
    }
    
    // Exit kód podle výsledků
    const failedTests = runner.testResults.filter(t => t.status === 'FAILED').length;
    process.exit(failedTests > 0 ? 1 : 0);
    
  } catch (error) {
    await Log.error('[TEST_RUNNER]', `Kritická chyba test runneru: ${error.message}`);
    process.exit(2);
  }
}

// Spuštění, pokud je soubor volán přímo
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { TestRunner };