/**
 * LanguageDetector - Detekce jazyka citátů
 */

import franc from 'franc';

export class LanguageDetector {
  constructor() {
    // Mapování franc kódů na naše ISO 639-2/T kódy
    this.languageMap = {
      'ces': 'ces', // čeština
      'slk': 'slk', // slovenština
      'eng': 'eng', // angličtina
      'fra': 'fra', // francouzština
      'deu': 'deu', // němčina
      'ita': 'ita', // italština
      'spa': 'spa', // španělština
      'rus': 'rus', // ruština
      'pol': 'pol', // polština
      'hun': 'hun', // maďarština
      'nld': 'nld', // nizozemština
      'por': 'por', // portugalština
      'lat': 'lat', // latina (pokud franc podporuje)
      
      // Franc používá ISO 639-3, mapujeme na naše kódy
      'ces': 'ces',
      'slv': 'slk', // slovenština (franc kód)
      'eng': 'eng',
      'fra': 'fra', 
      'deu': 'deu',
      'ita': 'ita',
      'spa': 'spa',
      'rus': 'rus'
    };

    // Jazyky s malým vzorkem textu (obtížně detekovatelné)
    this.difficultLanguages = ['lat', 'grc'];
    
    // Výchozí jazyk pokud se detekce nezdaří
    this.defaultLanguage = 'eng';
  }

  /**
   * Hlavní detekce jazyka
   */
  async detect(text) {
    if (!text || text.length < 10) {
      return this.defaultLanguage;
    }

    try {
      // 1. Pokus o automatickou detekci pomocí franc
      const detected = this.detectWithFranc(text);
      if (detected) {
        return detected;
      }

      // 2. Heuristická detekce na základě znaků
      const heuristic = this.detectWithHeuristics(text);
      if (heuristic) {
        return heuristic;
      }

      // 3. Detekce na základě klíčových slov
      const keyword = this.detectByKeywords(text);
      if (keyword) {
        return keyword;
      }

      return this.defaultLanguage;

    } catch (error) {
      console.warn(`Chyba při detekci jazyka: ${error.message}`);
      return this.defaultLanguage;
    }
  }

  /**
   * Detekce pomocí franc knihovny
   */
  detectWithFranc(text) {
    try {
      const francResult = franc(text);
      
      // franc vrací ISO 639-3 kódy, převést na naše
      if (francResult && francResult !== 'und') {
        return this.languageMap[francResult] || this.mapFrancToOurCode(francResult);
      }
    } catch (error) {
      // Franc může selhat na krátký text
    }
    
    return null;
  }

  /**
   * Mapování franc výsledků na naše kódy
   */
  mapFrancToOurCode(francCode) {
    const mapping = {
      'ces': 'ces',
      'slv': 'slk',
      'eng': 'eng',
      'fra': 'fra',
      'deu': 'deu',
      'ita': 'ita',
      'spa': 'spa',
      'rus': 'rus',
      'pol': 'pol',
      'hun': 'hun',
      'nld': 'nld',
      'por': 'por'
    };

    return mapping[francCode] || null;
  }

  /**
   * Heuristická detekce na základě charakteristických znaků
   */
  detectWithHeuristics(text) {
    const lowerText = text.toLowerCase();

    // České/slovenské znaky
    if (/[ěščřžýáíéůúťňď]/.test(lowerText)) {
      // Rozlišit češtinu a slovenštinu
      if (/[ľĺŕôäň]/.test(lowerText)) {
        return 'slk'; // slovenština
      }
      return 'ces'; // čeština
    }

    // Německé znaky
    if (/[äöüß]/.test(lowerText)) {
      return 'deu';
    }

    // Francouzské znaky
    if (/[àâäæçéèêëïîôöùûüÿñ]/.test(lowerText)) {
      return 'fra';
    }

    // Španělské znaky
    if (/[ñáéíóúü¡¿]/.test(lowerText)) {
      return 'spa';
    }

    // Italské znaky (méně specifické)
    if (/[àèéìíîòóù]/.test(lowerText)) {
      return 'ita';
    }

    // Ruské znaky (cyrilice)
    if (/[а-яё]/.test(lowerText)) {
      return 'rus';
    }

    // Řecké znaky (starověká řečtina)
    if (/[α-ωάέήίόύώ]/.test(lowerText)) {
      return 'grc';
    }

    return null;
  }

