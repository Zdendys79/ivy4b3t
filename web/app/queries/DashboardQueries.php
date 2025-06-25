<?php
/**
 * File: DashboardQueries.php
 * Location: ~/web/app/queries/DashboardQueries.php
 *
 * Purpose: SQL queries for Dashboard controller operations.
 *          Contains all dashboard-related database queries organized by functionality.
 */

// Security check
if (!defined('IVY_FRAMEWORK')) {
    http_response_code(403);
    die('Direct access not allowed');
}

return [
    // ================================
    // SYSTEM STATUS & MONITORING
    // ================================
    'system_status' => [
        'get_active_heartbeats' => "
            SELECT host, up, user_id, group_id, version
            FROM heartbeat
            WHERE up > NOW() - INTERVAL 5 MINUTE
            ORDER BY up DESC
        ",

        'get_user_statistics' => "
            SELECT
                COUNT(*) as total_users,
                COUNT(CASE WHEN locked IS NULL THEN 1 END) as active_users,
                COUNT(CASE WHEN locked IS NOT NULL THEN 1 END) as locked_users
            FROM fb_users
        ",

        'get_dashboard_summary' => "
            SELECT
                (SELECT COUNT(*) FROM fb_users WHERE locked IS NULL) as active_users,
                (SELECT COUNT(*) FROM fb_groups WHERE priority > 0) as active_groups,
                (SELECT COUNT(*) FROM heartbeat WHERE up > NOW() - INTERVAL 5 MINUTE) as online_hosts,
                (SELECT COUNT(*) FROM action_log WHERE timestamp > NOW() - INTERVAL 1 HOUR) as recent_actions
        ",

        'get_system_health' => "
            SELECT
                'database' as component,
                'healthy' as status,
                NOW() as last_check
            UNION ALL
            SELECT
                'heartbeat' as component,
                CASE
                    WHEN COUNT(*) > 0 THEN 'healthy'
                    ELSE 'warning'
                END as status,
                MAX(up) as last_check
            FROM heartbeat
            WHERE up > NOW() - INTERVAL 10 MINUTE
        "
    ],

    // ================================
    // USER ACTIVITY & ACTIONS
    // ================================
    'user_activity' => [
        'get_recent_actions' => "
            SELECT al.timestamp, al.action_code, u.name, u.surname, al.text
            FROM action_log al
            JOIN fb_users u ON al.account_id = u.id
            ORDER BY al.timestamp DESC
            LIMIT ?
        ",

        'get_user_activity_today' => "
            SELECT
                u.id, u.name, u.surname,
                COUNT(al.id) as actions_today
            FROM fb_users u
            LEFT JOIN action_log al ON u.id = al.account_id
                AND DATE(al.timestamp) = CURDATE()
            WHERE u.locked IS NULL
            GROUP BY u.id, u.name, u.surname
            ORDER BY actions_today DESC
            LIMIT 10
        ",

        'get_user_activity_stats' => "
            SELECT
                u.id,
                u.name,
                u.surname,
                u.host,
                COUNT(CASE WHEN DATE(al.timestamp) = CURDATE() THEN 1 END) as today_actions,
                COUNT(CASE WHEN al.timestamp > NOW() - INTERVAL 7 DAY THEN 1 END) as week_actions,
                MAX(al.timestamp) as last_action
            FROM fb_users u
            LEFT JOIN action_log al ON u.id = al.account_id
            WHERE u.locked IS NULL
            GROUP BY u.id, u.name, u.surname, u.host
            ORDER BY today_actions DESC, last_action DESC
        "
    ],

    // ================================
    // USER MANAGEMENT
    // ================================
    'user_management' => [
        'lock_user' => "
            UPDATE fb_users
            SET locked = NOW()
            WHERE id = ?
        ",

        'unlock_user' => "
            UPDATE fb_users
            SET locked = NULL
            WHERE id = ?
        ",

        'get_user_details' => "
            SELECT id, name, surname, fb_login, host, locked,
                   day_limit, max_limit, next_worktime, last_add_group
            FROM fb_users
            WHERE id = ?
        ",

        'reset_user_limits' => "
            INSERT INTO user_group_limits (user_id, group_type, max_posts, time_window_hours, updated)
            VALUES (?, ?, ?, ?, NOW())
            ON DUPLICATE KEY UPDATE
                max_posts = VALUES(max_posts),
                time_window_hours = VALUES(time_window_hours),
                updated = NOW()
        ",

        'get_user_limit_usage' => "
            SELECT
                ugl.group_type,
                ugl.max_posts,
                ugl.time_window_hours,
                COUNT(al.id) as current_usage,
                GREATEST(0, ugl.max_posts - COUNT(al.id)) as remaining_posts
            FROM user_group_limits ugl
            LEFT JOIN action_log al ON al.account_id = ugl.user_id
                AND al.action_code = ugl.group_type
                AND al.timestamp > NOW() - INTERVAL ugl.time_window_hours HOUR
            WHERE ugl.user_id = ?
            GROUP BY ugl.group_type, ugl.max_posts, ugl.time_window_hours
        "
    ],

    // ================================
    // SYSTEM MAINTENANCE
    // ================================
    'maintenance' => [
        'clear_old_logs' => "
            DELETE FROM action_log
            WHERE timestamp < DATE_SUB(NOW(), INTERVAL ? DAY)
        ",

        'clear_old_system_logs' => "
            DELETE FROM log_s
            WHERE time < DATE_SUB(NOW(), INTERVAL ? DAY)
        ",

        'get_database_size' => "
            SELECT
                table_name,
                ROUND(((data_length + index_length) / 1024 / 1024), 2) as size_mb
            FROM information_schema.TABLES
            WHERE table_schema = DATABASE()
            ORDER BY (data_length + index_length) DESC
        ",

        'optimize_tables' => "
            OPTIMIZE TABLE action_log, log_s, log_u, heartbeat
        ",

        'get_system_variables' => "
            SELECT name, value, description, updated
            FROM variables
            WHERE active = 1
            ORDER BY name
        "
    ],

    // ================================
    // LOGGING & AUDIT
    // ================================
    'logging' => [
        'insert_system_log' => "
            INSERT INTO log_s (time, hostname, title, text, data)
            VALUES (NOW(), ?, ?, ?, ?)
        ",

        'insert_user_log' => "
            INSERT INTO log_u (time, user_id, title, text, data)
            VALUES (NOW(), ?, ?, ?, ?)
        ",

        'get_system_logs' => "
            SELECT time, hostname, title, text, data
            FROM log_s
            ORDER BY time DESC
            LIMIT ?
        ",

        'get_user_logs' => "
            SELECT ls.time, u.name, u.surname, ls.title, ls.text, ls.data
            FROM log_u ls
            JOIN fb_users u ON ls.user_id = u.id
            WHERE ls.user_id = ?
            ORDER BY ls.time DESC
            LIMIT ?
        "
    ],

    // ================================
    // EXPORT & REPORTING
    // ================================
    'reporting' => [
        'get_daily_activity_report' => "
            SELECT
                DATE(al.timestamp) as activity_date,
                COUNT(*) as total_actions,
                COUNT(DISTINCT al.account_id) as active_users,
                COUNT(CASE WHEN al.action_code = 'G' THEN 1 END) as group_actions,
                COUNT(CASE WHEN al.action_code = 'P' THEN 1 END) as post_actions
            FROM action_log al
            WHERE al.timestamp >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
            GROUP BY DATE(al.timestamp)
            ORDER BY activity_date DESC
        ",

        'get_user_performance_report' => "
            SELECT
                u.id,
                u.name,
                u.surname,
                u.host,
                COUNT(al.id) as total_actions,
                COUNT(CASE WHEN DATE(al.timestamp) = CURDATE() THEN 1 END) as today_actions,
                MAX(al.timestamp) as last_activity,
                DATEDIFF(NOW(), MAX(al.timestamp)) as days_since_last_action
            FROM fb_users u
            LEFT JOIN action_log al ON u.id = al.account_id
                AND al.timestamp >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            WHERE u.locked IS NULL
            GROUP BY u.id, u.name, u.surname, u.host
            ORDER BY total_actions DESC
        ",

        'get_system_performance_report' => "
            SELECT
                h.host,
                COUNT(DISTINCT h.user_id) as managed_users,
                MAX(h.up) as last_heartbeat,
                h.version,
                CASE
                    WHEN MAX(h.up) > NOW() - INTERVAL 5 MINUTE THEN 'online'
                    WHEN MAX(h.up) > NOW() - INTERVAL 30 MINUTE THEN 'warning'
                    ELSE 'offline'
                END as status
            FROM heartbeat h
            WHERE h.up >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
            GROUP BY h.host, h.version
            ORDER BY last_heartbeat DESC
        "
    ]
];
