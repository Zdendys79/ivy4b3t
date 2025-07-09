/**
 * ivy.js – hlavní řídící smyčka pro systém Ivy4B3T
 * Umístění: ~/ivy/ivy.js
 *
 * Úcel:
 * - periodické hlídání stavu klienta
 * - zapisuje heartBeat do DB
 * - kontroluje produkční verzi v databázi a ukončí se při nesouladu
 * - volá pracovní smyčku (iv_worker.tick)
 */

// Node.js API - default imports
import os from 'node:os';

// Local modules - named imports (UPDATED)
import { delay } from './iv_wait.js';
import { db } from './iv_sql.js'
import { get as getVersion } from './iv_version.js';
import { tick as workerTick } from './iv_worker.js';
import { Log } from './iv_log.class.js';
import { consoleLogger } from './iv_console_logger.class.js';

const hostname = os.hostname();
const versionCode = getVersion();

// Initialize the console logger
consoleLogger.init();

Log.info('[IVY]', `Spouštím klienta na hostu: ${hostname}`);
Log.info('[IVY]', `Verze klienta: ${versionCode}`);
Log.info('[IVY]', `Session ID: ${consoleLogger.sessionId}`);

(async () => {
  while (true) {
    try {
      await db.heartBeat(0, 0, versionCode);
      const dbVersion = await db.getVersionCode();
      if (dbVersion.code !== versionCode) {
        Log.info(`[IVY] Rozdílná verze: DB=${dbVersion.code}, Lokálně=${versionCode}. Ukončuji.`);
        process.exit(1);
      }
      await workerTick();
      await delay(60000);
    } catch (err) {
      await Log.error('[IVY]', err);
      await delay(60000);
    }
  }
})();

// Graceful shutdown handler
async function gracefulShutdown(signal) {
  Log.info(`[IVY] Proces ukončen signálem ${signal} - spouštím graceful shutdown...`);
  
  try {
    // Importuj worker pro přístup k browser shutdown
    const worker = await import('./iv_worker.js');
    
    // Zavři všechny aktivní browser instances
    await worker.shutdownAllBrowsers();
    
    // Flush pending logs before exit
    await consoleLogger.flush();
    
    Log.info('[IVY] Graceful shutdown dokončen');
  } catch (err) {
    Log.error('[IVY]', `Chyba při graceful shutdown: ${err.message}`);
  }
  
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT')); // Ctrl+C
