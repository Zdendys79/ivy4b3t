/**
 * TranslationRobot - Automatický překlad citátů do češtiny
 * Podporuje více překladových služeb s fallback systémem
 */

import fetch from 'node-fetch';
import https from 'https';

export class TranslationRobot {
  constructor(logger) {
    this.logger = logger;
    this.rateLimit = 5000; // 5 sekund mezi všemi dotazy
    this.lastRequests = {
      google: 0,
      libre: 0,
      mymemory: 0
    };
    
    // Mapování jazyků na kódy pro různé služby
    this.languageMaps = {
      google: {
        'eng': 'en',
        'fra': 'fr', 
        'deu': 'de',
        'ita': 'it',
        'spa': 'es',
        'lat': 'la',
        'grc': 'el'
      },
      libre: {
        'eng': 'en',
        'fra': 'fr',
        'deu': 'de', 
        'ita': 'it',
        'spa': 'es'
      },
      mymemory: {
        'eng': 'en',
        'fra': 'fr',
        'deu': 'de',
        'ita': 'it', 
        'spa': 'es'
      }
    };
  }

  /**
   * Hlavní metoda překladu s fallback systémem
   */
  async translateQuote(quote) {
    if (!quote.original_text || quote.language_code === 'ces') {
      return null; // Nepotřebuje překlad
    }

    const services = ['google', 'mymemory']; // LibreTranslate odstraněn - nefunguje
    
    for (const service of services) {
      try {
        const translation = await this.translateWithService(service, quote);
        
        if (translation && this.isValidTranslation(translation, quote.original_text)) {
          return translation;
        }
        
      } catch (error) {
        // Pouze při debugování: this.logger.warn(`⚠️  ${service} selhal: ${error.message}`);
        continue;
      }
    }
    
    this.logger.error(`❌ Překlad se nezdařil pro: "${quote.original_text.substring(0, 50)}..."`);
    return null;
  }

  /**
   * Překlad pomocí konkrétní služby
   */
  async translateWithService(service, quote) {
    await this.respectRateLimit(service);
    
    switch (service) {
      case 'google':
        return await this.translateWithGoogle(quote);
      case 'libre':
        return await this.translateWithLibreTranslate(quote);
      case 'mymemory':
        return await this.translateWithMyMemory(quote);
      default:
        throw new Error(`Neznámá služba: ${service}`);
    }
  }

  /**
   * Google Translate (unofficial API)
   */
  async translateWithGoogle(quote) {
    const sourceLang = this.languageMaps.google[quote.language_code];
    if (!sourceLang) {
      throw new Error(`Nepodporovaný jazyk pro Google: ${quote.language_code}`);
    }

    const text = encodeURIComponent(quote.original_text);
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=cs&dt=t&q=${text}`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`Google Translate HTTP ${response.status}`);
    }

    const data = await response.json();
    
    if (data && data[0] && data[0][0] && data[0][0][0]) {
      return data[0][0][0].trim();
    }
    
    throw new Error('Neplatná odpověď z Google Translate');
  }

  /**
   * LibreTranslate (open source)
   */
  async translateWithLibreTranslate(quote) {
    const sourceLang = this.languageMaps.libre[quote.language_code];
    if (!sourceLang) {
      throw new Error(`Nepodporovaný jazyk pro LibreTranslate: ${quote.language_code}`);
    }

    // Použít veřejnou instanci LibreTranslate
    const response = await fetch('https://libretranslate.de/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: quote.original_text,
        source: sourceLang,
        target: 'cs',
        format: 'text'
      })
    });

    if (!response.ok) {
      throw new Error(`LibreTranslate HTTP ${response.status}`);
    }

    const data = await response.json();
    
    if (data && data.translatedText) {
      return data.translatedText.trim();
    }
    
    throw new Error('Neplatná odpověď z LibreTranslate');
  }

  /**
   * MyMemory (free translation API)
   */
  async translateWithMyMemory(quote) {
    const sourceLang = this.languageMaps.mymemory[quote.language_code];
    if (!sourceLang) {
      throw new Error(`Nepodporovaný jazyk pro MyMemory: ${quote.language_code}`);
    }

    const text = encodeURIComponent(quote.original_text);
    const url = `https://api.mymemory.translated.net/get?q=${text}&langpair=${sourceLang}|cs`;
    
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`MyMemory HTTP ${response.status}`);
    }

    const data = await response.json();
    
    if (data && data.responseData && data.responseData.translatedText) {
      const translation = data.responseData.translatedText.trim();
      
      // MyMemory někdy vrací original text, když nemůže přeložit
      if (translation === quote.original_text) {
        throw new Error('MyMemory vrátil původní text');
      }
      
      return translation;
    }
    
    throw new Error('Neplatná odpověď z MyMemory');
  }

  /**
   * Validace kvality překladu
   */
  isValidTranslation(translation, originalText) {
    // Základní kontroly
    if (!translation || translation.length < 5) {
      return false;
    }
    
    // Nesmí být totožný s originálem
    if (translation === originalText) {
      return false;
    }
    
    // Nesmí obsahovat error zprávy
    const errorIndicators = ['error', 'failed', 'quota', 'limit', 'invalid'];
    if (errorIndicators.some(err => translation.toLowerCase().includes(err))) {
      return false;
    }
    
    // Nesmí obsahovat nepreložená anglická slova (kromě vlastních jmen)
    const suspiciousWords = ['the', 'and', 'but', 'with', 'from', 'they', 'have', 'this', 'that', 'will', 'you', 'all', 'any', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'its', 'may', 'new', 'now', 'old', 'see', 'two', 'who', 'boy', 'did', 'does', 'let', 'man', 'men', 'put', 'say', 'she', 'too', 'use'];
    const translationLower = translation.toLowerCase();
    const suspiciousWordsFound = suspiciousWords.filter(word => 
      translationLower.includes(` ${word} `) || translationLower.startsWith(`${word} `) || translationLower.endsWith(` ${word}`)
    );
    
    if (suspiciousWordsFound.length > 2) {
      return false; // Příliš mnoho anglických slov
    }
    
    // Délka nesmí být příliš odlišná (+-50%)
    const lengthRatio = translation.length / originalText.length;
    if (lengthRatio < 0.5 || lengthRatio > 2.0) {
      return false;
    }
    
    return true;
  }

  /**
   * Rate limiting pro překladové služby
   */
  async respectRateLimit(service) {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequests[service];
    
    if (timeSinceLastRequest < this.rateLimit) {
      const waitTime = this.rateLimit - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequests[service] = Date.now();
  }

  /**
   * Získat statistiky podporovaných jazyků
   */
  getSupportedLanguages() {
    const allLanguages = new Set();
    
    Object.values(this.languageMaps).forEach(map => {
      Object.keys(map).forEach(lang => allLanguages.add(lang));
    });
    
    return Array.from(allLanguages);
  }

  /**
   * Zkontrolovat, jestli jazyk je podporovaný
   */
  isLanguageSupported(languageCode) {
    return this.getSupportedLanguages().includes(languageCode);
  }
}