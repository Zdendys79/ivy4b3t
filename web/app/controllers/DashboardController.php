<?php
/**
 * File: DashboardController.php
 * Location: ~/web/app/controllers/DashboardController.php
 *
 * Purpose: Main dashboard controller for system monitoring and management.
 *          Refactored for better maintainability and separation of concerns.
 */

// Security check
if (!defined('IVY_FRAMEWORK')) {
    http_response_code(403);
    die('Direct access not allowed');
}

require_once dirname(__DIR__) . '/core/BaseController.php';
require_once dirname(__DIR__) . '/core/Database.php';
require_once dirname(__DIR__) . '/services/SystemLogger.php';
require_once dirname(__DIR__) . '/services/SystemStatusService.php';
require_once dirname(__DIR__) . '/services/SystemCommandService.php';
require_once dirname(__DIR__) . '/services/UserManagementService.php';
require_once dirname(__DIR__) . '/services/ExportService.php';

class DashboardController extends BaseController
{
    private $logger;
    private $statusService;
    private $commandService;
    private $userService;
    private $exportService;

    protected function init()
    {
        // Skip auth requirement for main menu - keep simple
    }

    /**
     * Main dashboard page (root route - show main menu)
     */
    public function index()
    {
        // Show main menu instead of full dashboard on root
        $this->showMainMenu();
    }
    
    /**
     * Show main navigation menu
     */
    public function showMainMenu()
    {
        require_once dirname(__DIR__) . '/views/main-menu.php';
    }
    
    /**
     * Full dashboard with monitoring data
     */
    public function dashboard()
    {
        try {
            // Get dashboard data using services
            $system_status = $this->statusService->get_system_status();
            $recent_actions = $this->statusService->get_recent_actions(10);
            $user_activity = $this->statusService->get_user_activity_today();
            $system_health = $this->statusService->get_system_health();
            $flash = $this->get_flash();

            $this->render('dashboard/index', [
                'page_title' => 'IVY4B3T Dashboard',
                'page_css' => ['dashboard'], // Include dashboard.css
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
            $this->logger->log_critical(
                'Dashboard Load Error',
                'Failed to load dashboard page',
                ['error' => $e->getMessage(), 'user' => $this->get_current_user()['id']]
            );

            $this->flash('error', 'Error loading dashboard data. Please try again.');
            $this->render('dashboard/error', [
                'page_title' => 'Dashboard Error',
                'error' => $this->debug_mode ? $e->getMessage() : 'Internal server error'
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
                'system_status' => $this->statusService->get_system_status(),
                'recent_actions' => $this->statusService->get_recent_actions(5),
                'timestamp' => date('Y-m-d H:i:s'),
                'success' => true
            ];

            $this->json($data);

        } catch (Exception $e) {
            $this->logger->log_event(
                'Status API Error',
                'Failed to fetch system status',
                ['error' => $e->getMessage()]
            );

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
            $data = $this->statusService->get_widget_data($widget);

            $this->json([
                'success' => true,
                'data' => $data,
                'timestamp' => date('Y-m-d H:i:s')
            ]);

        } catch (Exception $e) {
            $this->logger->log_event(
                'Widget API Error',
                "Failed to load widget: {$widget}",
                ['widget' => $widget, 'error' => $e->getMessage()]
            );

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

        // Check admin privileges
        if (!$this->userService->has_admin_privileges($user)) {
            $this->logger->log_security(
                'Unauthorized Controls Access',
                "User {$user['id']} attempted to access system controls",
                ['user' => $user]
            );

            $this->flash('error', 'Insufficient privileges for system controls.');
            $this->redirect('/dashboard');
            return;
        }

        try {
            $system_health = $this->statusService->get_system_health();
            $flash = $this->get_flash();

            $this->render('dashboard/controls', [
                'page_title' => 'System Controls',
                'system_health' => $system_health,
                'flash' => $flash,
                'current_user' => $user,
                'csrf_token' => $this->csrf_token()
            ]);

        } catch (Exception $e) {
            $this->logger->log_critical(
                'Controls Load Error',
                'Failed to load system controls page',
                ['error' => $e->getMessage(), 'user' => $user['id']]
            );

            $this->flash('error', 'Error loading system controls.');
            $this->redirect('/dashboard');
        }
    }

    /**
     * Validate CSRF token from request
     */
    private function validate_csrf()
    {
        $csrf_token = $this->get_input('csrf_token');
        if (!$this->verify_csrf($csrf_token)) {
            throw new Exception('Invalid CSRF token');
        }
    }

    /**
     * Execute system commands (AJAX endpoint)
     */
    public function command()
    {
        try {
            $this->validate_csrf();
            $user = $this->get_current_user();

            if (!$this->userService->has_admin_privileges($user)) {
                throw new Exception('Insufficient privileges');
            }

            $command = $this->get_input('command');
            if (empty($command)) {
                throw new Exception('Command parameter is required');
            }

            $result = $this->commandService->execute_command($command, $user);

            $this->json([
                'success' => true,
                'data' => $result
            ]);

        } catch (Exception $e) {
            $this->logger->log_security(
                'Command Execution Error',
                "Failed to execute command: " . ($command ?? 'unknown'),
                ['error' => $e->getMessage(), 'user' => $this->get_current_user()['id']]
            );

            $this->json([
                'success' => false,
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * User management actions (AJAX endpoint)
     */
    public function user_action()
    {
        try {
            $this->validate_csrf();
            $user = $this->get_current_user();

            if (!$this->userService->has_admin_privileges($user)) {
                throw new Exception('Insufficient privileges');
            }

            $user_id = $this->get_input('user_id');
            $action = $this->get_input('action');

            if (empty($user_id) || empty($action)) {
                throw new Exception('User ID and action parameters are required');
            }

            $result = $this->userService->execute_user_action($user_id, $action, $user);

            $this->json([
                'success' => true,
                'data' => $result
            ]);

        } catch (Exception $e) {
            $this->logger->log_security(
                'User Action Error',
                "Failed to execute user action: " . ($action ?? 'unknown'),
                ['error' => $e->getMessage(), 'target_user' => $user_id ?? 'unknown']
            );

            $this->json([
                'success' => false,
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Export data endpoint
     */
    public function export()
    {
        try {
            $this->validate_csrf();
            $user = $this->get_current_user();

            if (!$this->userService->has_admin_privileges($user)) {
                throw new Exception('Insufficient privileges');
            }

            $type = $this->get_input('type');
            $format = $this->get_input('format');

            if (empty($type) || empty($format)) {
                throw new Exception('Type and format parameters are required');
            }

            $this->logger->log_event(
                'Data Export',
                "User {$user['name']} exported {$type} as {$format}",
                ['user_id' => $user['id'], 'type' => $type, 'format' => $format]
            );

            $this->exportService->export_data($type, $format);

        } catch (Exception $e) {
            $this->logger->log_event(
                'Export Error',
                'Failed to export data',
                ['error' => $e->getMessage(), 'type' => $type ?? 'unknown']
            );

            $this->flash('error', 'Export failed: ' . $e->getMessage());
            $this->redirect('/dashboard/controls');
        }
    }
}
