<?php
/**
 * File: ExportService.php
 * Location: ~/web/app/services/ExportService.php
 *
 * Purpose: Service for handling data export operations.
 *          Provides CSV and JSON export functionality with proper headers.
 */

// Security check
if (!defined('IVY_FRAMEWORK')) {
    http_response_code(403);
    die('Direct access not allowed');
}

class ExportService
{
    private $db;

    public function __construct($db)
    {
        $this->db = $db;
    }

    /**
     * Export data in specified format
     */
    public function export_data($type, $format)
    {
        $data = $this->get_export_data($type);
        $filename = $this->generate_filename($type);

        switch ($format) {
            case 'csv':
                $this->export_csv($data, $filename);
                break;

            case 'json':
                $this->export_json($data, $filename);
                break;

            default:
                throw new Exception("Unsupported export format: {$format}");
        }
    }

    /**
     * Get data for export based on type
     */
    private function get_export_data($type)
    {
        switch ($type) {
            case 'users':
                return $this->db->query_all('reporting', 'get_user_performance_report');

            case 'activity':
                return $this->db->query_all('reporting', 'get_daily_activity_report');

            case 'system':
                return $this->db->query_all('reporting', 'get_system_performance_report');

            case 'logs_system':
                return $this->db->query_all('logging', 'get_system_logs', [1000]);

            case 'logs_user':
                return $this->db->query_all('logging', 'get_user_logs', [1000]);

            default:
                throw new Exception("Unknown export type: {$type}");
        }
    }

    /**
     * Generate filename with timestamp
     */
    private function generate_filename($type)
    {
        $timestamp = date('Y-m-d_H-i-s');
        return "ivy4b3t_{$type}_{$timestamp}";
    }

    /**
     * Export data as CSV
     */
    private function export_csv($data, $filename)
    {
        // Set headers for file download
        header('Content-Type: text/csv; charset=utf-8');
        header("Content-Disposition: attachment; filename=\"{$filename}.csv\"");
        header('Cache-Control: no-cache, must-revalidate');
        header('Expires: 0');

        $output = fopen('php://output', 'w');

        // Add BOM for UTF-8 compatibility in Excel
        fprintf($output, chr(0xEF).chr(0xBB).chr(0xBF));

        if (!empty($data)) {
            // Write CSV headers
            fputcsv($output, array_keys($data[0]));

            // Write data rows
            foreach ($data as $row) {
                // Convert any objects/arrays to JSON strings
                $processed_row = array_map(function($value) {
                    if (is_array($value) || is_object($value)) {
                        return json_encode($value);
                    }
                    return $value;
                }, $row);

                fputcsv($output, $processed_row);
            }
        } else {
            // Write empty CSV with message
            fputcsv($output, ['message']);
            fputcsv($output, ['No data available for export']);
        }

        fclose($output);
        exit;
    }

    /**
     * Export data as JSON
     */
    private function export_json($data, $filename)
    {
        // Set headers for file download
        header('Content-Type: application/json; charset=utf-8');
        header("Content-Disposition: attachment; filename=\"{$filename}.json\"");
        header('Cache-Control: no-cache, must-revalidate');
        header('Expires: 0');

        $export_data = [
            'export_metadata' => [
                'export_date' => date('Y-m-d H:i:s'),
                'export_type' => basename($filename),
                'total_records' => count($data),
                'generated_by' => 'IVY4B3T Export Service'
            ],
            'data' => $data
        ];

        echo json_encode($export_data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        exit;
    }

    /**
     * Get available export types
     */
    public function get_available_exports()
    {
        return [
            'users' => [
                'label' => 'User Performance Report',
                'description' => 'User activity and performance metrics',
                'formats' => ['csv', 'json']
            ],
            'activity' => [
                'label' => 'Daily Activity Report',
                'description' => 'Daily system activity statistics',
                'formats' => ['csv', 'json']
            ],
            'system' => [
                'label' => 'System Performance Report',
                'description' => 'System hosts and performance data',
                'formats' => ['csv', 'json']
            ],
            'logs_system' => [
                'label' => 'System Logs',
                'description' => 'Recent system event logs',
                'formats' => ['csv', 'json']
            ],
            'logs_user' => [
                'label' => 'User Logs',
                'description' => 'Recent user activity logs',
                'formats' => ['csv', 'json']
            ]
        ];
    }

    /**
     * Validate export request
     */
    public function validate_export_request($type, $format)
    {
        $available = $this->get_available_exports();

        if (!isset($available[$type])) {
            throw new Exception("Invalid export type: {$type}");
        }

        if (!in_array($format, $available[$type]['formats'])) {
            throw new Exception("Format {$format} not supported for export type {$type}");
        }

        return true;
    }
}
