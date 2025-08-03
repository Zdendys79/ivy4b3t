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
        await harvester.run();
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

function showHelp() {
  console.log(`
🌾 Quote Harvester - Automatický sběr citátů

POUŽITÍ:
  node harvester.js [příkaz]

PŘÍKAZY:
  --run, --harvest     Spustit kompletní harvesting
  --validate-only      Pouze validovat existující citáty
  --stats-only         Zobrazit statistiky databáze
  --sources            Vypsat dostupné zdroje
  --test-connection    Otestovat připojení k databázi
  --help               Zobrazit tuto nápovědu

PŘÍKLADY:
  node harvester.js --run               # Běžný harvesting
  node harvester.js --stats-only        # Pouze statistiky
  npm run harvest                       # Pomocí npm scriptu

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