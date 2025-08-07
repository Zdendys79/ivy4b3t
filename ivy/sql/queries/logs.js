/**
 * Název souboru: logs.js
 * Umístění: ~/ivy/sql/queries/logs.js
 *
 * Popis: SQL dotazy pro logování systému (action_log, log_system)
 * Obsahuje pouze existující tabulky - odstraněny neexistující log_s, log_u, log
 */

export const LOGS = {
  // ===== SYSTÉMOVÝ LOG (log_system) =====

  insertSystemLog: `
    INSERT INTO log_system (time, hostname, title, text, data)
    VALUES (NOW(), ?, ?, ?, ?)
  `,

  getSystemLogs: `
    SELECT time, hostname, title, text, data
    FROM log_system
    ORDER BY time DESC
    LIMIT ?
  `,

  getSystemLogsByHostname: `
    SELECT time, hostname, title, text, data
    FROM log_system
    WHERE hostname = ?
    ORDER BY time DESC
    LIMIT ?
  `,

  getRecentSystemErrors: `
    SELECT time, hostname, title, text, data
    FROM log_system
    WHERE title LIKE '%error%' OR title LIKE '%failed%'
    ORDER BY time DESC
    LIMIT ?
  `,

  // ===== ACTION LOG STATISTICS =====

  getActionLogStats: `
    SELECT
      action_code,
      COUNT(*) as total_count,
      COUNT(DISTINCT account_id) as unique_users,
      MAX(timestamp) as last_occurrence
    FROM action_log
    WHERE timestamp >= NOW() - INTERVAL ? DAY
    GROUP BY action_code
    ORDER BY total_count DESC
  `,

  getUserActionStats: `
    SELECT
      action_code,
      COUNT(*) as count,
      MAX(timestamp) as last_time,
      MIN(timestamp) as first_time
    FROM action_log
    WHERE account_id = ?
      AND timestamp >= NOW() - INTERVAL ? DAY
    GROUP BY action_code
    ORDER BY count DESC
  `,

  getPostingActivityByHour: `
    SELECT
      HOUR(timestamp) as hour,
      COUNT(*) as posts_count
    FROM action_log
    WHERE action_code LIKE 'post_%'
      AND timestamp >= NOW() - INTERVAL ? DAY
    GROUP BY HOUR(timestamp)
    ORDER BY hour
  `,

  // ===== MAINTENANCE OPERATIONS =====

  clearOldActionLogs: `
    DELETE FROM action_log
    WHERE timestamp < DATE_SUB(NOW(), INTERVAL ? DAY)
  `,

  clearOldSystemLogs: `
    DELETE FROM log_system
    WHERE time < DATE_SUB(NOW(), INTERVAL ? DAY)
  `,

  getLogTableSizes: `
    SELECT
      table_name,
      ROUND(((data_length + index_length) / 1024 / 1024), 2) as size_mb,
      table_rows
    FROM information_schema.TABLES
    WHERE table_schema = DATABASE()
      AND table_name IN ('action_log', 'log_system')
    ORDER BY (data_length + index_length) DESC
  `,

  // ===== KOMBINOVANÉ DOTAZY PRO MONITORING =====

  getActivityOverview: `
    SELECT
      'action_log' as log_type,
      COUNT(*) as total_records,
      MAX(timestamp) as latest_entry,
      COUNT(DISTINCT account_id) as active_users
    FROM action_log
    WHERE timestamp >= NOW() - INTERVAL 24 HOUR
    UNION ALL
    SELECT
      'system_log' as log_type,
      COUNT(*) as total_records,
      MAX(time) as latest_entry,
      COUNT(DISTINCT hostname) as active_hosts
    FROM log_system
    WHERE time >= NOW() - INTERVAL 24 HOUR
  `,

  getRecentActivity: `
    SELECT
      'action' as type,
      timestamp as time,
      CONCAT(u.name, ' ', u.surname) as user_name,
      action_code as activity,
      text as details
    FROM action_log al
    JOIN fb_users u ON al.account_id = u.id
    WHERE timestamp >= NOW() - INTERVAL ? HOUR
    UNION ALL
    SELECT
      'system' as type,
      time,
      hostname as user_name,
      title as activity,
      LEFT(text, 100) as details
    FROM log_system
    WHERE time >= NOW() - INTERVAL ? HOUR
    ORDER BY time DESC
    LIMIT ?
  `,

  // ===== DIAGNOSTIC QUERIES =====

  detectAnomalies: `
    SELECT
      DATE(timestamp) as date,
      action_code,
      COUNT(*) as count,
      AVG(COUNT(*)) OVER (
        PARTITION BY action_code
        ORDER BY DATE(timestamp)
        ROWS BETWEEN 6 PRECEDING AND 1 PRECEDING
      ) as avg_previous_7days
    FROM action_log
    WHERE timestamp >= NOW() - INTERVAL 14 DAY
    GROUP BY DATE(timestamp), action_code
    HAVING count > avg_previous_7days * 2 OR count < avg_previous_7days * 0.5
    ORDER BY date DESC, count DESC
  `,

  findErrorPatterns: `
    SELECT
      LEFT(text, 50) as error_pattern,
      COUNT(*) as occurrences,
      MAX(time) as last_occurrence,
      COUNT(DISTINCT hostname) as affected_hosts
    FROM log_system
    WHERE (title LIKE '%error%' OR title LIKE '%failed%' OR text LIKE '%error%')
      AND time >= NOW() - INTERVAL ? HOUR
    GROUP BY LEFT(text, 50)
    HAVING occurrences > 1
    ORDER BY occurrences DESC
  `
};
