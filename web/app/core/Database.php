<?php
/**
 * File: Database.php
 * Location: ~/web/app/core/Database.php
 *
 * Purpose: Enhanced PDO database class with query repository pattern.
 *          Loads SQL queries from protected storage and provides clean interface.
 */

// Security check
if (!defined('IVY_FRAMEWORK')) {
    http_response_code(403);
    die('Direct access not allowed');
}

class Database
{
    private $pdo;
    private $config;
    private $queries;
    private $errors;
    private $query_log;
    private $debug_mode;

    public function __construct($debug_mode = false)
    {
        $this->errors = [];
        $this->query_log = [];
        $this->debug_mode = $debug_mode;

        $this->load_config();
        $this->load_queries();
        $this->connect();
    }

    /**
     * Load database configuration from environment variables
     */
    private function load_config()
    {
        // Load configuration from MYSQL_ environment variables
        $this->config = [
            'host' => getenv('MYSQL_HOST'),
            'user' => getenv('MYSQL_USER'), 
            'password' => getenv('MYSQL_PASSWORD'),
            'database' => getenv('MYSQL_DATABASE'),
            'charset' => 'utf8mb4'
        ];

        // Validate required config keys
        $required_keys = ['host', 'user', 'password', 'database'];
        foreach ($required_keys as $key) {
            if (!$this->config[$key]) {
                throw new Exception("Missing required environment variable: MYSQL_" . strtoupper($key === 'database' ? 'DATABASE' : $key));
            }
        }

        if ($this->debug_mode) {
            $safe_config = $this->config;
            $safe_config['password'] = '***HIDDEN***';
            $this->log_debug("Configuration loaded from environment", $safe_config);
        }
    }

    /**
     * Load SQL queries from storage
     */
    private function load_queries()
    {
        $queries_path = dirname(__DIR__, 2) . "/storage/sql/queries.php";

        if (!file_exists($queries_path)) {
            throw new Exception("SQL queries file not found: {$queries_path}");
        }

        // Framework constant should already be defined
        if (!defined('IVY_FRAMEWORK')) {
            define('IVY_FRAMEWORK', true);
        }
        $this->queries = require $queries_path;

        if (!is_array($this->queries)) {
            throw new Exception("Invalid queries file format");
        }

        if ($this->debug_mode) {
            $this->log_debug("Loaded " . count($this->queries, COUNT_RECURSIVE) . " SQL queries");
        }
    }

    /**
     * Establish database connection
     */
    private function connect()
    {
        try {
            $dsn = "mysql:host={$this->config['host']};dbname={$this->config['database']};charset=utf8mb4";

            $options = [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
                PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4 COLLATE utf8mb4_general_ci",
                PDO::ATTR_TIMEOUT => 5,
                PDO::ATTR_PERSISTENT => false
            ];

            $this->pdo = new PDO($dsn, $this->config['user'], $this->config['password'], $options);

            if ($this->debug_mode) {
                $this->log_debug("Database connection established successfully");
            }

        } catch (PDOException $e) {
            $error_msg = "Database connection failed: " . $e->getMessage();
            $this->errors[] = $error_msg;
            throw new Exception($error_msg);
        }
    }

    /**
     * Get query by category and name
     */
    private function get_query($category, $name)
    {
        if (!isset($this->queries[$category][$name])) {
            throw new Exception("Query not found: {$category}.{$name}");
        }

        return trim($this->queries[$category][$name]);
    }

    /**
     * Execute query and return single row
     */
    public function query_first($category, $name, $params = [])
    {
        $sql = $this->get_query($category, $name);
        $result = $this->execute_query($sql, $params);

        if (!$result['success']) {
            return false;
        }

        $row = $result['statement']->fetch();
        return $row !== false ? $row : false;
    }

    /**
     * Execute query and return all rows
     */
    public function query_all($category, $name, $params = [])
    {
        $sql = $this->get_query($category, $name);
        $result = $this->execute_query($sql, $params);

        if (!$result['success']) {
            return [];
        }

        return $result['statement']->fetchAll();
    }

    /**
     * Execute query and return success status
     */
    public function execute($category, $name, $params = [])
    {
        $sql = $this->get_query($category, $name);
        $result = $this->execute_query($sql, $params);

        return $result['success'];
    }

    /**
     * Execute prepared query with special handling for dynamic placeholders
     */
    public function query_dynamic($category, $name, $params = [], $placeholders = [])
    {
        $sql = $this->get_query($category, $name);

        // Handle dynamic placeholders (like IN clauses)
        foreach ($placeholders as $key => $values) {
            if (is_array($values)) {
                $placeholder_string = str_repeat('?,', count($values) - 1) . '?';
                $sql = str_replace($key, $placeholder_string, $sql);

                // Insert values into params array at appropriate position
                $params = array_merge($params, $values);
            }
        }

        return $this->execute_query($sql, $params);
    }

    /**
     * Core query execution with logging and error handling
     */
    private function execute_query($sql, $params = [])
    {
        $start_time = microtime(true);

        try {
            $stmt = $this->pdo->prepare($sql);
            $success = $stmt->execute($params);

            $this->log_query($sql, $params, $start_time, $stmt->rowCount());

            return [
                'success' => $success,
                'statement' => $stmt,
                'affected_rows' => $stmt->rowCount()
            ];

        } catch (PDOException $e) {
            $this->handle_error("Query execution failed", $sql, $params, $e);
            return [
                'success' => false,
                'error' => $e->getMessage(),
                'affected_rows' => 0
            ];
        }
    }

