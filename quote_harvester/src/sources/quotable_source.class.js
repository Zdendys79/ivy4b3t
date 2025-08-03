/**
 * QuotableSource - Quotable.io API zdroj
 * https://quotable.io/
 */

import { BaseSource } from './base_source.class.js';
import fetch from 'node-fetch';
import https from 'https';

export class QuotableSource extends BaseSource {
  constructor() {
    super('Quotable.io', 'https://api.quotable.io', 'api');
    this.supportedLanguages = ['eng'];
    this.rateLimit = 3000; // 3s mezi requesty - opatrné i pro API
    this.description = 'Free API with thousands of famous quotes';
    this.maxQuotesPerRequest = 20;
  }

  async fetchQuotes(activeLanguages) {
    const quotes = [];
    
    try {
      // Quotable.io podporuje pouze angličtinu
      if (!activeLanguages.some(lang => lang.code === 'eng')) {
        return quotes;
      }

      // Získat náhodné citáty
      const randomQuotes = await this.fetchRandomQuotes();
      quotes.push(...randomQuotes);

      // Získat citáty podle autorů
      const authorQuotes = await this.fetchQuotesByAuthors();
      quotes.push(...authorQuotes);

      this.log(`Načteno ${quotes.length} citátů z Quotable.io`);
      
    } catch (error) {
      this.log(`Chyba při načítání z Quotable.io: ${error.message}`, 'error');
    }

    return quotes;
  }

  /**
   * Načíst náhodné citáty
   */
  async fetchRandomQuotes() {
    const quotes = [];
    const batchSize = 50; // Quotable limit
    const totalBatches = 10; // Celkem 500 citátů

    for (let i = 0; i < totalBatches; i++) {
      try {
        const url = `${this.url}/quotes?limit=${batchSize}&page=${i + 1}`;
        
        // SSL agent pro ignorování expired certificates
        const httpsAgent = new https.Agent({
          rejectUnauthorized: false
        });
        
        const response = await fetch(url, {
          agent: httpsAgent,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json'
          }
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        
        for (const quote of data.results || []) {
          const normalized = this.normalizeQuote({
            text: quote.content,
            author: quote.author,
            language_code: 'eng'
          });

          if (this.isValidQuote(normalized)) {
            quotes.push(normalized);
          }
        }

        // Rate limiting mezi batches
        await this.respectRateLimit();
        
      } catch (error) {
        this.log(`Chyba při načítání batch ${i + 1}: ${error.message}`, 'error');
      }
    }

    return quotes;
  }

  /**
   * Načíst citáty podle známých autorů
   */
  async fetchQuotesByAuthors() {
    const quotes = [];
    const famousAuthors = [
      'Albert Einstein',
      'Winston Churchill', 
      'Mark Twain',
      'Oscar Wilde',
      'Benjamin Franklin',
      'Abraham Lincoln',
      'Mahatma Gandhi',
      'Nelson Mandela',
      'Steve Jobs',
      'Ernest Hemingway'
    ];

    for (const author of famousAuthors) {
      try {
        const url = `${this.url}/quotes?author=${encodeURIComponent(author)}&limit=50`;
        
        // SSL agent pro ignorování expired certificates
        const httpsAgent = new https.Agent({
          rejectUnauthorized: false
        });
        
        const response = await fetch(url, {
          agent: httpsAgent,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json'
          }
        });
        
        if (!response.ok) {
          continue; // Pokračovat s dalším autorem
        }

        const data = await response.json();
        
        for (const quote of data.results || []) {
          const normalized = this.normalizeQuote({
            text: quote.content,
            author: quote.author,
            language_code: 'eng'
          });

          if (this.isValidQuote(normalized)) {
            quotes.push(normalized);
          }
        }

        await this.respectRateLimit();
        
      } catch (error) {
        this.log(`Chyba při načítání citátů od ${author}: ${error.message}`, 'error');
      }
    }

    return quotes;
  }
}