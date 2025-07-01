<?php
/**
 * File: AuthController.php
 * Location: ~/web/app/controllers/AuthController.php
 *
 * Purpose: Authentication controller for login, logout, and session management.
 *          Handles user authentication with enhanced security measures.
 */

// Security check
if (!defined('IVY_FRAMEWORK')) {
    http_response_code(403);
    die('Direct access not allowed');
}

require_once dirname(__DIR__) . '/core/BaseController.php';

class AuthController extends BaseController
{
    protected $layout = 'auth';

    protected function init()
    {
        // Initialize session if not started
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
    }

    /**
     * Show login form
     */
    public function login()
    {
        // Redirect if already authenticated
        if ($this->is_authenticated()) {
            $this->redirect('/dashboard');
        }

        // Get system information for display
        $system_info = $this->get_system_info();
        $flash = $this->get_flash();

        $this->render('auth/login', [
            'page_title' => 'IVY4B3T - Přihlášení',
            'system_info' => $system_info,
            'flash' => $flash,
            'csrf_token' => $this->csrf_token()
        ]);
    }

    /**
     * Process login attempt
     */
    public function authenticate()
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->redirect('/login');
        }

        // Validate CSRF token
        $csrf_token = $this->get_input('csrf_token');
        if (!$this->verify_csrf($csrf_token)) {
            $this->flash('error', 'Invalid security token. Please try again.');
            $this->redirect('/login');
        }

        // Validate input
        $validation = $this->validate([
            'username' => 'required',
            'password' => 'required'
        ]);

        if (!$validation['valid']) {
            $this->flash('error', 'All fields are required.');
            $this->redirect('/login');
        }

        $username = $validation['data']['username'];
        $password = $validation['data']['password'];

        // Rate limiting check
        if (!$this->check_rate_limit($username)) {
            $this->flash('error', 'Too many login attempts. Please wait before trying again.');
            $this->redirect('/login');
        }

        // Attempt authentication
        $user = $this->db->find_user_by_login($username);

        if ($user && $this->verify_password($password, $user['fb_pass'])) {
            // Successful login
            $this->log_login_attempt($username, true, $user['id']);
            $this->create_user_session($user);

            $this->flash('success', 'Welcome back, ' . $user['name'] . '!');

            // Redirect to intended page or dashboard
            $redirect_url = $_SESSION['intended_url'] ?? '/dashboard';
            unset($_SESSION['intended_url']);

            $this->redirect($redirect_url);

        } else {
            // Failed login
            $this->log_login_attempt($username, false);
            $this->flash('error', 'Invalid username or password.');
            $this->redirect('/login');
        }
    }

    /**
     * Logout user
     */
    public function logout()
    {
        if ($this->is_authenticated()) {
            $user = $this->get_current_user();

            // Log logout event
            $this->log_event(
                'User Logout',
                "User {$user['name']} {$user['surname']} logged out",
                ['user_id' => $user['id']]
            );
        }

        // Destroy session
        $this->destroy_session();

        $this->flash('success', 'You have been logged out successfully.');
        $this->redirect('/login');
    }

    /**
     * Check user session status (AJAX endpoint)
     */
    public function check_session()
    {
        $this->json([
            'authenticated' => $this->is_authenticated(),
            'user' => $this->get_current_user(),
            'csrf_token' => $this->csrf_token()
        ]);
    }

    /**
     * Refresh session (extend expiry)
     */
    public function refresh_session()
    {
        if (!$this->is_authenticated()) {
            $this->json(['success' => false, 'message' => 'Not authenticated'], 401);
        }

        // Regenerate session ID for security
        session_regenerate_id(true);

        // Update session timestamp
        $_SESSION['last_activity'] = time();

        $this->json([
            'success' => true,
            'message' => 'Session refreshed',
            'csrf_token' => $this->csrf_token()
        ]);
    }

    /**
     * Get system information for login page
     */
    private function get_system_info()
    {
        try {
            $heartBeats = $this->db->get_active_heartBeats();
            $user_stats = $this->db->get_user_statistics();

            return [
                'active_hosts' => count($heartBeats),
                'total_users' => $user_stats['total_users'] ?? 0,
                'active_users' => $user_stats['active_users'] ?? 0,
                'version' => 'IVY4B3T v2.0'
            ];
        } catch (Exception $e) {
            if ($this->debug_mode) {
                error_log("[AuthController] Error getting system info: " . $e->getMessage());
            }
            return null;
        }
    }

    /**
     * Verify password (simple comparison for now, can be enhanced)
     */
    private function verify_password($input_password, $stored_password)
    {
        // For now, simple comparison as per existing system
        // In production, this should use password_verify() with hashed passwords
        return $input_password === $stored_password;
    }

    /**
     * Create user session
     */
    private function create_user_session($user)
    {
        // Regenerate session ID for security
        session_regenerate_id(true);

        // Set session variables
        $_SESSION['user_id'] = $user['id'];
        $_SESSION['user_name'] = $user['name'] . ' ' . $user['surname'];
        $_SESSION['login_time'] = time();
        $_SESSION['last_activity'] = time();
        $_SESSION['user_data'] = $user;

        // Clear rate limiting for successful login
        unset($_SESSION['login_attempts']);

        if ($this->debug_mode) {
            error_log("[AuthController] User session created for user ID: {$user['id']}");
        }
    }

    /**
     * Destroy user session
     */
    private function destroy_session()
    {
        // Clear all session variables
        $_SESSION = array();

        // Delete session cookie
        if (isset($_COOKIE[session_name()])) {
            setcookie(session_name(), '', time() - 3600, '/');
        }

        // Destroy session
        session_destroy();

        // Start new session for flash messages
        session_start();
        session_regenerate_id(true);
    }

    /**
     * Rate limiting for login attempts
     */
    private function check_rate_limit($username)
    {
        $max_attempts = 5;
        $lockout_time = 900; // 15 minutes

        if (!isset($_SESSION['login_attempts'])) {
            $_SESSION['login_attempts'] = [];
        }

        $attempts = &$_SESSION['login_attempts'];
        $now = time();

        // Clean old attempts
        foreach ($attempts as $user => $data) {
            if (($now - $data['last_attempt']) > $lockout_time) {
                unset($attempts[$user]);
            }
        }

        // Check current user's attempts
        if (isset($attempts[$username])) {
            $user_attempts = $attempts[$username];

            if ($user_attempts['count'] >= $max_attempts) {
                $time_passed = $now - $user_attempts['last_attempt'];
                if ($time_passed < $lockout_time) {
                    return false; // Still in lockout period
                } else {
                    // Lockout period expired, reset
                    unset($attempts[$username]);
                }
            }
        }

        return true;
    }

    /**
     * Log login attempt
     */
    private function log_login_attempt($username, $success, $user_id = null)
    {
        $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
        $user_agent = $_SERVER['HTTP_USER_AGENT'] ?? 'unknown';

        if (!$success) {
            // Increment failed attempts
            if (!isset($_SESSION['login_attempts'])) {
                $_SESSION['login_attempts'] = [];
            }

            if (!isset($_SESSION['login_attempts'][$username])) {
                $_SESSION['login_attempts'][$username] = ['count' => 0, 'last_attempt' => 0];
            }

            $_SESSION['login_attempts'][$username]['count']++;
            $_SESSION['login_attempts'][$username]['last_attempt'] = time();
        }

        // Log to database
        $this->log_event(
            $success ? 'Successful Login' : 'Failed Login',
            $success ? "User {$username} logged in successfully" : "Failed login attempt for {$username}",
            [
                'username' => $username,
                'user_id' => $user_id,
                'ip' => $ip,
                'user_agent' => $user_agent,
                'success' => $success
            ]
        );

        if ($this->debug_mode) {
            error_log("[AuthController] Login attempt logged: {$username} - " . ($success ? 'SUCCESS' : 'FAILED'));
        }
    }
}
