/**
 * Název souboru: hostname_block_handler.js
 * Umístění: ~/ivy/hostname_block_handler.js
 *
 * Popis: Handler pro blokování hostname při detekci account ban
 * Implementuje ochranu proti lavině banů
 */

import os from 'node:os';
import { db } from './iv_sql.js';
import { Log } from './libs/iv_log.class.js';

/**
 * Zpracuje nově detekovaný zablokovaný účet a zablokuje hostname
 * @param {Object} user - Uživatelské data
 * @param {string} lockReason - Důvod zablokování
 * @param {string} lockType - Typ zablokování
 * @returns {Promise<void>}
 */
export async function handleNewAccountBlock(user, lockReason, lockType) {
  const hostname = os.hostname();
  
  try {
    // 1. Zablokovat účet v databázi (už se děje v volajícím kódu)
    // await db.lockAccountWithReason(user.id, lockReason, lockType, hostname);
    
    // 2. Zalogovat do action_log
    await db.logAction(user.id, 'account_blocked', lockType, lockReason);
    
    // 3. Zalogovat do systémového logu
    await db.logSystemEvent(
      'ACCOUNT_SECURITY',
      'ERROR',
      `Account ${user.id} (${user.name} ${user.surname}) has been blocked by Facebook`,
      {
        user_id: user.id,
        hostname: hostname,
        lock_reason: lockReason,
        lock_type: lockType,
        detection_time: new Date().toISOString()
      }
    );
    
    // 4. Zablokovat hostname na 40-60 minut
    const blockMinutes = 40 + Math.random() * 20; // 40-60 minut
    await db.blockHostname(
      hostname,
      user.id,
      `Account ban detected for user ${user.id}: ${lockReason}`,
      blockMinutes
    );
    
    // 5. Další systémový log pro hostname blokaci
    await db.logSystemEvent(
      'HOSTNAME_PROTECTION',
      'WARN',
      `Hostname ${hostname} blocked for ${Math.round(blockMinutes)} minutes due to account ban`,
      {
        blocked_user_id: user.id,
        block_duration_minutes: blockMinutes,
        blocked_until: new Date(Date.now() + blockMinutes * 60 * 1000).toISOString()
      }
    );
    
    await Log.error(`[${user.id}]`, `ACCOUNT BLOCKED: ${lockReason}`);
    await Log.error('[WORKER]', `HOSTNAME ${hostname} BLOCKED for ${Math.round(blockMinutes)} minutes`);
    await Log.error('[WORKER]', `NO MORE ACCOUNTS from this VM until ${new Date(Date.now() + blockMinutes * 60 * 1000).toLocaleString()}`);
    
  } catch (err) {
    await Log.error('[HOSTNAME_BLOCK]', `Error handling account block: ${err.message}`);
    // I při chybě v handleru je důležité, aby byl původní účet zablokován
  }
}

/**
 * Detekuje, zda byl účet nově zablokován na základě analýzy
 * @param {Object} fbBot - FBBot instance
 * @param {Object} user - Uživatelské data
 * @returns {Promise<Object|null>} - Objekt s detaily blokace nebo null
 */
export async function detectAccountBlock(fbBot, user) {
  try {
    if (!fbBot || !fbBot.isAccountLocked) {
      return null;
    }
    
    const lockResult = await fbBot.isAccountLocked();
    
    if (lockResult && lockResult !== false) {
      // Účet je zablokován
      if (typeof lockResult === 'string') {
        // Starý formát
        return {
          locked: true,
          reason: lockResult, type: 'UNKNOWN',
          severity: 'critical'
        };
      }
      
      if (typeof lockResult === 'object' && lockResult.locked) {
        // Nový formát
        return {
          locked: true,
          reason: lockResult.reason || 'Account locked', type: lockResult.type || 'UNKNOWN',
          severity: lockResult.severity || 'critical'
        };
      }
    }
    
    return null;
    
  } catch (err) {
    await Log.error(`[${user.id}] detectAccountBlock`, err);
    return null;
  }
}

/**
 * Zkontroluje, zda není hostname zablokován před jakoukoliv akcí
 * @param {string} hostname - Hostname k ověření
 * @returns {Promise<Object|null>} - Objekt s detaily blokace nebo null
 */
export async function checkHostnameBlock(hostname) {
  try {
    const block = await db.isHostnameBlocked(hostname);
    return block;
  } catch (err) {
    await Log.error('[HOSTNAME_BLOCK]', `Error checking hostname block: ${err.message}`);
    return null;
  }
}