/**
 * QueryBuilder mixin: Logging
 * Logování a audit - systemLog, logSystemEvent, getSystemLogs, etc.
 */

import os from 'node:os';

const hostname = os.hostname();

export const LoggingMixin = {

  async systemLog(title, text, data = {}) {
    return await this.safeExecute('logs.insertSystemLog', [
      hostname, title, text, JSON.stringify(data)
    ]);
  },

  /**
   * Vloží záznam do systémového logu
   */
  async logSystemEvent(eventType, eventLevel, message, details = null, userId = null, processId = null) {
    const host = os.hostname();

    return await this.safeExecute('system.insertSystemLog', [
      host,
      eventType,
      eventLevel,
      message,
      details ? JSON.stringify(details) : null,
      userId,
      processId || process.pid
    ]);
  },

  /**
   * Získá systémové logy pro aktuální hostname
   */
  async getSystemLogs(hours = 24, limit = 100) {
    const host = os.hostname();

    return await this.safeQueryAll('system.getSystemLogs', [host, hours, limit]);
  },

  /**
   * Získá všechny systémové logy ze všech hostnames
   */
  async getAllSystemLogs(hours = 24, limit = 100) {
    return await this.safeQueryAll('system.getAllSystemLogs', [hours, limit]);
  },

  /**
   * Získá statistiky systémového logu
   */
  async getSystemLogStats(hours = 24) {
    return await this.safeQueryAll('system.getSystemLogStats', [hours]);
  },

  /**
   * Vyčistí staré systémové logy
   */
  async cleanOldSystemLogs(days = 30) {
    return await this.safeExecute('system.cleanOldSystemLogs', [days]);
  }

};
