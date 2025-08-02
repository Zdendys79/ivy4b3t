/**
 * DB Retry wrapper pro výpadky databáze
 * - 6 pokusů s 20s pauzou mezi pokusy
 * - Pouze pro connection errors, ne SQL chyby
 */

import { Wait } from './iv_wait.class.js';
import { Log } from './iv_log.class.js';

export class DBRetry {
  static MAX_RETRIES = 6;
  static RETRY_DELAY_MS = 20000; // 20 sekund

  /**
   * Obalí DB operaci retry logikou
   * @param {Function} dbOperation - Async funkce s DB operací
   * @param {string} operationName - Název operace pro logy
   * @returns {Promise<any>} Výsledek operace
   */
  static async withRetry(dbOperation, operationName = 'DB operation') {
    let lastError;
    
    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        return await dbOperation();
      } catch (err) {
        lastError = err;
        
        // Kontrola zda je to connection error
        if (this.isConnectionError(err)) {
          if (attempt < this.MAX_RETRIES) {
            await Log.warn('[DB_RETRY]', `${operationName} selhalo (pokus ${attempt}/${this.MAX_RETRIES}): ${err.message}`);
            Log.info('[DB_RETRY]', `Čekám ${Log.formatTime(this.RETRY_DELAY_MS)} před dalším pokusem...`);
            await Wait.toMilliseconds(this.RETRY_DELAY_MS);
          } else {
            await Log.error('[DB_RETRY]', `${operationName} selhalo po ${this.MAX_RETRIES} pokusech`);
          }
        } else {
          // Není connection error - nehnat retry
          throw err;
        }
      }
    }
    
    // Po všech pokusech - exit s kódem který nezastaví start.sh
    await Log.error('[DB_RETRY]', 'Databáze nedostupná po všech pokusech. Ukončuji s exit code 2.');
    process.exit(2); // Exit code 2 = DB nedostupná, start.sh pokračuje
  }

  /**
   * Kontrola zda je chyba connection error
   */
  static isConnectionError(err) {
    const connectionErrors = [
      'ECONNREFUSED',
      'ETIMEDOUT', 
      'ENOTFOUND',
      'ER_ACCESS_DENIED_ERROR',
      'ER_DBACCESS_DENIED_ERROR',
      'ER_HOST_NOT_PRIVILEGED',
      'ER_HOST_IS_BLOCKED',
      'PROTOCOL_CONNECTION_LOST',
      'ER_CON_COUNT_ERROR'
    ];
    
    return connectionErrors.includes(err.code) || 
           err.message.includes('connect') ||
           err.message.includes('Connection') ||
           err.message.includes('timeout');
  }
}