/**
 * RSS Reader for IVY4B3T Project
 * Purpose: Fetch RSS feeds and store article URLs in database
 * 
 * Features:
 * - Fetches one RSS channel per run (hourly rotation)
 * - Stores article URLs in rss_urls table
 * - Removes used or old URLs (2+ days)
 * - Uses ES modules (import/export)
 * - Integrated with IVY database system
 */

import mysql from 'mysql2/promise';
import { Log } from './libs/iv_log.class.js';

// RSS Parser - dynamic import for compatibility
let Parser;

// Database connection pools
let prodPool = null;
let testPool = null;

/**
 * Initialize database connections for both prod and test
 */
function initDatabase() {
  const prodDbName = process.env.MYSQL_DATABASE;           // ivy
  const testDbName = `${process.env.MYSQL_DATABASE}_test`; // ivy_test
  
  if (!prodPool) {
    prodPool = mysql.createPool({
      host: process.env.MYSQL_HOST,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: prodDbName,
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0
    });
  }
  
  if (!testPool) {
    testPool = mysql.createPool({
      host: process.env.MYSQL_HOST,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: testDbName,
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0
    });
  }
  
  return { prodPool, testPool };
}

/**
 * Execute query on both databases
 */
async function executeOnBoth(query, params = []) {
  const { prodPool, testPool } = initDatabase();
  
  try {
    const [prodResult, testResult] = await Promise.all([
      prodPool.execute(query, params),
      testPool.execute(query, params)
    ]);
    
    const prodCount = prodResult[0]?.affectedRows ?? prodResult[0]?.length ?? 0;
    const testCount = testResult[0]?.affectedRows ?? testResult[0]?.length ?? 0;
    Log.debug('[RSS]', `Query executed on both databases: ${prodCount} prod, ${testCount} test`);
    
    return prodResult; // Return prod result for compatibility
  } catch (err) {
    Log.error('[RSS]', `Failed to execute on both databases: ${err.message}`);
    throw err;
  }
}

/**
 * Query only production database (for reading metadata)
 */
async function queryProd(query, params = []) {
  const { prodPool } = initDatabase();
  return await prodPool.execute(query, params);
}

/**
 * Initialize RSS parser
 */
async function initParser() {
  try {
    const rssParser = await import('rss-parser');
    Parser = rssParser.default;
    return new Parser();
  } catch (err) {
    Log.error('[RSS]', 'Failed to load rss-parser. Install with: npm install rss-parser');
    throw err;
  }
}

/**
 * Get next RSS channel to process (round-robin style)
 */
async function getNextRSSChannel() {
  try {
    const [rows] = await queryProd(`
      SELECT id, name, url, COALESCE(last_fetched, '1970-01-01') as last_fetched
      FROM rss_channels 
      WHERE active = 1 
      ORDER BY last_fetched ASC, id ASC 
      LIMIT 1
    `);
    
    return rows.length > 0 ? rows[0] : null;
  } catch (err) {
    Log.error('[RSS]', `Failed to get next RSS channel: ${err.message}`);
    throw err;
  }
}

/**
 * Process single RSS feed
 */
async function processRSSFeed(channel, parser) {
  try {
    Log.info('[RSS]', `Processing RSS feed: ${channel.name} (${channel.url})`);
    
    const feed = await parser.parseURL(channel.url);
    let newUrls = 0;
    let duplicates = 0;
    
    // Process each feed item
    for (const item of feed.items) {
      if (!item.link) continue;
      
      try {
        await executeOnBoth(`
          INSERT INTO rss_urls (channel_id, url, title, created_at) 
          VALUES (?, ?, ?, NOW())
        `, [
          channel.id,
          item.link,
          item.title || null
        ]);
        newUrls++;
      } catch (err) {
        // Duplicate URL (UNIQUE constraint)
        if (err.code === 'ER_DUP_ENTRY') {
          duplicates++;
        } else {
          Log.error('[RSS]', `Failed to insert URL ${item.link}: ${err.message}`);
        }
      }
    }
    
    // Update channel last_fetched timestamp
    await executeOnBoth(`
      UPDATE rss_channels 
      SET last_fetched = NOW() 
      WHERE id = ?
    `, [channel.id]);
    
    Log.info('[RSS]', `Feed processed: ${newUrls} new URLs, ${duplicates} duplicates from ${channel.name}`);
    return { newUrls, duplicates, totalItems: feed.items.length };
    
  } catch (err) {
    Log.error('[RSS]', `Failed to process RSS feed ${channel.name}: ${err.message}`);
    throw err;
  }
}

