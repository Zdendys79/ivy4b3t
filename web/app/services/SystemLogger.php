<?php
/**
 * File: SystemLogger.php
 * Location: ~/web/app/services/SystemLogger.php
 *
 * Purpose: Centralized system logging service for IVY4B3T.
 *          Provides consistent logging across the application.
 */

// Security check
if (!defined('IVY_FRAMEWORK')) {
    http_response_code(403);
    die('Direct access not allowed');
}

class SystemLogger
{
    private $db;
    private $debug_mode;

    public function __construct($db, $debug_mode = false)
    {
        $this->db = $db;
        $this->debug_mode = $debug_mode;
    }

    /**
     * Log system events with proper error handling
     */
    public function log_event($title, $text, $data = [])
    {
        try {
            // Fix: Proper null coalescing operator usage
            $hostname = gethostname() ?: 'unknown';

            $result = $this->db->execute('logging', 'insert_system_log', [
                $hostname,
                $title,
                $text,
                json_encode($data, JSON_UNESCAPED_UNICODE)
            ]);

            if ($this->debug_mode) {
                error_log("[SystemLogger] Logged event: {$title} from {$hostname}");
            }

            return $result;

        } catch (Exception $e) {
            if ($this->debug_mode) {
                error_log("[SystemLogger] Failed to log event '{$title}': " . $e->getMessage());
            }
            return false;
        }
    }

    /**
     * Log user-specific events
     */
    public function log_user_event($user_id, $title, $text, $data = [])
    {
        try {
            return $this->db->execute('logging', 'insert_user_log', [
                $user_id,
                $title,
                $text,
                json_encode($data, JSON_UNESCAPED_UNICODE)
            ]);
        } catch (Exception $e) {
            if ($this->debug_mode) {
                error_log("[SystemLogger] Failed to log user event '{$title}' for user {$user_id}: " . $e->getMessage());
            }
            return false;
        }
    }

    /**
     * Log critical system errors
     */
    public function log_critical($title, $text, $data = [])
    {
        $critical_data = array_merge($data, [
            'level' => 'CRITICAL',
            'timestamp' => date('Y-m-d H:i:s'),
            'memory_usage' => memory_get_usage(true),
            'peak_memory' => memory_get_peak_usage(true)
        ]);

        return $this->log_event("[CRITICAL] {$title}", $text, $critical_data);
    }

    /**
     * Log security events
     */
    public function log_security($title, $text, $data = [])
    {
        $security_data = array_merge($data, [
            'level' => 'SECURITY',
            'ip_address' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
            'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? 'unknown',
            'request_uri' => $_SERVER['REQUEST_URI'] ?? 'unknown'
        ]);

        return $this->log_event("[SECURITY] {$title}", $text, $security_data);
    }
}
