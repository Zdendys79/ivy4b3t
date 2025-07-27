<?php
/**
 * File: SystemStatusService.php
 * Location: ~/web/app/services/SystemStatusService.php
 *
 * Purpose: Service for handling system status monitoring and health checks.
 *          Centralizes all system monitoring functionality.
 */

// Security check
if (!defined('IVY_FRAMEWORK')) {
    http_response_code(403);
    die('Direct access not allowed');
}

class SystemStatusService
{
    private $db;
    private $logger;

    public function __construct($db, $logger)
    {
        $this->db = $db;
        $this->logger = $logger;
    }

    /**
     * Get comprehensive system status
     */
    public function get_system_status()
    {
        try {
            return [
                'summary' => $this->db->query_first('system_status', 'get_dashboard_summary'),
                'heartBeats' => $this->db->query_all('system_status', 'get_active_heartBeats'),
                'user_stats' => $this->db->query_first('system_status', 'get_user_statistics'),
                'last_updated' => date('Y-m-d H:i:s')
            ];
        } catch (Exception $e) {
            $this->logger->log_event(
                'System Status Error',
                'Failed to retrieve system status',
                ['error' => $e->getMessage()]
            );
            throw $e;
        }
    }

    /**
     * Get recent user actions
     */
    public function get_recent_actions($limit = 10)
    {
        try {
            return $this->db->query_all('user_activity', 'get_recent_actions', [$limit]);
        } catch (Exception $e) {
            $this->logger->log_event(
                'Recent Actions Error',
                'Failed to retrieve recent actions',
                ['error' => $e->getMessage(), 'limit' => $limit]
            );
            return [];
        }
    }

    /**
     * Get today's user activity
     */
    public function get_user_activity_today()
    {
        try {
            return $this->db->query_all('user_activity', 'get_user_activity_today');
        } catch (Exception $e) {
            $this->logger->log_event(
                'User Activity Error',
                'Failed to retrieve today\'s user activity',
                ['error' => $e->getMessage()]
            );
            return [];
        }
    }

    /**
     * Get system health status
     */
    public function get_system_health()
    {
        try {
            $health_data = $this->db->query_all('system_status', 'get_system_health');

            $overall_status = 'healthy';
            foreach ($health_data as $component) {
                if ($component['status'] === 'warning' && $overall_status === 'healthy') {
                    $overall_status = 'warning';
                } elseif ($component['status'] === 'error') {
                    $overall_status = 'error';
                    break;
                }
            }

            return [
                'overall' => $overall_status,
                'components' => $health_data,
                'last_check' => date('Y-m-d H:i:s')
            ];

        } catch (Exception $e) {
            $this->logger->log_critical(
                'System Health Check Failed',
                'Unable to determine system health',
                ['error' => $e->getMessage()]
            );

            return [
                'overall' => 'error',
                'components' => [],
                'last_check' => date('Y-m-d H:i:s'),
                'error' => 'Health check failed'
            ];
        }
    }

    /**
     * Get widget-specific data
     */
    public function get_widget_data($widget)
    {
        switch ($widget) {
            case 'system_status':
                return $this->get_system_status();

            case 'recent_actions':
                return $this->get_recent_actions(10);

            case 'user_activity':
                return $this->get_user_activity_today();

            case 'system_health':
                return $this->get_system_health();

            case 'user_stats':
                return $this->db->query_all('user_activity', 'get_user_activity_stats');

            default:
                throw new Exception("Unknown widget: {$widget}");
        }
    }

    /**
     * Check if system needs attention
     */
    public function needs_attention()
    {
        $health = $this->get_system_health();
        return $health['overall'] !== 'healthy';
    }

    /**
     * Get system performance metrics
     */
    public function get_performance_metrics()
    {
        try {
            return [
                'database_size' => $this->db->query_all('maintenance', 'get_database_size'),
                'query_performance' => $this->db->get_debug_info(),
                'memory_usage' => [
                    'current' => memory_get_usage(true),
                    'peak' => memory_get_peak_usage(true),
                    'limit' => ini_get('memory_limit')
                ],
                'uptime' => $this->get_system_uptime()
            ];
        } catch (Exception $e) {
            $this->logger->log_event(
                'Performance Metrics Error',
                'Failed to gather performance metrics',
                ['error' => $e->getMessage()]
            );
            return [];
        }
    }

    /**
     * Get system uptime (simplified)
     */
    private function get_system_uptime()
    {
        try {
            // Get oldest active heartBeat as proxy for system uptime
            $oldest_heartBeat = $this->db->query_first(
                'system_status',
                'get_oldest_active_heartBeat'
            );

            if ($oldest_heartBeat) {
                $start_time = new DateTime($oldest_heartBeat['up']);
                $now = new DateTime();
                return $now->diff($start_time)->format('%a days, %h hours, %i minutes');
            }

            return 'Unknown';
        } catch (Exception $e) {
            return 'Unknown';
        }
    }
}
