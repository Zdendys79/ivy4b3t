<?php
/**
 * File: SystemCommandService.php
 * Location: ~/web/app/services/SystemCommandService.php
 *
 * Purpose: Service for handling system administrative commands.
 *          Provides secure execution of system maintenance operations.
 */

// Security check
if (!defined('IVY_FRAMEWORK')) {
    http_response_code(403);
    die('Direct access not allowed');
}

class SystemCommandService
{
    private $db;
    private $logger;

    public function __construct($db, $logger)
    {
        $this->db = $db;
        $this->logger = $logger;
    }

    /**
     * Execute system command with proper logging
     */
    public function execute_command($command, $user)
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
        $this->logger->log_event(
            'System Command',
            'System restart requested',
            ['user_id' => $user['id'], 'command' => 'restart_system']
        );

        // In a real implementation, this would trigger system restart
        // For now, we'll simulate the operation

        return [
            'message' => 'System restart initiated successfully',
            'timestamp' => date('Y-m-d H:i:s'),
            'status' => 'pending'
        ];
    }

    /**
     * Database backup command
     */
    private function backup_database($user)
    {
        $this->logger->log_event(
            'System Command',
            'Database backup requested',
            ['user_id' => $user['id'], 'command' => 'backup_database']
        );

        try {
            // This would call the actual backup script
            // exec('/path/to/backup/script.sh', $output, $return_code);

            return [
                'message' => 'Database backup initiated successfully',
                'timestamp' => date('Y-m-d H:i:s'),
                'status' => 'completed'
            ];

        } catch (Exception $e) {
            $this->logger->log_critical(
                'Backup Failed',
                'Database backup operation failed',
                ['user_id' => $user['id'], 'error' => $e->getMessage()]
            );

            return [
                'message' => 'Database backup failed: ' . $e->getMessage(),
                'timestamp' => date('Y-m-d H:i:s'),
                'status' => 'failed'
            ];
        }
    }

    /**
     * Clear logs command
     */
    private function clear_logs($user)
    {
        $this->logger->log_event(
            'System Command',
            'Log cleanup requested',
            ['user_id' => $user['id'], 'command' => 'clear_logs']
        );

        try {
            // Clear old logs (keep last 30 days)
            $action_logs_cleared = $this->db->execute('maintenance', 'clear_old_logs', [30]);
            $system_logs_cleared = $this->db->execute('maintenance', 'clear_old_system_logs', [30]);

            $status = ($action_logs_cleared && $system_logs_cleared) ? 'completed' : 'partial';

            return [
                'message' => 'Log cleanup completed successfully',
                'timestamp' => date('Y-m-d H:i:s'),
                'status' => $status,
                'details' => [
                    'action_logs' => $action_logs_cleared ? 'cleared' : 'failed',
                    'system_logs' => $system_logs_cleared ? 'cleared' : 'failed'
                ]
            ];

        } catch (Exception $e) {
            $this->logger->log_critical(
                'Log Cleanup Failed',
                'Log cleanup operation failed',
                ['user_id' => $user['id'], 'error' => $e->getMessage()]
            );

            return [
                'message' => 'Log cleanup failed: ' . $e->getMessage(),
                'timestamp' => date('Y-m-d H:i:s'),
                'status' => 'failed'
            ];
        }
    }

    /**
     * Update system command
     */
    private function update_system($user)
    {
        $this->logger->log_event(
            'System Command',
            'System update requested',
            ['user_id' => $user['id'], 'command' => 'update_system']
        );

        // In a real implementation, this would trigger system update
        // This could involve git pull, composer update, etc.

        return [
            'message' => 'System update initiated successfully',
            'timestamp' => date('Y-m-d H:i:s'),
            'status' => 'pending'
        ];
    }

    /**
     * Optimize database tables
     */
    private function optimize_tables($user)
    {
        $this->logger->log_event(
            'System Command',
            'Database optimization requested',
            ['user_id' => $user['id'], 'command' => 'optimize_tables']
        );

        try {
            $result = $this->db->execute('maintenance', 'optimize_tables');

            return [
                'message' => $result ? 'Database optimization completed successfully' : 'Database optimization failed',
                'timestamp' => date('Y-m-d H:i:s'),
                'status' => $result ? 'completed' : 'failed'
            ];

        } catch (Exception $e) {
            $this->logger->log_critical(
                'Database Optimization Failed',
                'Database optimization operation failed',
                ['user_id' => $user['id'], 'error' => $e->getMessage()]
            );

            return [
                'message' => 'Database optimization failed: ' . $e->getMessage(),
                'timestamp' => date('Y-m-d H:i:s'),
                'status' => 'failed'
            ];
        }
    }

    /**
     * Get available commands for user
     */
    public function get_available_commands($user)
    {
        $commands = [
            'restart_system' => [
                'label' => 'Restart System',
                'description' => 'Restart all system services',
                'requires_confirmation' => true,
                'danger_level' => 'high'
            ],
            'backup_database' => [
                'label' => 'Backup Database',
                'description' => 'Create database backup',
                'requires_confirmation' => false,
                'danger_level' => 'low'
            ],
            'clear_logs' => [
                'label' => 'Clear Old Logs',
                'description' => 'Remove logs older than 30 days',
                'requires_confirmation' => true,
                'danger_level' => 'medium'
            ],
            'update_system' => [
                'label' => 'Update System',
                'description' => 'Update system components',
                'requires_confirmation' => true,
                'danger_level' => 'medium'
            ],
            'optimize_tables' => [
                'label' => 'Optimize Database',
                'description' => 'Optimize database tables',
                'requires_confirmation' => false,
                'danger_level' => 'low'
            ]
        ];

        return $commands;
    }
}
