<?php
/**
 * File: UserManagementService.php
 * Location: ~/web/app/services/UserManagementService.php
 *
 * Purpose: Service for handling user management operations.
 *          Provides user administration, privilege checking, and user actions.
 */

// Security check
if (!defined('IVY_FRAMEWORK')) {
    http_response_code(403);
    die('Direct access not allowed');
}

class UserManagementService
{
    private $db;
    private $logger;

    public function __construct($db, $logger)
    {
        $this->db = $db;
        $this->logger = $logger;
    }

    /**
     * Check if user has admin privileges
     */
    public function has_admin_privileges($user)
    {
        // Admin users have low IDs (simple check for now)
        return $user['id'] < 10;
    }

    /**
     * Execute user management actions
     */
    public function execute_user_action($user_id, $action, $current_user)
    {
        switch ($action) {
            case 'lock':
                return $this->lock_user($user_id, $current_user);

            case 'unlock':
                return $this->unlock_user($user_id, $current_user);

            case 'reset_limits':
                return $this->reset_user_limits($user_id, $current_user);

            case 'get_details':
                return $this->get_user_details($user_id);

            default:
                throw new Exception("Unknown user action: {$action}");
        }
    }

    /**
     * Lock user account
     */
    private function lock_user($user_id, $current_user)
    {
        $result = $this->db->execute('user_management', 'lock_user', [$user_id]);

        if ($result) {
            $this->logger->log_event(
                'User Management',
                "User {$user_id} locked by {$current_user['name']}",
                ['target_user_id' => $user_id, 'admin_user_id' => $current_user['id']]
            );
            return ['message' => 'User locked successfully'];
        }

        throw new Exception('Failed to lock user');
    }

    /**
     * Unlock user account
     */
    private function unlock_user($user_id, $current_user)
    {
        $result = $this->db->execute('user_management', 'unlock_user', [$user_id]);

        if ($result) {
            $this->logger->log_event(
                'User Management',
                "User {$user_id} unlocked by {$current_user['name']}",
                ['target_user_id' => $user_id, 'admin_user_id' => $current_user['id']]
            );
            return ['message' => 'User unlocked successfully'];
        }

        throw new Exception('Failed to unlock user');
    }

    /**
     * Reset user limits to default values
     */
    private function reset_user_limits($user_id, $current_user)
    {
        // Default limits configuration
        $default_limits = [
            ['G', 15, 24],  // Groups: 15 posts per 24 hours
            ['GV', 1, 8],   // Group videos: 1 post per 8 hours
            ['P', 2, 8],    // Posts: 2 posts per 8 hours
            ['Z', 1, 48]    // Messages: 1 per 48 hours
        ];

        try {
            foreach ($default_limits as [$type, $posts, $hours]) {
                $this->db->execute('user_management', 'reset_user_limits', [$user_id, $type, $posts, $hours]);
            }

            $this->logger->log_event(
                'User Management',
                "Limits reset for user {$user_id} by {$current_user['name']}",
                ['target_user_id' => $user_id, 'admin_user_id' => $current_user['id']]
            );

            return ['message' => 'User limits reset successfully'];

        } catch (Exception $e) {
            $this->logger->log_event(
                'User Management Error',
                "Failed to reset limits for user {$user_id}",
                ['target_user_id' => $user_id, 'error' => $e->getMessage()]
            );
            throw new Exception('Failed to reset user limits');
        }
    }

    /**
     * Get detailed user information
     */
    private function get_user_details($user_id)
    {
        try {
            $user_details = $this->db->query_first('user_management', 'get_user_details', [$user_id]);
            $limit_usage = $this->db->query_all('user_management', 'get_user_limit_usage', [$user_id]);

            return [
                'message' => 'User details retrieved successfully',
                'data' => [
                    'user' => $user_details,
                    'limit_usage' => $limit_usage
                ]
            ];

        } catch (Exception $e) {
            $this->logger->log_event(
                'User Details Error',
                "Failed to get details for user {$user_id}",
                ['target_user_id' => $user_id, 'error' => $e->getMessage()]
            );
            throw new Exception('Failed to retrieve user details');
        }
    }

    /**
     * Get list of users for management
     */
    public function get_users_list($filters = [])
    {
        try {
            $params = [];
            $where_conditions = [];

            // Apply filters
            if (!empty($filters['status'])) {
                switch ($filters['status']) {
                    case 'active':
                        $where_conditions[] = "locked IS NULL";
                        break;
                    case 'locked':
                        $where_conditions[] = "locked IS NOT NULL";
                        break;
                }
            }

            if (!empty($filters['host'])) {
                $where_conditions[] = "host = ?";
                $params[] = $filters['host'];
            }

            return $this->db->query_all('user_management', 'get_users_with_filters', array_merge([$where_conditions], $params));

        } catch (Exception $e) {
            $this->logger->log_event(
                'User List Error',
                'Failed to retrieve users list',
                ['filters' => $filters, 'error' => $e->getMessage()]
            );
            return [];
        }
    }

    /**
     * Get user activity summary
     */
    public function get_user_activity_summary($user_id, $days = 7)
    {
        try {
            return $this->db->query_all('user_management', 'get_user_activity_summary', [$user_id, $days]);
        } catch (Exception $e) {
            $this->logger->log_event(
                'User Activity Error',
                "Failed to get activity summary for user {$user_id}",
                ['user_id' => $user_id, 'error' => $e->getMessage()]
            );
            return [];
        }
    }
}
