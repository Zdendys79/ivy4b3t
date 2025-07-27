<?php
/**
 * File: DashboardQueries.php
 * Location: ~/web/app/queries/DashboardQueries.php
 *
 * Purpose: OPRAVENÉ SQL queries for Dashboard controller operations.
 * Změny: Nahrazení WHERE active = 1 za WHERE priority > 0
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
        'get_active_heartBeats' => "
            SELECT host, up, user_id, group_id, version
            FROM heartBeat
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
                (SELECT COUNT(*) FROM heartBeat WHERE up > NOW() - INTERVAL 5 MINUTE) as online_hosts,
                (SELECT COUNT(*) FROM action_log WHERE timestamp > NOW() - INTERVAL 1 HOUR) as recent_actions
        ",

        'get_system_health' => "
            SELECT
                'database' as component,
                'healthy' as status,
                NOW() as last_check
            UNION ALL
            SELECT
                'heartBeat' as component,
                CASE
                    WHEN COUNT(*) > 0 THEN 'healthy'
                    ELSE 'warning'
                END as status,
                MAX(up) as last_check
            FROM heartBeat
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

        'get_user_activity_summary' => "
            SELECT
                u.id,
                u.name,
                u.surname,
                u.host,
                u.locked,
                COUNT(al.id) as actions_today,
                MAX(al.timestamp) as last_action
            FROM fb_users u
            LEFT JOIN action_log al ON u.id = al.account_id
                AND al.timestamp >= CURDATE()
            GROUP BY u.id, u.name, u.surname, u.host, u.locked
            ORDER BY actions_today DESC, last_action DESC
        ",

        'get_hourly_activity' => "
            SELECT
                HOUR(timestamp) as hour,
                COUNT(*) as action_count,
                COUNT(DISTINCT account_id) as unique_users
            FROM action_log
            WHERE timestamp >= CURDATE()
            GROUP BY HOUR(timestamp)
            ORDER BY hour
        "
    ],

    // ================================
    // FB GROUPS MANAGEMENT
    // ================================
    'FB_groups' => [
        'get_all_groups' => "
            SELECT
                id, fb_id, nazev, typ, priority, user_counter,
                last_seen, next_seen, sell, region_id, district_id
            FROM fb_groups
            ORDER BY typ, priority DESC, nazev
        ",

        'get_active_groups' => "
            SELECT
                id, fb_id, nazev, typ, priority, user_counter,
                last_seen, next_seen
            FROM fb_groups
            WHERE priority > 0
            ORDER BY typ, priority DESC, nazev
        ",

        'get_groups_by_type' => "
            SELECT id, fb_id, nazev, user_counter, last_seen
            FROM fb_groups
            WHERE typ = ? AND priority > 0
            ORDER BY priority DESC, nazev
        ",

        'get_group_statistics' => "
            SELECT
                typ,
                COUNT(*) as total_groups,
                COUNT(CASE WHEN priority > 0 THEN 1 END) as active_groups,
                AVG(priority) as avg_priority,
                COUNT(CASE WHEN sell = 1 THEN 1 END) as sell_groups
            FROM fb_groups
            GROUP BY typ
            ORDER BY typ
        ",

        'update_group_priority' => "
            UPDATE fb_groups
            SET priority = ?
            WHERE id = ?
        ",

        'deactivate_group' => "
            UPDATE fb_groups
            SET priority = 0
            WHERE id = ?
        ",

        'activate_group' => "
            UPDATE fb_groups
            SET priority = ?
            WHERE id = ?
        "
    ],

    // ================================
    // ACTION LOG & MONITORING
    // ================================
    'action_monitoring' => [
        'get_recent_posts' => "
            SELECT
                al.timestamp,
                al.action_code,
                u.name,
                u.surname,
                fg.nazev as group_name,
                fg.typ as group_type,
                al.text
            FROM action_log al
            JOIN fb_users u ON al.account_id = u.id
            LEFT JOIN fb_groups fg ON al.reference_id = fg.id
            WHERE al.action_code LIKE 'post_%'
                OR al.action_code LIKE 'share_%'
            ORDER BY al.timestamp DESC
            LIMIT ?
        ",

        'get_action_statistics' => "
            SELECT
                action_code,
                COUNT(*) as count,
                COUNT(DISTINCT account_id) as unique_users,
                MAX(timestamp) as last_occurrence
            FROM action_log
            WHERE timestamp >= NOW() - INTERVAL ? HOUR
            GROUP BY action_code
            ORDER BY count DESC
        ",

        'get_failed_actions' => "
            SELECT
                al.timestamp,
                al.action_code,
                u.name,
                u.surname,
                al.text
            FROM action_log al
            JOIN fb_users u ON al.account_id = u.id
            WHERE al.text LIKE '%error%'
                OR al.text LIKE '%failed%'
                OR al.text LIKE '%chyba%'
            ORDER BY al.timestamp DESC
            LIMIT ?
        "
    ],

    // ================================
    // USER MANAGEMENT & LIMITS
    // ================================
    'user_management' => [
        'get_all_users_summary' => "
            SELECT
                u.id,
                u.name,
                u.surname,
                u.host,
                u.locked,
                u.lock_reason,
                u.day_limit,
                u.next_worktime,
                COUNT(al.id) as actions_today
            FROM fb_users u
            LEFT JOIN action_log al ON u.id = al.account_id
                AND al.timestamp >= CURDATE()
            GROUP BY u.id, u.name, u.surname, u.host, u.locked, u.lock_reason, u.day_limit, u.next_worktime
            ORDER BY u.id
        ",

        'get_locked_users' => "
            SELECT
                id, name, surname, host, locked, lock_reason, lock_type
            FROM fb_users
            WHERE locked IS NOT NULL
            ORDER BY locked DESC
        ",

        'get_user_limits_overview' => "
            SELECT
                u.id,
                u.name,
                u.surname,
                u.host,
                u.locked,
                GROUP_CONCAT(
                    CONCAT(ugl.group_type, ':', ugl.max_posts, '/', ugl.time_window_hours, 'h')
                    ORDER BY
                      CASE ugl.group_type
                        WHEN 'G' THEN 1
                        WHEN 'GV' THEN 2
                        WHEN 'P' THEN 3
                        WHEN 'Z' THEN 4
                      END
                    SEPARATOR ' | '
                ) as limits_summary
            FROM fb_users u
            LEFT JOIN user_group_limits ugl ON u.id = ugl.user_id
            GROUP BY u.id, u.name, u.surname, u.host, u.locked
            ORDER BY u.id
        ",

        'unlock_user' => "
            UPDATE fb_users
            SET locked = NULL, lock_reason = NULL, lock_type = NULL
            WHERE id = ?
        ",

        'lock_user' => "
            UPDATE fb_users
            SET locked = NOW(), lock_reason = ?, lock_type = ?
            WHERE id = ?
        "
    ],

    // ================================
    // SYSTEM MAINTENANCE
    // ================================
    'maintenance' => [
        'cleanup_old_logs' => "
            DELETE FROM action_log
            WHERE timestamp < NOW() - INTERVAL ? DAY
        ",

        'cleanup_old_heartBeats' => "
            DELETE FROM heartBeat
            WHERE up < NOW() - INTERVAL ? DAY
        ",

        'get_database_stats' => "
            SELECT
                table_name,
                table_rows,
                ROUND(((data_length + index_length) / 1024 / 1024), 2) as size_mb
            FROM information_schema.TABLES
            WHERE table_schema = DATABASE()
            ORDER BY (data_length + index_length) DESC
        ",

        'reset_group_cooldowns' => "
            UPDATE fb_groups
            SET last_seen = NOW() - INTERVAL 2 HOUR,
                next_seen = NOW() - INTERVAL 1 HOUR
            WHERE next_seen > NOW() OR last_seen > NOW() - INTERVAL 1 HOUR
        "
    ],

    // ================================
    // SCHEME TREE SYSTEM
    // ================================
    'scheme' => [
        'get_all_scheme_items' => "
            SELECT id, name, type, description, status, visible
            FROM scheme
            WHERE visible = 1
            ORDER BY id
        ",

        'get_scheme_statistics' => "
            SELECT
                status,
                type,
                COUNT(*) as count
            FROM scheme
            WHERE visible = 1
            GROUP BY status, type
            ORDER BY status, type
        ",

        'update_scheme_item' => "
            UPDATE scheme
            SET name = ?, description = ?, status = ?
            WHERE id = ?
        "
    ]
];
