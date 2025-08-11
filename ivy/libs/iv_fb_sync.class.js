/**
 * FB Data Synchronization
 * Synchronizuje fb_users a fb_groups mezi ivy a ivy_test databázemi
 */

import { Log } from './iv_log.class.js';

export class FBSync {
  constructor(mainPool, prodPool) {
    this.mainPool = mainPool;
    this.prodPool = prodPool;
  }

  /**
   * Synchronized execute - prepare on both pools, execute if both OK
   * @param {string} query - SQL query
   * @param {Array} params - Parameters
   * @returns {Promise<any>} Result from main pool
   */
  async executeSync(query, params = []) {
    try {
      
      // Execute na obou poolech současně
      const [mainResult, prodResult] = await Promise.all([
        this.mainPool.execute(query, params),
        this.prodPool.execute(query, params)
      ]);
      
      
      return mainResult[0]; // Vrátit výsledek z hlavní DB
      
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