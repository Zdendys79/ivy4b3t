/**
 * BaseSource - Základní třída pro všechny zdroje citátů
 */

export class BaseSource {
  constructor(name, url, type = 'api') {
    this.name = name;
    this.url = url;
    this.type = type; // 'api' nebo 'scraping'
    this.supportedLanguages = ['eng']; // Default angličtina
    this.rateLimit = 1000; // ms mezi requesty
    this.disabled = false;
    this.lastRequest = 0;
    this.description = 'Base source class';
  }

  /**
   * Hlavní metoda pro získání citátů
   * @param {Array} activeLanguages - Aktivní jazyky z databáze
   * @returns {Array} Pole citátů
   */
  async fetch(activeLanguages) {
    // Filtrovat pouze podporované jazyky
    const supportedActive = activeLanguages.filter(lang => 
      this.supportedLanguages.includes(lang.code)
    );

    if (supportedActive.length === 0) {
      return [];
    }

    // Rate limiting
    await this.respectRateLimit();

    // Delegate na konkrétní implementaci
    return await this.fetchQuotes(supportedActive);
  }

  /**
   * Abstract metoda - musí implementovat každý zdroj
   */
  async fetchQuotes(activeLanguages) {
    throw new Error(`fetchQuotes must be implemented by ${this.constructor.name}`);
  }

  /**
   * Rate limiting
   */
  async respectRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequest;
    
    if (timeSinceLastRequest < this.rateLimit) {
      const waitTime = this.rateLimit - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequest = Date.now();
  }

  /**
   * Simple wait function
   */
  async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Normalizace citátu do standardního formátu
   */
  normalizeQuote(rawQuote) {
    return {
      text: rawQuote.text?.trim() || '',
      original_text: rawQuote.original_text?.trim() || null,
      author: rawQuote.author?.trim() || null,
      language_code: rawQuote.language_code || 'eng',
      source: this.name
    };
  }

  /**
   * Validace základních požadavků na citát
   */
  isValidQuote(quote) {
    const text = quote.original_text || quote.text;
    return text && 
           text.length >= 10 && 
           text.length <= 500 &&
           !text.includes('<') && // Žádné HTML
           !text.includes('@') && // Žádné zmínky
           !text.includes('http'); // Žádné URL
  }

  /**
   * Log s prefixem zdroje
   */
  log(message, level = 'info') {
    const prefix = `[${this.name}]`;
    console.log(`${prefix} ${message}`);
  }
}