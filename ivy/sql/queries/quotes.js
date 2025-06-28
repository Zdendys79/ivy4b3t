/**
 * Název souboru: quotes.js
 * Umístění: ~/ivy/sql/queries/quotes.js
 *
 * Popis: SQL dotazy pro správu citátů a výroků (quotes)
 * Obsahuje výběr, aktualizace a statistiky pro timeline příspěvky
 */

export const QUOTES = {
  // ===== ZÁKLADNÍ CRUD OPERACE =====

  getAll: `
    SELECT id, text, author, hash, next_seen, user_id
    FROM quotes
    ORDER BY COALESCE(next_seen, '1970-01-01') ASC, id ASC
  `,

  getByHash: `
    SELECT id, text, author, hash, next_seen, user_id
    FROM quotes
    WHERE hash = ?
  `,

  getById: `
    SELECT id, text, author, hash, next_seen, user_id
    FROM quotes
    WHERE id = ?
  `,

  insert: `
    INSERT INTO quotes (text, author, user_id)
    VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE
      text = VALUES(text),
      author = VALUES(author)
  `,

  // ===== VÝBĚR PRO POSTOVÁNÍ =====

  selectForPosting: `
    SELECT id, text, author, hash
    FROM quotes
    WHERE next_seen IS NULL OR next_seen <= NOW()
    ORDER BY COALESCE(next_seen, '1970-01-01') ASC
    LIMIT 1
  `,

  selectRandomUnused: `
    SELECT id, text, author, hash
    FROM quotes
    WHERE next_seen IS NULL
    ORDER BY RAND()
    LIMIT 1
  `,

  selectOldestUsed: `
    SELECT id, text, author, hash, next_seen
    FROM quotes
    WHERE next_seen IS NOT NULL
    ORDER BY next_seen ASC
    LIMIT 1
  `,

  selectByAuthor: `
    SELECT id, text, author, hash
    FROM quotes
    WHERE author = ?
      AND (next_seen IS NULL OR next_seen <= NOW())
    ORDER BY COALESCE(next_seen, '1970-01-01') ASC
    LIMIT 1
  `,

  // ===== AKTUALIZACE STAVU =====

  markAsPosted: `
    UPDATE quotes
    SET next_seen = NOW() + INTERVAL ? DAY
    WHERE id = ?
  `,

  markAsUsed: `
    UPDATE quotes
    SET next_seen = NOW() + INTERVAL 7 DAY
    WHERE id = ?
  `,

  resetPostedStatus: `
    UPDATE quotes
    SET next_seen = NULL
    WHERE id = ?
  `,

  resetAllPostedStatus: `
    UPDATE quotes
    SET next_seen = NULL
  `,

  // ===== STATISTIKY A MONITORING =====

  getStatistics: `
    SELECT
      COUNT(*) as total_quotes,
      COUNT(CASE WHEN next_seen IS NULL THEN 1 END) as unused_quotes,
      COUNT(CASE WHEN next_seen IS NOT NULL THEN 1 END) as used_quotes,
      MAX(next_seen) as last_posted,
      COUNT(DISTINCT author) as unique_authors
    FROM quotes
  `,

  getAuthorStatistics: `
    SELECT
      author,
      COUNT(*) as total_count,
      COUNT(CASE WHEN next_seen IS NULL THEN 1 END) as unused_count,
      COUNT(CASE WHEN next_seen IS NOT NULL THEN 1 END) as used_count,
      MAX(next_seen) as last_posted
    FROM quotes
    WHERE author IS NOT NULL
    GROUP BY author
    ORDER BY total_count DESC
  `,

  getMostRecentlyUsed: `
    SELECT id, text, author, next_seen
    FROM quotes
    WHERE next_seen IS NOT NULL
    ORDER BY next_seen DESC
    LIMIT ?
  `,

  getLeastRecentlyUsed: `
    SELECT id, text, author, COALESCE(next_seen, '1970-01-01') as next_seen
    FROM quotes
    ORDER BY COALESCE(next_seen, '1970-01-01') ASC
    LIMIT ?
  `,

  getAvailableNow: `
    SELECT id, text, author
    FROM quotes
    WHERE next_seen IS NULL OR next_seen <= NOW()
    ORDER BY COALESCE(next_seen, '1970-01-01') ASC
    LIMIT ?
  `,

  // ===== MAINTENANCE OPERACE =====

  findDuplicates: `
    SELECT text, COUNT(*) as count
    FROM quotes
    GROUP BY text
    HAVING COUNT(*) > 1
    ORDER BY count DESC
  `,

  findDuplicateHashes: `
    SELECT hash, COUNT(*) as count
    FROM quotes
    GROUP BY hash
    HAVING COUNT(*) > 1
    ORDER BY count DESC
  `,

  deleteDuplicates: `
    DELETE q1 FROM quotes q1
    INNER JOIN quotes q2
    WHERE q1.id > q2.id
      AND q1.text = q2.text
  `,

  cleanupOldPosted: `
    UPDATE quotes
    SET next_seen = NULL
    WHERE next_seen < DATE_SUB(NOW(), INTERVAL ? DAY)
  `,

  // ===== POKROČILÉ DOTAZY =====

  getDistributionByMonth: `
    SELECT
      DATE_FORMAT(next_seen, '%Y-%m') as month,
      COUNT(*) as quotes_used,
      COUNT(DISTINCT author) as unique_authors
    FROM quotes
    WHERE next_seen IS NOT NULL
      AND next_seen >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
    GROUP BY DATE_FORMAT(next_seen, '%Y-%m')
    ORDER BY month DESC
  `,

  getRandomWeightedQuote: `
    SELECT id, text, author, hash
    FROM quotes
    WHERE next_seen IS NULL OR next_seen < DATE_SUB(NOW(), INTERVAL ? DAY)
    ORDER BY
      CASE
        WHEN next_seen IS NULL THEN 1
        ELSE 2
      END,
      RAND()
    LIMIT 1
  `,

  // ===== IMPORT/EXPORT OPERACE =====

  bulkInsert: `
    INSERT IGNORE INTO quotes (text, author, user_id)
    VALUES %s
  `,

  exportAll: `
    SELECT id, text, author, hash, next_seen, user_id
    FROM quotes
    ORDER BY id
  `,

  exportByAuthor: `
    SELECT id, text, author, hash, next_seen, user_id
    FROM quotes
    WHERE author = ?
    ORDER BY id
  `,

  // ===== VALIDACE =====

  validateQuotes: `
    SELECT
      id,
      text,
      CASE
        WHEN LENGTH(text) < 10 THEN 'Too short'
        WHEN LENGTH(text) > 500 THEN 'Too long'
        WHEN text REGEXP '^[[:space:]]*$' THEN 'Empty or whitespace only'
        WHEN text LIKE '%[placeholder]%' THEN 'Contains placeholder'
        ELSE 'OK'
      END as validation_status
    FROM quotes
    HAVING validation_status != 'OK'
    ORDER BY validation_status, id
  `,

  getEmptyQuotes: `
    SELECT id, text, author
    FROM quotes
    WHERE text IS NULL
       OR text = ''
       OR text REGEXP '^[[:space:]]*$'
  `,

  getLongQuotes: `
    SELECT id, text, author, LENGTH(text) as length
    FROM quotes
    WHERE LENGTH(text) > ?
    ORDER BY LENGTH(text) DESC
  `,

  // ===== FUNKCE PRO KOLO ŠTĚSTÍ =====

  getRandomForUser: `
    SELECT id, text, author
    FROM quotes
    WHERE (next_seen IS NULL OR next_seen <= NOW())
      AND id NOT IN (
        SELECT DISTINCT reference_id
        FROM action_log
        WHERE account_id = ?
          AND action_code = 'quote_post'
          AND reference_id IS NOT NULL
          AND timestamp >= NOW() - INTERVAL 7 DAY
      )
    ORDER BY RAND()
    LIMIT 1
  `
};
