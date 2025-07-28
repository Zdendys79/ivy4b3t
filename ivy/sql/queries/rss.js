/**
 * RSS SQL Queries for IVY4B3T Project
 * Purpose: Database queries for RSS system integration
 */

export default {
  
  // ===== RSS CHANNELS =====
  
  getRSSChannels: `
    SELECT id, name, url, active, last_fetched, created_at
    FROM rss_channels 
    WHERE active = 1 
    ORDER BY name ASC
  `,

  getNextRSSChannel: `
    SELECT id, name, url, COALESCE(last_fetched, '1970-01-01') as last_fetched
    FROM rss_channels 
    WHERE active = 1 
    ORDER BY last_fetched ASC, id ASC 
    LIMIT 1
  `,

  updateChannelFetched: `
    UPDATE rss_channels 
    SET last_fetched = NOW() 
    WHERE id = ?
  `,

  // ===== RSS URLS =====

  getAvailableUrl: `
    SELECT id, url, title, channel_id
    FROM rss_urls 
    WHERE used_count = 0 
    ORDER BY created_at DESC 
    LIMIT 1
  `,

  getRandomAvailableUrl: `
    SELECT id, url, title, channel_id
    FROM rss_urls 
    WHERE used_count = 0 
    ORDER BY RAND() 
    LIMIT 1
  `,

  markUrlAsUsed: `
    UPDATE rss_urls 
    SET used_count = used_count + 1, last_used = NOW() 
    WHERE id = ?
  `,

  insertRSSUrl: `
    INSERT INTO rss_urls (channel_id, url, title, created_at) 
    VALUES (?, ?, ?, NOW())
  `,

  cleanOldUrls: `
    DELETE FROM rss_urls 
    WHERE created_at < NOW() - INTERVAL 2 DAY 
       OR (used_count > 0 AND last_used < NOW() - INTERVAL 1 DAY)
  `,

  // ===== RSS STATISTICS =====

  getRSSStats: `
    SELECT 
      COUNT(*) as total_urls,
      COUNT(CASE WHEN used_count = 0 THEN 1 END) as unused_urls,
      COUNT(CASE WHEN used_count > 0 THEN 1 END) as used_urls,
      COUNT(CASE WHEN created_at >= NOW() - INTERVAL 1 DAY THEN 1 END) as recent_urls,
      COUNT(CASE WHEN created_at >= NOW() - INTERVAL 1 HOUR THEN 1 END) as very_recent_urls
    FROM rss_urls
  `,

  getRSSChannelStats: `
    SELECT 
      c.id,
      c.name,
      c.url,
      c.last_fetched,
      COUNT(u.id) as total_urls,
      COUNT(CASE WHEN u.used_count = 0 THEN 1 END) as unused_urls,
      MAX(u.created_at) as latest_url_date
    FROM rss_channels c
    LEFT JOIN rss_urls u ON c.id = u.channel_id
    WHERE c.active = 1
    GROUP BY c.id, c.name, c.url, c.last_fetched
    ORDER BY c.name ASC
  `
};