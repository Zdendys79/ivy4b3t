/**
 * Název souboru: system.js
 * Umístění: ~/ivy/sql/queries/system.js
 *
 * Popis: SQL dotazy pro systémové operace (heartbeat, verze, UI příkazy, URL)
 * Obsahuje monitoring, údržbu, administraci
 */

export const SYSTEM = {
  // ===== HEARTBEAT SYSTEM =====

  heartbeat: `
    INSERT LOW_PRIORITY INTO heartbeat (host, up, user_id, group_id, version)
    VALUES (?, NOW(), ?, ?, ?)
    ON DUPLICATE KEY UPDATE up = NOW(), user_id = ?, group_id = ?, version = ?
  `,

  getActiveHeartbeats: `
    SELECT host, up, user_id, group_id, version
    FROM heartbeat
    WHERE up > NOW() - INTERVAL 5 MINUTE
    ORDER BY up DESC
  `,

  getAllHeartbeats: `
    SELECT
      h.host,
      h.up,
      h.user_id,
      h.group_id,
      h.version,
      u.name,
      u.surname,
      TIMESTAMPDIFF(MINUTE, h.up, NOW()) as minutes_ago
    FROM heartbeat h
    LEFT JOIN fb_users u ON h.user_id = u.id
    ORDER BY h.up DESC
  `,

  cleanOldHeartbeats: `
    DELETE FROM heartbeat
    WHERE up < NOW() - INTERVAL ? HOUR
  `,

  getHeartbeatStats: `
    SELECT
      COUNT(*) as total_hosts,
      COUNT(CASE WHEN up > NOW() - INTERVAL 5 MINUTE THEN 1 END) as active_hosts,
      COUNT(CASE WHEN up > NOW() - INTERVAL 1 HOUR THEN 1 END) as recent_hosts,
      MIN(up) as oldest_heartbeat,
      MAX(up) as newest_heartbeat
    FROM heartbeat
  `,

  // ===== VERSION MANAGEMENT =====

  getVersionCode: `
    SELECT code FROM versions
    ORDER BY created DESC
    LIMIT 1
  `,

  getProductionVersion: `
    SELECT code FROM variables
    WHERE name = 'version'
    LIMIT 1
  `,

  getAllVersions: `
    SELECT code, created
    FROM versions
    ORDER BY created DESC
    LIMIT ?
  `,

  insertVersion: `
    INSERT INTO versions (code, created)
    VALUES (?, NOW())
  `,

  // ===== UI COMMANDS =====

  getUICommand: `
    SELECT * FROM ui_commands
    WHERE host = ? AND fulfilled = '0'
    ORDER BY created ASC
    LIMIT 1
  `,

  getAllUICommands: `
    SELECT * FROM ui_commands
    WHERE host = ?
    ORDER BY created DESC
    LIMIT ?
  `,

  getUICommandCount: `
    SELECT IFNULL(SUM(fulfilled = '0'), 0) as pending_count
    FROM ui_commands
    WHERE host = ?
  `,

  uiCommandSolved: `
    UPDATE ui_commands
    SET fulfilled = '1'
    WHERE id = ?
  `,

  uiCommandAccepted: `
    UPDATE ui_commands
    SET accepted = NOW()
    WHERE id = ?
  `,

  insertUICommand: `
    INSERT INTO ui_commands (host, command, parameters, created)
    VALUES (?, ?, ?, NOW())
  `,

  cleanOldUICommands: `
    DELETE FROM ui_commands
    WHERE created < NOW() - INTERVAL ? DAY
  `,

  // ===== URL MANAGEMENT =====

  loadUrl: `
    SELECT * FROM urls
    ORDER BY used ASC, RAND()
    LIMIT 1
  `,

  useUrl: `
    UPDATE urls
    SET used = used + 1
    WHERE url = ?
  `,

  getUrlStats: `
    SELECT
      COUNT(*) as total_urls,
      AVG(used) as avg_usage,
      MIN(used) as min_usage,
      MAX(used) as max_usage
    FROM urls
  `,

  getMostUsedUrls: `
    SELECT url, used
    FROM urls
    ORDER BY used DESC
    LIMIT ?
  `,

  getUnusedUrls: `
    SELECT url, used
    FROM urls
    WHERE used = 0
    ORDER BY url
  `,

  // ===== REFERERS =====

  getRandomReferer: `
    SELECT url FROM referers
    ORDER BY RAND()
    LIMIT 1
  `,

  getAllReferers: `
    SELECT * FROM referers
    ORDER BY url
  `,

  // ===== VARIABLES SYSTEM =====

  getVariable: `
    SELECT value FROM variables
    WHERE name = ?
  `,

  setVariable: `
    INSERT INTO variables (name, value, changed)
    VALUES (?, ?, NOW())
    ON DUPLICATE KEY UPDATE value = VALUES(value), changed = NOW()
  `,

  getAllVariables: `
    SELECT name, value, changed
    FROM variables
    ORDER BY name
  `,

  // ===== SYSTEM MONITORING =====

  getDashboardSummary: `
    SELECT
      (SELECT COUNT(*) FROM fb_users WHERE locked IS NULL) as active_users,
      (SELECT COUNT(*) FROM fb_users WHERE locked IS NOT NULL) as locked_users,
      (SELECT COUNT(*) FROM heartbeat WHERE up > NOW() - INTERVAL 5 MINUTE) as active_hosts,
      (SELECT COUNT(*) FROM action_log WHERE timestamp >= CURDATE()) as actions_today,
      (SELECT COUNT(*) FROM fb_groups WHERE active = 1) as active_groups,
      (SELECT code FROM versions ORDER BY created DESC LIMIT 1) as current_version
  `,

  getSystemHealth: `
    SELECT
      'database' as component,
      'OK' as status,
      NOW() as checked_at
    UNION ALL
    SELECT
      'heartbeat' as component,
      CASE
        WHEN COUNT(*) > 0 THEN 'OK'
        ELSE 'WARNING'
      END as status,
      NOW() as checked_at
    FROM heartbeat
    WHERE up > NOW() - INTERVAL 10 MINUTE
  `,

  // ===== MAINTENANCE QUERIES =====

  optimizeTables: `
    OPTIMIZE TABLE action_log, heartbeat, log_s, user_action_plan
  `,

  getTableSizes: `
    SELECT
      table_name,
      ROUND(((data_length + index_length) / 1024 / 1024), 2) as size_mb,
      table_rows
    FROM information_schema.TABLES
    WHERE table_schema = DATABASE()
    ORDER BY (data_length + index_length) DESC
  `,

  getDatabaseSize: `
    SELECT
      ROUND(SUM((data_length + index_length) / 1024 / 1024), 2) as total_size_mb
    FROM information_schema.TABLES
    WHERE table_schema = DATABASE()
  `,

  // ===== ERROR TRACKING =====

  getRecentErrors: `
    SELECT * FROM log_s
    WHERE (title LIKE '%error%' OR title LIKE '%Error%' OR title LIKE '%ERROR%')
      AND time >= NOW() - INTERVAL ? HOUR
    ORDER BY time DESC
    LIMIT ?
  `,

  getErrorStats: `
    SELECT
      DATE(time) as error_date,
      COUNT(*) as error_count
    FROM log_s
    WHERE (title LIKE '%error%' OR title LIKE '%Error%' OR title LIKE '%ERROR%')
      AND time >= NOW() - INTERVAL ? DAY
    GROUP BY DATE(time)
    ORDER BY error_date DESC
  `,

  // ===== BACKUP SUPPORT =====

  getLastBackupInfo: `
    SELECT
      title,
      text,
      time,
      JSON_EXTRACT(data, '$.backup_size') as backup_size
    FROM log_s
    WHERE title LIKE '%backup%'
    ORDER BY time DESC
    LIMIT 1
  `,

  // ===== PERFORMANCE MONITORING =====

  getSlowQueries: `
    SELECT
      query_time,
      lock_time,
      rows_sent,
      rows_examined,
      sql_text
    FROM mysql.slow_log
    WHERE start_time >= NOW() - INTERVAL ? HOUR
    ORDER BY query_time DESC
    LIMIT ?
  `,

  getActiveConnections: `
    SELECT
      id,
      user,
      host,
      db,
      command,
      time,
      state,
      info
    FROM information_schema.PROCESSLIST
    WHERE command != 'Sleep'
    ORDER BY time DESC
  `,

  // ===== CLEANUP OPERATIONS =====

  cleanupOldLogs: `
    DELETE FROM log_s
    WHERE time < NOW() - INTERVAL ? DAY
  `,

  cleanupOldActionLogs: `
    DELETE FROM action_log
    WHERE timestamp < NOW() - INTERVAL ? DAY
  `,

  cleanupOldUtioLogs: `
    DELETE FROM log
    WHERE inserted < NOW() - INTERVAL ? DAY
  `,

  // ===== CONFIGURATION =====

  getSystemConfig: `
    SELECT
      name,
      value,
      description,
      changed
    FROM variables
    WHERE name LIKE 'config_%'
    ORDER BY name
  `,

  // ===== REPLICATION STATUS (pokud se používá) =====

  getReplicationStatus: `
    SHOW REPLICA STATUS
  `,

  // ===== EMERGENCY OPERATIONS =====

  emergencyStopAll: `
    UPDATE fb_users
    SET locked = NOW(), lock_reason = 'Emergency stop', lock_type = 'EMERGENCY'
    WHERE locked IS NULL
  `,

  emergencyResetAllActions: `
    UPDATE user_action_plan
    SET next_time = NOW() + INTERVAL 1 HOUR
  `,

  getSystemStatus: `
    SELECT
      @@version as mysql_version,
      @@uptime as mysql_uptime,
      @@max_connections as max_connections,
      (SELECT COUNT(*) FROM information_schema.PROCESSLIST) as current_connections
  `
};
