/**
 * SourceManager - Správa zdrojů citátů
 */

import { QuotableSource } from './sources/quotable_source.class.js';
import { WikiquoteSource } from './sources/wikiquote_source.class.js';
import { BrainyQuoteSource } from './sources/brainyquote_source.class.js';
import { CeskySource } from './sources/cesky_source.class.js';

export class SourceManager {
  constructor() {
    this.sources = [];
    this.initializeSources();
  }

  /**
   * Inicializace všech dostupných zdrojů
   */
  initializeSources() {
    // API zdroje (priorita)
    this.sources.push(new QuotableSource());
    
    // Web scraping zdroje
    this.sources.push(new WikiquoteSource());
    this.sources.push(new BrainyQuoteSource());
    
    // České zdroje
    this.sources.push(new CeskySource());
  }

  /**
   * Získat všechny zdroje
   */
  getAllSources() {
    return this.sources;
  }

  /**
   * Získat zdroje podle jazyka
   */
  getSourcesByLanguage(languageCode) {
    return this.sources.filter(source => 
      source.supportedLanguages.includes(languageCode)
    );
  }

  /**
   * Získat pouze API zdroje
   */
  getApiSources() {
    return this.sources.filter(source => source.type === 'api');
  }

  /**
   * Získat pouze scraping zdroje
   */
  getScrapingSources() {
    return this.sources.filter(source => source.type === 'scraping');
  }

  /**
   * Aktivní zdroje (které nejsou disabled)
   */
  getActiveSources() {
    return this.sources.filter(source => !source.disabled);
  }
}