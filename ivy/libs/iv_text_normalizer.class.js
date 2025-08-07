/**
 * Zjednodušená verze TextNormalizer pro produkční server
 * Normalizuje text pro databázové ukládání - pouze ASCII 7bit + české znaky
 */

export class TextNormalizer {
  constructor() {
    // Základní mapování problematických znaků
    this.charMap = {
      // Pomlčky → standardní pomlčka
      '\u2013': '-',  // En dash
      '\u2014': '-',  // Em dash
      '\u2015': '-',  // Horizontal bar
      '\u2212': '-',  // Minus sign
      
      // Tři tečky
      '\u2026': '...',
      
      // Mezery → standardní mezera
      '\u00A0': ' ',  // Non-breaking space
      '\u2000': ' ',  // En quad
      '\u2001': ' ',  // Em quad
      '\u2004': ' ',  // Three-per-em space
      '\u2005': ' ',  // Four-per-em space
      '\u2006': ' ',  // Six-per-em space
      '\u2007': ' ',  // Figure space
      '\u2008': ' ',  // Punctuation space
      '\u2009': ' ',  // Thin space
      '\u200A': ' ',  // Hair space
      '\u205F': ' ',  // Medium mathematical space
    };

    // Znaky k úplnému odstranění
    this.removeChars = [
      '\u200B',  // Zero width space
      '\u200C',  // Zero width non-joiner
      '\u200D',  // Zero width joiner
      '\u2060',  // Word joiner
      '\uFEFF',  // Zero width no-break space (BOM)
      '\u00AD',  // Soft hyphen
    ];
  }

  /**
   * Hlavní normalizační funkce - pouze ASCII + české znaky
   */
  normalize(text) {
    if (!text || typeof text !== 'string') {
      return text;
    }

    let normalized = text;

    // 1. Odstranit neviditelné znaky
    for (const char of this.removeChars) {
      normalized = normalized.replace(new RegExp(char, 'g'), '');
    }

    // 2. Nahradit problematické znaky
    for (const [from, to] of Object.entries(this.charMap)) {
      normalized = normalized.replace(new RegExp(from, 'g'), to);
    }

    // 3. Odstranit všechny nevalidní znaky - pouze ASCII + česká diakritika
    normalized = normalized.replace(/[^\x20-\x7E\u00C0-\u017F]/g, '');

    // 4. Normalizovat více mezer na jednu
    normalized = normalized.replace(/\s+/g, ' ');

    // 5. Trim whitespace
    normalized = normalized.trim();

    return normalized;
  }
}