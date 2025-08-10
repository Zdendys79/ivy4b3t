/**
 * Název souboru: user_group_escalation.js
 * Umístění: ~/ivy/user_group_escalation.js
 *
 * Popis: Escalation logika pro per-user group blocking
 * Implementuje postupné prodlužování blokace při opakovaných problémech
 */

import { db } from './iv_sql.js';
import { Log } from './libs/iv_log.class.js';

/**
 * Konfigurace escalation vzorce
 */
const ESCALATION_CONFIG = {
  baseDays: 5,        // Základní počet dní pro první problém
  maxDays: 180        // Maximum 6 měsíců
};

/**
 * Vypočítá délku blokace na základě počtu opakování
 * Používá exponenciální vzorec: baseDays * 2^(blockCount-1)
 * Omezeno na maximum 180 dní
 * 
 * @param {number} currentBlockCount - Aktuální počet blokací
 * @returns {number} - Počet dní blokace
 */
export function calculateBlockDuration(currentBlockCount) {
  const nextBlockCount = currentBlockCount + 1;
  
  // Exponenciální vzorec: 5 * 2^(n-1)
  const calculated = ESCALATION_CONFIG.baseDays * Math.pow(2, nextBlockCount - 1);
  
  // Omezení na maximum
  const finalDays = Math.min(calculated, ESCALATION_CONFIG.maxDays);
  
  return finalDays;
}

/**
 * Získá tabulku escalation pro zobrazení/debugging
 * @param {number} maxLevels - Počet úrovní k zobrazení
 * @returns {Array} - Tabulka s escalation úrovněmi
 */
export function getEscalationTable(maxLevels = 10) {
  const table = [];
  
  for (let i = 0; i < maxLevels; i++) {
    const days = calculateBlockDuration(i);
    table.push({
      problemNumber: i + 1,
      blockCount: i,
      days: days,
      duration: formatDuration(days)
    });
    
    // Zastav když dosáhneme maxima
    if (days >= ESCALATION_CONFIG.maxDays) break;
  }
  
  return table;
}

/**
 * Formátuje délku blokace do lidsky čitelného formátu
 * @param {number} days - Počet dní
 * @returns {string} - Formátovaný text
 */
function formatDuration(days) {
  if (days < 30) {
    return `${days} dní`;
  } else if (days < 180) {
    const months = Math.round(days / 30 * 10) / 10;
    return `${months} měsíců`;
  } else {
    return `6 měsíců (maximum)`;
  }
}

/**
 * Zablokuje skupinu pro uživatele s escalation logikou
 * @param {number} userId - ID uživatele
 * @param {number} groupId - ID skupiny
 * @param {string} reason - Důvod blokace
 * @returns {Promise<Object>} - Informace o blokaci
 */
export async function blockUserGroup(userId, groupId, reason) {
  try {
    // Získej aktuální počet blokací
    const currentCount = await db.safeQueryFirst('userGroupBlocking.getBlockCountForGroup', [userId, groupId]);
    const blockCount = currentCount ? currentCount.block_count : 0;
    
    // Vypočítej délku blokace
    const blockDays = calculateBlockDuration(blockCount);
    const blockedUntil = new Date(Date.now() + blockDays * 24 * 60 * 60 * 1000);
    const blockedUntilStr = blockedUntil.toISOString().slice(0, 19).replace('T', ' ');
    
    // Proveď blokaci
    const result = await db.safeExecute('userGroupBlocking.blockUserGroup', [
      blockedUntilStr,
      reason,
      userId,
      groupId
    ]);
    
    // Logování
    await Log.warn(`[${userId}]`, `Skupina ${groupId} zablokovana na ${blockDays} dni (${blockCount + 1}. problem)`);
    await Log.warn(`[${userId}]`, `Dostupna opet: ${blockedUntil.toISOString().substring(11, 19)} UTC`);
    
    // Systémový log
    await db.logSystemEvent(
      'USER_GROUP_BLOCKING',
      'WARN',
      `User ${userId} blocked from group ${groupId} for ${blockDays} days`,
      {
        user_id: userId,
        group_id: groupId,
        reason: reason,
        block_count: blockCount + 1,
        block_duration_days: blockDays,
        blocked_until: blockedUntil.toISOString()
      }
    );
    
    return {
      success: result,
      blockCount: blockCount + 1,
      blockDays: blockDays,
      blockedUntil: blockedUntil,
      reason: reason
    };
    
  } catch (err) {
    await Log.error(`[${userId}] blockUserGroup`, err);
    return { success: false, error: err.message };
  }
}

