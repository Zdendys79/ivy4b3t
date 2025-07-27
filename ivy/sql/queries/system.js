/**
 * Název souboru: system.js
 * Umístění: ~/ivy/sql/queries/system.js
 *
 * Popis: KOMPLETNÍ systémové SQL dotazy
 * Změny: Nahrazení fg.active = 1 za fg.priority > 0 + doplněny všechny chybějící dotazy
 */

export const SYSTEM = {
  // ===== HEARTBEAT SYSTEM =====

  heartBeat: `
    INSERT LOW_PRIORITY INTO heartbeat (host, up, user_id, group_id, version)
    VALUES (?, NOW(), ?, ?, ?)
    ON DUPLICATE KEY UPDATE up = NOW(), user_id = ?, group_id = ?, version = ?
  `,

  heartBeatExtended: `
    INSERT LOW_PRIORITY INTO heartbeat (host, up, user_id, group_id, version, action_name, action_started_at)
    VALUES (?, NOW(), ?, 0, ?, ?, ?)
    ON DUPLICATE KEY UPDATE up = NOW(), user_id = ?, version = ?, action_name = ?, action_started_at = ?
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
    SELECT value as code FROM variables
    WHERE name = 'version'
  `,

  getProductionVersion: `
    SELECT code FROM variables
    WHERE name = 'version'
    LIMIT 1
  `,

  getAllVersions: `
    SELECT value as code, value as hash, 'git' as source, 'system' as hostname, NOW() as created
    FROM variables
    WHERE name = 'version'
    LIMIT ?
  `,

  insertVersion: `
    INSERT INTO variables (name, value)
    VALUES ('version', ?)
    ON DUPLICATE KEY UPDATE value = VALUES(value)
  `,

  // ===== UI COMMANDS =====

  getUICommand: `
    SELECT * FROM ui_commands
    WHERE host = ? AND fulfilled IS NULL
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
    SELECT IFNULL(SUM(CASE WHEN fulfilled IS NULL THEN 1 ELSE 0 END), 0) as pending_count
    FROM ui_commands
    WHERE host = ?
  `,

  uiCommandSolved: `
    UPDATE ui_commands
    SET fulfilled = NOW()
    WHERE id = ?
  `,

  uiCommandAccepted: `
    UPDATE ui_commands
    SET accepted = NOW()
    WHERE id = ?
  `,

  insertUICommand: `
    INSERT INTO ui_commands (host, command, data, created)
    VALUES (?, ?, ?, NOW())
  `,

  cleanOldUICommands: `
    DELETE FROM ui_commands
    WHERE created < NOW() - INTERVAL ? DAY
  `,

  // ===== URL MANAGEMENT =====


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

  addReferer: `
    INSERT IGNORE INTO referers (url)
    VALUES (?)
  `,

  removeReferer: `
    DELETE FROM referers
    WHERE id = ?
  `,

  // ===== VARIABLES SYSTEM =====

  getVariable: `
    SELECT value FROM variables
    WHERE name = ?
  `,

  setVariable: `
    INSERT INTO variables (name, value, type, changed)
    VALUES (?, ?, ?, NOW())
    ON DUPLICATE KEY UPDATE value = VALUES(value), type = VALUES(type), changed = NOW()
  `,

  getAllVariables: `
    SELECT name, value, type, changed
    FROM variables
    ORDER BY name
  `,

  deleteVariable: `
    DELETE FROM variables
    WHERE name = ?
  `,

  getVariablesByPrefix: `
    SELECT name, value, type, changed
    FROM variables
    WHERE name LIKE CONCAT(?, '%')
    ORDER BY name
  `,

  // ===== SYSTEM MONITORING =====

  getDashboardSummary: `
    SELECT
      (SELECT COUNT(*) FROM fb_users WHERE locked IS NULL) as active_users,
      (SELECT COUNT(*) FROM fb_users WHERE locked IS NOT NULL) as locked_users,
      (SELECT COUNT(*) FROM heartbeat WHERE up > NOW() - INTERVAL 5 MINUTE) as active_hosts,
      (SELECT COUNT(*) FROM action_log WHERE timestamp >= CURDATE()) as actions_today,
      (SELECT COUNT(*) FROM fb_groups WHERE priority > 0) as active_groups,
      (SELECT value FROM variables WHERE name = 'version') as current_version
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

  getSystemStats: `
    SELECT
      (SELECT COUNT(*) FROM fb_users) as total_users,
      (SELECT COUNT(*) FROM fb_groups) as total_groups,
      (SELECT COUNT(*) FROM action_log WHERE timestamp >= CURDATE()) as actions_today,
      (SELECT COUNT(*) FROM quotes) as total_quotes,
      (SELECT COUNT(*) FROM referers) as total_referers,
      0 as total_urls
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

  analyzeTable: `
    ANALYZE TABLE ?
  `,

  checkTable: `
    CHECK TABLE ?
  `,

  repairTable: `
    REPAIR TABLE ?
  `,

  // ===== LOG MANAGEMENT =====

  insertSystemLog: `
    INSERT LOW_PRIORITY INTO log_s (time, hostname, title, text, data)
    VALUES (NOW(), ?, ?, ?, ?)
  `,

  getRecentSystemLogs: `
    SELECT * FROM log_s
    ORDER BY time DESC
    LIMIT ?
  `,

  getSystemLogsByType: `
    SELECT * FROM log_s
    WHERE title LIKE ?
      AND time >= NOW() - INTERVAL ? HOUR
    ORDER BY time DESC
    LIMIT ?
  `,

  cleanOldSystemLogs: `
    DELETE FROM log_s
    WHERE time < NOW() - INTERVAL ? DAY
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

  getErrorsByHost: `
    SELECT
      hostname,
      COUNT(*) as error_count,
      MAX(time) as last_error
    FROM log_s
    WHERE (title LIKE '%error%' OR title LIKE '%Error%' OR title LIKE '%ERROR%')
      AND time >= NOW() - INTERVAL ? HOUR
    GROUP BY hostname
    ORDER BY error_count DESC
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

  logBackupOperation: `
    INSERT INTO log_s (time, hostname, title, text, data)
    VALUES (NOW(), ?, 'Backup Operation', ?, ?)
  `,

  // ===== PERFORMANCE MONITORING =====

  getActiveConnections: `
    SELECT
      id,
      user,
      host,
      db,
      command,
      time,
      state,
      LEFT(info, 100) as query_preview
    FROM information_schema.PROCESSLIST
    WHERE command != 'Sleep'
    ORDER BY time DESC
  `,

  getConnectionStats: `
    SELECT
      @@max_connections as max_connections,
      (SELECT COUNT(*) FROM information_schema.PROCESSLIST) as current_connections,
      @@threads_connected as threads_connected,
      @@threads_running as threads_running
  `,

  // ===== CLEANUP OPERATIONS =====

  cleanupOldActionLogs: `
    DELETE FROM action_log
    WHERE timestamp < NOW() - INTERVAL ? DAY
  `,

  cleanupOldUtioLogs: `
    DELETE FROM log
    WHERE inserted < NOW() - INTERVAL ? DAY
  `,

  cleanupOldUserLogs: `
    DELETE FROM log_u
    WHERE time < NOW() - INTERVAL ? DAY
  `,

  cleanupOldUserGroups: `
    DELETE FROM user_groups
    WHERE time < NOW() - INTERVAL ? DAY
      AND (blocked_until IS NULL OR blocked_until <= NOW())
  `,

  // ===== CONFIGURATION =====

  getSystemConfig: `
    SELECT
      name,
      value,
      changed
    FROM variables
    WHERE name LIKE 'config_%'
    ORDER BY name
  `,

  updateSystemConfig: `
    INSERT INTO variables (name, value, changed)
    VALUES (?, ?, NOW())
    ON DUPLICATE KEY UPDATE value = VALUES(value), changed = NOW()
  `,

  // ===== EMERGENCY OPERATIONS =====

  emergencyStopAll: `
    UPDATE fb_users
    SET locked = NOW(), lock_reason = 'Emergency stop', lock_type = 'EMERGENCY'
    WHERE locked IS NULL
  `,

  emergencyUnlockAll: `
    UPDATE fb_users
    SET locked = NULL, lock_reason = NULL, lock_type = NULL
    WHERE lock_type = 'EMERGENCY'
  `,

  emergencyResetAllActions: `
    UPDATE user_action_plan
    SET next_time = NOW() + INTERVAL 1 HOUR
  `,

  emergencyResetGroupCooldowns: `
    UPDATE fb_groups
    SET last_seen = NOW() - INTERVAL 2 HOUR,
        next_seen = NOW() - INTERVAL 1 HOUR
    WHERE next_seen > NOW() OR last_seen > NOW() - INTERVAL 1 HOUR
  `,

  // ===== STATUS QUERIES =====

  getSystemStatus: `
    SELECT
      @@version as mysql_version,
      @@uptime as mysql_uptime,
      @@max_connections as max_connections,
      (SELECT COUNT(*) FROM information_schema.PROCESSLIST) as current_connections,
      @@innodb_buffer_pool_size as buffer_pool_size,
      @@query_cache_size as query_cache_size
  `,

  getDiskUsage: `
    SELECT
      table_schema as database_name,
      ROUND(SUM((data_length + index_length) / 1024 / 1024), 2) as size_mb
    FROM information_schema.TABLES
    WHERE table_schema = DATABASE()
    GROUP BY table_schema
  `,

  // ===== DIAGNOSTICS =====

  getSlowQueries: `
    SELECT
      query_time,
      lock_time,
      rows_sent,
      rows_examined,
      LEFT(sql_text, 200) as sql_preview
    FROM mysql.slow_log
    WHERE start_time >= NOW() - INTERVAL ? HOUR
    ORDER BY query_time DESC
    LIMIT ?
  `,

  checkDatabaseIntegrity: `
    SELECT
      table_name,
      table_rows,
      ROUND(((data_length + index_length) / 1024 / 1024), 2) as size_mb,
      create_time,
      update_time
    FROM information_schema.TABLES
    WHERE table_schema = DATABASE()
      AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `,

  // ===== REPLICATION (pokud se používá) =====

  getReplicationStatus: `
    SHOW REPLICA STATUS
  `,

  getReplicationLag: `
    SELECT
      CASE
        WHEN Seconds_Behind_Master IS NULL THEN 'Not replicating'
        WHEN Seconds_Behind_Master = 0 THEN 'Up to date'
        ELSE CONCAT(Seconds_Behind_Master, ' seconds behind')
      END as replication_status
    FROM information_schema.REPLICA_HOST_STATUS
  `,

  // ===== DEBUG INCIDENTS SYSTEM =====

  insertDebugIncident: `
    INSERT INTO debug_incidents (
      incident_id, user_id, error_level, error_message, error_context,
      page_url, page_title, user_agent, screenshot_data, dom_html,
      console_logs, user_comment, user_analysis_request, system_info,
      stack_trace, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,

  // Removed getDebugIncidents - table debug_incidents_summary no longer exists

  getDebugIncidentById: `
    SELECT * FROM debug_incidents
    WHERE incident_id = ?
  `,

  updateDebugIncidentStatus: `
    UPDATE debug_incidents 
    SET status = ?, analyzed_by = ?, analysis_notes = ?, updated_at = NOW()
    WHERE incident_id = ?
  `,

  markDebugIncidentResolved: `
    UPDATE debug_incidents 
    SET status = 'RESOLVED', resolution_notes = ?, resolved_at = NOW(), updated_at = NOW()
    WHERE incident_id = ?
  `,

  deleteResolvedDebugIncidents: `
    DELETE FROM debug_incidents 
    WHERE status = 'RESOLVED' AND resolved_at < DATE_SUB(NOW(), INTERVAL ? DAY)
  `,

  getDebugIncidentStats: `
    SELECT 
      status,
      error_level,
      COUNT(*) as count,
      MAX(timestamp) as latest_incident
    FROM debug_incidents
    GROUP BY status, error_level
    ORDER BY latest_incident DESC
  `,

  // ===== SYSTEM LOG =====

  insertSystemLog: `
    INSERT INTO log_system (
      hostname, 
      event_type, 
      event_level, 
      message, 
      details, 
      user_id, 
      process_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `,

  getSystemLogs: `
    SELECT 
      id,
      hostname,
      event_type,
      event_level,
      message,
      details,
      user_id,
      process_id,
      timestamp
    FROM log_system
    WHERE hostname = ?
      AND timestamp >= DATE_SUB(NOW(), INTERVAL ? HOUR)
    ORDER BY timestamp DESC
    LIMIT ?
  `,

  getAllSystemLogs: `
    SELECT 
      id,
      hostname,
      event_type,
      event_level,
      message,
      details,
      user_id,
      process_id,
      timestamp
    FROM log_system
    WHERE timestamp >= DATE_SUB(NOW(), INTERVAL ? HOUR)
    ORDER BY timestamp DESC
    LIMIT ?
  `,

  getSystemLogStats: `
    SELECT 
      hostname,
      event_type,
      event_level,
      COUNT(*) as count,
      MAX(timestamp) as latest_event
    FROM log_system
    WHERE timestamp >= DATE_SUB(NOW(), INTERVAL ? HOUR)
    GROUP BY hostname, event_type, event_level
    ORDER BY latest_event DESC
  `,

  cleanOldSystemLogs: `
    DELETE FROM log_system 
    WHERE timestamp < DATE_SUB(NOW(), INTERVAL ? DAY)
  `
};
