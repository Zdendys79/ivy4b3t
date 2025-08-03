/**
 * QuoteHarvester - Hlavní třída pro sběr citátů
 */

import { DatabaseManager } from './database_manager.class.js';
import { SourceManager } from './source_manager.class.js';
import { DuplicateChecker } from './duplicate_checker.class.js';
import { QualityValidator } from './quality_validator.class.js';
import { LanguageDetector } from './language_detector.class.js';
import { TranslationRobot } from './translation_robot.class.js';
import { Logger } from './logger.class.js';
import { HarvesterSystemLogger } from './harvester_system_logger.class.js';

export class QuoteHarvester {
  constructor() {
    this.logger = new Logger();
    this.db = new DatabaseManager();
    this.sourceManager = new SourceManager();
    this.duplicateChecker = new DuplicateChecker(this.db);
    this.qualityValidator = new QualityValidator();
    this.languageDetector = new LanguageDetector();
    this.translationRobot = new TranslationRobot(this.logger);
    
    // System logger pro integraci s IVY system logem
    this.systemLogger = new HarvesterSystemLogger({
      host: process.env.MYSQL_HOST,
      port: process.env.MYSQL_PORT,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE + '_test', // Používáme testovací databázi
      charset: 'utf8mb4'
    });
    
    this.stats = {
      processed: 0,
      duplicates: 0,
      invalid: 0,
      imported: 0,
      errors: 0
    };
    
    // Tracking pro inteligentní rate limiting
    this.lastZenQuotesRequest = 0;
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
      const textToDetect = quote.original_text || quote.text;
      const detectedLanguage = await this.languageDetector.detect(textToDetect);
      quote.language_code = detectedLanguage;

      // 3. Kontrola duplicit
      const isDuplicate = await this.duplicateChecker.check(quote);
      if (isDuplicate) {
        const displayText = quote.original_text || quote.text || 'bez textu';
        this.logger.debug(`🔄 Duplicitní citát: ${displayText.substring(0, 50)}...`);
        this.stats.duplicates++;
        return;
      }

      // 4. Import do databáze
      await this.db.importQuote(quote, sourceName);
      this.stats.imported++;
      
      const displayText = quote.original_text || quote.text || 'bez textu';
      this.logger.debug(`✅ Importován citát: ${displayText.substring(0, 50)}...`);
      
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
  /**
   * Spuštění s výběrem zdrojů
   */
  async runWithSourceSelection(mode) {
    this.logger.info('🚀 Spouštím Quote Harvester');
    
    try {
      // 1. Test připojení
      await this.testConnection();
      
      // 2. Načíst aktivní jazyky
      const activeLanguages = await this.db.getActiveLanguages();
      this.logger.info(`📚 Aktivní jazyky: ${activeLanguages.map(l => l.code).join(', ')}`);
      
      // 3. Vybrat zdroje podle módu
      const selectedSources = this.getSourcesByMode(mode);
      this.logger.info(`🎯 Vybrané zdroje: ${selectedSources.length}`);
      
      // 4. Spustit harvesting podle typu
      if (mode === 'zenquotes' || mode === 'apininjas') {
        await this.runRateLimitedHarvesting(selectedSources, activeLanguages);
      } else {
        await this.runStandardHarvesting(selectedSources, activeLanguages);
      }
      
      // 5. Zobrazit statistiky
      this.showFinalStats();
      
    } catch (error) {
      this.logger.error('❌ Kritická chyba:', error.message);
      throw error;
    }
  }

  /**
   * Získat zdroje podle vybraného módu
   */
  getSourcesByMode(mode) {
    const allSources = this.sourceManager.getAllSources();
    
    switch (mode) {
      case 'auto-safe':
        // Bezlimitové zdroje: Quotable, DummyJSON, České citáty
        return allSources.filter(s => 
          s.name.includes('Quotable.io') || 
          s.name.includes('DummyJSON') || 
          s.name.includes('České citáty')
        );
        
      case 'quotable':
        return allSources.filter(s => s.name.includes('Quotable.io'));
        
      case 'zenquotes':
        return allSources.filter(s => s.name.includes('ZenQuotes.io'));
        
      case 'apininjas':
        return allSources.filter(s => s.name.includes('API Ninjas'));
        
      case 'dummyjson':
        return allSources.filter(s => s.name.includes('DummyJSON'));
        
      case 'wikiquote':
        return allSources.filter(s => s.name.includes('Wikiquote'));
        
      case 'brainyquote':
        return allSources.filter(s => s.name.includes('BrainyQuote'));
        
      case 'cesky':
        return allSources.filter(s => s.name.includes('České citáty'));
        
      case 'all':
        return allSources;
        
      default:
        return allSources.filter(s => 
          s.name.includes('Quotable.io') || 
          s.name.includes('DummyJSON') || 
          s.name.includes('České citáty')
        );
    }
  }

  /**
   * Standardní harvesting pro bezlimitové zdroje
   */
  async runStandardHarvesting(sources, activeLanguages) {
    for (const source of sources) {
      await this.harvestFromSource(source, activeLanguages);
    }
  }

  /**
   * Pomalý harvesting pro zdroje s rate limity
   */
  async runRateLimitedHarvesting(sources, activeLanguages) {
    for (const source of sources) {
      this.logger.info(`\n🐌 POMALÝ HARVESTING - ${source.name}`);
      this.logger.info(`⏱️  Rate limit: ${source.rateLimit}ms mezi dotazy`);
      this.logger.info('🔄 Začínám postupné načítání...\n');
      
      await this.harvestFromSourceSlowly(source, activeLanguages);
    }
  }

  /**
   * Pomalé načítání s detailními progress info
   */
  async harvestFromSourceSlowly(source, activeLanguages) {
    this.logger.info(`📥 Zpracovávám zdroj: ${source.name}`);
    
    try {
      // Načíst citáty s progress reportingem
      const quotes = await this.fetchQuotesWithProgress(source, activeLanguages);
      
      if (quotes.length === 0) {
        this.logger.warn(`⚠️  Žádné citáty z ${source.name}`);
        return;
      }

      this.logger.info(`📝 Načteno ${quotes.length} citátů z ${source.name}`);
      this.logger.info('🔍 Začínám validaci a import...');
      
      // Zpracovat každý citát individuálně s progress
      let processed = 0;
      for (const quote of quotes) {
        processed++;
        
        if (processed % 10 === 0) {
          this.logger.info(`⚙️  Zpracováno ${processed}/${quotes.length} citátů`);
        }
        
        await this.processQuoteSlowly(quote, source.name);
        
        // Malá pauza mezi zpracováním
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      this.logger.success(`✅ Dokončen import z ${source.name}: ${processed} citátů`);
      
    } catch (error) {
      this.logger.error(`❌ Chyba při načítání z ${source.name}:`, error.message);
      this.stats.errors++;
    }
  }

  /**
   * Načítání citátů s progress reportingem
   */
  async fetchQuotesWithProgress(source, activeLanguages) {
    this.logger.info(`🔄 Připojuji se k ${source.name}...`);
    
    const quotes = await source.fetchQuotes(activeLanguages);
    
    this.logger.info(`📊 Odpověď serveru: ${quotes.length} citátů`);
    return quotes;
  }

  /**
   * Pomalé zpracování jednotlivého citátu
   */
  async processQuoteSlowly(quote, sourceName) {
    this.stats.processed++;

    try {
      // 1. Validace kvality
      const qualityResult = await this.qualityValidator.validate(quote);
      if (!qualityResult.valid) {
        this.stats.invalid++;
        return;
      }

      // 2. Detekce jazyka
      const detectedLanguage = await this.languageDetector.detect(quote.text || quote.original_text);
      if (detectedLanguage) {
        quote.language_code = detectedLanguage;
      }

      // 3. Kontrola duplicit
      const isDuplicate = await this.duplicateChecker.check(quote);
      if (isDuplicate) {
        this.stats.duplicates++;
        return;
      }

      // 4. Import do databáze
      await this.db.importQuote(quote, sourceName);
      this.stats.imported++;

    } catch (error) {
      this.logger.error('❌ Chyba při zpracování citátu:', error.message);
      this.stats.errors++;
    }
  }

  /**
   * Získat dostupné zdroje
   */
  async getAvailableSources() {
    return this.sourceManager.getAllSources();
  }

  /**
   * Nekonečný sběr z ZenQuotes.io
   */
  async runInfiniteZenQuotes() {
    console.log('\n🧘 NEKONEČNÝ SBĚR Z ZENQUOTES.IO');
    console.log('═══════════════════════════════════════');
    console.log('⏱️  Pauza mezi dotazy: 7 sekund');
    console.log('🔄 Pro ukončení stiskni Ctrl+C');
    console.log('═══════════════════════════════════════\n');

    try {
      // Test připojení
      await this.testConnection();
      
      // Načíst aktivní jazyky
      const activeLanguages = await this.db.getActiveLanguages();
      
      // Najít ZenQuotes zdroj
      const zenQuotesSource = this.sourceManager.getAllSources()
        .find(s => s.name.includes('ZenQuotes.io'));
        
      if (!zenQuotesSource) {
        throw new Error('ZenQuotes.io zdroj nenalezen');
      }

      this.logger.info('🚀 Začínám nekonečný cyklus...');
      
      let round = 1;
      let totalImported = 0;
      
      while (true) {
        this.logger.info(`\n🔄 KOLO ${round} - ${new Date().toLocaleTimeString()}`);
        
        try {
          // Načíst citáty
          this.logger.info('🔄 Připojuji se k ZenQuotes.io...');
          const quotes = await zenQuotesSource.fetchQuotes(activeLanguages);
          
          if (quotes.length === 0) {
            this.logger.warn('⚠️  Žádné citáty v tomto kole');
          } else {
            this.logger.info(`📊 Načteno ${quotes.length} citátů`);
            
            // Zpracovat citáty
            let roundImported = 0;
            for (const quote of quotes) {
              try {
                // Validace
                const qualityResult = await this.qualityValidator.validate(quote);
                if (!qualityResult.valid) continue;

                // Detekce jazyka
                const textToDetect = quote.original_text || quote.text;
                const detectedLanguage = await this.languageDetector.detect(textToDetect);
                if (detectedLanguage) {
                  quote.language_code = detectedLanguage;
                }

                // Kontrola duplicit
                const isDuplicate = await this.duplicateChecker.check(quote);
                if (isDuplicate) continue;

                // Import
                await this.db.importQuote(quote, zenQuotesSource.name);
                roundImported++;
                totalImported++;
                
              } catch (error) {
                this.logger.error(`❌ Chyba při zpracování citátu: ${error.message}`);
              }
            }
            
            this.logger.success(`✅ Kolo ${round}: ${roundImported} nových citátů (celkem: ${totalImported})`);
          }
          
        } catch (error) {
          this.logger.error(`❌ Chyba v kole ${round}: ${error.message}`);
        }
        
        round++;
        
        // Čekání 7 sekund
        this.logger.info('⏳ Čekám 7 sekund do dalšího kola...');
        await new Promise(resolve => setTimeout(resolve, 7000));
      }
      
    } catch (error) {
      this.logger.error('❌ Kritická chyba nekonečného sběru:', error.message);
      throw error;
    }
  }

  /**
   * Robot pro překlad chybějících citátů
   */
  async runTranslationBot() {
    console.log('\n🌐 ROBOT PRO PŘEKLAD CITÁTŮ');
    console.log('═══════════════════════════════════════');
    console.log('🔄 Překládá citáty bez českého textu');
    console.log('⚡ Postupný překlad s rate limiting');
    console.log('═══════════════════════════════════════\n');

    try {
      // Test připojení
      await this.testConnection();

      // Najít citáty k překladu
      const quotesToTranslate = await this.findQuotesNeedingTranslation();
      
      if (quotesToTranslate.length === 0) {
        this.logger.info('✅ Všechny citáty už mají překlad!');
        return;
      }

      this.logger.info(`📊 Nalezeno ${quotesToTranslate.length} citátů k překladu`);
      
      let translated = 0;
      let errors = 0;

      for (const quote of quotesToTranslate) {
        try {
          const translation = await this.translationRobot.translateQuote(quote);
          
          if (translation) {
            await this.saveTranslation(quote.id, translation);
            translated++;
            this.logger.success(`✅ Přeloženo ${translated}/${quotesToTranslate.length}`);
          } else {
            errors++;
          }
          
          // Pauza mezi překlady
          await new Promise(resolve => setTimeout(resolve, 2000));
          
        } catch (error) {
          this.logger.error(`❌ Chyba při překladu ID ${quote.id}: ${error.message}`);
          errors++;
        }
      }

      this.logger.info(`\n🎯 VÝSLEDKY PŘEKLADU:`);
      this.logger.info(`   Přeloženo: ${translated}`);
      this.logger.info(`   Chyby: ${errors}`);
      this.logger.info(`   Úspěšnost: ${Math.round((translated / quotesToTranslate.length) * 100)}%`);

    } catch (error) {
      this.logger.error('❌ Kritická chyba překladového robota:', error.message);
      throw error;
    }
  }

  /**
   * Kombinovaný nekonečný sběr + překlady (2 nezávislé smyčky)
   */
  async runInfiniteWithTranslation() {
    console.log('\n🧘🌐 ASYNCHRONNÍ SBĚR + KONTINUÁLNÍ PŘEKLAD');
    console.log('═══════════════════════════════════════');
    console.log('📥 Sběr ZenQuotes: každých 60 sekund');
    console.log('🌐 Překlady: kontinuálně každých 5 sekund');
    console.log('⚡ Dvě nezávislé asynchronní smyčky');
    console.log('🛑 Pro ukončení stiskni Ctrl+C');
    console.log('═══════════════════════════════════════\n');

    try {
      // Zalogovat start do system logu
      await this.systemLogger.logHarvesterStart();
      
      // Test připojení
      await this.testConnection();
      
      // Načíst aktivní jazyky
      const activeLanguages = await this.db.getActiveLanguages();
      
      // Najít ZenQuotes zdroj
      const zenQuotesSource = this.sourceManager.getAllSources()
        .find(s => s.name.includes('ZenQuotes.io'));
        
      if (!zenQuotesSource) {
        throw new Error('ZenQuotes.io zdroj nenalezen');
      }

      this.logger.info('🚀 Spouštím nezávislé asynchronní smyčky...');
      
      // Sdílené countery
      let totalImported = 0;
      let totalTranslated = 0;
      
      // SMYČKA 1: Sběr citátů (každých 60s)
      const harvestingLoop = async () => {
        let harvestRound = 1;
        
        while (true) {
          const timestamp = new Date().toLocaleTimeString();
          this.logger.info(`\n📥 SBĚR ${harvestRound} - ${timestamp}`);
          
          try {
            const quotes = await zenQuotesSource.fetchQuotes(activeLanguages);
            
            if (quotes.length > 0) {
              let roundImported = 0;
              for (const quote of quotes) {
                try {
                  const qualityResult = await this.qualityValidator.validate(quote);
                  if (!qualityResult.valid) continue;

                  const textToDetect = quote.original_text || quote.text;
                const detectedLanguage = await this.languageDetector.detect(textToDetect);
                  if (detectedLanguage) {
                    quote.language_code = detectedLanguage;
                  }

                  const isDuplicate = await this.duplicateChecker.check(quote);
                  if (isDuplicate) continue;

                  await this.db.importQuote(quote, zenQuotesSource.name);
                  roundImported++;
                  totalImported++;
                  
                } catch (error) {
                  this.logger.error(`❌ Chyba při zpracování citátu: ${error.message}`);
                }
              }
              
              this.logger.success(`✅ Sběr ${harvestRound}: +${roundImported} citátů (celkem: ${totalImported})`);
            } else {
              this.logger.warn(`⚠️  Sběr ${harvestRound}: žádné nové citáty`);
            }
            
          } catch (error) {
            this.logger.error(`❌ Chyba při sběru ${harvestRound}: ${error.message}`);
          }
          
          harvestRound++;
          
          // Čekání 60 sekund do dalšího sběru
          this.logger.info(`⏳ Další sběr za 60 sekund...`);
          await new Promise(resolve => setTimeout(resolve, 60000));
        }
      };
      
      // SMYČKA 2: Překlady (každých 5s)
      const translationLoop = async () => {
        let translationRound = 1;
        
        // Počkej 5 sekund než začneš (ať se spustí harvesting první)
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        while (true) {
          const timestamp = new Date().toLocaleTimeString();
          
          try {
            const quotesToTranslate = await this.findQuotesNeedingTranslation(1); // 1 citát za cyklus
            
            if (quotesToTranslate.length > 0) {
              const quote = quotesToTranslate[0];
              
              try {
                const translation = await this.translationRobot.translateQuote(quote);
                
                if (translation) {
                  await this.saveTranslation(quote.id, translation);
                  await this.systemLogger.logTranslationSuccess(quote.id, quote.original_text, translation, quote.language_code);
                  totalTranslated++;
                  this.logger.success(`✅ Přeložen citát ID ${quote.id} (celkem: ${totalTranslated})`);
                } else {
                  // Zkontrolovat počet selhání v system logu
                  const failureCount = await this.systemLogger.getTranslationFailureCount(quote.id);
                  
                  // Zalogovat selhání do system logu
                  await this.systemLogger.logTranslationFailure(quote.id, quote.original_text, quote.language_code, 'Translation returned null');
                  
                  if (failureCount >= 3) {
                    // Po 3 pokusech označit jako trvale problematický
                    await this.markQuoteAsProblematic(quote.id);
                    this.logger.warn(`⚠️  Citát ID ${quote.id} označen jako problematický po ${failureCount + 1} pokusech`);
                  } else {
                    this.logger.warn(`⚠️  Překlad selhal pro ID ${quote.id} (pokus ${failureCount + 1}/3)`);
                  }
                }
                
              } catch (error) {
                // Zalogovat kritickou chybu do system logu
                await this.systemLogger.logTranslationFailure(quote.id, quote.original_text, quote.language_code, error.message);
                
                const failureCount = await this.systemLogger.getTranslationFailureCount(quote.id);
                
                if (failureCount >= 3) {
                  await this.markQuoteAsProblematic(quote.id);
                  this.logger.error(`❌ Citát ID ${quote.id} označen jako problematický po ${failureCount} chybách`);
                } else {
                  this.logger.error(`❌ Chyba při překladu ID ${quote.id}: ${error.message} (pokus ${failureCount}/3)`);
                }
              }
            } else {
              // Loguj pouze každých 12 cyklů (každou minutu) pokud nejsou citáty k překladu
              if (translationRound % 12 === 0) {
                this.logger.info(`✅ Překlad ${translationRound}: všechny citáty přeloženy`);
              }
            }
            
          } catch (error) {
            this.logger.error(`❌ Chyba v překladové smyčce ${translationRound}: ${error.message}`);
          }
          
          translationRound++;
          
          // Čekání 5 sekund do dalšího překladu
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      };
      
      // Spustit obě smyčky paralelně
      await Promise.all([
        harvestingLoop(),
        translationLoop()
      ]);
      
    } catch (error) {
      await this.systemLogger.logHarvesterStop('error');
      this.logger.error('❌ Kritická chyba asynchronního systému:', error.message);
      throw error;
    }
  }

  /**
   * Graceful shutdown s system logem
   */
  async shutdown(reason = 'normal') {
    await this.systemLogger.logHarvesterStop(reason);
    await this.systemLogger.close();
    await this.db.close();
  }

  /**
   * Najít citáty potřebující překlad
   */
  async findQuotesNeedingTranslation(limit = 10) {
    const conn = await this.db.connect();
    
    // Náhodný výběr citátů k překladu
    const query = `
      SELECT id, original_text, language_code, author
      FROM quotes 
      WHERE language_code NOT IN ('ces', 'svk') 
        AND (translated_text IS NULL OR translated_text = '')
        AND original_text IS NOT NULL 
        AND original_text != ''
      ORDER BY RAND()
      LIMIT ?
    `;
    
    const [rows] = await conn.execute(query, [limit]);
    return rows;
  }

  /**
   * Uložit překlad do databáze
   */
  async saveTranslation(quoteId, translation) {
    const conn = await this.db.connect();
    
    const query = 'UPDATE quotes SET translated_text = ? WHERE id = ?';
    await conn.execute(query, [translation, quoteId]);
  }

  /**
   * Označit citát jako problematický (nemůže se přeložit)
   */
  async markQuoteAsProblematic(quoteId) {
    const conn = await this.db.connect();
    
    // Označit jako problematický přes translation_approved sloupec
    const query = 'UPDATE quotes SET translation_approved = 2 WHERE id = ?';
    await conn.execute(query, [quoteId]);
  }

  /**
   * Inteligentní čekání pro ZenQuotes rate limit (už se nepoužívá v async režimu)
   */
  async waitForZenQuotesIfNeeded() {
    // V asynchronním režimu už není potřeba - 60s pauzy jsou dostatečné
    this.lastZenQuotesRequest = Date.now();
  }

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