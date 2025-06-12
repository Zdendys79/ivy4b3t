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

let _debugMode = null;
let _debugLogged = false;

export function isDebugMode() {
  if (_debugMode === null) {
    try {
      const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
      const branch = config.branch || 'main';
      _debugMode = (branch === 'main');

      // Log pouze jednou při první detekci
      if (!_debugLogged) {
        Log.info('[DEBUG]', `Větev: ${branch}, Debug režim: ${_debugMode ? 'ZAPNUT' : 'VYPNUT'}`);
        _debugLogged = true;
      }
    } catch (err) {
      Log.error('[DEBUG]', `Chyba při čtení config.json: ${err.message}`);
      _debugMode = true; // fallback na debug režim
    }
  }
  return _debugMode;
}

export function resetDebugCache() {
  _debugMode = null;
  _debugLogged = false;
}

export function getDebugPause() {
  return isDebugMode() ? 60000 : 0; // 60 sekund pro main, 0 pro public
}
