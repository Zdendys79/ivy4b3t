/**
 * ivy.js – hlavní řídící smyčka pro systém Ivy4B3T
 * Umístění: ~/ivy/ivy.js
 *
 * Úcel:
 * - periodické hlídání stavu klienta
 * - zapisuje heartbeat do DB
 * - kontroluje produkční verzi v databázi a ukončí se při nesouladu
 * - volá pracovní smyčku (iv_worker.tick)
 */

import os from 'node:os';
import * as wait from './iv_wait.js';
import { db } from './iv_sql.js'
import * as version from './iv_version.js';
import * as worker from './iv_worker.js';
import { Log } from './iv_log.class.js';

const hostname = os.hostname();
const versionCode = version.get();

Log.info('[IVY]', `Spouštím klienta na hostu: ${hostname}`);
Log.info('[IVY]', `Verze klienta: ${versionCode}`);

(async () => {
  while (true) {
    try {
      await db.heartBeat(0, 0, versionCode);
      const dbVersion = await db.getVersionCode();
      if (dbVersion.code !== versionCode) {
        Log.info(`[IVY] Rozdílná verze: DB=${dbVersion.code}, Lokálně=${versionCode}. Ukončuji.`);
        process.exit(1);
      }
      await worker.tick();
      await wait.delay(60000);
    } catch (err) {
      Log.error('[IVY]', err);
      await wait.delay(60000);
    }
  }
})();

process.on('SIGTERM', () => {
  Log.info('[IVY] Proces ukončen signálem SIGTERM.');
  process.exit(0);
});
