/**
 * Název souboru: iv_config.class.js
 * Umístění: ~/ivy/libs/iv_config.class.js
 *
 * Popis: Globální konfigurace pro celý IVY4B3T systém s podporou DB variables
 * - Načítání systémových proměnných při startu
 * - Lazy loading dodatečných proměnných z DB
 * - Centralizované konstanty a nastavení pro všechny moduly
 * - Použitelné v Worker, Wheel, Actions, UI, atd.
 */

import os from 'node:os';
import { db } from '../iv_sql.js';
import { Log } from './iv_log.class.js';

// Výchozí hodnoty konfigurace
const DEFAULT_CONFIG = {
  // Worker konfigurace
  heartbeat_interval_s: 30,
  wait_min_minutes: 1.2,   // 1.2 minuty
  wait_max_minutes: 2.0,   // 2 minuty
  consecutive_failures_limit: 5,
  
  // UI konfigurace
  ui_timeout_minutes: 20,
  ui_wait_timeout_minutes: 20,
  
  // Browser konfigurace
  browser_close_to_s: 30,
  browser_launch_to_s: 30,
  
  // Systémové timeouty
  shutdown_timeout_s: 10,
  
  // Wheel konfigurace
  invasive_lock_default_minutes: 30,
  wheel_delay_min_s: 2,
  wheel_delay_max_s: 5,
  
  // Actions konfigurace
  action_timeout_minutes: 10,
  fb_page_load_to_s: 15,
  utio_page_load_to_s: 30,
  
  // Logging konfigurace
  log_level: 'info',
  log_max_entries: 1000,
  
  // Human behavior
  typing_mistakes_chance: 0.07,
  hesitation_chance: 0.3,
  reading_time_min_s: 2,
  reading_time_max_s: 5
};

export class IvyConfig {
  constructor() {
    // Systémové konstanty
    this.isLinux = process.platform === 'linux';
    this.debugKeepBrowserOpen = process.env.DEBUG_KEEP_BROWSER_OPEN === 'true';
    
    // Cache - inicializovaná s default hodnotami
    this.cache = { ...DEFAULT_CONFIG };
    
    // Throttling pro DB update
    this.lastUpdateTime = 0;
    this.updateIntervalSeconds = 60; // 1 minuta
    this.pendingUpdate = false;
  }

  /**
   * Inicializuje konfiguraci - spustí první update z DB
   * @returns {void} Neblokuje, používá defaults dokud se nenačte DB
   */
  init() {
    // Spustí první update ihned (bez throttlingu)
    this.pendingUpdate = true;
    this.lastUpdateTime = Date.now();
    
    this._loadFromDatabase()
      .then(() => {
        this.pendingUpdate = false;
      })
      .catch(async err => {
        this.pendingUpdate = false;
        await Log.error('[IVY_CONFIG]', `Inicializace selhala: ${err.message}`);
      });
  }

  /**
   * Získá hodnotu proměnné (synchronně z cache)
   * @param {string} name - Název proměnné
   * @param {any} defaultValue - Výchozí hodnota
   * @returns {any} Hodnota proměnné
   */
  get(name, defaultValue = null) {
    // Spustí update na pozadí (throttled)
    this._scheduleUpdate();
    
    // Vrať hodnotu z cache
    if (this.cache.hasOwnProperty(name)) {
      return this.cache[name];
    }
    
    // Vrať poskytnutou výchozí hodnotu
    return defaultValue;
  }

  /**
   * Nastaví hodnotu proměnné (do cache i DB)
   * @param {string} name - Název proměnné
   * @param {any} value - Hodnota
   * @param {string} type - Typ (string, number, boolean, json)
   * @returns {Promise<boolean>} True pokud byla hodnota nastavena
   */
  async set(name, value, type = 'string') {
    try {
      // Ulož do DB
      const dbValue = this._serializeValue(value, type);
      await db.safeQuery('system.setVariable', [name, dbValue, type]);
      
      // Ulož do cache
      this.cache[name] = value;
      
      Log.debug('[IVY_CONFIG]', `Proměnná ${name} nastavena na: ${value}`);
      return true;
    } catch (err) {
      await Log.error('[IVY_CONFIG]', `Chyba při nastavování proměnné ${name}: ${err.message}`);
      return false;
    }
  }

