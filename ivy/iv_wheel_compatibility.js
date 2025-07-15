/**
 * Název souboru: iv_wheel_compatibility.js
 * Umístění: ~/ivy/iv_wheel_compatibility.js
 *
 * Popis: Zpětná kompatibilita pro starý wheel
 * - Exportuje funkce pro kompatibilitu se starým kódem
 * - Deleguje na nové moduly
 */

import { ActionStats } from './libs/iv_action_stats.class.js';
import { InvasiveLock } from './libs/iv_invasive_lock.class.js';

// Singleton instance pro kompatibilitu
let compatibilityLock = null;
let actionStats = null;

/**
 * Inicializuje invasive lock (deprecated)
 */
export function initInvasiveLock() {
  if (!compatibilityLock) {
    compatibilityLock = new InvasiveLock();
  }
  compatibilityLock.init();
}

/**
 * Nastaví invasive lock (deprecated)
 */
export function setInvasiveLock(cooldownMs) {
  if (!compatibilityLock) {
    compatibilityLock = new InvasiveLock();
  }
  compatibilityLock.set(cooldownMs);
}

/**
 * Zkontroluje invasive lock (deprecated)
 */
export function hasInvasiveLock() {
  if (!compatibilityLock) {
    return { hasLock: false, reason: 'Žádný invasive lock' };
  }
  
  const status = compatibilityLock.check();
  return {
    hasLock: status.isActive,
    reason: status.reason,
    remainingMs: status.remainingMs || 0,
    remainingSeconds: status.remainingSeconds || 0,
    lockUntil: status.lockUntil || null
  };
}

/**
 * Vyčistí invasive lock (deprecated)
 */
export function clearInvasiveLock() {
  if (compatibilityLock) {
    compatibilityLock.clear();
  }
}

/**
 * Získá statistiky akcí (deprecated)
 */
export async function getActionStats(userId) {
  if (!actionStats) {
    actionStats = new ActionStats();
  }
  return await actionStats.getStats(userId);
}

/**
 * Kontroluje dostupné akce (deprecated)
 */
export async function hasAvailableActions(userId) {
  if (!actionStats) {
    actionStats = new ActionStats();
  }
  return await actionStats.hasAvailableActions(userId);
}

/**
 * Získá doporučení (deprecated)
 */
export async function getActionRecommendations(userId) {
  if (!actionStats) {
    actionStats = new ActionStats();
  }
  return await actionStats.getRecommendations(userId);
}