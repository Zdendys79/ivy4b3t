/**
 * BrainyQuoteSource - BrainyQuote.com scraping
 * Primárně anglické citáty s vysokou kvalitou
 */

import { BaseSource } from './base_source.class.js';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import https from 'https';

export class BrainyQuoteSource extends BaseSource {
  constructor() {
    super('BrainyQuote', 'https://www.brainyquote.com', 'scraping');
    this.supportedLanguages = ['eng'];
    this.rateLimit = 15000; // 15s mezi requesty - velmi opatrné
    this.description = 'High quality English quotes from famous people';
    this.disabled = false;
    
    // Rotující User-Agents pro lepší obcházení detekce
    this.userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:89.0) Gecko/20100101 Firefox/89.0'
    ];
  }

  async fetchQuotes(activeLanguages) {
    const quotes = [];
    
    // Pouze angličtina
    if (!activeLanguages.some(lang => lang.code === 'eng')) {
      return quotes;
    }

    try {
      // Rozšířený seznam kategorií
      const categories = [
        'motivational',
        'inspirational', 
        'life',
        'success',
        'wisdom',
        'happiness',
        'love',
        'friendship',
        'nature',
        'dreams',
        'education',
        'courage',
        'hope',
        'freedom',
        'time'
      ];

      for (const category of categories) {
        const categoryQuotes = await this.fetchCategoryQuotes(category);
        quotes.push(...categoryQuotes);
        
        // Omezit celkové množství
        if (quotes.length > 200) {
          break;
        }
      }

      this.log(`Načteno celkem ${quotes.length} citátů z BrainyQuote`);
      
    } catch (error) {
      this.log(`Chyba při načítání z BrainyQuote: ${error.message}`, 'error');
    }

    return quotes;
  }

  /**
   * Načíst citáty z kategorie
   */
  async fetchCategoryQuotes(category) {
    const quotes = [];
    
    try {
      const url = `${this.url}/topics/${category}-quotes`;
      
      // Náhodný User-Agent z kolekce
      const randomUserAgent = this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': randomUserAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Cache-Control': 'max-age=0',
          'Referer': 'https://www.brainyquote.com/'
        },
        agent: new https.Agent({
          keepAlive: true,
          timeout: 30000
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} for category ${category}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // BrainyQuote má specifickou strukturu
      $('.quote-text').each((i, element) => {
        const quoteText = $(element).text().trim();
        
        // Najít autora (obvykle v následujícím elementu)
        const authorElement = $(element).closest('.quote-card').find('.quote-author');
        const author = authorElement.text().trim();

        const normalized = this.normalizeQuote({
          text: quoteText,
          author: author || null,
          language_code: 'eng'
        });

        if (this.isValidQuote(normalized)) {
          quotes.push(normalized);
        }
      });

      // Alternativní selektory pokud se struktura změní
      if (quotes.length === 0) {
        $('.quoteText').each((i, element) => {
          const quoteText = $(element).text().trim();
          
          const normalized = this.normalizeQuote({
            text: quoteText,
            author: null, // Autor může být obtížně dohledatelný
            language_code: 'eng'
          });

          if (this.isValidQuote(normalized)) {
            quotes.push(normalized);
          }
        });
      }

      this.log(`Kategorie ${category}: ${quotes.length} citátů`);
      
    } catch (error) {
      this.log(`Chyba při načítání kategorie ${category}: ${error.message}`, 'error');
    }

    return quotes.slice(0, 50); // Max 50 citátů z kategorie
  }

  /**
   * Override validace pro BrainyQuote specifika
   */
  isValidQuote(quote) {
    // Základní validace z parent třídy
    if (!super.isValidQuote(quote)) {
      return false;
    }

    // BrainyQuote specifické filtry
    const text = (quote.original_text || quote.text).toLowerCase();
    
    // Odfiltrovat reklamní texty
    const spamKeywords = [
      'brainyquote',
      'subscribe',
      'newsletter',
      'advertisement',
      'click here',
      'visit our',
      'follow us'
    ];

    for (const keyword of spamKeywords) {
      if (text.includes(keyword)) {
        return false;
      }
    }

    // Musí obsahovat smysluplný obsah
    return (quote.original_text || quote.text).split(' ').length >= 5;
  }
}