/**
 * Clean old or used URLs (2+ days old)
 */
async function cleanOldUrls() {
  try {
    const [result] = await executeOnBoth(`
      DELETE FROM rss_urls 
      WHERE created_at < NOW() - INTERVAL 2 DAY 
         OR (used_count > 0 AND last_used < NOW() - INTERVAL 1 DAY)
    `);
    
    const deletedCount = result.affectedRows || 0;
    if (deletedCount > 0) {
      Log.info('[RSS]', `Cleaned ${deletedCount} old/used URLs from both databases`);
    }
    
    return deletedCount;
  } catch (err) {
    Log.error('[RSS]', `Failed to clean old URLs: ${err.message}`);
    throw err;
  }
}

/**
 * Get RSS statistics
 */
async function getRSSStats() {
  try {
    const [rows] = await queryProd(`
      SELECT 
        COUNT(*) as total_urls,
        COUNT(CASE WHEN used_count = 0 THEN 1 END) as unused_urls,
        COUNT(CASE WHEN used_count > 0 THEN 1 END) as used_urls,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL 1 DAY THEN 1 END) as recent_urls
      FROM rss_urls
    `);
    
    return rows[0] || {};
  } catch (err) {
    Log.error('[RSS]', `Failed to get RSS stats: ${err.message}`);
    return {};
  }
}

/**
 * Main RSS processing function
 */
async function processRSS() {
  const startTime = Date.now();
  
  try {
    Log.info('[RSS]', 'Starting RSS processing cycle');
    
    // Clean old URLs first
    const cleanedCount = await cleanOldUrls();
    
    // Get next channel to process
    const channel = await getNextRSSChannel();
    if (!channel) {
      Log.warn('[RSS]', 'No active RSS channels found in database');
      return;
    }
    
    // Initialize parser
    const parser = await initParser();
    
    // Process the RSS feed
    const result = await processRSSFeed(channel, parser);
    
    // Get updated statistics
    const stats = await getRSSStats();
    
    const processingTime = Date.now() - startTime;
    Log.info('[RSS]', `RSS cycle completed in ${processingTime}ms`);
    Log.info('[RSS]', `Database stats: ${stats.total_urls} total URLs, ${stats.unused_urls} unused, ${stats.recent_urls} from last 24h`);
    
    return {
      success: true,
      channel: channel.name,
      ...result,
      cleanedUrls: cleanedCount,
      stats,
      processingTime
    };
    
  } catch (err) {
    Log.error('[RSS]', `RSS processing failed: ${err.message}`);
    return {
      success: false,
      error: err.message,
      processingTime: Date.now() - startTime
    };
  }
}

/**
 * Get available URL for use (public API for other modules)
 */
export async function getAvailableUrl() {
  try {
    const [rows] = await queryProd(`
      SELECT id, url, title 
      FROM rss_urls 
      WHERE used_count = 0 
      ORDER BY created_at DESC 
      LIMIT 1
    `);
    
    return rows.length > 0 ? rows[0] : null;
  } catch (err) {
    Log.error('[RSS]', `Failed to get available URL: ${err.message}`);
    return null;
  }
}

/**
 * Mark URL as used (public API for other modules)
 */
export async function markUrlAsUsed(urlId) {
  try {
    await executeOnBoth(`
      UPDATE rss_urls 
      SET used_count = used_count + 1, last_used = NOW() 
      WHERE id = ?
    `, [urlId]);
    
    return true;
  } catch (err) {
    Log.error('[RSS]', `Failed to mark URL as used: ${err.message}`);
    return false;
  }
}

// Export main functions
export { processRSS };

// Export as rssReader object for compatibility
export const rssReader = {
  processAllFeeds: processRSS,
  getAvailableUrl,
  markUrlAsUsed
};

// Allow direct execution: node rss_reader.js
if (import.meta.url === `file://${process.argv[1]}`) {
  processRSS().then(result => {
    console.log('RSS processing result:', result);
    process.exit(result.success ? 0 : 1);
  });
}