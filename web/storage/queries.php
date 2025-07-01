<?php
/**
 * File: queries.php
 * Location: ~/web/storage/queries.php
 *
 * Purpose: OPRAVENÉ centralized SQL queries for IVY4B3T web application.
 * Změny: Nahrazení WHERE active = 1 za WHERE priority > 0
 */

// Security check - prevent direct access
if (!defined('IVY_FRAMEWORK')) {
    http_response_code(403);
    die('Direct access not allowed');
}

return [

    // ================================
    // USER AUTHENTICATION & MANAGEMENT
    // ================================

    'auth' => [
        'find_user_by_login' => "
            SELECT id, name, surname, fb_pass, locked
            FROM fb_users
            WHERE fb_login = ? AND locked IS NULL
        ",

        'get_user_by_id' => "
            SELECT id, name, surname, fb_login, host, locked, day_limit, max_limit
            FROM fb_users
            WHERE id = ?
        ",

        'get_all_users_overview' => "
            SELECT id, name, surname, host, locked, day_limit, max_limit,
                   next_worktime, last_add_group
            FROM fb_users
            ORDER BY id
        ",

        'update_user_last_login' => "
            UPDATE fb_users
            SET next_worktime = NOW()
            WHERE id = ?
        "
    ],

    // ================================
    // SYSTEM STATUS & MONITORING
    // ================================

    'system' => [
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

        'get_recent_actions' => "
            SELECT al.timestamp, al.action_code, u.name, u.surname, al.text
            FROM action_log al
            JOIN fb_users u ON al.account_id = u.id
            ORDER BY al.timestamp DESC
            LIMIT ?
        ",

        'insert_system_log' => "
            INSERT INTO log_s (time, hostname, title, text, data)
            VALUES (NOW(), ?, ?, ?, ?)
        ",

        'get_system_version' => "
            SELECT code, created
            FROM versions
            ORDER BY created DESC
            LIMIT 1
        "
    ],

    // ================================
    // GROUP LIMITS MANAGEMENT
    // ================================

    'group_limits' => [
        'get_user_limits' => "
            SELECT group_type, max_posts, time_window_hours, updated
            FROM user_group_limits
            WHERE user_id = ?
            ORDER BY
              CASE group_type
                WHEN 'G' THEN 1
                WHEN 'GV' THEN 2
                WHEN 'P' THEN 3
                WHEN 'Z' THEN 4
              END
        ",

        'bulk_update_limits' => "
            UPDATE user_group_limits
            SET max_posts = ?, time_window_hours = ?, updated = CURRENT_TIMESTAMP
            WHERE user_id IN (%s) AND group_type = ?
        ",

        'get_all_users_limits_overview' => "
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

        'can_user_post_check' => "
            SELECT max_posts, time_window_hours
            FROM user_group_limits
            WHERE user_id = ? AND group_type = ?
        ",

        'count_user_posts_in_timeframe' => "
            SELECT COUNT(*) as post_count
            FROM action_log al
            JOIN fb_groups fg ON al.reference_id = fg.id
            WHERE al.account_id = ?
              AND al.action_code LIKE 'share_post_%'
              AND fg.typ = ?
              AND al.timestamp >= NOW() - INTERVAL ? HOUR
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
    ],

    // ================================
    // FACEBOOK GROUPS & ACTIONS
    // ================================

    'facebook' => [
        'get_group_by_id' => "
            SELECT id, fb_id, nazev, typ, priority, user_counter, sell, last_seen, next_seen
            FROM fb_groups
            WHERE id = ?
        ",

        'get_groups_by_type' => "
            SELECT id, fb_id, nazev, user_counter, last_seen
            FROM fb_groups
            WHERE typ = ? AND priority > 0
            ORDER BY last_seen ASC
        ",

        'update_group_last_seen' => "
            UPDATE fb_groups
            SET last_seen = NOW()
            WHERE id = ?
        ",

        'log_user_action' => "
            INSERT INTO action_log (account_id, action_code, reference_id, text)
            VALUES (?, ?, ?, ?)
        ",

        'get_action_definitions' => "
            SELECT action_code, label, description, weight, min_minutes, max_minutes, active
            FROM action_definitions
            WHERE active = 1
            ORDER BY weight DESC
        "
    ],

    // ================================
    // QUOTES & CONTENT
    // ================================

    'content' => [
        'get_random_quote' => "
            SELECT id, text, author, next_seen
            FROM quotes
            WHERE (next_seen IS NULL OR next_seen <= NOW())
            ORDER BY RAND()
            LIMIT 1
        ",

        'update_quote_usage' => "
            UPDATE quotes
            SET next_seen = NOW() + INTERVAL ? DAY
            WHERE id = ?
        ",

        'get_quotes_statistics' => "
            SELECT
                COUNT(*) as total_quotes,
                COUNT(CASE WHEN next_seen IS NULL OR next_seen <= NOW() THEN 1 END) as available_quotes
            FROM quotes
        "
    ],

    // ================================
    // DASHBOARD WIDGETS
    // ================================

    'dashboard' => [
        'get_dashboard_summary' => "
            SELECT
                (SELECT COUNT(*) FROM fb_users WHERE locked IS NULL) as active_users,
                (SELECT COUNT(*) FROM fb_groups WHERE priority > 0) as active_groups,
                (SELECT COUNT(*) FROM heartBeat WHERE up > NOW() - INTERVAL 5 MINUTE) as online_hosts,
                (SELECT COUNT(*) FROM action_log WHERE timestamp > NOW() - INTERVAL 1 HOUR) as recent_actions
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
    ]
];
