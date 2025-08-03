/**
 * QuoteHarvester - Hlavní třída pro sběr citátů
 */

import { DatabaseManager } from './database_manager.class.js';
import { SourceManager } from './source_manager.class.js';
import { DuplicateChecker } from './duplicate_checker.class.js';
import { QualityValidator } from './quality_validator.class.js';
import { LanguageDetector } from './language_detector.class.js';
import { Logger } from './logger.class.js';

export class QuoteHarvester {
  constructor() {
    this.logger = new Logger();
    this.db = new DatabaseManager();
    this.sourceManager = new SourceManager();
    this.duplicateChecker = new DuplicateChecker();
    this.qualityValidator = new QualityValidator();
    this.languageDetector = new LanguageDetector();
    
    this.stats = {
      processed: 0,
      duplicates: 0,
      invalid: 0,
      imported: 0,
      errors: 0
    };
  }

  /**
   * Hlavní spuštění harvestingu
   */
  async run() {
    this.logger.info('🚀 Spouštím Quote Harvester');
    
    try {
      // 1. Test připojení
      await this.testConnection();
      
      // 2. Načíst aktivní jazyky
      const activeLanguages = await this.db.getActiveLanguages();
      this.logger.info(`📚 Aktivní jazyky: ${activeLanguages.map(l => l.code).join(', ')}`);
      
      // 3. Projít všechny zdroje
      const sources = this.sourceManager.getAllSources();
      this.logger.info(`🔗 Dostupné zdroje: ${sources.length}`);
      
      for (const source of sources) {
        await this.harvestFromSource(source, activeLanguages);
      }
      
      // 4. Finální statistiky
      this.showFinalStats();
      
    } catch (error) {
      this.logger.error('❌ Chyba při harvestingu:', error.message);
      throw error;
    }
  }

  /**
   * Harvest z jedného zdroje
   */
  async harvestFromSource(source, activeLanguages) {
    this.logger.info(`📥 Zpracovávám zdroj: ${source.name}`);
    
    try {
      // Získat citáty ze zdroje
      const quotes = await source.fetch(activeLanguages);
      this.logger.info(`📝 Načteno ${quotes.length} citátů z ${source.name}`);
      
      // Zpracovat každý citát
      for (const quote of quotes) {
        await this.processQuote(quote, source.name);
      }
      
    } catch (error) {
      this.logger.error(`❌ Chyba při zpracování zdroje ${source.name}:`, error.message);
      this.stats.errors++;
    }
  }

  /**
   * Zpracování jedného citátu
   */
  async processQuote(quote, sourceName) {
    this.stats.processed++;
    
    try {
      // 1. Validace kvality
      const qualityResult = await this.qualityValidator.validate(quote);
      if (!qualityResult.valid) {
        this.logger.debug(`❌ Nevalidní citát: ${qualityResult.reason}`);
        this.stats.invalid++;
        return;
      }

      // 2. Detekce jazyka
      const detectedLanguage = await this.languageDetector.detect(quote.text);
      quote.language_code = detectedLanguage;

      // 3. Kontrola duplicit
      const isDuplicate = await this.duplicateChecker.check(quote);
      if (isDuplicate) {
        this.logger.debug(`🔄 Duplicitní citát: ${quote.text.substring(0, 50)}...`);
        this.stats.duplicates++;
        return;
      }

      // 4. Import do databáze
      await this.db.importQuote(quote, sourceName);
      this.stats.imported++;
      
      this.logger.debug(`✅ Importován citát: ${quote.text.substring(0, 50)}...`);
      
    } catch (error) {
      this.logger.error(`❌ Chyba při zpracování citátu:`, error.message);
      this.stats.errors++;
    }
  }

  /**
   * Validace existujících citátů
   */
  async validateExisting() {
    this.logger.info('🔍 Validuji existující citáty...');
    
    const quotes = await this.db.getAllQuotes();
    this.logger.info(`📊 Celkem citátů: ${quotes.length}`);
    
    let invalidCount = 0;
    
    for (const quote of quotes) {
      const qualityResult = await this.qualityValidator.validate(quote);
      if (!qualityResult.valid) {
        this.logger.warn(`❌ Nevalidní citát ID ${quote.id}: ${qualityResult.reason}`);
        invalidCount++;
      }
    }
    
    this.logger.info(`📈 Validních citátů: ${quotes.length - invalidCount}/${quotes.length}`);
  }

  /**
   * Zobrazení statistik
   */
  async showStats() {
    const stats = await this.db.getQuoteStats();
    
    this.logger.info('📊 STATISTIKY DATABÁZE:');
    this.logger.info(`   Celkem citátů: ${stats.total}`);
    this.logger.info(`   Podle jazyků:`);
    
    for (const langStat of stats.byLanguage) {
      this.logger.info(`     ${langStat.language_name}: ${langStat.count}`);
    }
    
    this.logger.info(`   S autory: ${stats.withAuthor}`);
    this.logger.info(`   Bez autorů: ${stats.withoutAuthor}`);
    this.logger.info(`   S originálním textem: ${stats.withOriginal}`);
  }

  /**
   * Seznam zdrojů
   */
  async listSources() {
    const sources = this.sourceManager.getAllSources();
    
    this.logger.info('🔗 DOSTUPNÉ ZDROJE:');
    for (const source of sources) {
      this.logger.info(`   ${source.name}: ${source.description}`);
      this.logger.info(`     URL: ${source.url || 'N/A'}`);
      this.logger.info(`     Jazyky: ${source.supportedLanguages.join(', ')}`);
      this.logger.info(`     Typ: ${source.type}`);
      this.logger.info('');
    }
  }

  /**
   * Test připojení k databázi
   */
  async testConnection() {
    this.logger.info('🔌 Testuji připojení k databázi...');
    
    try {
      await this.db.testConnection();
      this.logger.success('✅ Připojení k databázi úspěšné');
    } catch (error) {
      this.logger.error('❌ Chyba připojení k databázi:', error.message);
      throw error;
    }
  }

  /**
   * Finální statistiky po harvesting
   */
  showFinalStats() {
    this.logger.info('');
    this.logger.info('🎯 VÝSLEDKY HARVESTINGU:');
    this.logger.info(`   Zpracováno: ${this.stats.processed}`);
    this.logger.info(`   Importováno: ${this.stats.imported}`);
    this.logger.info(`   Duplicity: ${this.stats.duplicates}`);
    this.logger.info(`   Nevalidní: ${this.stats.invalid}`);
    this.logger.info(`   Chyby: ${this.stats.errors}`);
    
    const successRate = this.stats.processed > 0 ? 
      Math.round((this.stats.imported / this.stats.processed) * 100) : 0;
    
    this.logger.info(`   Úspěšnost: ${successRate}%`);
    
    if (this.stats.imported > 0) {
      this.logger.success(`🎉 Úspěšně importováno ${this.stats.imported} nových citátů!`);
    } else {
      this.logger.warn('⚠️  Žádné nové citáty nebyly importovány');
    }
  }
}