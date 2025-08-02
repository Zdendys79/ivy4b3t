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
   * Čeká náhodný čas v sekundách (min je 60% z max) - NYní S PODPOROU KLÁVESY 'Q'
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
    
    await this._waitWithKeyboardSupport(wait_time * 1000, {
      checkRestart: false,
      checkUICommand: false,
      allowedKeys: ['q']
    });
  }

  /**
   * Čeká náhodný čas v sekundách - S KONTROLOU RESTART A KLÁVESY 'Q'
   * @param {number} max_time - Maximální čas v sekundách
   * @param {string} comment - Volitelný komentář
   * @returns {Promise<void>}
   */
  static async toSecondsInterruptible(max_time, comment = null) {
    const min_time = Math.round(max_time * 0.6);
    const wait_time = min_time + Math.random() * (max_time - min_time);
    
    if (comment) {
      Log.info('[WAIT]', `${comment} - čekám ${Math.round(wait_time)}s (přerušitelné)`);
    }
    
    await this._waitWithKeyboardSupport(wait_time * 1000, {
      checkRestart: true,
      checkUICommand: false,
      allowedKeys: ['q']
    });
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
   * Čeká náhodný čas v minutách - S PODPOROU KLÁVESY 'Q'
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
    
    await this._waitWithKeyboardSupport(wait_ms, {
      checkRestart: false,
      checkUICommand: false,
      allowedKeys: ['q']
    });
  }

  /**
   * Čeká náhodný čas v minutách - S KONTROLOU RESTART A KLÁVESY 'Q'  
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
    
    await this._waitWithKeyboardSupport(wait_ms, {
      checkRestart: true,
      checkUICommand: false,
      allowedKeys: ['q']
    });
  }

  /**
   * Čeká na další worker cyklus s kontrolou UI příkazů, restart_needed a klávesy 'q'
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
    
    const result = await this._waitWithKeyboardSupport(wait_ms, {
      checkRestart: true,
      checkUICommand: true,
      allowedKeys: ['q']
    });
    
    if (result === 'ui_command') {
      return; // UI příkaz detected - běžná cesta
    }
    
    Log.info('[WAIT]', 'Čekání dokončeno');
  }

  /**
   * Čeká do konkrétního času - S PODPOROU KLÁVESY 'Q'
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
    
    await this._waitWithKeyboardSupport(wait_ms, {
      checkRestart: false,
      checkUICommand: false,
      allowedKeys: ['q']
    });
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
   * UNIVERZÁLNÍ čekání s podporou klávesových zkratek a kontrol
   * @param {number} wait_ms - Čas v milisekundách
   * @param {object} options - Možnosti čekání
   * @param {boolean} options.checkRestart - Kontrolovat restart_needed (default: true)
   * @param {boolean} options.checkUICommand - Kontrolovat UI příkazy (default: false)
   * @param {Array<string>} options.allowedKeys - Povolené klávesy (default: ['q'])
   * @param {function} options.onKeyPress - Callback pro stisk klávesy (key) => action
   * @returns {Promise<string|null>} Vráti stisknutou klávesu nebo null při timeout
   * @private
   */
  static async _waitWithKeyboardSupport(wait_ms, options = {}) {
    const {
      checkRestart = true,
      checkUICommand = false,
      allowedKeys = ['q'],
      onKeyPress = null
    } = options;
    
    const start_time = Date.now();
    const end_time = start_time + wait_ms;
    
    let keyListener = null;
    let keyPressed = null;
    
    // Setup keyboard listener
    if (process.stdin.isTTY && allowedKeys.length > 0) {
      process.stdin.setRawMode(true);
      process.stdin.resume();
      
      keyListener = (key) => {
        const keyStr = key.toString().toLowerCase();
        console.log(`[WAIT DEBUG] Key pressed: "${keyStr}", allowed: [${allowedKeys.join(',')}]`);
        
        if (allowedKeys.includes(keyStr)) {
          keyPressed = keyStr;
          
          // Custom handler nebo default akce
          if (onKeyPress) {
            const action = onKeyPress(keyStr);
            console.log(`[WAIT DEBUG] onKeyPress returned: "${action}"`);
            if (action === 'exit') {
              Log.info('[WAIT]', `Stisknuta klávesa "${keyStr}" - ukončuji program...`);
              process.exit(0);
            }
          } else if (keyStr === 'q') {
            Log.info('[WAIT]', 'Stisknuta klávesa "q" - ukončuji program...');
            process.exit(0);
          }
        }
      };
      
      process.stdin.on('data', keyListener);
      console.log(`[WAIT DEBUG] Keyboard listener setup complete. TTY: ${process.stdin.isTTY}, allowed keys: [${allowedKeys.join(',')}]`);
    } else {
      console.log(`[WAIT DEBUG] Keyboard listener NOT setup. TTY: ${process.stdin.isTTY}, allowedKeys.length: ${allowedKeys.length}`);
    }
    
    try {
      while (Date.now() < end_time && !keyPressed) {
        // Kontrola restart_needed
        if (checkRestart && global.systemState?.restart_needed) {
          Log.info('[WAIT]', 'Čekání přerušeno kvůli restart_needed. Ukončuji aplikaci pro restart.');
          process.exit(1);
        }
        
        // Kontrola UI příkazů
        if (checkUICommand && global.uiCommandCache) {
          Log.info('[WAIT]', 'Čekání přerušeno kvůli nevyřízenému UI příkazu.');
          return 'ui_command';
        }
        
        // Čekej maximálně 1 sekundu nebo do konce
        const remaining_ms = end_time - Date.now();
        const next_check_ms = Math.min(1000, remaining_ms);
        
        if (next_check_ms > 0) {
          await new Promise(resolve => setTimeout(resolve, next_check_ms));
        }
      }
      
      return keyPressed;
    } finally {
      // Cleanup keyboard listener
      if (keyListener && process.stdin.isTTY) {
        process.stdin.removeListener('data', keyListener);
        process.stdin.setRawMode(false);
        process.stdin.pause();
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
   * Čekání s pevným časem - S PODPOROU KLÁVESY 'Q'
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
    
    await this._waitWithKeyboardSupport(delay_time, {
      checkRestart: false,
      checkUICommand: false,
      allowedKeys: ['q']
    });
  }

  /**
   * Čekání s interaktivní podporou klávesových zkratek pro debugger
   * @param {number} timeoutSeconds - Timeout v sekundách
   * @returns {Promise<string>} Vrací stisknutou klávesu nebo 'timeout'
   */
  static async forUserInput(timeoutSeconds = 30) {
    // Kontrola, zda máme TTY pro interaktivní vstup
    if (!process.stdin.isTTY) {
      Log.debug('[WAIT]', 'No TTY available for interactive input - auto-continuing after timeout');
      await this.toSeconds(timeoutSeconds);
      return 'timeout';
    }

    const result = await this._waitWithKeyboardSupport(timeoutSeconds * 1000, {
      checkRestart: false,
      checkUICommand: false,
      allowedKeys: ['c', 'q'],
      onKeyPress: (key) => {
        Log.info('[WAIT]', `Key received: "${key}"`);
        if (key === 'q') return 'exit';
        return 'continue';
      }
    });

    return result || 'timeout';
  }
}

// Export pro zpětnou kompatibilitu
export const wait = Wait;