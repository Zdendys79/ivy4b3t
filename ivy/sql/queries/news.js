/**
 * SQL dotazy pro news_post akci
 * Přímý přístup k RSS databázi pro roboty
 */

export const NEWS = {
  
  /**
   * Získá dostupnou URL pro news post
   * Vybere URL s nejnižším used_count, při shodě nejnovější
   */
  getAvailableUrl: `
    SELECT 
      ru.id,
      ru.url,
      ru.title,
      ru.used_count,
      ru.created_at,
      rc.name as channel_name,
      rc.id as channel_id
    FROM rss_urls ru
    JOIN rss_channels rc ON ru.channel_id = rc.id
    WHERE ru.used_count < 3
      AND rc.active = 1
      AND ru.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
    ORDER BY ru.used_count ASC, ru.created_at DESC
    LIMIT 1
  `,

  /**
   * Označí URL jako použitou (zvýší used_count)
   */
  markUrlAsUsed: `
    UPDATE rss_urls 
    SET used_count = used_count + 1,
        last_used = NOW()
    WHERE id = ?
  `,

  /**
   * Získá statistiky RSS URL
   */
  getUrlStats: `
    SELECT 
      COUNT(*) as total_urls,
      COUNT(CASE WHEN used_count = 0 THEN 1 END) as unused_urls,
      COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 1 END) as recent_urls
    FROM rss_urls ru
    JOIN rss_channels rc ON ru.channel_id = rc.id
    WHERE rc.active = 1
  `

};

export default NEWS;