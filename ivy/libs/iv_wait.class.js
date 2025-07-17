/**
 * Název souboru: iv_wait.class.js
 * Umístění: ~/ivy/libs/iv_wait.class.js
 * 
 * Popis: Jednotná třída pro všechny typy čekání a pauzy
 * - Jednoduché API s konzistentním logováním
 * - Náhodné intervaly pro lidské chování
 * - Bez duplicitních funkcí
 */

import { Log } from './iv_log.class.js';

export class Wait {
  /**
   * Čeká náhodný čas v sekundách (min je 60% z max)
   * @param {number} max_time - Maximální čas v sekundách
   * @param {string} comment - Volitelný komentář
   * @returns {Promise<void>}
   */
  static async toSeconds(max_time, comment = null) {
    const min_time = Math.round(max_time * 0.6);
    const wait_time = min_time + Math.random() * (max_time - min_time);
    
    if (comment) {
      Log.info('[WAIT]', `${comment} - čekám ${Math.round(wait_time)}s`);
    }
    
    return new Promise(resolve => setTimeout(resolve, wait_time * 1000));
  }

  /**
   * Čeká náhodný čas v minutách (min je 60% z max)
   * @param {number} max_time - Maximální čas v minutách (může být desetinný)
   * @param {string} comment - Volitelný komentář
   * @returns {Promise<void>}
   */
  static async toMinutes(max_time, comment = null) {
    const min_time = max_time * 0.6;
    const wait_minutes = min_time + Math.random() * (max_time - min_time);
    const wait_ms = wait_minutes * 60000;
    
    const target_time = new Date(Date.now() + wait_ms);
    const target_formatted = target_time.toTimeString().substring(0, 8);
    
    const final_comment = comment || 'Čekám';
    Log.info('[WAIT]', `${final_comment} - ${Math.round(wait_minutes * 10) / 10} min do ${target_formatted}`);
    
    return new Promise(resolve => setTimeout(resolve, wait_ms));
  }

  /**
   * Čeká do konkrétního času
   * @param {Date|number} target_time - Cílový čas (Date objekt nebo timestamp)
   * @param {string} comment - Volitelný komentář
   * @returns {Promise<void>}
   */
  static async toTime(target_time, comment = null) {
    const target_date = target_time instanceof Date ? target_time : new Date(target_time);
    const wait_ms = target_date.getTime() - Date.now();
    
    if (wait_ms <= 0) {
      Log.warn('[WAIT]', 'Cílový čas je v minulosti - neplatné čekání');
      return;
    }
    
    const target_formatted = target_date.toTimeString().substring(0, 8);
    const final_comment = comment || 'Čekám';
    
    Log.info('[WAIT]', `${final_comment} - do ${target_formatted}`);
    
    return new Promise(resolve => setTimeout(resolve, wait_ms));
  }

  /**
   * Rychlé čekání v milisekundách pro akce s elementy
   * @param {number} min_ms - Minimální čas v ms
   * @param {number} max_ms - Maximální čas v ms
   * @returns {Promise<void>}
   */
  static async betweenActions(min_ms, max_ms) {
    const delay_ms = min_ms + Math.random() * (max_ms - min_ms);
    return new Promise(resolve => setTimeout(resolve, delay_ms));
  }

  /**
   * Čekání mezi znaky při psaní - vrací čas v ms
   * @returns {number} Čas v ms
   */
  static charDelay() {
    return 30 + Math.random() * 30; // 30-60ms
  }

  /**
   * Čekání mezi slovy při psaní - vrací Promise
   * @returns {Promise<void>}
   */
  static async wordDelay() {
    const delay_ms = 150 + Math.random() * 300; // 150-450ms
    return new Promise(resolve => setTimeout(resolve, delay_ms));
  }

  /**
   * Validace času - BEZ FALLBACK!
   * @param {number} time_value - Hodnota času
   * @param {string} context - Kontext pro chybovou zprávu
   * @private
   */
  static _validateTime(time_value, context) {
    if (isNaN(time_value) || time_value < 0) {
      const error = new Error(`Neplatný čas v ${context}: ${time_value}. Zdroj chyby musí být opraven!`);
      Log.error('[WAIT]', error.message);
      throw error;
    }
  }

  /**
   * LEGACY: Zachovaná funkce delay pro zpětnou kompatibilitu
   * @param {number} delay_time - Čas v ms
   * @param {boolean} verbose - Zobrazit log
   * @returns {Promise<void>}
   */
  static async delay(delay_time, verbose = true) {
    this._validateTime(delay_time, 'delay');
    
    if (verbose && delay_time >= 60000) {
      const minutes = Math.floor(delay_time / 60000);
      const seconds = Math.floor((delay_time / 1000) % 60);
      const target_time = new Date(Date.now() + delay_time);
      const target_formatted = target_time.toTimeString().substring(0, 8);
      
      Log.info('[WAIT]', `Čekám ${minutes}:${seconds.toString().padStart(2, '0')} do ${target_formatted}`);
    }
    
    return new Promise(resolve => setTimeout(resolve, delay_time));
  }
}

// Export pro zpětnou kompatibilitu
export const wait = Wait;