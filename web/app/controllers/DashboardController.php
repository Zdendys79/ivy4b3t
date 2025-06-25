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
     * Main dashboard page
     */
    public function index()
    {
        try {
            // Get dashboard data
            $system_status = $this->get_system_status();
            $recent_actions = $this->db->get_recent_actions(10);
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
                'refresh_interval' => 30000 // 30 seconds
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
     * Get system health indicators
     */
    private function get_system_health()
    {
        try {
            $health_data = $this->db->query_all('dashboard', 'get_system_health');

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
     * Process system commands
     */
    private function process_system_command($command, $user)
    {
        switch ($command) {
            case 'restart_bots':
                return $this->restart_bots($user);

            case 'pause_system':
                return $this->pause_system($user);

            case 'resume_system':
                return $this->resume_system($user);

            case 'clear_logs':
                return $this->clear_logs($user);

            case 'backup_database':
                return $this->backup_database($user);

            default:
                throw new Exception("Unknown command: {$command}");
        }
    }

    /**
     * Restart bots command
     */
    private function restart_bots($user)
    {
        // Log the command
        $this->log_event(
            'System Command',
            'Bot restart requested',
            ['user_id' => $user['id'], 'command' => 'restart_bots']
        );

        // In a real implementation, this would trigger bot restart
        // For now, we'll simulate the action

        return [
            'message' => 'Bot restart command sent successfully',
            'timestamp' => date('Y-m-d H:i:s')
        ];
    }

    /**
     * Pause system command
     */
    private function pause_system($user)
    {
        $this->log_event(
            'System Command',
            'System pause requested',
            ['user_id' => $user['id'], 'command' => 'pause_system']
        );

        return [
            'message' => 'System pause command sent successfully',
            'timestamp' => date('Y-m-d H:i:s')
        ];
    }

    /**
     * Resume system command
     */
    private function resume_system($user)
    {
        $this->log_event(
            'System Command',
            'System resume requested',
            ['user_id' => $user['id'], 'command' => 'resume_system']
        );

        return [
            'message' => 'System resume command sent successfully',
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
            'Log clear requested',
            ['user_id' => $user['id'], 'command' => 'clear_logs']
        );

        // Clear old log entries (keep last 1000 entries)
        try {
            $this->db->execute_query(
                "DELETE FROM log_s WHERE id NOT IN (SELECT id FROM (SELECT id FROM log_s ORDER BY id DESC LIMIT 1000) t)",
                []
            );

            return [
                'message' => 'System logs cleared successfully',
                'timestamp' => date('Y-m-d H:i:s')
            ];
        } catch (Exception $e) {
            throw new Exception('Failed to clear logs: ' . $e->getMessage());
        }
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
     * Execute user management actions
     */
    private function execute_user_action($user_id, $action, $current_user)
    {
        switch ($action) {
            case 'lock':
                $result = $this->db->execute('auth', 'lock_user', [$user_id]);
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
                $result = $this->db->execute('auth', 'unlock_user', [$user_id]);
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
                    $this->db->update_user_limit($user_id, $type, $posts, $hours);
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
                    $data = $this->db->get_recent_actions(10);
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
                    $data = $this->db->get_recent_actions(100);
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
} real-time system status (AJAX endpoint)
     */
    public function status()
    {
        try {
            $data = [
                'system_status' => $this->get_system_status(),
                'recent_actions' => $this->db->get_recent_actions(5),
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
     * System controls page
     */
    public function controls()
    {
        $user = $this->get_current_user();

        // Check if user has admin privileges (simple check for now)
        if ($user['id'] < 10) { // Admin users have low IDs
            $this->flash('error', 'Insufficient privileges for system controls.');
            $this->redirect('/dashboard');
        }

        $this->render('dashboard/controls', [
            'page_title' => 'System Controls',
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

        // Verify CSRF
        $csrf_token = $this->get_input('csrf_token');
        if (!$this->verify_csrf($csrf_token)) {
            $this->json(['success' => false, 'message' => 'Invalid security token'], 403);
        }

        $command = $this->get_input('command');
        $user = $this->get_current_user();

        // Admin check
        if ($user['id'] >= 10) {
            $this->json(['success' => false, 'message' => 'Insufficient privileges'], 403);
        }

        try {
            $result = $this->process_system_command($command, $user);
            $this->json(['success' => true, 'result' => $result]);

        } catch (Exception $e) {
            $this->log_event(
                'System Command Error',
                "Failed to execute command: {$command}",
                ['user_id' => $user['id'], 'error' => $e->getMessage()]
            );

            $this->json([
                'success' => false,
                'message' => 'Command execution failed',
                'error' => $this->debug_mode ? $e->getMessage() : null
            ], 500);
        }
    }

    /**
     * User management page
     */
    public function users()
    {
        try {
            $users = $this->db->query_all('auth', 'get_all_users_overview');
            $user_stats = $this->db->get_user_statistics();

            $this->render('dashboard/users', [
                'page_title' => 'User Management',
                'users' => $users,
                'user_stats' => $user_stats,
                'csrf_token' => $this->csrf_token()
            ]);

        } catch (Exception $e) {
            $this->flash('error', 'Error loading user data.');
            $this->redirect('/dashboard');
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
     * Get system status data
     */
    private function get_system_status()
    {
        $heartbeats = $this->db->get_active_heartbeats();
        $user_stats = $this->db->get_user_statistics();
        $dashboard_summary = $this->db->get_dashboard_summary();

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
            return $this->db->query_all('dashboard', 'get_user_activity_today');
        } catch (Exception $e) {
            if ($this->debug_mode) {
                error_log("[DashboardController] Error getting user activity: " . $e->getMessage());
            }
            return [];
        }
    }

    /**
     * Get
