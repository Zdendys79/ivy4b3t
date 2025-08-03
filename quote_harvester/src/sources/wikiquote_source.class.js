/**
 * WikiquoteSource - Wikiquote web scraping
 * Podporuje více jazyků
 */

import { BaseSource } from './base_source.class.js';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

export class WikiquoteSource extends BaseSource {
  constructor() {
    super('Wikiquote', 'https://wikiquote.org', 'scraping');
    this.supportedLanguages = ['eng', 'ces', 'fra', 'deu', 'ita', 'spa'];
    this.rateLimit = 8000; // 8s mezi requesty - velmi opatrné pro větší objem
    this.description = 'Wikipedia sister project with quotes';
  }

  async fetchQuotes(activeLanguages) {
    const quotes = [];
    
    // Mapování jazyků na Wikiquote subdomény
    const languageMap = {
      'eng': 'en',
      'ces': 'cs', 
      'fra': 'fr',
      'deu': 'de',
      'ita': 'it',
      'spa': 'es'
    };

    for (const lang of activeLanguages) {
      const subdomain = languageMap[lang.code];
      if (!subdomain) continue;

      try {
        const langQuotes = await this.fetchQuotesForLanguage(subdomain, lang.code);
        quotes.push(...langQuotes);
        
        this.log(`Načteno ${langQuotes.length} citátů pro jazyk ${lang.code}`);
        
      } catch (error) {
        this.log(`Chyba při načítání pro jazyk ${lang.code}: ${error.message}`, 'error');
      }
    }

    return quotes;
  }

  /**
   * Načíst citáty pro konkrétní jazyk
   */
  async fetchQuotesForLanguage(subdomain, languageCode) {
    const quotes = [];
    
    // Seznam stránek pro scraping (různé pro každý jazyk)
    const pages = this.getPopularPages(subdomain);
    
    for (const page of pages) {
      try {
        const url = `https://${subdomain}.wikiquote.org/wiki/${page}`;
        const pageQuotes = await this.scrapePage(url, languageCode);
        quotes.push(...pageQuotes);

        // Bez omezení - chceme víc citátů

        await this.respectRateLimit();
        
      } catch (error) {
        this.log(`Chyba při scrapingu stránky ${page}: ${error.message}`, 'error');
      }
    }

    return quotes;
  }

  /**
   * Získat populární stránky podle jazyka
   */
  getPopularPages(subdomain) {
    const commonPages = {
      'en': [
        'Albert_Einstein', 'Winston_Churchill', 'Mark_Twain', 'Oscar_Wilde',
        'Benjamin_Franklin', 'Abraham_Lincoln', 'Mahatma_Gandhi', 'Nelson_Mandela',
        'Steve_Jobs', 'Ernest_Hemingway', 'William_Shakespeare', 'Aristotle',
        'Confucius', 'Maya_Angelou', 'Martin_Luther_King,_Jr.', 'Theodore_Roosevelt'
      ],
      'cs': [
        'Albert_Einstein', 'Tomáš_Garrigue_Masaryk', 'Václav_Havel',
        'Karel_Čapek', 'Bohumil_Hrabal', 'Milan_Kundera', 'Franz_Kafka',
        'Jan_Amos_Komenský', 'Božena_Němcová', 'Jaroslav_Hašek'
      ],
      'fr': [
        'Albert_Einstein', 'Napoleon_Bonaparte', 'Victor_Hugo', 'Voltaire',
        'Jean-Jacques_Rousseau', 'Marcel_Proust', 'Antoine_de_Saint-Exupéry',
        'Coco_Chanel', 'Charles_de_Gaulle', 'Simone_de_Beauvoir'
      ],
      'de': [
        'Albert_Einstein', 'Johann_Wolfgang_von_Goethe', 'Friedrich_Nietzsche',
        'Immanuel_Kant', 'Arthur_Schopenhauer', 'Hermann_Hesse', 'Thomas_Mann',
        'Bertolt_Brecht', 'Franz_Kafka', 'Rainer_Maria_Rilke'
      ],
      'it': [
        'Albert_Einstein', 'Leonardo_da_Vinci', 'Dante_Alighieri',
        'Galileo_Galilei', 'Niccolò_Machiavelli', 'Giuseppe_Garibaldi',
        'Umberto_Eco', 'Federico_Fellini', 'Roberto_Benigni'
      ],
      'es': [
        'Albert_Einstein', 'Pablo_Picasso', 'Miguel_de_Cervantes',
        'Federico_García_Lorca', 'Salvador_Dalí', 'Antonio_Machado',
        'Gabriel_García_Márquez', 'Jorge_Luis_Borges', 'Octavio_Paz'
      ]
    };

    return commonPages[subdomain] || ['Albert_Einstein'];
  }

  /**
   * Scrapovat jednu stránku
   */
  async scrapePage(url, languageCode) {
    const quotes = [];
    
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'IVY4B3T Quote Harvester (Educational Use)'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // Najít citáty - Wikiquote používá různé struktury
      const quoteSelectors = [
        'li:contains("–")', // Citáty s dlouhým pomlčkou
        'li:contains("—")', // Citáty s em dash
        '.quote', // CSS třída quote
        'blockquote'
      ];

      for (const selector of quoteSelectors) {
        $(selector).each((i, element) => {
          const text = $(element).text().trim();
          
          if (this.looksLikeQuote(text)) {
            const { quoteText, author } = this.parseQuoteText(text);
            
            const normalized = this.normalizeQuote({
              text: quoteText,
              author: author,
              language_code: languageCode
            });

            if (this.isValidQuote(normalized)) {
              quotes.push(normalized);
            }
          }
        });
      }

      // Omezit počet citátů z jedné stránky
      return quotes.slice(0, 50);
      
    } catch (error) {
      this.log(`Chyba při scrapingu ${url}: ${error.message}`, 'error');
      return [];
    }
  }

  /**
   * Rozpoznat zda text vypadá jako citát
   */
  looksLikeQuote(text) {
    return text.length > 20 && 
           text.length < 500 &&
           (text.includes('–') || text.includes('—') || text.includes('"'));
  }

  /**
   * Parsovat text citátu a autora
   */
  parseQuoteText(text) {
    // Různé formáty citátů na Wikiquote
    const patterns = [
      /^"(.+)"\s*[–—]\s*(.+)$/,
      /^(.+)\s*[–—]\s*(.+)$/,
      /^"(.+)"\s*\((.+)\)$/
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return {
          quoteText: match[1].trim(),
          author: match[2].trim()
        };
      }
    }

    // Pokud se nepodaří parsovat, vrátit celý text
    return {
      quoteText: text,
      author: null
    };
  }
}