  /**
   * Rychlý přístup k často používaným hodnotám
   */
  
  // Worker konfigurace
  getHeartbeatIntervalSeconds() {
    return this.cache.heartbeat_interval_s;
  }

  getWaitMinutes() {
    return {
      min: this.cache.wait_min_minutes,
      max: this.cache.wait_max_minutes
    };
  }

  getConsecutiveFailuresLimit() {
    return this.cache.consecutive_failures_limit;
  }

  // UI konfigurace
  getUITimeoutMinutes() {
    return this.cache.ui_timeout_minutes;
  }

  getUIWaitTimeoutMinutes() {
    return this.cache.ui_wait_timeout_minutes;
  }

  // Browser konfigurace
  getBrowserCloseTimeoutSeconds() {
    return this.cache.browser_close_to_s;
  }

  getBrowserLaunchTimeoutSeconds() {
    return this.cache.browser_launch_to_s;
  }

  // Systémové timeouty
  getShutdownTimeoutSeconds() {
    return this.cache.shutdown_timeout_s;
  }

  // Wheel konfigurace
  getInvasiveLockDefaultMinutes() {
    return this.cache.invasive_lock_default_minutes;
  }

  getWheelActionDelaySeconds() {
    return {
      min: this.cache.wheel_delay_min_s,
      max: this.cache.wheel_delay_max_s
    };
  }

  // Actions konfigurace
  getActionTimeoutMinutes() {
    return this.cache.action_timeout_minutes;
  }

  getFBPageLoadTimeout() {
    return this.cache.fb_page_load_timeout;
  }

  getUtioPageLoadTimeout() {
    return this.cache.utio_page_load_timeout;
  }

  // Logging konfigurace
  getLogLevel() {
    return this.cache.log_level;
  }

  getLogMaxEntries() {
    return this.cache.log_max_entries;
  }

  // Human behavior
  getHumanBehavior() {
    return {
      typing_mistakes_chance: this.cache.typing_mistakes_chance,
      hesitation_chance: this.cache.hesitation_chance,
      reading_time_min: this.cache.reading_time_min,
      reading_time_max: this.cache.reading_time_max
    };
  }

  // ==========================================
  // GETTER PROPERTIES pro přímý přístup
  // ==========================================
  
  // Často používané hodnoty jako properties
  get hesitation_chance() {
    return this.cache.hesitation_chance;
  }
  
  get typing_mistakes_chance() {
    return this.cache.typing_mistakes_chance;
  }
  
  get reading_time_min() {
    return this.cache.reading_time_min;
  }
  
  get reading_time_max() {
    return this.cache.reading_time_max;
  }
  
  get heartbeat_interval() {
    return this.cache.heartbeat_interval;
  }
  
  get ui_timeout_minutes() {
    return this.cache.ui_timeout_minutes;
  }
  
  get consecutive_failures_limit() {
    return this.cache.consecutive_failures_limit;
  }
  
  get wait_min_minutes() {
    return this.cache.wait_min_minutes;
  }
  
  get wait_max_minutes() {
    return this.cache.wait_max_minutes;
  }

  /**
   * Reload konfigurace z databáze
   * @returns {Promise<boolean>}
   */
  async reload() {
    // Resetuje cache na defaults a spustí update
    this.cache = { ...DEFAULT_CONFIG };
    
    this.lastUpdateTime = 0;
    this.pendingUpdate = false;
    
    return await this._scheduleUpdate();
  }

  /**
   * Vrátí všechny načtené proměnné
   * @returns {Object}
   */
  getAllVariables() {
    return { ...this.cache };
  }