/**
 * Zkontroluje, zda je skupina zablokována pro uživatele
 * @param {number} userId - ID uživatele
 * @param {number} groupId - ID skupiny
 * @returns {Promise<Object|null>} - Informace o blokaci nebo null
 */
export async function checkUserGroupBlock(userId, groupId) {
  try {
    const block = await db.safeQueryFirst('userGroupBlocking.isUserGroupBlocked', [userId, groupId]);
    return block;
  } catch (err) {
    await Log.error(`[${userId}] checkUserGroupBlock`, err);
    return null;
  }
}

/**
 * Získá dostupné skupiny pro uživatele (respektuje per-user blocking)
 * @param {number} userId - ID uživatele
 * @param {string} groupType - Typ skupiny (G, GV, P)
 * @returns {Promise<Array>} - Seznam dostupných skupin
 */
export async function getAvailableGroupsForUser(userId, groupType) {
  try {
    const groups = await db.safeQueryAll('userGroupBlocking.getAvailableGroupsForUser', [userId, groupType]);
    
    Log.debug(`[${userId}]`, `Nalezeno ${groups.length} dostupných skupin typu ${groupType}`);
    
    return groups;
  } catch (err) {
    await Log.error(`[${userId}] getAvailableGroupsForUser`, err);
    return [];
  }
}

/**
 * Detekuje "Vaše žádost o členství se vyřizuje" a automaticky blokuje skupinu
 * @param {Object} user - Uživatelské data
 * @param {Object} group - Skupinové data
 * @param {string} pageContent - Obsah stránky nebo detekovaný text
 * @returns {Promise<boolean>} - True pokud byla detekována žádost o členství
 */
export async function detectMembershipRequest(user, group, pageContent) {
  const membershipIndicators = [
    'Vaše žádost o členství se vyřizuje',
    'Your membership request is being reviewed',
    'membership request',
    'žádost o členství',
    'pending approval',
    'čeká na schválení'
  ];
  
  const detected = membershipIndicators.some(indicator => 
    pageContent && pageContent.toLowerCase().includes(indicator.toLowerCase())
  );
  
  if (detected) {
    await Log.warn(`[${user.id}]`, `DETEKOVÁNA ŽÁDOST O ČLENSTVÍ ve skupině ${group.name}`);
    
    // Automaticky zablokuj skupinu pro tohoto uživatele
    const blockResult = await blockUserGroup(
      user.id, 
      group.id, 
      'Žádost o členství se vyřizuje - automatická detekce'
    );
    
    if (blockResult.success) {
      await Log.warn(`[${user.id}]`, `Skupina automaticky zablokovana na ${blockResult.blockDays} dni`);
    }
    
    return true;
  }
  
  return false;
}

/**
 * Vyčistí expired blokace (volat periodicky)
 * @returns {Promise<number>} - Počet vyčištěných blokací
 */
export async function cleanupExpiredBlocks() {
  try {
    const result = await db.safeExecute('userGroupBlocking.unblockExpiredUserGroups');
    Log.info('[CLEANUP]', `Vyčištěno ${result ? 'několik' : '0'} expired user-group blokací`);
    return result ? 1 : 0;
  } catch (err) {
    await Log.error('[CLEANUP] cleanupExpiredBlocks', err);
    return 0;
  }
}

/**
 * Zobrazí statistiky user-group blokací pro uživatele
 * @param {number} userId - ID uživatele
 * @returns {Promise<Object>} - Statistiky
 */
export async function getUserGroupStats(userId) {
  try {
    const stats = await db.safeQueryFirst('userGroupBlocking.getUserGroupBlockStats', [userId]);
    const activeBlocks = await db.safeQueryAll('userGroupBlocking.getActiveUserGroupBlocks', [10]);
    
    return {
      stats: stats || {},
      activeBlocks: activeBlocks || []
    };
  } catch (err) {
    await Log.error(`[${userId}] getUserGroupStats`, err);
    return { stats: {}, activeBlocks: [] };
  }
}