/**
 * FB Data Synchronization
 * Synchronizuje fb_users a fb_groups mezi ivy a ivy_test databázemi
 */

import { Log } from './iv_log.class.js';

export class FBSync {
  constructor(mainPool, prodPool, isMainBranch = false) {
    this.mainPool = mainPool;
    this.prodPool = prodPool;
    this.isMainBranch = isMainBranch;
  }

  /**
   * Synchronized execute - na main větvi zapisuje do obou DB, na production jen do prod.
   * @param {string} query - SQL query
   * @param {Array} params - Parameters
   * @returns {Promise<any>} Result from active pool
   */
  async executeSync(query, params = []) {
    try {
      if (this.isMainBranch) {
        // Na main větvi: synchronizovaný zápis do obou DB
        const [mainResult] = await Promise.all([
          this.mainPool.execute(query, params),
          this.prodPool.execute(query, params)
        ]);
        return mainResult[0];
      } else {
        // Na production větvi: pouze produkční DB
        const [result] = await this.prodPool.execute(query, params);
        return result;
      }
    } catch (err) {
      await Log.error('[FB_SYNC]', `Synchronized query failed: ${err.message}`);
      throw err;
    }
  }

  /**
   * Synchronized query for critical tables (fb_users, fb_groups, user_action_plan, action_log)
   * @param {string} query - SQL query
   * @param {Array} params - Parameters
   * @returns {Promise<any>} Query result
   */
  async queryFB(query, params = []) {
    // Kontrola zda je to synchronizovaná tabulka
    const syncTables = ['fb_users', 'fb_groups', 'user_action_plan', 'action_log'];
    const isSyncTable = syncTables.some(table => query.includes(table));
    
    if (!isSyncTable) {
      await Log.error('[FB_SYNC]', `Attempted to use FBSync for non-synchronized table: ${query}`);
      throw new Error('FBSync can only be used for synchronized tables: fb_users, fb_groups, user_action_plan, action_log');
    }
    
    
    return await this.executeSync(query, params);
  }
}