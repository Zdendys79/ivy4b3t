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
    
    if (comment && wait_time >= 0.1) {
      Log.info('[WAIT]', `${comment} - čekám ${Math.round(wait_time)}s`);
    }
    
    return new Promise(resolve => setTimeout(resolve, wait_time * 1000));
  }

  /**
   * Čeká náhodný čas v sekundách - PŘERUŠITELNÉ při restart_needed
   * @param {number} max_time - Maximální čas v sekundách
   * @param {string} comment - Volitelný komentář
   * @returns {Promise<void>}
   */
  static async toSecondsInterruptible(max_time, comment = null) {
    const min_time = Math.round(max_time * 0.6);
    const wait_time = min_time + Math.random() * (max_time - min_time);
    
    if (comment && wait_time >= 0.1) {
      Log.info('[WAIT]', `${comment} - čekám ${Math.round(wait_time)}s (přerušitelné)`);
    }
    
    return this._waitWithRestartCheck(wait_time * 1000);
  }

  /**
   * Čeká náhodný čas v milisekundách (min je 60% z max) - BEZ LOGOVÁNÍ
   * @param {number} max_time - Maximální čas v milisekundách
   * @returns {Promise<void>}
   */
  static async toMS(max_time) {
    if (typeof max_time !== 'number' || isNaN(max_time) || max_time < 0) {
      throw new Error(`Wait.toMS(): max_time musí být platné číslo >= 0, dostáno: ${max_time}`);
    }
    
    const min_time = Math.round(max_time * 0.6);
    const wait_time = min_time + Math.random() * (max_time - min_time);
    
    return new Promise(resolve => setTimeout(resolve, wait_time));
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
   * Čeká náhodný čas v minutách - PŘERUŠITELNÉ při restart_needed
   * @param {number} max_time - Maximální čas v minutách (může být desetinný)
   * @param {string} comment - Volitelný komentář
   * @returns {Promise<void>}
   */
  static async toMinutesInterruptible(max_time, comment = null) {
    const min_time = max_time * 0.6;
    const wait_minutes = min_time + Math.random() * (max_time - min_time);
    const wait_ms = wait_minutes * 60000;
    
    const target_time = new Date(Date.now() + wait_ms);
    const target_formatted = target_time.toTimeString().substring(0, 8);
    
    const final_comment = comment || 'Čekám';
    Log.info('[WAIT]', `${final_comment} - ${Math.round(wait_minutes * 10) / 10} min do ${target_formatted} (přerušitelné)`);
    
    return this._waitWithRestartCheck(wait_ms);
  }

  /**
   * Čeká na další worker cyklus s kontrolou UI příkazů a restart_needed
   * @param {number} maxMinutes - Maximální čas v minutách
   * @returns {Promise<void>}
   */
  static async forNextWorkerCycle(maxMinutes) {
    const min_time = maxMinutes * 0.6;
    const wait_minutes = min_time + Math.random() * (maxMinutes - min_time);
    const wait_ms = wait_minutes * 60000;
    
    const target_time = new Date(Date.now() + wait_ms);
    const target_formatted = target_time.toTimeString().substring(0, 8);
    
    Log.info('[WAIT]', `Čekání na další cyklus - ${Math.round(wait_minutes * 10) / 10} min do ${target_formatted} (přerušitelné s UI)`);
    
    const start_time = Date.now();
    const end_time = start_time + wait_ms;
    
    while (Date.now() < end_time) {
      // Kontrola restart_needed
      if (global.systemState?.restart_needed) {
        Log.info('[WAIT]', 'Čekání přerušeno kvůli restart_needed. Ukončuji aplikaci pro restart.');
        process.exit(1);
      }
      
      // Kontrola UI příkazů
      if (global.uiCommandCache) {
        Log.info('[WAIT]', 'Čekání přerušeno kvůli nevyřízenému UI příkazu.');
        return;
      }
      
      // Čekej maximálně 1 sekundu nebo do konce
      const remaining_ms = end_time - Date.now();
      const next_check_ms = Math.min(1000, remaining_ms);
      
      if (next_check_ms > 0) {
        await new Promise(resolve => setTimeout(resolve, next_check_ms));
      }
    }
    
    Log.info('[WAIT]', 'Čekání dokončeno');
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
      await Log.warn('[WAIT]', 'Cílový čas je v minulosti - neplatné čekání');
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
   * Čekání mezi znaky při psaní
   * @returns {Promise<void>}
   */
  static async charDelay() {
    const delay_ms = 30 + Math.random() * 30; // 30-60ms
    return new Promise(resolve => setTimeout(resolve, delay_ms));
  }

  /**
   * Čekání mezi slovy při psaní
   * @returns {Promise<void>}
   */
  static async wordDelay() {
    const delay_ms = 150 + Math.random() * 300; // 150-450ms
    return new Promise(resolve => setTimeout(resolve, delay_ms));
  }

  /**
   * Čekání s kontrolou restart_needed každou sekundu
   * @param {number} wait_ms - Čas v milisekundách
   * @returns {Promise<void>}
   * @private
   */
  static async _waitWithRestartCheck(wait_ms) {
    const start_time = Date.now();
    const end_time = start_time + wait_ms;
    
    while (Date.now() < end_time) {
      // Kontrola restart_needed
      if (global.systemState?.restart_needed) {
        Log.info('[WAIT]', 'Čekání přerušeno kvůli restart_needed. Ukončuji aplikaci pro restart.');
        process.exit(1);
      }
      
      // Čekej maximálně 1 sekundu nebo do konce
      const remaining_ms = end_time - Date.now();
      const next_check_ms = Math.min(1000, remaining_ms);
      
      if (next_check_ms > 0) {
        await new Promise(resolve => setTimeout(resolve, next_check_ms));
      }
    }
  }

  /**
   * Validace času - BEZ FALLBACK!
   * @param {number} time_value - Hodnota času
   * @param {string} context - Kontext pro chybovou zprávu
   * @private
   */
  static async _validateTime(time_value, context) {
    if (isNaN(time_value) || time_value < 0) {
      const error = new Error(`Neplatný čas v ${context}: ${time_value}. Zdroj chyby musí být opraven!`);
      await Log.error('[WAIT]', error.message);
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
    await this._validateTime(delay_time, 'delay');
    
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