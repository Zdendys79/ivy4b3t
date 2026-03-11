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
    const sockets = fs.readdirSync('/tmp/.X11-unix');
    const socket = sockets.find(f => /^X\d+$/.test(f));
    if (socket) return `:${socket.slice(1)}`;
  } catch {}
  return null;
}
