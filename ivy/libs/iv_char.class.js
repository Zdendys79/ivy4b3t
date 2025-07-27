/**
 * Název souboru: iv-char.class.js
 * Umístění: ~/ivy/iv-char.class.js
 *
 * Popis: Třída pro generování náhodných řetězců a práci se znaky
 *
 * Autor: Ivy Project
 * Datum: 2025
 */

export class IvChar {
  /**
   * Alfanumerické znaky používané pro generování kódů
   * @static
   * @readonly
   */
  static CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  /**
   * Speciální znaky používané jako oddělovače nebo identifikátory
   * @static
   * @readonly
   */
  static SIGNS = "/+*-$,;:#&";

  /**
   * Generuje náhodný kód zadané délky s volitelným speciálním znakem
   *
   * @param {number} c - Délka generovaného kódu (výchozí: 6)
   * @param {boolean} includeSpecial - Zda vložit speciální znak (výchozí: true)
   * @returns {string} Vygenerovaný kód
   *
   * @example
   * IvChar.generate() // "A3X/B9"
   * IvChar.generate(8) // "K2L$M4N8"
   * IvChar.generate(10, false) // "A1B2C3D4E5"
   * IvChar.generate(2) // "X9" (bez speciálního znaku, c < 3)
   */
  static generate(c = 6, includeSpecial = true) {
    // 1. Vygenerovat c alfanumerických znaků
    let code = "";
    for (let i = 0; i < c; i++) {
      code += this.CHARS.charAt(Math.floor(Math.random() * this.CHARS.length));
    }

    // 2. Pokud includeSpecial je true a c >= 3, vložit speciální znak
    if (includeSpecial && c >= 3) {
      // Náhodně vybrat pozici pro speciální znak (ne začátek, ne konec)
      const signPosition = Math.floor(Math.random() * (c - 2)) + 1;

      // Nahradit znak na dané pozici speciálním znakem
      const sign = this.SIGNS.charAt(Math.floor(Math.random() * this.SIGNS.length));
      code = code.substring(0, signPosition) + sign + code.substring(signPosition + 1);
    }

    return code;
  }

  /**
   * Generuje pole náhodných kódů
   *
   * @param {number} count - Počet kódů k vygenerování
   * @param {number} length - Délka každého kódu (výchozí: 6)
   * @param {boolean} includeSpecial - Zda vložit speciální znaky (výchozí: true)
   * @returns {string[]} Pole vygenerovaných kódů
   *
   * @example
   * IvChar.generateBatch(5) // ["A3/B9C", "X2$Y8Z", ...]
   * IvChar.generateBatch(3, 8, false) // ["A1B2C3D4", "X5Y6Z7W8", ...]
   */
  static generateBatch(count, length = 6, includeSpecial = true) {
    const codes = [];
    for (let i = 0; i < count; i++) {
      codes.push(this.generate(length, includeSpecial));
    }
    return codes;
  }

  /**
   * Generuje unikátní kódy (bez duplicit)
   *
   * @param {number} count - Počet unikátních kódů k vygenerování
   * @param {number} length - Délka každého kódu (výchozí: 6)
   * @param {boolean} includeSpecial - Zda vložit speciální znaky (výchozí: true)
   * @returns {string[]} Pole unikátních vygenerovaných kódů
   * @throws {Error} Pokud nelze vygenerovat požadovaný počet unikátních kódů
   *
   * @example
   * IvChar.generateUnique(10, 6) // 10 unikátních 6-znakových kódů
   */
  static generateUnique(count, length = 6, includeSpecial = true) {
    const codes = new Set();
    const maxAttempts = count * 100; // Ochrana proti nekonečné smyčce
    let attempts = 0;

    while (codes.size < count && attempts < maxAttempts) {
      codes.add(this.generate(length, includeSpecial));
      attempts++;
    }

    if (codes.size < count) {
      throw new Error(`Nelze vygenerovat ${count} unikátních kódů délky ${length}`);
    }

    return Array.from(codes);
  }

  /**
   * Kontroluje, zda kód obsahuje speciální znak
   *
   * @param {string} code - Kód k ověření
   * @returns {boolean} True, pokud kód obsahuje speciální znak
   *
   * @example
   * IvChar.hasSpecialChar("A3/B9") // true
   * IvChar.hasSpecialChar("A3B9C") // false
   */
  static hasSpecialChar(code) {
    return this.SIGNS.split('').some(sign => code.includes(sign));
  }

  /**
   * Odstraní všechny speciální znaky z kódu
   *
   * @param {string} code - Kód k vyčištění
   * @returns {string} Kód bez speciálních znaků
   *
   * @example
   * IvChar.removeSpecialChars("A3/B9$C") // "A3B9C"
   */
  static removeSpecialChars(code) {
    return code.split('').filter(char => !this.SIGNS.includes(char)).join('');
  }

  /**
   * Formátuje kód do skupin zadané délky
   *
   * @param {string} code - Kód k formátování
   * @param {number} groupSize - Velikost skupiny (výchozí: 4)
   * @param {string} separator - Oddělovač skupin (výchozí: "-")
   * @returns {string} Formátovaný kód
   *
   * @example
   * IvChar.format("A1B2C3D4E5F6") // "A1B2-C3D4-E5F6"
   * IvChar.format("A1B2C3D4E5F6", 3, " ") // "A1B 2C3 D4E 5F6"
   */
  static format(code, groupSize = 4, separator = "-") {
    const groups = [];
    for (let i = 0; i < code.length; i += groupSize) {
      groups.push(code.substring(i, i + groupSize));
    }
    return groups.join(separator);
  }
}

// Moderní ES6 export je již na začátku souboru pomocí 'export class IvChar'
// Není potřeba další export
