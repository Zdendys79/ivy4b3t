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
import { Wait } from './libs/iv_wait.class.js';
import { db, closeConnection as closeDB } from './iv_sql.js'
import { get as getVersion } from './iv_version.js';
import { tick as workerTick } from './iv_worker.js';
import { Log } from './libs/iv_log.class.js';
import { consoleLogger } from './libs/iv_console_logger.class.js';
import { initIvyConfig } from './libs/iv_config.class.js';

const hostname = os.hostname();
const versionCode = getVersion();

// Globální proměnné systému
global.systemState = {
  currentUserId: null,
  currentAction: null,
  actionStartTime: null,
  restart_needed: false
};
global.isTestBranch = (process.env.IVY_GIT_BRANCH === 'main');
global.uiCommandCache = null;

// Initialize the console logger
consoleLogger.init();

// Initialize the global configuration
initIvyConfig();
Log.info('[IVY]', 'Globální konfigurace inicializována');

let isShuttingDown = false;
let heartbeatInterval = null;

Log.info('[IVY]', `Spouštím klienta na hostu: ${hostname}`);
Log.info('[IVY]', `Verze klienta: ${versionCode}`);
Log.info('[IVY]', `Git branch: ${process.env.IVY_GIT_BRANCH}`);
Log.info('[IVY]', `Session ID: ${consoleLogger.sessionId}`);


// Záznam do systémového logu o spuštění
const { SystemLogger } = await import('./libs/iv_system_logger.class.js');
await SystemLogger.logStartup(hostname, versionCode, process.env.IVY_GIT_BRANCH, consoleLogger.sessionId);

// Asynchronní heartbeat funkce
async function backgroundHeartbeat() {
  try {
    const result = await db.heartBeatExtended({
      hostname: hostname,
      version: versionCode,
      userId: global.systemState.currentUserId,
      action: global.systemState.currentAction,
      actionStartedAt: global.systemState.actionStartTime
    });
    
    // Cache UI příkaz z odpovědi
    global.uiCommandCache = result?.uiCommand || null;
    
    // Kontrola verze - pokud se liší, nastavit restart_needed
    if (result?.dbVersion && result.dbVersion !== versionCode) {
      Log.info(`[HEARTBEAT]`, `Rozdílná verze: DB=${result.dbVersion}, Lokálně=${versionCode}. Nastavuji restart_needed.`);
      global.systemState.restart_needed = true;
    }
    
  } catch (err) {
    Log.debug('[HEARTBEAT]', `Background heartbeat error: ${err.message}`);
  }
}

// Spustit heartbeat interval
heartbeatInterval = setInterval(backgroundHeartbeat, config.getHeartbeatIntervalSeconds() * 1000);
Log.info('[IVY]', `Asynchronní heartbeat spuštěn (interval ${config.getHeartbeatIntervalSeconds()}s)`);

(async () => {
  while (!isShuttingDown) {
    try {
      // Kontrola restart_needed z heartbeat
      if (global.systemState.restart_needed) {
        Log.info(`[IVY] Heartbeat detekoval změnu verze. Ukončuji.`);
        process.exit(1);
      }
      
      await workerTick();
      await Wait.toSeconds(1, 'Malá pauza pro CPU');
    } catch (err) {
      await Log.error('[IVY]', err);
      await Wait.toMinutes(1, 'Čekání na další heartbeat');
    }
  }
})();

// Graceful shutdown handler
async function gracefulShutdown(signal) {
  if (isShuttingDown) return; // Pokud již probíhá, nic nedělej
  isShuttingDown = true;

  Log.info(`[IVY] Proces ukončen signálem ${signal} - spouštím graceful shutdown...`);
  
  try {
    // Zastavit heartbeat interval
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      
      // Poslední heartbeat s vyčištěným stavem
      await db.heartBeatExtended({
        hostname: hostname,
        version: versionCode,
        userId: null,
        action: null,
        actionStartedAt: null
      });
      
      Log.info('[IVY]', 'Heartbeat ukončen a stav vyčištěn');
    }
    
    // Importuj worker pro přístup k browser shutdown
    const worker = await import('./iv_worker.js');
    
    // Zavři všechny aktivní browser instances
    await worker.shutdownAllBrowsers();
    
    // Flush pending logs before exit
    await consoleLogger.flush();
    
    // Záznam do systémového logu o ukončení - PŘED zavřením DB
    const { SystemLogger } = await import('./libs/iv_system_logger.class.js');
    await SystemLogger.logShutdown(hostname, versionCode, process.env.IVY_GIT_BRANCH, consoleLogger.sessionId, signal);
    
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
