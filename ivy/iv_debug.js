/**
 * Název souboru: iv_debug.js
 * Umístění: ~/ivy/iv_debug.js
 *
 * Popis: Jednoduchý helper pro určení debug režimu podle větve v config.json
 *        main = debug mode ON, public = debug mode OFF
 */

import fs from 'fs';
import path from 'path';
import { Log } from './iv_log.class.js';

const CONFIG_PATH = path.resolve('./config.json');

export function isDebugMode() {
  try {
    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    const branch = config.branch || 'main';
    const debugMode = (branch === 'main');

    Log.info('[DEBUG]', `Větev: ${branch}, Debug režim: ${debugMode ? 'ZAPNUT' : 'VYPNUT'}`);
    return debugMode;
  } catch (err) {
    Log.error('[DEBUG]', `Chyba při čtení config.json: ${err.message}`);
    return true; // fallback na debug režim
  }
}

export function getDebugPause() {
  return isDebugMode() ? 60000 : 0; // 60 sekund pro main, 0 pro public
}
