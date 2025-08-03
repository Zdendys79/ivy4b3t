/**
 * QualityValidator - Validace kvality citátů
 */

export class QualityValidator {
  constructor() {
    // Filtrované slova a fráze
    this.blockedWords = [
      // Sprostá slova
      'fuck', 'shit', 'damn', 'hell', 'bitch',
      'kurva', 'píča', 'kokot', 'sraček', 'hovno',
      
      // Reklamní texty
      'subscribe', 'click here', 'visit our website',
      'buy now', 'order today', 'limited time',
      'přihlásit se', 'objednat', 'koupit',
      
      // Spam indikátory
      'lorem ipsum', 'test test', 'sample text',
      'example text', 'placeholder'
    ];

    this.minLength = 10;
    this.maxLength = 500;
    this.minWords = 3;
    this.maxWords = 100;
  }

  /**
   * Hlavní validace citátu
   */
  async validate(quote) {
    const result = {
      valid: true,
      reason: null,
      score: 100
    };

    // Série validačních testů
    const tests = [
      this.validateLength.bind(this),
      this.validateContent.bind(this),
      this.validateLanguage.bind(this),
      this.validateFormat.bind(this),
      this.validateBlockedWords.bind(this),
      this.validateRelevance.bind(this)
    ];

    for (const test of tests) {
      const testResult = test(quote);
      
      if (!testResult.valid) {
        result.valid = false;
        result.reason = testResult.reason;
        result.score = testResult.score;
        break;
      }
      
      // Snížit skóre podle výsledku testu
      result.score = Math.min(result.score, testResult.score);
    }

    return result;
  }

  /**
   * Validace délky textu
   */
  validateLength(quote) {
    const text = quote.original_text || quote.text;
    const length = text.length;
    const wordCount = text.split(/\s+/).length;

    if (length < this.minLength) {
      return { valid: false, reason: `Příliš krátký text: ${length} znaků`, score: 0 };
    }

    if (length > this.maxLength) {
      return { valid: false, reason: `Příliš dlouhý text: ${length} znaků`, score: 0 };
    }

    if (wordCount < this.minWords) {
      return { valid: false, reason: `Příliš málo slov: ${wordCount}`, score: 0 };
    }

    if (wordCount > this.maxWords) {
      return { valid: false, reason: `Příliš mnoho slov: ${wordCount}`, score: 0 };
    }

    // Skóre podle optimální délky (50-200 znaků)
    const optimalMin = 50;
    const optimalMax = 200;
    
    if (length >= optimalMin && length <= optimalMax) {
      return { valid: true, score: 100 };
    } else {
      const score = Math.max(60, 100 - Math.abs(length - ((optimalMin + optimalMax) / 2)) / 5);
      return { valid: true, score: Math.round(score) };
    }
  }

  /**
   * Validace obsahu
   */
  validateContent(quote) {
    const text = (quote.original_text || quote.text).toLowerCase();

    // Kontrola HTML tagů
    if (text.includes('<') && text.includes('>')) {
      return { valid: false, reason: 'Obsahuje HTML tagy', score: 0 };
    }

    // Kontrola URL
    if (text.includes('http') || text.includes('www.')) {
      return { valid: false, reason: 'Obsahuje URL odkazy', score: 0 };
    }

    // Kontrola email adres
    if (text.includes('@') && text.includes('.')) {
      return { valid: false, reason: 'Obsahuje email adresy', score: 0 };
    }

    // Kontrola telefonních čísel
    if (/\d{3}[- ]?\d{3}[- ]?\d{3}/.test(text)) {
      return { valid: false, reason: 'Obsahuje telefonní čísla', score: 0 };
    }

    // Kontrola nadměrného používání velkých písmen
    const upperCaseRatio = (text.match(/[A-Z]/g) || []).length / text.length;
    if (upperCaseRatio > 0.5) {
      return { valid: false, reason: 'Příliš mnoho velkých písmen', score: 30 };
    }

    return { valid: true, score: 90 };
  }

