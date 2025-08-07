/**
 * Název souboru: iv_invasive_lock.class.js
 * Umístění: ~/ivy/libs/iv_invasive_lock.class.js
 *
 * Popis: Třída pro správu invasive lock mechanismu
 * - Ochrana proti spam postům
 * - Cooldown po invazivních akcích
 * - Jednoduchá in-memory implementace pro jednoho uživatele
 */

import { Log } from './iv_log.class.js';

export class InvasiveLock {
  constructor() {
    this.lockUntil = null;
  }

  /**
   * Inicializuje lock (reset)
   */
  init() {
    this.lockUntil = null;
    Log.debug('[INVASIVE_LOCK]', 'Lock inicializován');
  }

  /**
   * Nastaví lock na určitou dobu
   * @param {number} cooldownMs - Doba locknutí v ms
   */
  set(cooldownMs) {
    Log.debug('[INVASIVE_LOCK]', `Nastavuji lock na ${cooldownMs}ms (${typeof cooldownMs})`);
    
    if (!cooldownMs || isNaN(cooldownMs) || cooldownMs <= 0) {
      Log.warn('[INVASIVE_LOCK]', `Neplatná hodnota cooldownMs: ${cooldownMs}, používám 180000ms (3min)`);
      cooldownMs = 180000; // 3 minuty fallback
    }
    
    this.lockUntil = Date.now() + cooldownMs;
    const lockUntilDate = new Date(this.lockUntil);
    Log.debug('[INVASIVE_LOCK]', `Lock nastaven do ${lockUntilDate.toLocaleTimeString()}`);
  }

  /**
   * Zkontroluje, zda je lock aktivní
   * @returns {Object} Stav locku
   */
  check() {
    if (!this.lockUntil) {
      return { 
        isActive: false, 
        reason: 'Žádný invasive lock' 
      };
    }

    const now = Date.now();
    if (now >= this.lockUntil) {
      return { 
        isActive: false, 
        reason: 'Invasive lock vypršel' 
      };
    }

    const remainingMs = this.lockUntil - now;
    return {
      isActive: true,
      remainingMs: remainingMs,
      remainingSeconds: Math.ceil(remainingMs / 1000),
      lockUntil: this.lockUntil,
      reason: `Invasive lock aktivní - zbývá ${Math.ceil(remainingMs / 1000)}s`
    };
  }

  /**
   * Vyčistí lock
   */
  clear() {
    this.lockUntil = null;
    Log.debug('[INVASIVE_LOCK]', 'Lock vymazán');
  }

  /**
   * Vrátí zda je lock aktivní (zkratka)
   * @returns {boolean}
   */
  isActive() {
    return this.check().isActive;
  }

  /**
   * Vrátí zbývající sekundy
   * @returns {number} 0 pokud není aktivní
   */
  getRemainingSeconds() {
    const status = this.check();
    return status.isActive ? status.remainingSeconds : 0;
  }
}