/**
 * Název souboru: quotes.js
 * Umístění: ~/ivy/sql/queries/quotes.js
 *
 * Popis: SQL dotazy pro správu citátů (quotes tabulka)
 * Opraveno: Nahrazení legacy 'statements' za 'quotes' s odpovídajícími sloupci
 */

export const QUOTES = {
  // ===== ZÁKLADNÍ CRUD OPERACE =====

  getById: `
    SELECT * FROM quotes
    WHERE id = ?
  `,

  getByUserId: `
    SELECT * FROM quotes
    WHERE user_id = ?
    ORDER BY id DESC
  `,

  getAll: `
    SELECT * FROM quotes
    ORDER BY id DESC
  `,

  // ===== VÝBĚR CITÁTŮ PRO POUŽITÍ =====

  getRandomQuote: `
    SELECT * FROM quotes
    WHERE (next_seen IS NULL OR next_seen <= NOW())
    ORDER BY COALESCE(next_seen, NOW() - INTERVAL 90 DAY) ASC
    LIMIT 1
  `,

  getAvailableQuotes: `
    SELECT * FROM quotes
    WHERE (next_seen IS NULL OR next_seen <= NOW())
    ORDER BY COALESCE(next_seen, NOW() - INTERVAL 90 DAY) ASC
    LIMIT ?
  `,

  getQuotesByAuthor: `
    SELECT * FROM quotes
    WHERE author LIKE ?
    ORDER BY id DESC
  `,

  getRandomForUser: `
  SELECT q.id, q.text, q.original_text, q.language_code, q.author, q.hash
  FROM quotes q
  LEFT JOIN action_log al ON al.reference_id = q.id
    AND al.action_code = 'quote_post'
    AND al.account_id = ?
  WHERE al.id IS NULL
    AND (
      q.next_seen IS NULL
      OR q.next_seen <= NOW()
    )
  ORDER BY COALESCE(q.next_seen, NOW() - INTERVAL 90 DAY) ASC
  LIMIT 1
`,

  // ===== AKTUALIZACE STAVU CITÁTŮ =====

  markAsUsed: `
    UPDATE quotes
    SET next_seen = NOW() + INTERVAL ? DAY
    WHERE id = ?
  `,

  markAsUsedByHash: `
    UPDATE quotes
    SET next_seen = NOW() + INTERVAL ? DAY
    WHERE hash = ?
  `,

  resetCooldown: `
    UPDATE quotes
    SET next_seen = NULL
    WHERE id = ?
  `,

  resetAllCooldowns: `
    UPDATE quotes
    SET next_seen = NULL
    WHERE next_seen > NOW()
  `,

  // ===== VKLÁDÁNÍ NOVÝCH CITÁTŮ =====

  insertQuote: `
    INSERT INTO quotes (user_id, text, author)
    VALUES (?, ?, ?)
  `,

  insertQuoteWithHash: `
    INSERT INTO quotes (user_id, text, author, hash)
    VALUES (?, ?, ?, MD5(?))
  `,

  // ===== ÚPRAVY CITÁTŮ =====

  updateQuote: `
    UPDATE quotes
    SET text = ?, author = ?
    WHERE id = ?
  `,

  deleteQuote: `
    DELETE FROM quotes
    WHERE id = ?
  `,

  // ===== VYHLEDÁVÁNÍ =====

  searchQuotes: `
    SELECT * FROM quotes
    WHERE text LIKE ? OR author LIKE ?
    ORDER BY id DESC
    LIMIT ?
  `,

  findByHash: `
    SELECT id, hash, text, next_seen
    FROM quotes
    WHERE hash = ?
    LIMIT 1
  `,

  findDuplicates: `
    SELECT hash, COUNT(*) as count, GROUP_CONCAT(id) as duplicate_ids
    FROM quotes
    GROUP BY hash
    HAVING COUNT(*) > 1
    ORDER BY count DESC
  `,

  // ===== STATISTIKY =====

  getQuoteStats: `
    SELECT
      COUNT(*) as total_quotes,
      COUNT(CASE WHEN next_seen IS NULL OR next_seen <= NOW() THEN 1 END) as available_quotes,
      COUNT(CASE WHEN next_seen > NOW() THEN 1 END) as cooldown_quotes,
      COUNT(DISTINCT user_id) as unique_users,
      COUNT(DISTINCT author) as unique_authors
    FROM quotes
  `,

  getUsageStats: `
    SELECT
      author,
      COUNT(*) as quote_count,
      COUNT(CASE WHEN next_seen IS NULL OR next_seen <= NOW() THEN 1 END) as available_count,
      MAX(next_seen) as last_used
    FROM quotes
    WHERE author IS NOT NULL
    GROUP BY author
    ORDER BY quote_count DESC
    LIMIT ?
  `,

  getUserQuoteStats: `
    SELECT
      u.name,
      u.surname,
      COUNT(q.id) as quote_count,
      COUNT(CASE WHEN q.next_seen IS NULL OR q.next_seen <= NOW() THEN 1 END) as available_count
    FROM fb_users u
    LEFT JOIN quotes q ON u.id = q.user_id
    GROUP BY u.id, u.name, u.surname
    HAVING quote_count > 0
    ORDER BY quote_count DESC
    LIMIT ?
  `,

  // ===== MAINTENANCE =====

  cleanOldQuotes: `
    DELETE FROM quotes
    WHERE next_seen < NOW() - INTERVAL ? DAY
      AND text NOT LIKE '%important%'
  `,

  updateHashesForAllQuotes: `
    UPDATE quotes
    SET hash = MD5(text)
    WHERE hash IS NULL OR hash = ''
  `,

  removeDuplicateQuotes: `
    DELETE q1 FROM quotes q1
    INNER JOIN quotes q2
    WHERE q1.id > q2.id AND q1.hash = q2.hash
  `,

  // ===== LEGACY KOMPATIBILITA =====
  // Pro nahrazení starých dotazů na tabulku 'statements'

  selectStatement: `
    SELECT * FROM quotes
    WHERE (next_seen IS NULL OR next_seen <= NOW())
    ORDER BY COALESCE(next_seen, NOW() - INTERVAL 90 DAY) ASC
    LIMIT 1
  `,

  updateStatement: `
    UPDATE quotes
    SET next_seen = NOW() + INTERVAL 7 DAY
    WHERE hash = ?
  `,

  // ===== POKROČILÉ DOTAZY =====

  getQuotesWithCooldown: `
    SELECT
      q.*,
      TIMESTAMPDIFF(HOUR, NOW(), q.next_seen) as hours_until_available
    FROM quotes q
    WHERE q.next_seen > NOW()
    ORDER BY q.next_seen ASC
  `,

  getOldestUnusedQuote: `
    SELECT * FROM quotes
    WHERE next_seen IS NULL
    ORDER BY id ASC
    LIMIT 1
  `,

  getRecentlyUsedQuotes: `
    SELECT * FROM quotes
    WHERE next_seen > NOW() - INTERVAL ? DAY
    ORDER BY next_seen DESC
    LIMIT ?
  `,

  // ===== REPORTING =====

  getQuoteUsageReport: `
    SELECT
      DATE(next_seen) as usage_date,
      COUNT(*) as quotes_used,
      COUNT(DISTINCT author) as unique_authors
    FROM quotes
    WHERE next_seen >= NOW() - INTERVAL ? DAY
      AND next_seen <= NOW()
    GROUP BY DATE(next_seen)
    ORDER BY usage_date DESC
  `,

  getPopularAuthors: `
    SELECT
      author,
      COUNT(*) as total_quotes,
      COUNT(CASE WHEN next_seen > NOW() - INTERVAL 30 DAY THEN 1 END) as recently_used,
      AVG(LENGTH(text)) as avg_quote_length
    FROM quotes
    WHERE author IS NOT NULL
    GROUP BY author
    HAVING total_quotes >= ?
    ORDER BY recently_used DESC, total_quotes DESC
  `
};
