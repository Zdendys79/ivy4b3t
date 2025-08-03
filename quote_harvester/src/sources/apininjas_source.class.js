/**
 * APINinjasSource - Citáty z API Ninjas
 * Free tier: 1000 requests per month
 */

import { BaseSource } from './base_source.class.js';
import fetch from 'node-fetch';

export class APINinjasSource extends BaseSource {
  constructor() {
    super('API Ninjas', 'https://api.api-ninjas.com/v1/quotes', 'api');
    this.supportedLanguages = ['eng'];
    this.rateLimit = 7000; // 7 sekund mezi dotazy (bezpečná rezerva)
    this.description = 'Citáty z API Ninjas databáze';
    this.categories = ['age', 'alone', 'amazing', 'anger', 'architecture', 'art', 'attitude', 'beauty', 'best', 'birthday', 'business', 'car', 'change', 'communication', 'computers', 'cool', 'courage', 'dad', 'dating', 'death', 'design', 'dreams', 'education', 'environmental', 'equality', 'experience', 'failure', 'faith', 'family', 'famous', 'fear', 'fitness', 'food', 'forgiveness', 'freedom', 'friendship', 'funny', 'future', 'god', 'good', 'government', 'graduation', 'great', 'happiness', 'health', 'history', 'home', 'hope', 'humor', 'imagination', 'inspirational', 'intelligence', 'jealousy', 'knowledge', 'leadership', 'learning', 'legal', 'life', 'love', 'marriage', 'medical', 'men', 'mom', 'money', 'morning', 'movies', 'success'];
  }

  async fetchQuotes(activeLanguages) {
    const quotes = [];
    
    // Pouze angličtina
    if (!activeLanguages.some(lang => lang.code === 'eng')) {
      return quotes;
    }

    try {
      // Postupně načítat z různých kategorií
      const selectedCategories = this.categories.slice(0, 10); // První 10 kategorií
      
      for (const category of selectedCategories) {
        try {
          const response = await fetch(`https://api.api-ninjas.com/v1/quotes?category=${category}&limit=10`, {
            headers: {
              'X-Api-Key': process.env.API_NINJAS_KEY || '' // Volitelný API klíč
            }
          });
          
          if (!response.ok) {
            if (response.status === 429) {
              this.log('Rate limit dosažen u API Ninjas, přeskakujem', 'warn');
              break;
            }
            continue;
          }

          const data = await response.json();
          
          if (Array.isArray(data)) {
            for (const item of data) {
              if (item.quote && item.author) {
                quotes.push(this.normalizeQuote({
                  text: item.quote.trim(),
                  author: item.author.trim(),
                  language_code: 'eng'
                }));
              }
            }
          }

          // Rate limiting
          await this.wait(this.rateLimit);
          
        } catch (error) {
          this.log(`Chyba při kategorie ${category}: ${error.message}`, 'warn');
          continue;
        }
      }

      this.log(`Načteno ${quotes.length} citátů z API Ninjas`);
      
    } catch (error) {
      this.log(`Chyba při načítání z API Ninjas: ${error.message}`, 'error');
    }

    return quotes;
  }
}