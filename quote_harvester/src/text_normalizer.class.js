/**
 * TextNormalizer - Normalizace textů citátů
 * Odstraňuje problematické speciální znaky zachovávajíc diakritiku a běžnou interpunkci
 */

export class TextNormalizer {
  constructor() {
    // Mapování problematických uvozovek - POZOR: nepoužívat " ' `
    this.quoteMap = {
      // Všechny uvozovky → jeden typ (neutrální hranatý znak)
      '\u201C': '⟨',  // Left double quotation mark → mathematical left angle bracket
      '\u201D': '⟩',  // Right double quotation mark → mathematical right angle bracket  
      '\u201E': '⟨',  // Double low-9 quotation mark → mathematical left angle bracket
      '\u201A': '⟨',  // Single low-9 quotation mark → mathematical left angle bracket
      '\u2018': '⟨',  // Left single quotation mark → mathematical left angle bracket
      '\u2019': '⟩',  // Right single quotation mark → mathematical right angle bracket
      '\u2039': '⟨',  // Single left angle quotation mark → mathematical left angle bracket
      '\u203A': '⟩',  // Single right angle quotation mark → mathematical right angle bracket
      '\u00AB': '⟨',  // Left double angle quotation mark → mathematical left angle bracket
      '\u00BB': '⟩',  // Right double angle quotation mark → mathematical right angle bracket
      '\u201F': '⟨',  // Double high-reversed-9 quotation mark → mathematical left angle bracket
      '\u2032': '⟨',  // Prime → mathematical left angle bracket
      '\u2033': '⟨',  // Double prime → mathematical left angle bracket
      '\u201B': '⟩'   // Single high-reversed-9 quotation mark → mathematical right angle bracket
    };

    // Mapování dalších problematických znaků
    this.charMap = {
      // Pomlčky → standardní pomlčka/spojovník
      '\u2013': '-',  // En dash
      '\u2014': '-',  // Em dash
      '\u2015': '-',  // Horizontal bar
      '\u2012': '-',  // Figure dash
      '\u2212': '-',  // Minus sign
      
      // Tři tečky → standardní tři tečky
      '\u2026': '...',
      
      // Apostrofy → standardní apostrof
      '\u02BC': "'",  // Modifier letter apostrophe
      '\u02BB': "'",  // Modifier letter turned comma
      
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
      
      // Speciální znaky → standardní alternativy
      '\u00A9': '(c)',
      '\u00AE': '(R)',
      '\u2122': '(TM)',
      '\u00A7': 'paragraf',
      '\u00B6': '',
      '\u2020': '',
      '\u2021': '',
      '\u2022': '-',  // Bullet → pomlčka
      '\u2030': '%',  // Per mille → procento
      '\u2031': '%',  // Per ten thousand → procento
    };

    // Znaky k úplnému odstranění (neviditelné, kontrolní)
    this.removeChars = [
      '\u200B',  // Zero width space
      '\u200C',  // Zero width non-joiner
      '\u200D',  // Zero width joiner
      '\u2060',  // Word joiner
      '\uFEFF',  // Zero width no-break space (BOM)
      '\u00AD',  // Soft hyphen
      '\u034F',  // Combining grapheme joiner
      '\u202A',  // Left-to-right embedding
      '\u202B',  // Right-to-left embedding
      '\u202C',  // Pop directional formatting
      '\u202D',  // Left-to-right override
      '\u202E',  // Right-to-left override
    ];

    // Diakritika a znaky které CHCEME zachovat
    this.preservedChars = [
      // České znaky
      'á', 'č', 'ď', 'é', 'ě', 'í', 'ň', 'ó', 'ř', 'š', 'ť', 'ú', 'ů', 'ý', 'ž',
      'Á', 'Č', 'Ď', 'É', 'Ě', 'Í', 'Ň', 'Ó', 'Ř', 'Š', 'Ť', 'Ú', 'Ů', 'Ý', 'Ž',
      
      // Německé znaky
      'ä', 'ö', 'ü', 'ß', 'Ä', 'Ö', 'Ü',
      
      // Francouzské znaky
      'à', 'â', 'ç', 'è', 'é', 'ê', 'ë', 'î', 'ï', 'ô', 'ù', 'û', 'ü', 'ÿ',
      'À', 'Â', 'Ç', 'È', 'É', 'Ê', 'Ë', 'Î', 'Ï', 'Ô', 'Ù', 'Û', 'Ü', 'Ÿ',
      
      // Španělské znaky
      'á', 'é', 'í', 'ñ', 'ó', 'ú', 'ü', 'Á', 'É', 'Í', 'Ñ', 'Ó', 'Ú', 'Ü',
      
      // Italské znaky
      'à', 'è', 'é', 'ì', 'í', 'î', 'ò', 'ó', 'ù', 'ú',
      'À', 'È', 'É', 'Ì', 'Í', 'Î', 'Ò', 'Ó', 'Ù', 'Ú',
      
      // Standardní interpunkce
      '.', ',', '!', '?', ':', ';', '-', '(', ')', '[', ']', '{', '}',
      '"', "'", '/', '\\', '&', '%', '$', '#', '@', '*', '+', '=',
      
      // Číslice
      '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'
    ];
  }

