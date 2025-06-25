<?php
/**
 * File: DashboardController.php
 * Location: ~/web/app/controllers/DashboardController.php
 *
 * Purpose: Main dashboard controller for system monitoring and management.
 *          Provides real-time status, user management, and system controls.
 */

// Security check
if (!defined('IVY_FRAMEWORK')) {
    http_response_code(403);
    die('Direct access not allowed');
}

require_once dirname(__DIR__) . '/core/BaseController.php';

class DashboardController extends BaseController
{
    protected function init()
    {
        // Require authentication for all dashboard actions
        $this->require_auth();
    }

    /**
     * Get recent actions with limit
     */
    private function get_recent_actions_limited($limit = 10)
    {
        $result = $this->db->safe_query("
            SELECT al.timestamp, al.action_code, u.name, u.surname, al.text
            FROM action_log al
            JOIN fb_users u ON al.account_id = u.id
            ORDER BY al.timestamp DESC
            LIMIT ?
        ", [$limit]);

        return $result['success'] ? $result['statement']->fetchAll() : [];
    }

    /**
     * Main dashboard page
     */
    public function index()
    {
        try {
            // Get dashboard data
            $system_status = $this->get_system_status();
            $recent_actions = $this->get_recent_actions_limited(10);
            $user_activity = $this->get_user_activity_today();
            $system_health = $this->get_system_health();
            $flash = $this->get_flash();

            $this->render('dashboard/index', [
                'page_title' => 'IVY4B3T Dashboard',
                'system_status' => $system_status,
                'recent_actions' => $recent_actions,
                'user_activity' => $user_activity,
                'system_health' => $system_health,
                'flash' => $flash,
                'refresh_interval' => 30000, // 30 seconds
                'current_user' => $this->get_current_user(),
                'csrf_token' => $this->csrf_token()
            ]);

        } catch (Exception $e) {
            if ($this->debug_mode) {
                error_log("[DashboardController] Error loading dashboard: " . $e->getMessage());
            }

            $this->flash('error', 'Error loading dashboard data. Please try again.');
            $this->render('dashboard/error', [
                'page_title' => 'Dashboard Error',
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * Get real-time system status (AJAX endpoint)
     */
    public function status()
    {
        try {
            $data = [
                'system_status' => $this->get_system_status(),
                'recent_actions' => $this->get_recent_actions_limited(5),
                'timestamp' => date('Y-m-d H:i:s'),
                'success' => true
            ];

            $this->json($data);

        } catch (Exception $e) {
            $this->json([
                'success' => false,
                'error' => 'Failed to load system status',
                'message' => $this->debug_mode ? $e->getMessage() : 'Internal error'
            ], 500);
        }
    }

    /**
     * Get dashboard widgets data (AJAX endpoint)
     */
    public function widgets()
    {
        try {
            $widget = $this->get_input('widget');

            switch ($widget) {
                case 'system_status':
                    $data = $this->get_system_status();
                    break;

                case 'recent_actions':
                    $result = $this->db->safe_query("
                        SELECT al.timestamp, al.action_code, u.name, u.surname, al.text
                        FROM action_log al
                        JOIN fb_users u ON al.account_id = u.id
                        ORDER BY al.timestamp DESC
                        LIMIT 10
                    ");
                    $data = $result['success'] ? $result['statement']->fetchAll() : [];
                    break;

                case 'user_activity':
                    $data = $this->get_user_activity_today();
                    break;

                case 'system_health':
                    $data = $this->get_system_health();
                    break;

                default:
                    $this->json(['success' => false, 'message' => 'Unknown widget'], 400);
            }

            $this->json([
                'success' => true,
                'data' => $data,
                'timestamp' => date('Y-m-d H:i:s')
            ]);

        } catch (Exception $e) {
            $this->json([
                'success' => false,
                'message' => 'Failed to load widget data',
                'error' => $this->debug_mode ? $e->getMessage() : null
            ], 500);
        }
    }

    /**
     * System controls page
     */
    public function controls()
    {
        $user = $this->get_current_user();

        // Check if user has admin privileges (simple check for now)
        if ($user['id'] >= 10) { // Admin users have low IDs
            $this->flash('error', 'Insufficient privileges for system controls.');
            $this->redirect('/dashboard');
        }

        $this->render('dashboard/controls', [
            'page_title' => 'System Controls',
            'current_user' => $user,
            'csrf_token' => $this->csrf_token()
        ]);
    }

    /**
     * Execute system command (AJAX endpoint)
     */
    public function execute_command()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->json(['success' => false, 'message' => 'Invalid request method'], 405);
        }

        $validation = $this->validate([
            'command' => 'required|in:restart_system,backup_database,clear_logs,update_system',
            'csrf_token' => 'required'
        ]);

        if (!$validation['valid']) {
            $this->json(['success' => false, 'message' => 'Invalid input', 'errors' => $validation['errors']], 400);
        }

        if (!$this->verify_csrf($validation['data']['csrf_token'])) {
            $this->json(['success' => false, 'message' => 'Invalid security token'], 403);
        }

        try {
            $command = $validation['data']['command'];
            $user = $this->get_current_user();

            // Admin privilege check
            if ($user['id'] >= 10) {
                $this->json(['success' => false, 'message' => 'Insufficient privileges'], 403);
            }

            $result = $this->execute_system_command($command, $user);
            $this->json(['success' => true, 'message' => $result['message']]);

        } catch (Exception $e) {
            $this->json(['success' => false, 'message' => 'Command execution failed'], 500);
        }
    }

    /**
     * Update user status (AJAX endpoint)
     */
    public function update_user_status()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->json(['success' => false, 'message' => 'Invalid request method'], 405);
        }

        $validation = $this->validate([
            'user_id' => 'required|numeric',
            'action' => 'required|in:lock,unlock,reset_limits',
            'csrf_token' => 'required'
        ]);

        if (!$validation['valid']) {
            $this->json(['success' => false, 'message' => 'Invalid input', 'errors' => $validation['errors']], 400);
        }

        if (!$this->verify_csrf($validation['data']['csrf_token'])) {
            $this->json(['success' => false, 'message' => 'Invalid security token'], 403);
        }

        try {
            $user_id = $validation['data']['user_id'];
            $action = $validation['data']['action'];
            $current_user = $this->get_current_user();

            $result = $this->execute_user_action($user_id, $action, $current_user);
            $this->json(['success' => true, 'message' => $result['message']]);

        } catch (Exception $e) {
            $this->json(['success' => false, 'message' => 'Action failed'], 500);
        }
    }

    /**
     * Export dashboard data (CSV/JSON)
     */
    public function export()
    {
        $format = $this->get_input('format', 'json');
        $type = $this->get_input('type', 'system_status');

        try {
            switch ($type) {
                case 'system_status':
                    $data = $this->get_system_status();
                    break;

                case 'user_activity':
                    $data = $this->get_user_activity_today();
                    break;

                case 'recent_actions':
                    $result = $this->db->safe_query("
                        SELECT al.timestamp, al.action_code, u.name, u.surname, al.text
                        FROM action_log al
                        JOIN fb_users u ON al.account_id = u.id
                        ORDER BY al.timestamp DESC
                        LIMIT 100
                    ");
                    $data = $result['success'] ? $result['statement']->fetchAll() : [];
                    break;

                default:
                    $this->json(['success' => false, 'message' => 'Unknown export type'], 400);
            }

            $filename = "ivy4b3t_{$type}_" . date('Y-m-d_H-i-s');

            if ($format === 'csv') {
                $this->export_csv($data, $filename);
            } else {
                $this->export_json($data, $filename);
            }

        } catch (Exception $e) {
            $this->json(['success' => false, 'message' => 'Export failed'], 500);
        }
    }

    // ================================
    // PRIVATE HELPER METHODS
    // ================================

    /**
     * Get system status data
     */
    private function get_system_status()
    {
        // Use the available methods from db_class.php
        $heartbeats_result = $this->db->safe_query("
            SELECT host, up, user_id, group_id, version
            FROM heartbeat
            WHERE up > NOW() - INTERVAL 5 MINUTE
            ORDER BY up DESC
        ");
        $heartbeats = $heartbeats_result['success'] ? $heartbeats_result['statement']->fetchAll() : [];

        $user_stats_result = $this->db->safe_query("
            SELECT
                COUNT(*) as total_users,
                COUNT(CASE WHEN locked IS NULL THEN 1 END) as active_users,
                COUNT(CASE WHEN locked IS NOT NULL THEN 1 END) as locked_users
            FROM fb_users
        ");
        $user_stats = $user_stats_result['success'] ? $user_stats_result['statement']->fetch() : [];

        $dashboard_summary_result = $this->db->safe_query("
            SELECT
                (SELECT COUNT(*) FROM fb_users WHERE locked IS NULL) as active_users,
                (SELECT COUNT(*) FROM fb_groups WHERE priority > 0) as active_groups,
                (SELECT COUNT(*) FROM heartbeat WHERE up > NOW() - INTERVAL 5 MINUTE) as online_hosts,
                (SELECT COUNT(*) FROM action_log WHERE timestamp > NOW() - INTERVAL 1 HOUR) as recent_actions
        ");
        $dashboard_summary = $dashboard_summary_result['success'] ? $dashboard_summary_result['statement']->fetch() : [];

        return [
            'heartbeats' => $heartbeats,
            'user_stats' => $user_stats,
            'summary' => $dashboard_summary,
            'active_hosts' => count($heartbeats),
            'last_update' => date('H:i:s')
        ];
    }

    /**
     * Get user activity for today
     */
    private function get_user_activity_today()
    {
        try {
            $result = $this->db->safe_query("
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
            ");

            return $result['success'] ? $result['statement']->fetchAll() : [];

        } catch (Exception $e) {
            if ($this->debug_mode) {
                error_log("[DashboardController] Error getting user activity: " . $e->getMessage());
            }
            return [];
        }
    }

    /**
     * Get system health indicators
     */
    private function get_system_health()
    {
        try {
            $result = $this->db->safe_query("
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
            ");

            $health = [
                'overall' => 'healthy',
                'components' => []
            ];

            if ($result['success']) {
                $health_data = $result['statement']->fetchAll();

                foreach ($health_data as $component) {
                    $health['components'][$component['component']] = [
                        'status' => $component['status'],
                        'last_check' => $component['last_check']
                    ];

                    if ($component['status'] !== 'healthy') {
                        $health['overall'] = 'warning';
                    }
                }
            }

            return $health;

        } catch (Exception $e) {
            if ($this->debug_mode) {
                error_log("[DashboardController] Error getting system health: " . $e->getMessage());
            }

            return [
                'overall' => 'error',
                'components' => []
            ];
        }
    }

    /**
     * Execute system commands
     */
    private function execute_system_command($command, $user)
    {
        switch ($command) {
            case 'restart_system':
                return $this->restart_system($user);

            case 'backup_database':
                return $this->backup_database($user);

            case 'clear_logs':
                return $this->clear_logs($user);

            case 'update_system':
                return $this->update_system($user);

            default:
                throw new Exception("Unknown system command: {$command}");
        }
    }

    /**
     * Restart system command
     */
    private function restart_system($user)
    {
        $this->log_event(
            'System Command',
            'System restart requested',
            ['user_id' => $user['id'], 'command' => 'restart_system']
        );

        // In a real implementation, this would trigger system restart
        return [
            'message' => 'System restart initiated successfully',
            'timestamp' => date('Y-m-d H:i:s')
        ];
    }

    /**
     * Database backup command
     */
    private function backup_database($user)
    {
        $this->log_event(
            'System Command',
            'Database backup requested',
            ['user_id' => $user['id'], 'command' => 'backup_database']
        );

        // In a real implementation, this would trigger database backup
        return [
            'message' => 'Database backup initiated successfully',
            'timestamp' => date('Y-m-d H:i:s')
        ];
    }

    /**
     * Clear logs command
     */
    private function clear_logs($user)
    {
        $this->log_event(
            'System Command',
            'Log cleanup requested',
            ['user_id' => $user['id'], 'command' => 'clear_logs']
        );

        // Clear old logs (keep last 30 days)
        $result = $this->db->safe_query("
            DELETE FROM action_log WHERE timestamp < DATE_SUB(NOW(), INTERVAL ? DAY)
        ", [30]);

        return [
            'message' => 'Log cleanup completed successfully',
            'timestamp' => date('Y-m-d H:i:s')
        ];
    }

    /**
     * Update system command
     */
    private function update_system($user)
    {
        $this->log_event(
            'System Command',
            'System update requested',
            ['user_id' => $user['id'], 'command' => 'update_system']
        );

        // In a real implementation, this would trigger system update
        return [
            'message' => 'System update initiated successfully',
            'timestamp' => date('Y-m-d H:i:s')
        ];
    }

    /**
     * Execute user management actions
     */
    private function execute_user_action($user_id, $action, $current_user)
    {
        switch ($action) {
            case 'lock':
                $result = $this->db->safe_query("
                    UPDATE fb_users SET locked = NOW() WHERE id = ?
                ", [$user_id]);

                if ($result['success'] && $result['affected_rows'] > 0) {
                    $this->log_event(
                        'User Management',
                        "User {$user_id} locked by {$current_user['name']}",
                        ['target_user_id' => $user_id, 'admin_user_id' => $current_user['id']]
                    );
                    return ['message' => 'User locked successfully'];
                }
                throw new Exception('Failed to lock user');

            case 'unlock':
                $result = $this->db->safe_query("
                    UPDATE fb_users SET locked = NULL WHERE id = ?
                ", [$user_id]);

                if ($result['success'] && $result['affected_rows'] > 0) {
                    $this->log_event(
                        'User Management',
                        "User {$user_id} unlocked by {$current_user['name']}",
                        ['target_user_id' => $user_id, 'admin_user_id' => $current_user['id']]
                    );
                    return ['message' => 'User unlocked successfully'];
                }
                throw new Exception('Failed to unlock user');

            case 'reset_limits':
                // Reset user limits to default values
                $default_limits = [
                    ['G', 15, 24],
                    ['GV', 1, 8],
                    ['P', 2, 8],
                    ['Z', 1, 48]
                ];

                foreach ($default_limits as [$type, $posts, $hours]) {
                    $this->db->safe_query("
                        INSERT INTO user_group_limits (user_id, group_type, max_posts, time_window_hours, updated)
                        VALUES (?, ?, ?, ?, NOW())
                        ON DUPLICATE KEY UPDATE
                            max_posts = VALUES(max_posts),
                            time_window_hours = VALUES(time_window_hours),
                            updated = NOW()
                    ", [$user_id, $type, $posts, $hours]);
                }

                $this->log_event(
                    'User Management',
                    "Limits reset for user {$user_id} by {$current_user['name']}",
                    ['target_user_id' => $user_id, 'admin_user_id' => $current_user['id']]
                );

                return ['message' => 'User limits reset successfully'];

            default:
                throw new Exception("Unknown user action: {$action}");
        }
    }

    /**
     * Export data as CSV
     */
    private function export_csv($data, $filename)
    {
        header('Content-Type: text/csv');
        header("Content-Disposition: attachment; filename=\"{$filename}.csv\"");

        $output = fopen('php://output', 'w');

        if (!empty($data)) {
            // Write headers
            fputcsv($output, array_keys($data[0]));

            // Write data
            foreach ($data as $row) {
                fputcsv($output, $row);
            }
        }

        fclose($output);
        exit;
    }

    /**
     * Export data as JSON
     */
    private function export_json($data, $filename)
    {
        header('Content-Type: application/json');
        header("Content-Disposition: attachment; filename=\"{$filename}.json\"");

        echo json_encode([
            'export_date' => date('Y-m-d H:i:s'),
            'data' => $data
        ], JSON_PRETTY_PRINT);

        exit;
    }
}
