/**
 * Název souboru: iv_version.js
 * Umístění: ~/ivy/iv_version.js
 *
 * Popis: Načítá aktuální verzi klienta z package.json. Pokud se načtení nezdaří,
 *        vrací výchozí '000' a zapíše chybu do logu.
 */

import fs from 'fs';
import path from 'path';

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function get() {
  try {
    const pkgPath = path.join(__dirname, 'package.json');
    const pkgData = fs.readFileSync(pkgPath, 'utf-8');
    const pkg = JSON.parse(pkgData);
    return pkg.versionCode || '000';
  } catch (err) {
    console.error(`Chyba při načítání package.json: ${err.message}`);
    return '000';
  }
}
