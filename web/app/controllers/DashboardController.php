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
require_once dirname(__DIR__) . '/core/Database.php';

class DashboardController extends BaseController
{
    private $queries;

    protected function init()
    {
        // Require authentication for all dashboard actions
        $this->require_auth();

        // Load dashboard queries
        $this->load_queries();

        // Use enhanced Database class
        $this->db = new Database($this->debug_mode);
    }

    /**
     * Load dashboard-specific queries
     */
    private function load_queries()
    {
        $queries_path = dirname(__DIR__) . "/queries/DashboardQueries.php";

        if (!file_exists($queries_path)) {
            throw new Exception("Dashboard queries file not found: {$queries_path}");
        }

        $this->queries = require $queries_path;
    }

    /**
     * Main dashboard page
     */
    public function index()
    {
        try {
            // Get dashboard data
            $system_status = $this->get_system_status();
            $recent_actions = $this->db->query_all('user_activity', 'get_recent_actions', [10]);
            $user_activity = $this->db->query_all('user_activity', 'get_user_activity_today');
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
                'recent_actions' => $this->db->query_all('user_activity', 'get_recent_actions', [5]),
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
                    $data = $this->db->query_all('user_activity', 'get_recent_actions', [10]);
                    break;

                case 'user_activity':
                    $data = $this->db->query_all('user_activity', 'get_user_activity_today');
                    break;

                case 'system_health':
                    $data = $this->get_system_health();
                    break;

                case 'user_stats':
                    $data = $this->db->query_all('user_activity', 'get_user_activity_stats');
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
            'csrf_token' => $this->csrf_token(),
            'system_variables' => $this->db->query_all('maintenance', 'get_system_variables'),
            'database_info' => $this->db->query_all('maintenance', 'get_database_size')
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
            'command' => 'required|in:restart_system,backup_database,clear_logs,update_system,optimize_tables',
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
            'action' => 'required|in:lock,unlock,reset_limits,get_details',
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
            $this->json(['success' => true, 'message' => $result['message'], 'data' => $result['data'] ?? null]);

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
                    $data = $this->db->query_all('user_activity', 'get_user_activity_today');
                    break;

                case 'recent_actions':
                    $data = $this->db->query_all('user_activity', 'get_recent_actions', [100]);
                    break;

                case 'daily_report':
                    $data = $this->db->query_all('reporting', 'get_daily_activity_report');
                    break;

                case 'user_performance':
                    $data = $this->db->query_all('reporting', 'get_user_performance_report');
                    break;

                case 'system_performance':
                    $data = $this->db->query_all('reporting', 'get_system_performance_report');
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

    /**
     * Get reports page
     */
    public function reports()
    {
        try {
            $daily_report = $this->db->query_all('reporting', 'get_daily_activity_report');
            $user_performance = $this->db->query_all('reporting', 'get_user_performance_report');
            $system_performance = $this->db->query_all('reporting', 'get_system_performance_report');

            $this->render('dashboard/reports', [
                'page_title' => 'System Reports',
                'daily_report' => $daily_report,
                'user_performance' => $user_performance,
                'system_performance' => $system_performance,
                'current_user' => $this->get_current_user(),
                'csrf_token' => $this->csrf_token()
            ]);

        } catch (Exception $e) {
            $this->flash('error', 'Error loading reports data.');
            $this->redirect('/dashboard');
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
        $heartbeats = $this->db->query_all('system_status', 'get_active_heartbeats');
        $user_stats = $this->db->query_first('system_status', 'get_user_statistics');
        $dashboard_summary = $this->db->query_first('system_status', 'get_dashboard_summary');

        return [
            'heartbeats' => $heartbeats,
            'user_stats' => $user_stats,
            'summary' => $dashboard_summary,
            'active_hosts' => count($heartbeats),
            'last_update' => date('H:i:s')
        ];
    }

    /**
     * Get system health indicators
     */
    private function get_system_health()
    {
        try {
            $health_data = $this->db->query_all('system_status', 'get_system_health');

            $health = [
                'overall' => 'healthy',
                'components' => []
            ];

            foreach ($health_data as $component) {
                $health['components'][$component['component']] = [
                    'status' => $component['status'],
                    'last_check' => $component['last_check']
                ];

                if ($component['status'] !== 'healthy') {
                    $health['overall'] = 'warning';
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

            case 'optimize_tables':
                return $this->optimize_tables($user);

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
        $action_logs_cleared = $this->db->execute('maintenance', 'clear_old_logs', [30]);
        $system_logs_cleared = $this->db->execute('maintenance', 'clear_old_system_logs', [30]);

        return [
            'message' => 'Log cleanup completed successfully',
            'timestamp' => date('Y-m-d H:i:s'),
            'details' => [
                'action_logs' => $action_logs_cleared ? 'cleared' : 'failed',
                'system_logs' => $system_logs_cleared ? 'cleared' : 'failed'
            ]
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
     * Optimize database tables
     */
    private function optimize_tables($user)
    {
        $this->log_event(
            'System Command',
            'Database optimization requested',
            ['user_id' => $user['id'], 'command' => 'optimize_tables']
        );

        $result = $this->db->execute('maintenance', 'optimize_tables');

        return [
            'message' => $result ? 'Database optimization completed successfully' : 'Database optimization failed',
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
                $result = $this->db->execute('user_management', 'lock_user', [$user_id]);
                if ($result) {
                    $this->log_event(
                        'User Management',
                        "User {$user_id} locked by {$current_user['name']}",
                        ['target_user_id' => $user_id, 'admin_user_id' => $current_user['id']]
                    );
                    return ['message' => 'User locked successfully'];
                }
                throw new Exception('Failed to lock user');

            case 'unlock':
                $result = $this->db->execute('user_management', 'unlock_user', [$user_id]);
                if ($result) {
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
                    $this->db->execute('user_management', 'reset_user_limits', [$user_id, $type, $posts, $hours]);
                }

                $this->log_event(
                    'User Management',
                    "Limits reset for user {$user_id} by {$current_user['name']}",
                    ['target_user_id' => $user_id, 'admin_user_id' => $current_user['id']]
                );

                return ['message' => 'User limits reset successfully'];

            case 'get_details':
                $user_details = $this->db->query_first('user_management', 'get_user_details', [$user_id]);
                $limit_usage = $this->db->query_all('user_management', 'get_user_limit_usage', [$user_id]);

                return [
                    'message' => 'User details retrieved successfully',
                    'data' => [
                        'user' => $user_details,
                        'limit_usage' => $limit_usage
                    ]
                ];

            default:
                throw new Exception("Unknown user action: {$action}");
        }
    }

    /**
     * Log system events
     */
    private function log_event($title, $text, $data = [])
    {
        $hostname = gethostname() ?: 'unknown';
        return $this->db->execute('logging', 'insert_system_log', [
            $hostname, $title, $text, json_encode($data)
        ]);
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
            'export_type' => $filename,
            'data' => $data,
            'total_records' => count($data)
        ], JSON_PRETTY_PRINT);

        exit;
    }
}