  /**
   * Validace jazyka a kódování
   */
  validateLanguage(quote) {
    const text = quote.original_text || quote.text;

    // Kontrola základního kódování
    if (/[\uFFFD\u0000-\u001F]/.test(text)) {
      return { valid: false, reason: 'Poškozené kódování znaků', score: 0 };
    }

    // Kontrola smíšeného obsahu (čísla vs. text)
    const digitRatio = (text.match(/\d/g) || []).length / text.length;
    if (digitRatio > 0.3) {
      return { valid: false, reason: 'Příliš mnoho čísel', score: 20 };
    }

    // Kontrola opakujících se znaků
    if (/(.)\1{4,}/.test(text)) {
      return { valid: false, reason: 'Nadměrné opakování znaků', score: 10 };
    }

    return { valid: true, score: 95 };
  }

  /**
   * Validace formátu
   */
  validateFormat(quote) {
    const text = (quote.original_text || quote.text).trim();

    // Kontrola prázdného textu
    if (!text) {
      return { valid: false, reason: 'Prázdný text', score: 0 };
    }

    // Kontrola pouze interpunkce
    if (/^[^\w]*$/.test(text)) {
      return { valid: false, reason: 'Pouze interpunkce', score: 0 };
    }

    // Kontrola rozumného poměru písmen k interpunkci
    const letterCount = (text.match(/[a-zA-ZáčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]/g) || []).length;
    const totalLength = text.length;
    const letterRatio = letterCount / totalLength;

    if (letterRatio < 0.5) {
      return { valid: false, reason: 'Příliš málo písmen', score: 20 };
    }

    return { valid: true, score: 95 };
  }

  /**
   * Kontrola zakázaných slov
   */
  validateBlockedWords(quote) {
    const text = (quote.original_text || quote.text).toLowerCase();

    for (const word of this.blockedWords) {
      if (text.includes(word.toLowerCase())) {
        return { valid: false, reason: `Obsahuje zakázané slovo: ${word}`, score: 0 };
      }
    }

    return { valid: true, score: 100 };
  }

  /**
   * Validace relevance pro citáty
   */
  validateRelevance(quote) {
    const text = (quote.original_text || quote.text).toLowerCase();

    // Pozitivní indikátory (zvyšují skóre)
    const positiveKeywords = [
      'život', 'láska', 'štěstí', 'moudrost', 'pravda',
      'life', 'love', 'happiness', 'wisdom', 'truth',
      'success', 'hope', 'dream', 'future', 'inspire',
      'úspěch', 'naděje', 'sen', 'budoucnost', 'inspirace'
    ];

    // Negativní indikátory (snižují skóre)
    const negativeKeywords = [
      'reklama', 'prodej', 'koup', 'zdarma', 'akce',
      'advertisement', 'sale', 'buy', 'free', 'offer',
      'click', 'subscribe', 'follow', 'like', 'share'
    ];

    let score = 80; // Základní skóre

    // Pozitivní klíčová slova
    for (const keyword of positiveKeywords) {
      if (text.includes(keyword)) {
        score += 5;
      }
    }

    // Negativní klíčová slova
    for (const keyword of negativeKeywords) {
      if (text.includes(keyword)) {
        score -= 20;
      }
    }

    // Kontrola struktury citátu
    if (text.includes('"') || text.includes('„') || text.includes('"')) {
      score += 10; // Citáty v uvozovkách jsou často kvalitnější
    }

    if (quote.author) {
      score += 15; // Citáty s autorem jsou cennější
    }

    score = Math.max(0, Math.min(100, score));

    if (score < 50) {
      return { valid: false, reason: 'Nízká relevance pro citáty', score };
    }

    return { valid: true, score };
  }

  /**
   * Detailní analýza kvality
   */
  async analyzeQuality(quote) {
    const analysis = {
      overallScore: 0,
      details: {},
      recommendations: []
    };

    const tests = [
      { name: 'length', test: this.validateLength.bind(this) },
      { name: 'content', test: this.validateContent.bind(this) },
      { name: 'language', test: this.validateLanguage.bind(this) },
      { name: 'format', test: this.validateFormat.bind(this) },
      { name: 'blockedWords', test: this.validateBlockedWords.bind(this) },
      { name: 'relevance', test: this.validateRelevance.bind(this) }
    ];

    let totalScore = 0;
    let validTests = 0;

    for (const { name, test } of tests) {
      const result = test(quote);
      analysis.details[name] = result;

      if (result.valid) {
        totalScore += result.score;
        validTests++;
      } else {
        analysis.recommendations.push(`${name}: ${result.reason}`);
      }
    }

    analysis.overallScore = validTests > 0 ? Math.round(totalScore / validTests) : 0;

    return analysis;
  }
}