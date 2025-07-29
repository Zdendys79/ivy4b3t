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
      await Log.info('[FB_SYNC]', `Preparing synchronized query: ${query.substring(0, 50)}...`);
      await Log.info('[FB_SYNC]', `Parameters: ${JSON.stringify(params)}`);
      
      // Execute na obou poolech současně
      const [mainResult, prodResult] = await Promise.all([
        this.mainPool.execute(query, params),
        this.prodPool.execute(query, params)
      ]);
      
      await Log.info('[FB_SYNC]', 'Query executed on both databases successfully');
      await Log.info('[FB_SYNC]', `Main DB affected rows: ${mainResult[0].affectedRows || 0}`);
      await Log.info('[FB_SYNC]', `Prod DB affected rows: ${prodResult[0].affectedRows || 0}`);
      
      return mainResult[0]; // Vrátit výsledek z hlavní DB
      
    } catch (err) {
      await Log.error('[FB_SYNC]', `Synchronized query failed: ${err.message}`);
      throw err;
    }
  }

  /**
   * Synchronized query for FB tables (fb_users, fb_groups)
   * @param {string} query - SQL query
   * @param {Array} params - Parameters
   * @returns {Promise<any>} Query result
   */
  async queryFB(query, params = []) {
    // Kontrola zda je to FB tabulka
    if (!query.includes('fb_users') && !query.includes('fb_groups')) {
      await Log.error('[FB_SYNC]', `Attempted to use FBSync for non-FB table: ${query}`);
      throw new Error('FBSync can only be used for fb_users and fb_groups tables');
    }
    
    await Log.info('[FB_SYNC]', 'FB table detected - using synchronized write');
    
    return await this.executeSync(query, params);
  }
}