/**
 * iv_display.js
 * Detekce dostupnosti grafického prostředí (X11 display).
 */

import fs from 'fs';

/**
 * Vrátí dostupný display string (např. ":20") nebo null.
 * Kontroluje DISPLAY env var i X11 sockety v /tmp/.X11-unix/
 * @returns {string|null}
 */
export function getAvailableDisplay() {
  // CRD (Chrome Remote Desktop) always uses :20
  const CRD_DISPLAY = ':20';
  try {
    const sockets = fs.readdirSync('/tmp/.X11-unix');
    if (sockets.includes('X20')) return CRD_DISPLAY;
  } catch {}
  return null;
}
