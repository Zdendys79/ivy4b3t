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
import { db, closeConnection as closeDB, initializeDatabase } from './iv_sql.js'
import { get as getVersion } from './iv_version.js';
import { tick as workerTick } from './iv_worker.js';
import { Log } from './libs/iv_log.class.js';
import { consoleLogger } from './libs/iv_console_logger.class.js';
import { initIvyConfig, getIvyConfig } from './libs/iv_config.class.js';
// RSS scheduler odstraněn - bude spouštěn Ubuntu plánovačem

const hostname = os.hostname();
const versionCode = getVersion();
const config = getIvyConfig();

// Globální proměnné systému
global.systemState = {
  currentUserId: null,
  currentAction: null,
  actionStartTime: null,
  restart_needed: false
};
// VÝJIMKA Z PRAVIDLA: Tento fallback je povolen pro testování bez start.sh
// Při přímém spuštění (node ivy.js) není IVY_GIT_BRANCH nastavena
// V produkci je vždy nastavena přes start.sh/main-start.sh
async function initializeGitBranch() {
  if (!process.env.IVY_GIT_BRANCH) {
    try {
      const { execSync } = await import('child_process');
      const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
      process.env.IVY_GIT_BRANCH = branch;
    } catch (err) {
      await Log.warn('[IVY]', `Nelze zjistit Git branch: ${err.message}. Používám fallback: main`);
      process.env.IVY_GIT_BRANCH = 'main';
    }
  }
  global.isTestBranch = (process.env.IVY_GIT_BRANCH === 'main');
}

// Spustit inicializaci a počkat na dokončení
await initializeGitBranch();
global.uiCommandCache = null;

// Initialize the console logger
consoleLogger.init();

// Initialize the global configuration
initIvyConfig();

let isShuttingDown = false;
let heartbeatInterval = null;

Log.info('[IVY]', `Spouštím klienta na hostu: ${hostname}`);
Log.info('[IVY]', `Verze klienta: ${versionCode} (ze souboru package.json)`);
Log.info('[IVY]', `Git branch: ${process.env.IVY_GIT_BRANCH}${global.isTestBranch ? ' (testing)' : ''}`);
Log.info('[IVY]', `Session ID: ${consoleLogger.sessionId}`);


// Inicializace databáze s retry logikou
const dbInitialized = await initializeDatabase();
if (!dbInitialized) {
  await Log.error('[IVY]', 'Database initialization failed after all retries - exiting with code 2');
  process.exit(2);
}

// Záznam do systémového logu o spuštění
const { SystemLogger } = await import('./libs/iv_system_logger.class.js');
await SystemLogger.logStartup(hostname, versionCode, process.env.IVY_GIT_BRANCH, consoleLogger.sessionId);

// Funkce pro získání systémových verzí
async function getSystemVersions() {
  try {
    const { execSync } = await import('child_process');
    
    // Získat verze systému
    const ubuntuVersion = execSync('lsb_release -rs 2>/dev/null || echo "unknown"', { encoding: 'utf8' }).trim();
    const nodeVersion = process.version;
    
    let npmVersion = 'unknown';
    try {
      npmVersion = execSync('npm --version 2>/dev/null', { encoding: 'utf8' }).trim();
    } catch {}
    
    let syncthingVersion = 'unknown';
    try {
      const syncthingOutput = execSync('syncthing version 2>/dev/null', { encoding: 'utf8' });
      const match = syncthingOutput.match(/syncthing\s+(v[\d.]+)/);
      syncthingVersion = match ? match[1] : 'unknown';
    } catch {}
    
    let chromeRdVersion = 'unknown';
    try {
      chromeRdVersion = execSync('dpkg -l | grep chrome-remote-desktop | awk \'{print $3}\' 2>/dev/null || echo "unknown"', { encoding: 'utf8' }).trim();
    } catch {}
    
    // Zjistit čas posledního APT upgrade
    let lastSystemUpdate = 'unknown';
    try {
      // Pokus o načtení z apt history
      const aptHistory = execSync('grep -E "Start-Date.*upgrade" /var/log/apt/history.log 2>/dev/null | tail -1', { encoding: 'utf8' }).trim();
      if (aptHistory) {
        const match = aptHistory.match(/Start-Date: (.+)/);
        if (match) {
          lastSystemUpdate = new Date(match[1]).toISOString();
        }
      } else {
        // Fallback - čas modifikace dpkg status souboru
        const dpkgStat = execSync('stat -c %Y /var/lib/dpkg/status 2>/dev/null', { encoding: 'utf8' }).trim();
        if (dpkgStat) {
          lastSystemUpdate = new Date(parseInt(dpkgStat) * 1000).toISOString();
        }
      }
    } catch {}
    
    return {
      ubuntu: ubuntuVersion,
      node: nodeVersion,
      npm: npmVersion,
      syncthing: syncthingVersion,
      chrome_remote_desktop: chromeRdVersion,
      last_system_update: lastSystemUpdate,
      collected_at: new Date().toISOString()
    };
  } catch (err) {
    Log.warn('[SYSTEM_VERSIONS]', `Chyba při získávání verzí: ${err.message}`);
    return null;
  }
}

