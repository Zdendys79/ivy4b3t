/**
 * Název souboru: iv-math.class.js
 * Umístění: ~/ivy/iv-math.class.js
 *
 * Popis: Třída obsahující pomocné matematické funkce pro generování
 *        náhodných čísel s různými distribucemi
 *
 * Autor: Ivy Project
 * Datum: 2025
 */

export class IvMath {

  /**
   * Generuje náhodné celé číslo v daném intervalu (včetně krajních bodů)
   * Rovnoměrná distribuce - všechny hodnoty mají stejnou pravděpodobnost
   *
   * @param {number} min - Minimální hodnota (včetně)
   * @param {number} max - Maximální hodnota (včetně)
   * @returns {number} Náhodné celé číslo mezi min a max
   *
   * @example
   * IvMath.randInterval(1, 10) // vrátí číslo mezi 1-10
   * IvMath.randInterval(24, 72) // vrátí číslo mezi 24-72
   */
  static randInterval(min, max) {
    // Validace vstupů - BEZ FALLBACK!
    if (isNaN(min) || isNaN(max) || min < 0 || max < 0) {
      const error = new Error(`Neplatné hodnoty pro randInterval: min=${min}, max=${max}. Zdroj chyby musí být opraven!`);
      console.error(`[MATH] Stack trace:`, error.stack);
      throw error;
    }
    
    if (min > max) {
      console.error(`[MATH] min (${min}) je větší než max (${max}). Prohazuji hodnoty.`);
      [min, max] = [max, min];
    }
    
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Generuje náhodné číslo s parabolickým rozptylem
   * Nižší hodnoty jsou výrazně pravděpodobnější než vyšší
   * Používá kvadratickou funkci r² pro distribuci
   *
   * @param {number} min - Minimální hodnota (včetně)
   * @param {number} max - Maximální hodnota (včetně)
   * @returns {number} Náhodné číslo s parabolickým rozptylem
   *
   * @example
   * IvMath.parabolicRand(24, 72)
   * // 24h má ~4% pravděpodobnost
   * // 36h má ~1% pravděpodobnost
   * // 72h má ~0.1% pravděpodobnost
   */
  static parabolicRand(min, max) {
    const r = Math.random();
    const normalized = r * r;
    return Math.floor(min + normalized * (max - min + 1));
  }

  /**
   * Generuje náhodné číslo s inverzním parabolickým rozptylem
   * Vyšší hodnoty jsou výrazně pravděpodobnější než nižší
   * Používá odmocninu √r pro distribuci
   *
   * @param {number} min - Minimální hodnota (včetně)
   * @param {number} max - Maximální hodnota (včetně)
   * @returns {number} Náhodné číslo s inverzním parabolickým rozptylem
   *
   * @example
   * IvMath.parabolicRandReverse(24, 72)
   * // 24h má ~0.1% pravděpodobnost
   * // 36h má ~1% pravděpodobnost
   * // 72h má ~4% pravděpodobnost
   */
  static parabolicRandReverse(min, max) {
    const r = Math.random();
    const normalized = Math.sqrt(r);
    return Math.floor(min + normalized * (max - min + 1));
  }

  /**
   * Testovací metoda pro vizualizaci distribuce
   * Spustí simulaci a vypíše statistiky do konzole
   *
   * @param {string} method - Název metody k testování
   * @param {number} min - Minimální hodnota
   * @param {number} max - Maximální hodnota
   * @param {number} iterations - Počet iterací (výchozí 100000)
   *
   * @example
   * IvMath.testDistribution('parabolicRand', 24, 72, 100000)
   */
  static testDistribution(method, min, max, iterations = 100000) {
    if (!this[method]) {
      console.error(`Metoda ${method} neexistuje`);
      return;
    }

    const counts = {};
    const range = max - min + 1;
    const bucketSize = Math.ceil(range / 4);
    const buckets = {};

    // Inicializace bucketů
    for (let i = 0; i < 4; i++) {
      const start = min + i * bucketSize;
      const end = Math.min(start + bucketSize - 1, max);
      buckets[`${start}-${end}`] = 0;
    }

    // Generování hodnot
    for (let i = 0; i < iterations; i++) {
      const value = this[method](min, max);
      counts[value] = (counts[value] || 0) + 1;

      // Přiřazení do bucketu
      for (const [key, _] of Object.entries(buckets)) {
        const [start, end] = key.split('-').map(Number);
        if (value >= start && value <= end) {
          buckets[key]++;
          break;
        }
      }
    }

    // Výpis výsledků
    console.log(`\nDistribuce pro ${method}(${min}, ${max}):`);
    console.log('='.repeat(40));

    console.log('\nRozmezí:');
    for (const [range, count] of Object.entries(buckets)) {
      const percentage = (count / iterations * 100).toFixed(1);
      console.log(`${range}: ${percentage}%`);
    }

    console.log('\nNejčastější hodnoty:');
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    sorted.slice(0, 5).forEach(([value, count]) => {
      const percentage = (count / iterations * 100).toFixed(2);
      console.log(`${value}: ${percentage}%`);
    });

    console.log('\nKrajní hodnoty:');
    console.log(`${min}: ${((counts[min] || 0) / iterations * 100).toFixed(2)}%`);
    console.log(`${max}: ${((counts[max] || 0) / iterations * 100).toFixed(2)}%`);
  }
}

// Export pro Node.js (CommonJS)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = IvMath;
}
