/**
 * Název souboru: iv_version.js
 * Umístění: ~/ivy/iv_version.js
 *
 * Popis: Načítá aktuální verzi klienta z package.json.
 *         Používá se při ověřování, zda je spuštěna správná verze.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function get() {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json')));
  return pkg.versionCode || '000';
}