/**
 * DummyJSONSource - Citáty z DummyJSON API
 * Úplně free bez omezení
 */

import { BaseSource } from './base_source.class.js';
import fetch from 'node-fetch';

export class DummyJSONSource extends BaseSource {
  constructor() {
    super('DummyJSON', 'https://dummyjson.com/quotes', 'api');
    this.supportedLanguages = ['eng'];
    this.rateLimit = 1000; // 1 sekunda mezi dotazy
    this.description = 'Testovací citáty z DummyJSON';
  }

  async fetchQuotes(activeLanguages) {
    const quotes = [];
    
    // Pouze angličtina
    if (!activeLanguages.some(lang => lang.code === 'eng')) {
      return quotes;
    }

    try {
      // Načíst všechny dostupné citáty po stránkách
      const limit = 30;
      let skip = 0;
      let hasMore = true;
      
      while (hasMore && skip < 150) { // Max 5 stránek = 150 citátů
        const response = await fetch(`https://dummyjson.com/quotes?limit=${limit}&skip=${skip}`);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        if (data.quotes && Array.isArray(data.quotes)) {
          for (const item of data.quotes) {
            if (item.quote && item.author) {
              quotes.push(this.normalizeQuote({
                text: item.quote.trim(),
                author: item.author.trim(),
                language_code: 'eng'
              }));
            }
          }
          
          // Kontrola, jestli máme další stránku
          hasMore = data.quotes.length === limit;
          skip += limit;
          
          // Rate limiting
          await this.wait(this.rateLimit);
        } else {
          hasMore = false;
        }
      }

      this.log(`Načteno ${quotes.length} citátů z DummyJSON`);
      
    } catch (error) {
      this.log(`Chyba při načítání z DummyJSON: ${error.message}`, 'error');
    }

    return quotes;
  }
}