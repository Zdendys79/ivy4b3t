/**
 * ZenQuotesSource - Citáty z ZenQuotes.io API
 * Free API s 5 requests per 30 seconds
 */

import { BaseSource } from './base_source.class.js';
import fetch from 'node-fetch';

export class ZenQuotesSource extends BaseSource {
  constructor() {
    super('ZenQuotes.io', 'https://zenquotes.io/api', 'api');
    this.supportedLanguages = ['eng'];
    this.rateLimit = 7000; // 7 sekund mezi dotazy (bezpečná rezerva)
    this.description = 'Filosofické citáty z ZenQuotes.io';
  }

  async fetchQuotes(activeLanguages) {
    const quotes = [];
    
    // Pouze angličtina
    if (!activeLanguages.some(lang => lang.code === 'eng')) {
      return quotes;
    }

    try {
      // Random quotes endpoint
      const response = await fetch('https://zenquotes.io/api/quotes');
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (Array.isArray(data)) {
        for (const item of data) {
          if (item.q && item.a) {
            quotes.push(this.normalizeQuote({
              text: item.q.trim(),
              author: item.a.trim() === 'zenquotes.io' ? null : item.a.trim(),
              language_code: 'eng'
            }));
          }
        }
      }

      // Logování odstraněno - je redundantní
      
      // Rate limiting - čekání 6 sekund
      if (quotes.length > 0) {
        await this.wait(this.rateLimit);
      }
      
    } catch (error) {
      this.log(`Chyba při načítání ze ZenQuotes.io: ${error.message}`, 'error');
    }

    return quotes;
  }
}