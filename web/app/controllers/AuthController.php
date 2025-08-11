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
     * Show login form or handle password authentication
     */
    public function login()
    {
        try {
            // Redirect if already authenticated
            if ($this->is_authenticated()) {
                $this->redirect('/dashboard');
            }

            // Check for active timeout FIRST - before any login processing
            $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
            $timeout_info = $this->checkLoginTimeout($ip);
            
            // If in timeout, show timeout page immediately
            if ($timeout_info) {
                $this->render('auth/login', [
                    'page_title' => 'IVY4B3T - Timeout',
                    'timeout_info' => $timeout_info,
                ]);
                return;
            }

            // Handle GET parameter login (pass=code)
            if (isset($_GET['pass']) && !empty($_GET['pass'])) {
                return $this->handleGetLogin($_GET['pass']);
            }

            // Handle POST request (login attempt)
            if ($_SERVER['REQUEST_METHOD'] === 'POST') {
                return $this->handlePasswordLogin();
            }
            
            // Normal login form (no timeout)
            $this->render('auth/login', [
                'page_title' => 'IVY4B3T - Přihlášení',
                'csrf_token' => $this->csrf_token(),
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            die("Login Error: " . $e->getMessage() . "\nFile: " . $e->getFile() . "\nLine: " . $e->getLine());
        }
    }

    /**
     * Handle password-only authentication
     */
    private function handlePasswordLogin()
    {
        $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
        
        // DOUBLE-CHECK timeout - safety measure
        $timeout_info = $this->checkLoginTimeout($ip);
        if ($timeout_info) {
            error_log("[AuthController] POST login blocked - IP {$ip} still in timeout ({$timeout_info['remaining_seconds']}s remaining)");
            $this->render('auth/login', [
                'page_title' => 'IVY4B3T - Timeout',
                'timeout_info' => $timeout_info,
            ]);
            return;
        }
        
        if ($this->debug_mode) {
            error_log("[AuthController] handlePasswordLogin - Method: " . $_SERVER['REQUEST_METHOD'] . ", IP: {$ip}");
        }
        
        // CSRF protection removed - session ID provides sufficient protection
        
        // Get password from POST
        $password = trim($_POST['password'] ?? '');
        
        if ($this->debug_mode) {
            error_log("[AuthController] Password length: " . strlen($password));
        }
        
        if (empty($password)) {
            $this->recordFailedAttempt($ip);
            $this->flash('error', 'Heslo je povinné.');
            $this->redirect('/login');
        }
        
        // Check password against database variables (web_pass_*)
        if ($this->verifyPasswordAgainstDatabase($password)) {
            // Successful login
            if ($this->debug_mode) {
                error_log("[AuthController] LOGIN SUCCESS for IP {$ip} with password length " . strlen($password));
            }
            
            $this->clearFailedAttempts($ip);
            $this->createAdminSession();
            
            // Successful login - no logging needed for simplicity
            
            $this->flash('success', 'Přihlášení úspěšné!');
            $this->redirect('/dashboard');
        } else {
            // Failed login
            if ($this->debug_mode) {
                error_log("[AuthController] LOGIN FAILED for IP {$ip} with password: '{$password}' (length: " . strlen($password) . ")");
            }
            
            // ALWAYS log for debugging  
            error_log("[AuthController] POST LOGIN FAILED - calling recordFailedAttempt for IP: {$ip}");
            
            $this->recordFailedAttempt($ip);
            
            // Failed login - no logging needed for simplicity
            
            $this->flash('error', 'Nesprávné heslo.');
            $this->redirect('/login');
        }
    }


    /**
     * Logout user
     */
    public function logout()
    {
        // Destroy session without complex logging
        $this->destroy_session();

        $this->flash('success', 'Byl jste úspěšně odhlášen.');
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
    private function get_login_system_info()
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
     * Create admin session (simplified)
     */
    private function createAdminSession()
    {
        // Regenerate session ID for security
        session_regenerate_id(true);

        // Set session variables
        $_SESSION['user_id'] = 'admin';
        $_SESSION['user_name'] = 'Administrator';
        $_SESSION['auth_method'] = 'password';
        $_SESSION['is_authenticated'] = true;
        $_SESSION['login_time'] = time();
        $_SESSION['last_activity'] = time();

        if ($this->debug_mode) {
            error_log("[AuthController] Admin session created");
        }
    }

    /**
     * Check if IP has active timeout
     */
    private function checkLoginTimeout($ip)
    {
        try {
            $stmt = $this->db->getPDO()->prepare("
                SELECT failed_attempts, timeout_until, 
                       TIMESTAMPDIFF(SECOND, NOW(), timeout_until) as remaining_seconds
                FROM web_login_timeouts 
                WHERE ip_address = ? AND timeout_until > NOW()
            ");
            $stmt->execute([$ip]);
            $result = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($result) {
                // Calculate next timeout (double the current one)
                $next_timeout = min(5 * pow(2, $result['failed_attempts']), 3600); // Max 1 hour
                
                return [
                    'failed_attempts' => $result['failed_attempts'],
                    'remaining_seconds' => max(0, $result['remaining_seconds']),
                    'timeout_until_js' => date('c', strtotime('+' . $result['remaining_seconds'] . ' seconds')),
                    'next_timeout_seconds' => $next_timeout
                ];
            }
            
            return null;
        } catch (Exception $e) {
            error_log("[AuthController] Error checking timeout: " . $e->getMessage());
            return null;
        }
    }

    /**
     * Get failed attempts for IP (without timeout)
     */
    private function getFailedAttempts($ip)
    {
        try {
            $stmt = $this->db->getPDO()->prepare("
                SELECT failed_attempts FROM web_login_timeouts WHERE ip_address = ?
            ");
            $stmt->execute([$ip]);
            $result = $stmt->fetch(PDO::FETCH_ASSOC);
            
            return $result ? $result['failed_attempts'] : 0;
        } catch (Exception $e) {
            error_log("[AuthController] Error getting failed attempts: " . $e->getMessage());
            return 0;
        }
    }

    /**
     * Record failed login attempt with immediate escalating timeout
     * Timeout starts from first failed attempt: 5s, 10s, 20s, 40s, 80s...
     */
    private function recordFailedAttempt($ip)
    {
        try {
            // Get current attempts
            $stmt = $this->db->getPDO()->prepare("
                SELECT failed_attempts FROM web_login_timeouts WHERE ip_address = ?
            ");
            $stmt->execute([$ip]);
            $result = $stmt->fetch(PDO::FETCH_ASSOC);
            
            $failed_attempts = $result ? $result['failed_attempts'] + 1 : 1;
            
            // Calculate timeout: IMMEDIATE from first attempt
            // 1st attempt = 5s, 2nd = 10s, 3rd = 20s, 4th = 40s, 5th = 80s... (max 1 hour)
            $timeout_seconds = min(5 * pow(2, $failed_attempts - 1), 3600);
            
            // Upsert timeout record - ALWAYS create timeout, even for first attempt
            $stmt = $this->db->getPDO()->prepare("
                INSERT INTO web_login_timeouts (ip_address, failed_attempts, timeout_until) 
                VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND))
                ON DUPLICATE KEY UPDATE 
                    failed_attempts = ?,
                    timeout_until = DATE_ADD(NOW(), INTERVAL ? SECOND),
                    last_attempt = NOW()
            ");
            $stmt->execute([$ip, $failed_attempts, $timeout_seconds, $failed_attempts, $timeout_seconds]);
            
            // ALWAYS log for debugging
            error_log("[AuthController] RECORDED timeout for IP {$ip}: attempt #{$failed_attempts}, timeout {$timeout_seconds}s");
            
            if ($this->debug_mode) {
                error_log("[AuthController] IMMEDIATE timeout for IP {$ip}: attempt #{$failed_attempts}, timeout {$timeout_seconds}s");
            }
        } catch (Exception $e) {
            error_log("[AuthController] Error recording failed attempt: " . $e->getMessage());
        }
    }

    /**
     * Clear failed attempts for IP
     */
    private function clearFailedAttempts($ip)
    {
        try {
            $stmt = $this->db->getPDO()->prepare("DELETE FROM web_login_timeouts WHERE ip_address = ?");
            $stmt->execute([$ip]);
            
            if ($this->debug_mode) {
                error_log("[AuthController] Cleared failed attempts for IP {$ip}");
            }
        } catch (Exception $e) {
            error_log("[AuthController] Error clearing failed attempts: " . $e->getMessage());
        }
    }

    /**
     * Verify password against database variables with pattern web_pass_*
     */
    private function verifyPasswordAgainstDatabase($inputPassword)
    {
        try {
            // First, get all web_pass_* variables
            $stmt = $this->db->getPDO()->prepare("
                SELECT name, value FROM variables 
                WHERE name LIKE 'web_pass_%'
            ");
            $stmt->execute();
            $allPasswords = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            if ($this->debug_mode) {
                error_log("[AuthController] Found " . count($allPasswords) . " password variables");
                foreach ($allPasswords as $pass) {
                    error_log("[AuthController] " . $pass['name'] . " = " . $pass['value']);
                }
                error_log("[AuthController] Input password: " . $inputPassword);
            }
            
            // Check if input matches any of them
            foreach ($allPasswords as $passData) {
                if ($passData['value'] === $inputPassword) {
                    if ($this->debug_mode) {
                        error_log("[AuthController] Password MATCH found in " . $passData['name']);
                    }
                    return true;
                }
            }
            
            if ($this->debug_mode) {
                error_log("[AuthController] Password verification: INVALID - no matches");
            }
            
            return false;
        } catch (Exception $e) {
            error_log("[AuthController] Error verifying password: " . $e->getMessage());
            return false;
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

    /**
     * Handle GET parameter login (?pass=code)
     */
    private function handleGetLogin($password)
    {
        $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
        
        // DOUBLE-CHECK timeout - safety measure
        $timeout_info = $this->checkLoginTimeout($ip);
        if ($timeout_info) {
            error_log("[AuthController] GET login blocked - IP {$ip} still in timeout ({$timeout_info['remaining_seconds']}s remaining)");
            $this->render('auth/login', [
                'page_title' => 'IVY4B3T - Timeout',
                'timeout_info' => $timeout_info,
            ]);
            return;
        }
        
        if ($this->debug_mode) {
            error_log("[AuthController] handleGetLogin - Password: '{$password}', IP: {$ip}");
        }
        
        // Verify password against database
        if ($this->verifyPasswordAgainstDatabase($password)) {
            // Successful login
            if ($this->debug_mode) {
                error_log("[AuthController] GET LOGIN SUCCESS for IP {$ip} with password: {$password}");
            }
            
            $this->clearFailedAttempts($ip);
            $this->createAdminSession();
            
            $this->flash('success', 'Přihlášení úspěšné!');
            $this->redirect('/dashboard');
        } else {
            // Failed login
            if ($this->debug_mode) {
                error_log("[AuthController] GET LOGIN FAILED for IP {$ip} with password: '{$password}'");
            }
            
            // ALWAYS log for debugging  
            error_log("[AuthController] GET LOGIN FAILED - calling recordFailedAttempt for IP: {$ip}");
            
            $this->recordFailedAttempt($ip);
            $this->flash('error', 'Nesprávné heslo.');
            $this->redirect('/login');
        }
    }
    
}
