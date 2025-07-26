/**
 * Název souboru: iv_hostname_protection.class.js
 * Umístění: ~/ivy/libs/iv_hostname_protection.class.js
 *
 * Popis: Třída pro ochranu hostname proti lavině banů
 * - Kontrola zablokovaných hostname
 * - Logování událostí
 * - Správa timeout informací
 */

import os from 'node:os';

import { db } from '../iv_sql.js';
import { Log } from './iv_log.class.js';

export class HostnameProtection {
  constructor() {
    this.hostname = os.hostname();
  }

  /**
   * Zkontroluje, zda je hostname zablokován
   * @returns {Promise<boolean>} True pokud je hostname zablokován
   */
  async isBlocked() {
    try {
      const hostnameBlock = await db.isHostnameBlocked(this.hostname);
      
      if (hostnameBlock) {
        await this._logBlockedHostname(hostnameBlock);
        return true;
      }
      
      Log.debug('[HOSTNAME_PROTECTION]', `Hostname ${this.hostname} ochrana OK`);
      return false;
    } catch (err) {
      await Log.error('[HOSTNAME_PROTECTION]', `Chyba při kontrole hostname: ${err.message}`);
      // V případě chyby neblokujeme - lepší false positive než false negative
      return false;
    }
  }

  /**
   * Vrátí informace o blokaci hostname
   * @returns {Promise<Object|null>} Informace o blokaci nebo null
   */
  async getBlockInfo() {
    try {
      return await db.isHostnameBlocked(this.hostname);
    } catch (err) {
      await Log.error('[HOSTNAME_PROTECTION]', `Chyba při získávání info o blokaci: ${err.message}`);
      return null;
    }
  }

  /**
   * Zablokuje hostname
   * @param {Object} user - Uživatel, kvůli kterému se blokuje
   * @param {string} reason - Důvod blokace
   * @param {string} type - Typ blokace
   * @param {number} durationMinutes - Délka blokace v minutách
   * @returns {Promise<boolean>} True pokud byla blokace úspěšná
   */
  async blockHostname(user, reason, type, durationMinutes = 60) {
    try {
      const result = await db.blockHostname(this.hostname, user.id, reason, type, durationMinutes);
      
      if (result) {
        await Log.warn('[HOSTNAME_PROTECTION]', `Hostname ${this.hostname} zablokován na ${durationMinutes} minut`);
        await Log.warn('[HOSTNAME_PROTECTION]', `Důvod: ${reason} (${type})`);
        
        // Systémový log
        await db.logSystemEvent(
          'HOSTNAME_BLOCKED',
          'WARN',
          `Hostname ${this.hostname} blocked due to ${type}`,
          {
            user_id: user.id,
            reason: reason,
            type: type,
            duration_minutes: durationMinutes
          }
        );
        
        return true;
      }
      
      return false;
    } catch (err) {
      await Log.error('[HOSTNAME_PROTECTION]', `Chyba při blokování hostname: ${err.message}`);
      return false;
    }
  }

  /**
   * Odblokuje hostname
   * @returns {Promise<boolean>} True pokud bylo odblokovávání úspěšné
   */
  async unblockHostname() {
    try {
      const result = await db.unblockHostname(this.hostname);
      
      if (result) {
        Log.success('[HOSTNAME_PROTECTION]', `Hostname ${this.hostname} odblokován`);
        
        // Systémový log
        await db.logSystemEvent(
          'HOSTNAME_UNBLOCKED',
          'INFO',
          `Hostname ${this.hostname} manually unblocked`,
          { hostname: this.hostname }
        );
        
        return true;
      }
      
      return false;
    } catch (err) {
      await Log.error('[HOSTNAME_PROTECTION]', `Chyba při odblokování hostname: ${err.message}`);
      return false;
    }
  }

  // ==========================================
  // PRIVATE METODY
  // ==========================================

  /**
   * Loguje informace o zablokovaném hostname
   * @param {Object} hostnameBlock - Informace o blokaci
   * @returns {Promise<void>}
   */
  async _logBlockedHostname(hostnameBlock) {
    await Log.warn('[HOSTNAME_PROTECTION]', `Hostname ${this.hostname} je zablokován do ${hostnameBlock.blocked_until}`);
    await Log.warn('[HOSTNAME_PROTECTION]', `Důvod: ${hostnameBlock.blocked_reason}`);
    await Log.warn('[HOSTNAME_PROTECTION]', `Zbývá: ${hostnameBlock.remaining_minutes} minut`);
    
    // Systémový log
    await db.logSystemEvent(
      'HOSTNAME_PROTECTION_ACTIVE',
      'WARN',
      `Hostname ${this.hostname} is blocked - preventing account access`,
      {
        blocked_until: hostnameBlock.blocked_until,
        blocked_reason: hostnameBlock.blocked_reason,
        blocked_user_id: hostnameBlock.blocked_user_id,
        remaining_minutes: hostnameBlock.remaining_minutes
      }
    );
  }
}