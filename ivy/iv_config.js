/**
 * iv_config.js
 * 
 * Centrální správa konfigurace načítané z databáze.
 * Načte všechny proměnné najednou a poskytuje je ostatním modulům.
 */

import { db } from './iv_sql.js';
import { Log } from './libs/iv_log.class.js';

let configCache = null;

/**
 * Načte nebo znovu načte všechny konfigurační proměnné z databáze.
 */
async function loadConfig() {
  try {
    const results = await db.safeQueryAll('system.getAllVariables');
    const newConfig = {};
    for (const row of results) {
      try {
        // Pokusí se parsovat JSON, pokud selže, použije se jako string
        newConfig[row.name] = JSON.parse(row.value);
      } catch (e) {
        newConfig[row.name] = row.value;
      }
    }
    configCache = newConfig;
    Log.info('[CONFIG]', `Konfigurace úspěšně načtena. Počet klíčů: ${Object.keys(configCache).length}`);
    return configCache;
  } catch (error) {
    await Log.error('[CONFIG]', `Chyba při načítání konfigurace z DB: ${error.message}`);
    // V případě chyby vrátí prázdný objekt, aby aplikace nespadla
    return {};
  }
}

/**
 * Vrátí hodnotu konfiguračního klíče. Pokud konfigurace není načtena, nejprve ji načte.
 * @param {string} key - Název konfiguračního klíče (např. 'cfg_debug_mode')
 * @param {*} defaultValue - Výchozí hodnota, pokud klíč není nalezen.
 * @returns {*} Hodnota klíče nebo výchozí hodnota.
 */
export async function getConfig(key, defaultValue = null) {
  if (configCache === null) {
    await loadConfig();
  }
  return configCache[key] ?? defaultValue;
}

/**
 * Vrátí celý objekt s konfigurací.
 * @returns {object} Celý konfigurační objekt.
 */
export async function getAllConfig() {
  if (configCache === null) {
    await loadConfig();
  }
  return configCache;
}

// Prvotní načtení při startu aplikace
loadConfig();
