#!/usr/bin/env node

/**
 * Quote Harvester - Automatický systém pro sběr citátů
 * 
 * Funkce:
 * - Stahuje citáty z různých zdrojů (API + web scraping)
 * - Detekuje duplicity pomocí hash + Levenshtein distance
 * - Podporuje více jazyků s automatickou detekcí
 * - Validuje kvalitu a relevanci citátů
 * - Integruje s IVY4B3T databází
 */

import { QuoteHarvester } from './src/quote_harvester.class.js';
import { Logger } from './src/logger.class.js';
import readline from 'readline';

const logger = new Logger();

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || '--help';

  try {
    const harvester = new QuoteHarvester();

    switch (command) {
      case '--run':
      case '--harvest':
        logger.info('🌾 Spouštím Quote Harvester...');
        await showSourceSelection(harvester);
        break;

      case '--validate-only':
        logger.info('✅ Pouze validace existujících citátů...');
        await harvester.validateExisting();
        break;

      case '--stats-only':
        logger.info('📊 Zobrazuji statistiky...');
        await harvester.showStats();
        break;

      case '--sources':
        logger.info('🔗 Dostupné zdroje:');
        await harvester.listSources();
        break;

      case '--test-connection':
        logger.info('🔌 Testuji připojení k databázi...');
        await harvester.testConnection();
        break;

      case '--zenquotes-infinite':
        logger.info('🧘 Spouštím nekonečný sběr z ZenQuotes.io...');
        await harvester.runInfiniteZenQuotes();
        break;

      case '--translate-missing':
        logger.info('🌐 Spouštím překlad chybějících citátů...');
        await harvester.runTranslationBot();
        break;

      case '--infinite-with-translation':
        logger.info('🧘🌐 Spouštím nekonečný sběr + překlady...');
        await harvester.runInfiniteWithTranslation();
        break;

      case '--help':
      default:
        showHelp();
        break;
    }

  } catch (error) {
    logger.error('❌ Kritická chyba:', error.message);
    process.exit(1);
  }
}

async function showSourceSelection(harvester) {
  const sources = await harvester.getAvailableSources();
  
  console.log('\n🎯 VÝBĚR ZDROJŮ CITÁTŮ');
  console.log('═══════════════════════════════════════');
  console.log('0) 🚀 AUTOMATICKY - pouze bezlimitové zdroje (VÝCHOZÍ)');
  console.log('1) 📚 Quotable.io API');
  console.log('2) 🧘 ZenQuotes.io API (rate limit)');
  console.log('3) 🥷 API Ninjas (rate limit)');
  console.log('4) 🎲 DummyJSON API');
  console.log('5) 📖 Wikiquote scraping');
  console.log('6) 🧠 BrainyQuote scraping');
  console.log('7) 🇨🇿 České citáty');
  console.log('8) 🌐 VŠECHNY ZDROJE (opatrně s rate limity!)');
  console.log('═══════════════════════════════════════');
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log('\n⏰ Za 15 sekund se automaticky spustí volba 0 (bezlimitové zdroje)');
  console.log('Stiskni číslo 0-8 a ENTER pro výběr:');

  let timeoutId;
  const userChoice = await new Promise((resolve) => {
    // Auto-select after 15 seconds
    timeoutId = setTimeout(() => {
      console.log('\n⚡ Automaticky vybráno: 0 (bezlimitové zdroje)');
      rl.close();
      resolve('0');
    }, 15000);

    rl.on('line', (input) => {
      clearTimeout(timeoutId);
      rl.close();
      resolve(input.trim());
    });
  });

  await executeHarvestingChoice(harvester, userChoice);
}

async function executeHarvestingChoice(harvester, choice) {
  const sourceMap = {
    '0': 'auto-safe',      // Bezlimitové zdroje
    '1': 'quotable',       // Quotable.io
    '2': 'zenquotes',      // ZenQuotes.io (rate limit)
    '3': 'apininjas',      // API Ninjas (rate limit) 
    '4': 'dummyjson',      // DummyJSON
    '5': 'wikiquote',      // Wikiquote
    '6': 'brainyquote',    // BrainyQuote
    '7': 'cesky',          // České citáty
    '8': 'all'             // Všechny zdroje
  };

  const selectedMode = sourceMap[choice] || 'auto-safe';
  
  console.log(`\n🎯 Spouštím harvesting: ${selectedMode}`);
  console.log('═══════════════════════════════════════\n');
  
  await harvester.runWithSourceSelection(selectedMode);
}

function showHelp() {
  console.log(`
🌾 Quote Harvester - Automatický sběr citátů

POUŽITÍ:
  node harvester.js [příkaz]

PŘÍKAZY:
  --run, --harvest              Spustit kompletní harvesting (s výběrem zdrojů)
  --validate-only               Pouze validovat existující citáty
  --stats-only                  Zobrazit statistiky databáze
  --sources                     Vypsat dostupné zdroje
  --test-connection             Otestovat připojení k databázi
  --zenquotes-infinite          Nekonečný sběr z ZenQuotes.io (7s pauzy)
  --translate-missing           Přeložit citáty bez českého textu
  --infinite-with-translation   Asynchronní sběr (60s) + překlady (5s) (DOPORUČENO)
  --help                        Zobrazit tuto nápovědu

PŘÍKLADY:
  node harvester.js --run                         # Běžný harvesting s výběrem
  node harvester.js --stats-only                  # Pouze statistiky
  node harvester.js --infinite-with-translation   # Asynchronní režim (doporučeno)
  node harvester.js --translate-missing           # Pouze překlady
  npm run harvest                                 # Pomocí npm scriptu

POZNÁMKY:
  - Harvester používá systémové proměnné pro připojení k DB
  - Podporuje detekci duplicit a validaci kvality
  - Automaticky detekuje jazyk citátů
  - Respektuje rate limiting API služeb
`);
}

// Spustit pouze pokud je soubor spuštěn přímo
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('🚨 Neočekávaná chyba:', error);
    process.exit(1);
  });
}