  /**
   * Hlavní normalizační funkce
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

    // 2. Odstranit uvozovky kolem celého textu PŘED nahrazováním
    normalized = this.removeOuterQuotes(normalized);

    // 3. Nahradit problematické uvozovky uvnitř textu
    normalized = this.normalizeQuotesInText(normalized);

    // 4. Nahradit ostatní problematické znaky
    for (const [from, to] of Object.entries(this.charMap)) {
      normalized = normalized.replace(new RegExp(from, 'g'), to);
    }

    // 5. Normalizovat více mezer na jednu
    normalized = normalized.replace(/\s+/g, ' ');

    // 6. Odstranit mezery na začátku a konci
    normalized = normalized.trim();

    // 7. Opravit zdvojené interpunkce
    normalized = this.fixDuplicatedPunctuation(normalized);

    return normalized;
  }

  /**
   * Odstranit uvozovky kolem celého textu
   */
  removeOuterQuotes(text) {
    text = text.trim();
    
    // Odstranit různé typy uvozovek na začátku a konci
    const quotePatterns = [
      [/^„(.*)"$/, '$1'],           // „text" → text
      [/^"(.*)"$/, '$1'],           // "text" → text
      [/^"(.*)"$/, '$1'],           // "text" → text
      [/^'(.*)'$/, '$1'],           // 'text' → text
      [/^‚(.*)'$/, '$1'],           // ‚text' → text
      [/^«(.*)»$/, '$1'],           // «text» → text
      [/^‹(.*)›$/, '$1'],           // ‹text› → text
      [/^⟨(.*)⟩$/, '$1']            // ⟨text⟩ → text (náš interní)
    ];
    
    for (const [pattern, replacement] of quotePatterns) {
      const match = text.match(pattern);
      if (match) {
        text = match[1].trim();
        break;
      }
    }
    
    return text;
  }

  /**
   * Inteligentní normalizace uvozovek uvnitř textu
   */
  normalizeQuotesInText(text) {
    let result = text;
    
    // Nahradit speciální uvozovky podle mapy
    for (const [from, to] of Object.entries(this.quoteMap)) {
      result = result.replace(new RegExp(from, 'g'), to);
    }
    
    // Najít páry uvozovek a nahradit je správně
    // Vzor: libovolná uvozovka následovaná textem a ukončená ASCII uvozovkou
    result = result.replace(/(⟨[^"⟨⟩]*?)"/g, '$1⟩');
    
    // Zbývající ASCII uvozovky nahradit za levé úhly
    result = result.replace(/"/g, '⟨');
    result = result.replace(/'/g, '⟨');
    
    return result;
  }

  /**
   * Určit zda je uvozovka levá (otevírací)
   */
  isLeftQuote(char) {
    const leftQuotes = ['\u201C', '\u201E', '\u201A', '\u2018', '\u2039', '\u00AB', '\u201F'];
    return leftQuotes.includes(char);
  }

  /**
   * Spárovat uvozovky v textu
   */
  pairQuotes(quotes) {
    const pairs = [];
    const stack = [];

    for (const quote of quotes) {
      if (quote.isLeft) {
        stack.push(quote);
      } else {
        // Pravá uvozovka - najít odpovídající levou
        if (stack.length > 0) {
          const left = stack.pop();
          pairs.push({ left, right: quote });
        }
      }
    }

    return pairs;
  }

  /**
   * Oprava zdvojené interpunkce
   */
  fixDuplicatedPunctuation(text) {
    return text
      // Zdvojené tečky, čárky, atd.
      .replace(/\.{2,}/g, '...')  // Více teček → tři tečky
      .replace(/,{2,}/g, ',')     // Více čárek → jedna čárka
      .replace(/!{2,}/g, '!')     // Více vykřičníků → jeden
      .replace(/\?{2,}/g, '?')    // Více otazníků → jeden
      .replace(/:{2,}/g, ':')     // Více dvojteček → jedna
      .replace(/;{2,}/g, ';')     // Více středníků → jeden
      
      // Oprava mezer kolem interpunkce
      .replace(/\s+([,.!?:;])/g, '$1')  // Mezera před interpunkcí
      .replace(/([,.!?:;])\s+/g, '$1 ') // Správná mezera za interpunkcí
      
      // Oprava uvozovek
      .replace(/\s*"\s*/g, '"')   // Mezery kolem uvozovek
      .replace(/\s*'\s*/g, "'");  // Mezery kolem apostrofů
  }

  /**
   * Normalizace specificky pro citáty
   */
  normalizeQuote(quote) {
    const normalized = { ...quote };

    // Normalizovat hlavní text
    if (normalized.text) {
      const result = this.extractAuthorFromText(normalized.text);
      normalized.text = this.normalize(result.text);
      
      // Pokud nebyl autor nastaven a našli jsme ho v textu
      if (!normalized.author && result.author) {
        normalized.author = result.author;
      }
    }

    // Normalizovat originální text
    if (normalized.original_text) {
      const result = this.extractAuthorFromText(normalized.original_text);
      normalized.original_text = this.normalize(result.text);
      
      // Pokud nebyl autor nastaven a našli jsme ho v originálním textu
      if (!normalized.author && result.author) {
        normalized.author = result.author;
      }
    }

    // Normalizovat autora
    if (normalized.author) {
      normalized.author = this.normalize(normalized.author);
    }

    return normalized;
  }

  /**
   * Extrakce autora z textu citátu
   */
  extractAuthorFromText(text) {
    if (!text) return { text, author: null };

    let cleanText = text.trim();
    let author = null;

    // Vzory pro extrakci autora (autor na konci)
    const authorPatterns = [
      // Pomlčka + autor
      /^(.*?)\s*[-–—]\s*(.+)$/,
      // Závorky [autor] nebo (autor)
      /^(.*?)\s*[\[\(]([^\[\]\(\)]+)[\]\)]\s*$/,
      // Autor s uvozovkami
      /^(.*?)\s*['"„"‚'‹›«»]\s*([^'"„"‚'‹›«»]+)\s*['"„"‚'‹›«»]\s*$/,
      // Tilda + autor
      /^(.*?)\s*~\s*(.+)$/,
      // Středník + autor
      /^(.*?)\s*;\s*(.+)$/,
      // Čárka + autor (pouze pokud je autor krátký)
      /^(.*?),\s*([A-Z][a-zA-ZáčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ\s]{1,30})$/
    ];

    for (const pattern of authorPatterns) {
      const match = cleanText.match(pattern);
      if (match) {
        const potentialText = match[1].trim();
        const potentialAuthor = match[2].trim();

        // Kontrola zda má smysl rozdělit (text musí být delší než autor)
        if (potentialText.length > 10 && potentialAuthor.length > 2 && potentialAuthor.length < 50) {
          // Kontrola zda potenciální autor vypadá jako jméno
          if (this.looksLikeName(potentialAuthor)) {
            cleanText = potentialText;
            author = this.cleanAuthorName(potentialAuthor);
            break;
          }
        }
      }
    }

    return { text: cleanText, author };
  }

  /**
   * Kontrola zda text vypadá jako jméno autora
   */
  looksLikeName(text) {
    // Základní kontroly
    if (!text || text.length < 2) return false;
    
    // Nesmí obsahovat čísla (kromě římských číslic)
    if (/[0-9]/.test(text)) return false;
    
    // Nesmí obsahovat speciální znaky (kromě pomlček a teček)
    if (/[#@$%^&*+=<>{}|\\_]/.test(text)) return false;
    
    // Měl by začínat velkým písmenem
    if (!/^[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]/.test(text)) return false;
    
    // Neměl by být jen jedno slovo kratší než 3 znaky (výjimka pro iniciály)
    const words = text.split(/\s+/);
    if (words.length === 1 && text.length < 3 && !/^[A-Z]\.?$/.test(text)) return false;
    
    return true;
  }

  /**
   * Vyčištění jména autora
   */
  cleanAuthorName(author) {
    return author
      // Odstranit hranaté závorky, závorky, uvozovky
      .replace(/[\[\]\(\)'"„"‚'‹›«»]/g, '')
      // Odstranit pomlčky na začátku/konci
      .replace(/^[-–—\s]+|[-–—\s]+$/g, '')
      // Normalizovat mezery
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Kontrola zda text obsahuje problematické znaky
   */
  hasProblematicChars(text) {
    if (!text) return false;

    // Kontrola problematických uvozovek
    for (const char of Object.keys(this.quoteMap)) {
      if (text.includes(char)) return true;
    }

    // Kontrola problematických znaků
    for (const char of Object.keys(this.charMap)) {
      if (text.includes(char)) return true;
    }

    // Kontrola neviditelných znaků
    for (const char of this.removeChars) {
      if (text.includes(char)) return true;
    }

    return false;
  }

  /**
   * Statistiky normalizace
   */
  getNormalizationStats(originalText, normalizedText) {
    if (!originalText || !normalizedText) {
      return { changes: 0, details: [] };
    }

    const changes = [];
    let changeCount = 0;

    // Porovnat znak po znaku
    const maxLength = Math.max(originalText.length, normalizedText.length);
    
    for (let i = 0; i < maxLength; i++) {
      const originalChar = originalText[i] || '';
      const normalizedChar = normalizedText[i] || '';
      
      if (originalChar !== normalizedChar) {
        changes.push({
          position: i,
          from: originalChar,
          to: normalizedChar,
          type: this.getChangeType(originalChar, normalizedChar)
        });
        changeCount++;
      }
    }

    return {
      changes: changeCount,
      details: changes.slice(0, 10), // Prvních 10 změn pro přehled
      lengthChange: normalizedText.length - originalText.length
    };
  }

  /**
   * Určení typu změny
   */
  getChangeType(from, to) {
    if (this.quoteMap[from]) return 'quote_normalization';
    if (this.charMap[from]) return 'char_replacement';
    if (this.removeChars.includes(from)) return 'char_removal';
    if (from === ' ' && to === ' ') return 'space_normalization';
    return 'other';
  }
}