// Globální proměnné pro systémové verze
let lastSystemVersionsUpdate = null;
let cachedSystemVersions = null;

// Asynchronní heartbeat funkce
async function backgroundHeartbeat() {
  try {
    // Kontrola zda je čas aktualizovat systémové verze (24h interval)
    const now = Date.now();
    let systemVersions = null;
    
    if (!lastSystemVersionsUpdate || (now - lastSystemVersionsUpdate) >= (24 * 60 * 60 * 1000)) {
      Log.info('[HEARTBEAT]', 'Získávám systémové verze...');
      systemVersions = await getSystemVersions();
      if (systemVersions) {
        cachedSystemVersions = systemVersions;
        lastSystemVersionsUpdate = now;
        Log.info('[HEARTBEAT]', `Systémové verze aktualizovány: ${JSON.stringify(systemVersions)}`);
      }
    }
    
    const result = await db.heartBeatExtended({
      hostname: hostname,
      version: versionCode,
      userId: global.systemState.currentUserId,
      action: global.systemState.currentAction,
      actionStartedAt: global.systemState.actionStartTime,
      systemVersions: systemVersions // Pošle jen když jsou aktualizovány
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

// CLI režim pro testování
async function runCLICommand() {
  const args = process.argv.slice(2);
  const userIndex = args.indexOf('--user');
  const actionIndex = args.indexOf('--action');
  
  if (userIndex === -1 || actionIndex === -1) {
    console.log('❌ Použití: node ivy.js --user <ID> --action <action_name>');
    console.log('Příklady:');
    console.log('  node ivy.js --user 999 --action quote_post');
    console.log('  node ivy.js --user 1 --action screenshot');
    process.exit(1);
  }
  
  const userId = parseInt(args[userIndex + 1]);
  const actionName = args[actionIndex + 1];
  
  if (!userId || !actionName) {
    console.log('❌ Neplatné parametry');
    process.exit(1);
  }
  
  Log.info('[CLI]', `Spouštím akci "${actionName}" pro uživatele ${userId}`);
  
  // Načíst uživatele z fb_users tabulky
  const user = await db.pool.execute('SELECT id, name, surname, host, fb_login FROM fb_users WHERE id = ?', [userId]).then(([rows]) => rows[0]);
  if (!user) {
    Log.error('[CLI]', `Uživatel ${userId} neexistuje`);
    process.exit(1);
  }
  
  // Kontrola hostname
  if (user.host && user.host !== hostname) {
    Log.error('[CLI]', `Uživatel ${userId} není povolen na hostname "${hostname}". Povolen: "${user.host}"`);
    process.exit(1);
  }
  
  Log.info('[CLI]', `Uživatel: ${user.name} ${user.surname} | FB: ${user.fb_login} (${user.id})`);
  Log.info('[CLI]', `Hostname: ${hostname} ✅`);
  
  // Načíst akci
  try {
    const actionModule = await import(`./actions/${actionName}.action.js`);
    const ActionClass = Object.values(actionModule)[0];
    const action = new ActionClass();
    
    // Zkontrolovat zda akce potřebuje browser/fbBot
    const requirements = action.getRequirements ? action.getRequirements() : {};
    
    let context = null;
    if (requirements.needsFB) {
      // Importovat worker pro browser management
      const worker = await import('./iv_worker.js');
      
      Log.info('[CLI]', `Akce "${actionName}" vyžaduje Facebook - spouštím browser na DISPLAY=:20`);
      
      // Vytvořit browser context pro uživatele
      context = await worker.createBrowserContext(user);
      if (!context) {
        throw new Error('Nelze vytvořit browser kontext pro uživatele');
      }
    }
    
    // Spustit akci
    global.systemState.currentUserId = user.id;
    global.systemState.currentAction = actionName;
    global.systemState.actionStartTime = new Date();
    
    await action.execute(user, context, null);
    
    Log.success('[CLI]', `Akce "${actionName}" dokončena!`);
    
  } catch (error) {
    Log.error('[CLI]', `Chyba při spouštění akce: ${error.message}`);
    process.exit(1);
  }
  
  // Vyčistit stav
  global.systemState.currentUserId = null;
  global.systemState.currentAction = null;
  global.systemState.actionStartTime = null;
  
  process.exit(0);
}

// Detekce CLI vs normální režim
const isCLIMode = process.argv.includes('--user') || process.argv.includes('--action');

if (isCLIMode) {
  // CLI režim
  runCLICommand().catch(async (error) => {
    await Log.error('[CLI]', `Kritická chyba: ${error.message}`);
    process.exit(1);
  });
} else {
  // Normální režim
  (async () => {
    // První heartbeat IHNED pro okamžité ohlášení - s verzemi systému
    Log.info('[IVY]', 'Spouštím první heartbeat s načtením systémových verzí...');
    lastSystemVersionsUpdate = 0; // Vynucení načtení verzí při prvním heartbeatu
    await backgroundHeartbeat();
    
    // Zobraz verzi z databáze po prvním heartbeatu (z tabulky variables)
    try {
      const dbVersionResult = await db.safeQueryFirst('system.getVersionCode');
      const dbVersionFromDb = dbVersionResult?.code || 'nenalezena';
    } catch (err) {
      Log.debug('[IVY]', `Chyba při načítání verze z DB: ${err.message}`);
    }
    
    // Spustit heartbeat interval
    heartbeatInterval = setInterval(backgroundHeartbeat, config.getHeartbeatIntervalSeconds() * 1000);
    Log.info('[IVY]', 'Heartbeat inicializován - první ohlášení dokončeno');

    // RSS scheduler je nyní samostatný proces na serveru

    while (!isShuttingDown) {
      try {
        // Kontrola restart_needed z heartbeat
        if (global.systemState.restart_needed) {
          Log.info(`[IVY] Heartbeat detekoval změnu verze. Ukončuji.`);
          process.exit(1);
        }
        
        await workerTick();
        await Wait.toSeconds(1);
      } catch (err) {
        await Log.error('[IVY]', err);
        await Wait.toMinutes(1, 'Čekání na další heartbeat');
      }
    }
  })();
}

// Graceful shutdown handler
async function gracefulShutdown(signal) {
  if (isShuttingDown) return; // Pokud již probíhá, nic nedělej
  isShuttingDown = true;

  Log.info(`[IVY] Proces ukončen signálem ${signal} - spouštím graceful shutdown...`);
  
  try {
    // RSS scheduler už není součástí robotů
    
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
    
    
    // Záznam do systémového logu o ukončení - PŘED zavřením DB
    const { SystemLogger } = await import('./libs/iv_system_logger.class.js');
    await SystemLogger.logShutdown(hostname, versionCode, process.env.IVY_GIT_BRANCH, consoleLogger.sessionId, signal);
    
    // Zavři databázové spojení AŽ PO logování
    await closeDB();
    
    Log.info('[IVY] Graceful shutdown dokončen');
  } catch (err) {
    await Log.error('[IVY]', `Chyba při graceful shutdown: ${err.message}`);
  }
  
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT')); // Ctrl+C