    /**
     * Get last inserted ID
     */
    public function last_insert_id()
    {
        return $this->pdo->lastInsertId();
    }

    /**
     * Transaction management
     */
    public function begin_transaction()
    {
        return $this->pdo->beginTransaction();
    }

    public function commit()
    {
        return $this->pdo->commit();
    }

    public function rollback()
    {
        return $this->pdo->rollBack();
    }

    /**
     * Execute multiple queries in transaction
     */
    public function execute_transaction($operations)
    {
        $this->begin_transaction();

        try {
            foreach ($operations as $operation) {
                $result = $this->execute_query($operation['sql'], $operation['params'] ?? []);
                if (!$result['success']) {
                    throw new Exception("Transaction operation failed");
                }
            }

            $this->commit();
            return true;

        } catch (Exception $e) {
            $this->rollback();

            if ($this->debug_mode) {
                $this->log_debug("Transaction failed: " . $e->getMessage());
            }

            throw $e;
        }
    }

    /**
     * High-level convenience methods
     */

    // Authentication
    public function find_user_by_login($login) {
        return $this->query_first('auth', 'find_user_by_login', [$login]);
    }

    public function get_user_by_id($id) {
        return $this->query_first('auth', 'get_user_by_id', [$id]);
    }

    // System status
    public function get_active_heartBeats() {
        return $this->query_all('system', 'get_active_heartBeats');
    }

    public function get_user_statistics() {
        return $this->query_first('system', 'get_user_statistics');
    }

    public function get_recent_actions($limit = 10) {
        return $this->query_all('system', 'get_recent_actions', [$limit]);
    }

    public function log_system_event($hostname, $title, $text, $data = []) {
        return $this->execute('system', 'insert_system_log',
            [$hostname, $title, $text, json_encode($data)]);
    }

    // Group limits
    public function get_user_limits($user_id) {
        return $this->query_all('group_limits', 'get_user_limits', [$user_id]);
    }

    public function update_user_limit($user_id, $group_type, $max_posts, $time_window) {
        return $this->execute('group_limits', 'upsert_user_limit',
            [$user_id, $group_type, $max_posts, $time_window]);
    }

    public function get_user_limit_stats($user_id) {
        return $this->query_all('group_limits', 'get_user_limit_stats', [$user_id, $user_id]);
    }

    // Scheme
    public function get_scheme_items() {
        return $this->query_all('scheme', 'get_all_scheme_items');
    }

    // Dashboard
    public function get_dashboard_summary() {
        return $this->query_first('dashboard', 'get_dashboard_summary');
    }

    /**
     * Error handling
     */
    private function handle_error($message, $sql, $params, $exception)
    {
        $error_data = [
            'message' => $message,
            'sql' => $sql,
            'params' => $params,
            'exception' => $exception->getMessage(),
            'timestamp' => date('Y-m-d H:i:s')
        ];

        $this->errors[] = $error_data;

        if ($this->debug_mode) {
            $this->log_debug("Database Error", $error_data);
        }

        // Log to file in production
        error_log("DB Error: " . json_encode($error_data));
    }

    /**
     * Query logging
     */
    private function log_query($sql, $params, $start_time, $affected_rows)
    {
        $duration = microtime(true) - $start_time;

        $log_entry = [
            'sql' => $sql,
            'params' => $params,
            'duration' => round($duration * 1000, 2), // ms
            'affected_rows' => $affected_rows,
            'timestamp' => date('Y-m-d H:i:s')
        ];

        $this->query_log[] = $log_entry;

        if ($this->debug_mode && $duration > 0.1) { // Log slow queries
            $this->log_debug("Slow Query", $log_entry);
        }
    }

    /**
     * Debug logging
     */
    private function log_debug($title, $data = null)
    {
        if ($this->debug_mode) {
            error_log("[DB DEBUG] {$title}: " . ($data ? json_encode($data) : ''));
        }
    }

    /**
     * Getters for debugging
     */
    public function get_query_log()
    {
        return $this->query_log;
    }

    public function get_errors()
    {
        return $this->errors;
    }

    public function is_connected()
    {
        try {
            $this->pdo->query('SELECT 1');
            return true;
        } catch (PDOException $e) {
            return false;
        }
    }

    /**
     * Get PDO instance for direct queries
     */
    public function getPdo()
    {
        return $this->pdo;
    }

    public function get_debug_info()
    {
        if (!$this->debug_mode) {
            return ['debug_mode' => false];
        }

        return [
            'debug_mode' => true,
            'total_queries' => count($this->query_log),
            'total_errors' => count($this->errors),
            'connection_alive' => $this->is_connected(),
            'last_query' => end($this->query_log),
            'recent_errors' => array_slice($this->errors, -3),
            'queries_loaded' => count($this->queries, COUNT_RECURSIVE)
        ];
    }

    /**
     * Get available query categories for introspection
     */
    public function get_query_categories()
    {
        return array_keys($this->queries);
    }

    /**
     * Get queries in specific category
     */
    public function get_category_queries($category)
    {
        return isset($this->queries[$category]) ? array_keys($this->queries[$category]) : [];
    }

}
