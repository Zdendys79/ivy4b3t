<?php
/**
 * Authentication Middleware
 * Protects all routes except login and OAuth
 */

// Security check
if (!defined('IVY_FRAMEWORK')) {
    http_response_code(403);
    die('Direct access not allowed');
}

class AuthMiddleware
{
    /**
     * Public routes that don't require authentication
     */
    private static $publicRoutes = [
        '/login'
    ];
    
    /**
     * Check if current route requires authentication
     */
    public static function requiresAuth($path)
    {
        // Counter routes are public
        if (preg_match('#^/counter/\d+$#', $path)) {
            return false;
        }
        
        return !in_array($path, self::$publicRoutes);
    }
    
    /**
     * Check if user is authenticated
     */
    public static function isAuthenticated()
    {
        error_log("=== AuthMiddleware::isAuthenticated() ===");
        error_log("Session ID: " . session_id());
        error_log("Session data: " . json_encode($_SESSION));
        error_log("is_authenticated value: " . (isset($_SESSION['is_authenticated']) ? $_SESSION['is_authenticated'] : 'NOT_SET'));
        
        // Check if session exists and is authenticated
        if (!isset($_SESSION['is_authenticated']) || $_SESSION['is_authenticated'] !== true) {
            error_log("Result: FALSE - not authenticated");
            return false;
        }
        
        // Check if session has expired (if expires_at is set)
        if (isset($_SESSION['expires_at']) && time() > $_SESSION['expires_at']) {
            error_log("Result: FALSE - session expired");
            // Clear expired session
            $_SESSION = [];
            return false;
        }
        
        // Update last activity and extend session expiration
        $_SESSION['last_activity'] = time();
        $_SESSION['expires_at'] = time() + (30 * 24 * 60 * 60); // Extend for another 30 days
        
        error_log("Result: TRUE - authenticated and valid");
        return true;
    }
    
    /**
     * Get current user info
     */
    public static function getCurrentUser()
    {
        if (!self::isAuthenticated()) {
            return null;
        }
        
        return [
            'id' => $_SESSION['user_id'] ?? null,
            'name' => $_SESSION['user_name'] ?? null,
            'email' => $_SESSION['user_email'] ?? null,
            'picture' => $_SESSION['user_picture'] ?? null,
            'auth_method' => $_SESSION['auth_method'] ?? null,
            'login_time' => $_SESSION['login_time'] ?? null
        ];
    }
    
    /**
     * Protect route - redirect to login if not authenticated
     */
    public static function protect($path)
    {
        error_log("=== AuthMiddleware::protect($path) ===");
        error_log("Requires auth: " . (self::requiresAuth($path) ? 'TRUE' : 'FALSE'));
        
        if (self::requiresAuth($path)) {
            $isAuth = self::isAuthenticated();
            error_log("User authenticated: " . ($isAuth ? 'TRUE' : 'FALSE'));
            
            if (!$isAuth) {
                error_log("REDIRECTING TO LOGIN - user not authenticated");
                
                // Store intended URL for redirect after login (only for real pages, not assets)
                if (!in_array($path, ['/favicon.ico', '/robots.txt']) && !preg_match('/\.(css|js|png|jpg|ico|svg)$/', $path)) {
                    $_SESSION['intended_url'] = $path;
                    error_log("Storing intended URL: " . $path);
                } else {
                    error_log("Not storing asset URL: " . $path);
                }
                
                header('Location: /login');
                exit;
            } else {
                error_log("ACCESS GRANTED - user is authenticated");
            }
        } else {
            error_log("PUBLIC ROUTE - no auth required");
        }
    }
    
    /**
     * Logout user
     */
    public static function logout()
    {
        // Clear all session data
        $_SESSION = [];
        
        // Destroy session cookie
        if (ini_get("session.use_cookies")) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000,
                $params["path"], $params["domain"],
                $params["secure"], $params["httponly"]
            );
        }
        
        // Destroy session
        session_destroy();
        
        // Start new session for flash messages
        session_start();
        $_SESSION['flash_success'] = 'Byl jste úspěšně odhlášen';
    }
}