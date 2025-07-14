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
import { db, closeConnection as closeDB } from './iv_sql.js'
import { get as getVersion } from './iv_version.js';
import { tick as workerTick } from './iv_worker.js';
import { Log } from './libs/iv_log.class.js';
import { consoleLogger } from './libs/iv_console_logger.class.js';

const hostname = os.hostname();
const versionCode = getVersion();

// Initialize the console logger
consoleLogger.init();

let isShuttingDown = false;

Log.info('[IVY]', `Spouštím klienta na hostu: ${hostname}`);
Log.info('[IVY]', `Verze klienta: ${versionCode}`);
Log.info('[IVY]', `Session ID: ${consoleLogger.sessionId}`);


// Záznam do systémového logu o spuštění
try {
  const queryBuilder = await import('./libs/iv_querybuilder.class.js');
  const dbInstance = new queryBuilder.QueryBuilder();
  
  await dbInstance.logSystemEvent(
    'STARTUP',
    'INFO',
    `Ivy client started on ${hostname}`,
    { 
      version: versionCode,
      session_id: consoleLogger.sessionId,
      node_version: process.version,
      platform: process.platform,
      arch: process.arch
    }
  );
} catch (err) {
  Log.debug('[IVY]', `System log startup error: ${err.message}`);
}

(async () => {
  while (!isShuttingDown) {
    try {
      await db.heartBeat(0, 0, versionCode);
      const dbVersion = await db.getVersionCode();
      if (dbVersion.code !== versionCode) {
        Log.info(`[IVY] Rozdílná verze: DB=${dbVersion.code}, Lokálně=${versionCode}. Ukončuji.`);
        process.exit(1);
      }
      await workerTick();
    } catch (err) {
      await Log.error('[IVY]', err);
      await delay(60000);
    }
  }
})();

// Graceful shutdown handler
async function gracefulShutdown(signal) {
  if (isShuttingDown) return; // Pokud již probíhá, nic nedělej
  isShuttingDown = true;

  Log.info(`[IVY] Proces ukončen signálem ${signal} - spouštím graceful shutdown...`);
  
  try {
    // Importuj worker pro přístup k browser shutdown
    const worker = await import('./iv_worker.js');
    
    // Zavři všechny aktivní browser instances
    await worker.shutdownAllBrowsers();
    
    // Flush pending logs before exit
    await consoleLogger.flush();
    
    // Záznam do systémového logu o ukončení - PŘED zavřením DB
    try {
      const logResult = await db.logSystemEvent(
        'SHUTDOWN',
        'INFO',
        `Ivy client shutting down on ${hostname} (signal: ${signal})`,
        { 
          signal: signal,
          version: versionCode,
          session_id: consoleLogger.sessionId,
          shutdown_type: 'graceful'
        }
      );
      
      if (logResult) {
        Log.debug('[IVY]', 'Shutdown event successfully logged to log_system');
      } else {
        Log.debug('[IVY]', 'Shutdown event logging returned false');
      }
      
    } catch (err) {
      Log.debug('[IVY]', `System log shutdown error: ${err.message}`);
    }
    
    // Zavři databázové spojení AŽ PO logování
    await closeDB();
    
    Log.info('[IVY] Graceful shutdown dokončen');
  } catch (err) {
    Log.error('[IVY]', `Chyba při graceful shutdown: ${err.message}`);
  }
  
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT')); // Ctrl+C
