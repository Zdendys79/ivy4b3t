/**
 * Název souboru: iv_system_logger.class.js
 * Umístění: ~/ivy/libs/iv_system_logger.class.js
 *
 * Popis: Utility pro system log události - startup, shutdown, atd.
 * Centralizuje duplicitní kód pro logování system událostí.
 */

import { Log } from './iv_log.class.js';
import { db } from '../iv_sql.js';

export class SystemLogger {
  /**
   * Loguje system událost do databáze
   * @param {string} eventType - Typ události (STARTUP, SHUTDOWN, atd.)
   * @param {string} level - Level (INFO, WARN, ERROR)
   * @param {string} message - Zpráva
   * @param {Object} metadata - Dodatečná metadata
   * @param {string} hostname - Hostname
   * @param {string} versionCode - Verze klienta
   * @param {string} gitBranch - Git branch
   * @param {string} sessionId - Session ID
   * @returns {Promise<boolean>} true pokud úspěšné
   */
  static async logEvent(eventType, level, message, metadata, hostname, versionCode, gitBranch, sessionId) {
    try {
      const queryBuilder = await import('./iv_querybuilder.class.js');
      const dbInstance = new queryBuilder.QueryBuilder();
      
      const eventData = {
        version: versionCode,
        git_branch: gitBranch,
        session_id: sessionId,
        ...metadata
      };
      
      const result = await dbInstance.logSystemEvent(
        eventType,
        level,
        message,
        eventData
      );
      
      if (result) {
        Log.debug('[SYSTEM_LOGGER]', `${eventType} event successfully logged to log_system`);
        return true;
      } else {
        Log.debug('[SYSTEM_LOGGER]', `${eventType} event logging returned false`);
        return false;
      }
      
    } catch (err) {
      Log.debug('[SYSTEM_LOGGER]', `${eventType} event logging error: ${err.message}`);
      return false;
    }
  }

  /**
   * Loguje STARTUP událost
   * @param {string} hostname - Hostname
   * @param {string} versionCode - Verze klienta
   * @param {string} gitBranch - Git branch
   * @param {string} sessionId - Session ID
   * @returns {Promise<boolean>}
   */
  static async logStartup(hostname, versionCode, gitBranch, sessionId) {
    return this.logEvent(
      'STARTUP',
      'INFO',
      `Ivy client started on ${hostname}`,
      {
        node_version: process.version,
        platform: process.platform,
        arch: process.arch
      },
      hostname,
      versionCode,
      gitBranch,
      sessionId
    );
  }

  /**
   * Loguje SHUTDOWN událost
   * @param {string} hostname - Hostname
   * @param {string} versionCode - Verze klienta
   * @param {string} gitBranch - Git branch
   * @param {string} sessionId - Session ID
   * @param {string} signal - Signal který způsobil shutdown
   * @returns {Promise<boolean>}
   */
  static async logShutdown(hostname, versionCode, gitBranch, sessionId, signal) {
    return this.logEvent(
      'SHUTDOWN',
      'INFO',
      `Ivy client shutting down on ${hostname} (signal: ${signal})`,
      {
        signal: signal,
        shutdown_type: 'graceful'
      },
      hostname,
      versionCode,
      gitBranch,
      sessionId
    );
  }
}