  /**
   * Detekce na základě klíčových slov
   */
  detectByKeywords(text) {
    const lowerText = text.toLowerCase();

    // České klíčové slova
    const czechKeywords = ['je', 'to', 'na', 'se', 'že', 'by', 'si', 'být', 'jako', 'jeho', 'její'];
    const czechMatches = czechKeywords.filter(word => lowerText.includes(word)).length;

    // Anglické klíčové slova
    const englishKeywords = ['the', 'and', 'is', 'it', 'to', 'of', 'you', 'that', 'in', 'for', 'with'];
    const englishMatches = englishKeywords.filter(word => lowerText.includes(word)).length;

    // Německé klíčové slova
    const germanKeywords = ['der', 'die', 'und', 'ist', 'das', 'ich', 'nicht', 'sie', 'mit', 'den'];
    const germanMatches = germanKeywords.filter(word => lowerText.includes(word)).length;

    // Francouzské klíčové slova
    const frenchKeywords = ['le', 'de', 'et', 'à', 'un', 'il', 'être', 'et', 'en', 'avoir', 'que'];
    const frenchMatches = frenchKeywords.filter(word => lowerText.includes(word)).length;

    // Najít jazyk s nejvíce shodami
    const matches = [
      { language: 'ces', count: czechMatches },
      { language: 'eng', count: englishMatches },
      { language: 'deu', count: germanMatches },
      { language: 'fra', count: frenchMatches }
    ];

    matches.sort((a, b) => b.count - a.count);

    // Vracet pouze pokud je jasný vítěz
    if (matches[0].count > matches[1].count && matches[0].count >= 2) {
      return matches[0].language;
    }

    return null;
  }

  /**
   * Detekce latiny (speciální případ)
   */
  detectLatin(text) {
    const lowerText = text.toLowerCase();
    
    // Typické latinské konce slov
    const latinEndings = ['um', 'us', 'is', 'ae', 'am', 'as', 'em', 'es'];
    const endingMatches = latinEndings.filter(ending => 
      new RegExp(`\\b\\w+${ending}\\b`).test(lowerText)
    ).length;

    // Latinské klíčové slova
    const latinWords = ['est', 'et', 'in', 'ad', 'de', 'cum', 'non', 'sed', 'ut', 'ex'];
    const wordMatches = latinWords.filter(word => lowerText.includes(word)).length;

    if (endingMatches >= 2 || wordMatches >= 3) {
      return 'lat';
    }

    return null;
  }

  /**
   * Validace detekovaného jazyka podle dostupných jazyků
   */
  validateDetection(detectedLanguage, availableLanguages) {
    const availableCodes = availableLanguages.map(lang => lang.code);
    
    if (availableCodes.includes(detectedLanguage)) {
      return detectedLanguage;
    }

    // Fallback na výchozí jazyk který je dostupný
    return availableCodes.includes(this.defaultLanguage) 
      ? this.defaultLanguage 
      : availableCodes[0] || 'eng';
  }

  /**
   * Detekce s dodatečnými informacemi
   */
  async detectWithAnalysis(text) {
    const analysis = {
      detected: null,
      confidence: 0,
      alternatives: [],
      method: null
    };

    // Pokus o různé metody
    const methods = [
      { name: 'franc', fn: () => this.detectWithFranc(text) },
      { name: 'heuristics', fn: () => this.detectWithHeuristics(text) },
      { name: 'keywords', fn: () => this.detectByKeywords(text) },
      { name: 'latin', fn: () => this.detectLatin(text) }
    ];

    for (const method of methods) {
      const result = method.fn();
      if (result) {
        analysis.detected = result;
        analysis.method = method.name;
        analysis.confidence = this.calculateConfidence(text, result, method.name);
        break;
      }
    }

    if (!analysis.detected) {
      analysis.detected = this.defaultLanguage;
      analysis.method = 'default';
      analysis.confidence = 10;
    }

    return analysis;
  }

  /**
   * Výpočet spolehlivosti detekce
   */
  calculateConfidence(text, language, method) {
    let confidence = 50; // Základní

    // Délka textu ovlivňuje spolehlivost
    if (text.length > 100) confidence += 20;
    else if (text.length > 50) confidence += 10;
    else if (text.length < 20) confidence -= 20;

    // Metoda detekce
    switch (method) {
      case 'franc': confidence += 30; break;
      case 'heuristics': confidence += 20; break;
      case 'keywords': confidence += 15; break;
      case 'latin': confidence += 25; break;
    }

    return Math.max(0, Math.min(100, confidence));
  }
}