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
  if (process.env.DISPLAY) return process.env.DISPLAY;
  try {
    const sockets = fs.readdirSync('/tmp/.X11-unix')
      .filter(f => /^X\d+$/.test(f))
      .map(f => ({ name: f, num: parseInt(f.slice(1), 10) }))
      .sort((a, b) => b.num - a.num); // Prefer highest display number (CRD = X20)
    if (sockets.length > 0) return `:${sockets[0].num}`;
  } catch {}
  return null;
}
