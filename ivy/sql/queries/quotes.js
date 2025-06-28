/**
 * Název souboru: quotes.js
 * Umístění: ~/ivy/sql/queries/quotes.js
 *
 * Popis: SQL dotazy pro správu citátů a výroků (statements)
 * Obsahuje výběr, aktualizace a statistiky pro timeline příspěvky
 */

export const QUOTES = {
  // ===== ZÁKLADNÍ CRUD OPERACE =====

  getAll: `
    SELECT hash, statement, topic, posted, created, counter
    FROM statements
    ORDER BY COALESCE(posted, '1970-01-01') ASC, created ASC
  `,

  getByHash: `
    SELECT hash, statement, topic, posted, created, counter
    FROM statements
    WHERE hash = ?
  `,

  getByTopic: `
    SELECT hash, statement, topic, posted, created, counter
    FROM statements
    WHERE topic = ?
    ORDER BY COALESCE(posted, '1970-01-01') ASC, created ASC
  `,

  insert: `
    INSERT INTO statements (hash, statement, topic)
    VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE
      statement = VALUES(statement),
      topic = VALUES(topic)
  `,

  // ===== VÝBĚR PRO POSTOVÁNÍ =====

  selectForPosting: `
    SELECT hash, statement, topic, posted, counter
    FROM statements
    ORDER BY COALESCE(posted, NOW() - INTERVAL 90 DAY) ASC
    LIMIT 1
  `,

  selectRandomUnused: `
    SELECT hash, statement, topic, counter
    FROM statements
    WHERE posted IS NULL
    ORDER BY RAND()
    LIMIT 1
  `,

  selectOldestUsed: `
    SELECT hash, statement, topic, posted, counter
    FROM statements
    WHERE posted IS NOT NULL
    ORDER BY posted ASC
    LIMIT 1
  `,

  selectByTopicForPosting: `
    SELECT hash, statement, topic, posted, counter
    FROM statements
    WHERE topic = ?
    ORDER BY COALESCE(posted, NOW() - INTERVAL 90 DAY) ASC
    LIMIT 1
  `,

  // ===== AKTUALIZACE STAVU =====

  markAsPosted: `
    UPDATE statements
    SET posted = NOW(), counter = COALESCE(counter, 0) + 1
    WHERE hash = ?
  `,

  updateCounter: `
    UPDATE statements
    SET counter = COALESCE(counter, 0) + 1
    WHERE hash = ?
  `,

  resetPostedStatus: `
    UPDATE statements
    SET posted = NULL, counter = 0
    WHERE hash = ?
  `,

  resetAllPostedStatus: `
    UPDATE statements
    SET posted = NULL, counter = 0
  `,

  // ===== STATISTIKY A MONITORING =====

  getStatistics: `
    SELECT
      COUNT(*) as total_statements,
      COUNT(CASE WHEN posted IS NULL THEN 1 END) as unused_statements,
      COUNT(CASE WHEN posted IS NOT NULL THEN 1 END) as used_statements,
      MAX(posted) as last_posted,
      AVG(counter) as avg_usage,
      MAX(counter) as max_usage
    FROM statements
  `,

  getTopicStatistics: `
    SELECT
      topic,
      COUNT(*) as total_count,
      COUNT(CASE WHEN posted IS NULL THEN 1 END) as unused_count,
      COUNT(CASE WHEN posted IS NOT NULL THEN 1 END) as used_count,
      MAX(posted) as last_posted,
      AVG(counter) as avg_usage
    FROM statements
    GROUP BY topic
    ORDER BY total_count DESC
  `,

  getMostUsed: `
    SELECT hash, statement, topic, counter, posted
    FROM statements
    WHERE counter > 0
    ORDER BY counter DESC
    LIMIT ?
  `,

  getLeastUsed: `
    SELECT hash, statement, topic, COALESCE(counter, 0) as counter, posted
    FROM statements
    ORDER BY COALESCE(counter, 0) ASC, COALESCE(posted, '1970-01-01') ASC
    LIMIT ?
  `,

  getRecentlyPosted: `
    SELECT hash, statement, topic, posted, counter
    FROM statements
    WHERE posted IS NOT NULL
    ORDER BY posted DESC
    LIMIT ?
  `,

  // ===== MAINTENANCE OPERACE =====

  findDuplicates: `
    SELECT statement, COUNT(*) as count
    FROM statements
    GROUP BY statement
    HAVING COUNT(*) > 1
    ORDER BY count DESC
  `,

  findDuplicateHashes: `
    SELECT hash, COUNT(*) as count
    FROM statements
    GROUP BY hash
    HAVING COUNT(*) > 1
    ORDER BY count DESC
  `,

  deleteDuplicates: `
    DELETE s1 FROM statements s1
    INNER JOIN statements s2
    WHERE s1.hash > s2.hash
      AND s1.statement = s2.statement
  `,

  cleanupOldPosted: `
    UPDATE statements
    SET posted = NULL
    WHERE posted < DATE_SUB(NOW(), INTERVAL ? DAY)
  `,

  // ===== POKROČILÉ DOTAZY =====

  getDistributionByMonth: `
    SELECT
      DATE_FORMAT(posted, '%Y-%m') as month,
      COUNT(*) as posts_count,
      COUNT(DISTINCT topic) as unique_topics
    FROM statements
    WHERE posted IS NOT NULL
      AND posted >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
    GROUP BY DATE_FORMAT(posted, '%Y-%m')
    ORDER BY month DESC
  `,

  getUnbalancedTopics: `
    SELECT
      topic,
      COUNT(*) as total_statements,
      SUM(CASE WHEN posted IS NOT NULL THEN 1 ELSE 0 END) as used_statements,
      ROUND(
        SUM(CASE WHEN posted IS NOT NULL THEN 1 ELSE 0 END) * 100.0 / COUNT(*),
        2
      ) as usage_percentage
    FROM statements
    WHERE topic IS NOT NULL
    GROUP BY topic
    HAVING usage_percentage > 80 OR usage_percentage < 20
    ORDER BY usage_percentage DESC
  `,

  getRandomWeightedStatement: `
    SELECT hash, statement, topic
    FROM statements
    WHERE posted IS NULL OR posted < DATE_SUB(NOW(), INTERVAL ? DAY)
    ORDER BY
      CASE
        WHEN posted IS NULL THEN 1
        ELSE 2
      END,
      COALESCE(counter, 0) ASC,
      RAND()
    LIMIT 1
  `,

  // ===== IMPORT/EXPORT OPERACE =====

  bulkInsert: `
    INSERT IGNORE INTO statements (hash, statement, topic)
    VALUES %s
  `,

  exportAll: `
    SELECT hash, statement, topic, posted, created, counter
    FROM statements
    ORDER BY created
  `,

  exportByTopic: `
    SELECT hash, statement, topic, posted, created, counter
    FROM statements
    WHERE topic = ?
    ORDER BY created
  `,

  // ===== VALIDACE =====

  validateStatements: `
    SELECT
      hash,
      statement,
      CASE
        WHEN LENGTH(statement) < 10 THEN 'Too short'
        WHEN LENGTH(statement) > 500 THEN 'Too long'
        WHEN statement REGEXP '^[[:space:]]*$' THEN 'Empty or whitespace only'
        WHEN statement LIKE '%[placeholder]%' THEN 'Contains placeholder'
        ELSE 'OK'
      END as validation_status
    FROM statements
    HAVING validation_status != 'OK'
    ORDER BY validation_status, hash
  `,

  getEmptyStatements: `
    SELECT hash, statement, topic
    FROM statements
    WHERE statement IS NULL
       OR statement = ''
       OR statement REGEXP '^[[:space:]]*$'
  `,

  getLongStatements: `
    SELECT hash, statement, topic, LENGTH(statement) as length
    FROM statements
    WHERE LENGTH(statement) > ?
    ORDER BY LENGTH(statement) DESC
  `
};
