/**
 * DuplicateChecker - Pokročilá kontrola duplicit citátů
 */

import crypto from 'crypto';
import Levenshtein from 'levenshtein';

export class DuplicateChecker {
  constructor(databaseManager) {
    this.db = databaseManager;
    this.similarityThreshold = 0.85; // 85% podobnost = duplicita
  }

  /**
   * Hlavní kontrola duplicit
   */
  async check(quote) {
    // 1. Přesná shoda podle hash
    const exactDuplicate = await this.checkExactDuplicate(quote);
    if (exactDuplicate) {
      return true;
    }

    // 2. Podobnost pomocí Levenshtein distance
    const similarDuplicate = await this.checkSimilarDuplicate(quote);
    if (similarDuplicate) {
      return true;
    }

    return false;
  }

  /**
   * Kontrola přesné shody podle MD5 hash
   */
  async checkExactDuplicate(quote) {
    const textForHash = quote.original_text || quote.text;
    return await this.db.quoteExists(textForHash);
  }

  /**
   * Kontrola podobnosti pomocí Levenshtein distance
   */
  async checkSimilarDuplicate(quote) {
    const targetText = this.normalizeForComparison(quote.original_text || quote.text);
    
    // Načíst podobně dlouhé citáty z databáze
    const similarQuotes = await this.db.findSimilarQuotes(targetText);
    
    for (const dbQuote of similarQuotes) {
      // Kontrola proti českému textu (pokud existuje)
      if (dbQuote.translated_text) {
        const similarity1 = this.calculateSimilarity(
          targetText, 
          this.normalizeForComparison(dbQuote.translated_text)
        );

        if (similarity1 >= this.similarityThreshold) {
          return true;
        }
      }

      // Kontrola proti originálnímu textu (pokud existuje)
      if (dbQuote.original_text) {
        const similarity2 = this.calculateSimilarity(
          targetText, 
          this.normalizeForComparison(dbQuote.original_text)
        );

        if (similarity2 >= this.similarityThreshold) {
          return true;
        }
      }

      // Křížová kontrola - náš český text proti jejich originálnímu
      if (quote.text && quote.original_text && dbQuote.original_text) {
        const similarity3 = this.calculateSimilarity(
          this.normalizeForComparison(quote.text),
          this.normalizeForComparison(dbQuote.original_text)
        );

        if (similarity3 >= this.similarityThreshold) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Výpočet podobnosti mezi dvěma texty
   */
  calculateSimilarity(text1, text2) {
    if (!text1 || !text2) return 0;
    
    const distance = new Levenshtein(text1, text2).distance;
    const maxLength = Math.max(text1.length, text2.length);
    
    if (maxLength === 0) return 1;
    
    return 1 - (distance / maxLength);
  }

  /**
   * Normalizace textu pro porovnání
   */
  normalizeForComparison(text) {
    if (!text) return '';
    
    return text
      .toLowerCase()
      .trim()
      // Odstranit diakritiku
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      // Odstranit interpunkci a speciální znaky
      .replace(/[^\w\s]/g, ' ')
      // Normalizovat mezery
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Generování hash pro citát
   */
  generateHash(text) {
    return crypto.createHash('md5').update(text).digest('hex');
  }

  /**
   * Kontrola duplicit v rámci jedné kolekce (před importem)
   */
  removeDuplicatesFromCollection(quotes) {
    const seen = new Set();
    const unique = [];

    for (const quote of quotes) {
      const textForHash = quote.original_text || quote.text;
      const hash = this.generateHash(textForHash);

      if (!seen.has(hash)) {
        seen.add(hash);
        unique.push(quote);
      }
    }

    return unique;
  }

  /**
   * Pokročilá analýza duplicit s detailními informacemi
   */
  async analyzeQuote(quote) {
    const analysis = {
      isExactDuplicate: false,
      isSimilarDuplicate: false,
      similarityScore: 0,
      matchedQuote: null,
      recommendation: 'import'
    };

    // Přesná shoda
    const exactMatch = await this.checkExactDuplicate(quote);
    if (exactMatch) {
      analysis.isExactDuplicate = true;
      analysis.recommendation = 'skip';
      return analysis;
    }

    // Podobnost
    const targetText = this.normalizeForComparison(quote.original_text || quote.text);
    const similarQuotes = await this.db.findSimilarQuotes(targetText);
    
    let maxSimilarity = 0;
    let bestMatch = null;

    for (const dbQuote of similarQuotes) {
      const similarity = this.calculateSimilarity(
        targetText, 
        this.normalizeForComparison(dbQuote.translated_text)
      );

      if (similarity > maxSimilarity) {
        maxSimilarity = similarity;
        bestMatch = dbQuote;
      }
    }

    analysis.similarityScore = maxSimilarity;
    analysis.matchedQuote = bestMatch;

    if (maxSimilarity >= this.similarityThreshold) {
      analysis.isSimilarDuplicate = true;
      analysis.recommendation = 'skip';
    } else if (maxSimilarity >= 0.7) {
      analysis.recommendation = 'review'; // Manuální kontrola
    }

    return analysis;
  }
}