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
        try {
            // Redirect if already authenticated
            if ($this->is_authenticated()) {
                $this->redirect('/dashboard');
            }

            // Get system information for display
            $system_info = $this->get_login_system_info();
            $flash = $this->get_flash();

            $this->render('auth/login', [
                'page_title' => 'IVY4B3T - Přihlášení',
                'system_info' => $system_info,
                'flash' => $flash,
                'csrf_token' => $this->csrf_token()
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            die("Login Error: " . $e->getMessage() . "\nFile: " . $e->getFile() . "\nLine: " . $e->getLine());
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
    
    /**
     * Redirect to Google OAuth
     */
    public function googleLogin()
    {
        require_once dirname(__DIR__) . '/services/GoogleOAuthService.php';
        
        try {
            $oauth = new GoogleOAuthService();
            $authUrl = $oauth->getAuthUrl();
            
            header('Location: ' . $authUrl);
            exit;
            
        } catch (Exception $e) {
            $this->flash('error', 'Google OAuth error: ' . $e->getMessage());
            $this->redirect('/login');
        }
    }
    
    /**
     * Handle Google OAuth callback
     */
    public function googleCallback()
    {
        // Debug mode - log everything
        error_log("=== OAuth Callback Started ===");
        error_log("GET params: " . json_encode($_GET));
        error_log("POST params: " . json_encode($_POST));
        error_log("Session before: " . json_encode($_SESSION));
        error_log("Session ID: " . session_id());
        error_log("Session save path: " . session_save_path());
        error_log("Session cookie params: " . json_encode(session_get_cookie_params()));
        
        require_once dirname(__DIR__) . '/services/GoogleOAuthService.php';
        
        if (!isset($_GET['code']) || !isset($_GET['state'])) {
            error_log("FATAL: Missing code or state parameter");
            die("OAuth Error: Missing required parameters. Code: " . (isset($_GET['code']) ? 'present' : 'MISSING') . ", State: " . (isset($_GET['state']) ? 'present' : 'MISSING'));
        }
        
        try {
            $oauth = new GoogleOAuthService();
            error_log("GoogleOAuthService created successfully");
            
            // Exchange code for token
            error_log("Attempting token exchange...");
            $tokenData = $oauth->exchangeCodeForToken($_GET['code'], $_GET['state']);
            error_log("Token exchange successful: " . json_encode($tokenData));
            
            // Get user info
            error_log("Attempting to get user info...");
            $userInfo = $oauth->getUserInfo($tokenData['access_token']);
            error_log("User info received: " . json_encode($userInfo));
            
            // Check if user is allowed (basic whitelist)
            $allowedEmails = ['b3.remotes@gmail.com', 'zdendys79@gmail.com'];
            
            if (!in_array($userInfo['email'], $allowedEmails)) {
                error_log("FATAL: Email not whitelisted: " . $userInfo['email']);
                die("Access Denied: Email " . htmlspecialchars($userInfo['email']) . " is not authorized. Contact administrator.");
            }
            
            error_log("Email whitelisted, creating session...");
            
            // Create session for Google user
            $this->create_google_user_session($userInfo);
            
            error_log("Session creation completed");
            error_log("Session after creation: " . json_encode($_SESSION));
            error_log("is_authenticated check: " . ($this->is_authenticated() ? 'TRUE' : 'FALSE'));
            
            // Verify session was created properly
            if (!$this->is_authenticated()) {
                error_log("FATAL: Session creation failed - user not authenticated after session creation");
                die("Session Error: Authentication failed after session creation. Please try again.");
            }
            
            error_log("Authentication verified, redirecting to dashboard");
            
            $this->flash('success', 'Welcome ' . $userInfo['name'] . '!');
            $this->redirect('/dashboard');
            
        } catch (Exception $e) {
            error_log("FATAL OAuth exception: " . $e->getMessage());
            error_log("Exception file: " . $e->getFile());
            error_log("Exception line: " . $e->getLine());
            error_log("Full stack trace: " . $e->getTraceAsString());
            
            // Don't redirect on error - show detailed error instead
            die("OAuth Error: " . htmlspecialchars($e->getMessage()) . "<br><br>File: " . htmlspecialchars($e->getFile()) . "<br>Line: " . $e->getLine() . "<br><br>Check server logs for detailed stack trace.");
        }
    }
    
    /**
     * Create session for Google OAuth user
     */
    private function create_google_user_session($userInfo)
    {
        $_SESSION['user_id'] = 'google_' . $userInfo['id'];
        $_SESSION['user_name'] = $userInfo['name'];
        $_SESSION['user_email'] = $userInfo['email'];
        $_SESSION['user_picture'] = $userInfo['picture'] ?? '';
        $_SESSION['auth_method'] = 'google';
        $_SESSION['is_authenticated'] = true;
        $_SESSION['login_time'] = time();
        $_SESSION['last_activity'] = time();
        
        error_log("Google OAuth session created for: " . $userInfo['email']);
        error_log("Session ID: " . session_id());
        error_log("Session data after creation: " . json_encode($_SESSION));
    }
    
}