  /**
   * Vymaže cache proměnných (resetuje na defaults)
   */
  clearCache() {
    this.cache = { ...DEFAULT_CONFIG };
  }

  // ==========================================
  // PRIVATE METODY
  // ==========================================

  /**
   * Naplánuje throttlovaný update z databáze
   * @returns {Promise<boolean>} True pokud byl update spuštěn
   */
  async _scheduleUpdate() {
    const now = Date.now();
    
    // Zkontroluj throttling
    if (this.pendingUpdate || (now - this.lastUpdateTime) < this.updateInterval) {
      return false;
    }
    
    this.pendingUpdate = true;
    this.lastUpdateTime = now;
    
    // Spusť update na pozadí
    this._loadFromDatabase()
      .then(() => {
        this.pendingUpdate = false;
        Log.debug('[IVY_CONFIG]', 'Background update dokončen');
      })
      .catch(async err => {
        this.pendingUpdate = false;
        await Log.error('[IVY_CONFIG]', `Background update selhal: ${err.message}`);
      });
    
    return true;
  }

  /**
   * Asynchronní načtení z databáze
   * @returns {Promise<void>}
   */
  async _loadFromDatabase() {
    Log.debug('[IVY_CONFIG]', 'Načítám globální konfiguraci z databáze...');
    
    // Načti všechny proměnné z variables tabulky
    const variables = await db.safeQueryAll('system.getAllVariables');
    
    if (variables && variables.length > 0) {
      for (const variable of variables) {
        this.cache[variable.name] = await this._parseValue(variable.value, variable.type);
      }
      
    } else {
      Log.info('[IVY_CONFIG]', 'Žádné proměnné v databázi nenalezeny');
    }
  }

  /**
   * Parsuje hodnotu podle typu
   * @param {string} value - Hodnota z DB
   * @param {string} type - Typ
   * @returns {any} Parsovaná hodnota
   */
  async _parseValue(value, type) {
    switch (type) {
      case 'number':
        const numValue = parseFloat(value);
        if (isNaN(numValue)) {
          await Log.warn('[IVY_CONFIG]', `Neplatná číselná hodnota: ${value}, používám 0`);
          return 0;
        }
        return numValue;
      case 'boolean':
        return value === 'true' || value === '1';
      case 'json':
        try {
          return JSON.parse(value);
        } catch (e) {
          await Log.warn('[IVY_CONFIG]', `Neplatný JSON: ${value}, používám původní string`);
          return value;
        }
      default:
        return value;
    }
  }

  /**
   * Serializuje hodnotu pro DB
   * @param {any} value - Hodnota
   * @param {string} type - Typ
   * @returns {string} Serializovaná hodnota
   */
  _serializeValue(value, type) {
    switch (type) {
      case 'number':
        return value.toString();
      case 'boolean':
        return value ? 'true' : 'false';
      case 'json':
        return JSON.stringify(value);
      default:
        return value.toString();
    }
  }
}

// Singleton instance
let configInstance = null;

/**
 * Získá singleton instanci IvyConfig
 * @returns {IvyConfig}
 */
export function getIvyConfig() {
  if (!configInstance) {
    configInstance = new IvyConfig();
  }
  return configInstance;
}

/**
 * Inicializuje globální konfiguraci (asynchronně na pozadí)
 * @returns {void}
 */
export function initIvyConfig() {
  const config = getIvyConfig();
  config.init();
}

/**
 * Synchronní inicializace s možností čekání
 * @param {number} maxWaitMs - Maximální čekání v ms
 * @returns {Promise<boolean>}
 */
export async function initIvyConfigSync(maxWaitMs = 5000) {
  const config = getIvyConfig();
  return await config.initSync(maxWaitMs);
}

// Zpětná kompatibilita
export const getWorkerConfig = getIvyConfig;
export const initWorkerConfig = initIvyConfig;