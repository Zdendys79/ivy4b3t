<?php
/**
 * File: db.class.php
 * Location: ~/web/system/db.class.php
 *
 * Purpose: Modern PDO database class for IVY project with proper error handling,
 *          connection pooling, debugging support and consistency with iv_sql.js style
 *
 * Author: Enhanced for IVY4B3T project
 * Date: 2025
 */

class DbClass
{
    private $pdo;
    private $config;
    private $errors;
    private $query_log;
    private $debug_mode;

    public function __construct($debug_mode = false)
    {
        $this->errors = [];
        $this->query_log = [];
        $this->debug_mode = $debug_mode;

        $this->load_config();
        $this->connect();
    }

    private function load_config()
    {
        $config_path = $_SERVER['DOCUMENT_ROOT'] . "/restricted/db_config.json";

        if (!file_exists($config_path)) {
            throw new Exception("Database config file not found: {$config_path}");
        }

        $this->config = json_decode(file_get_contents($config_path), true);

        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new Exception("Invalid JSON in database config: " . json_last_error_msg());
        }

        // Validate required config keys
        $required_keys = ['host', 'user', 'password', 'database'];
        foreach ($required_keys as $key) {
            if (!isset($this->config[$key])) {
                throw new Exception("Missing required config key: {$key}");
            }
        }
    }

    private function connect()
    {
        try {
            $dsn = "mysql:host={$this->config['host']};dbname={$this->config['database']};charset=utf8mb4";

            $options = [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
                PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4 COLLATE utf8mb4_general_ci"
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
     * Execute a simple query (use with caution - prefer safe_query for user input)
     */
    public function query($sql)
    {
        $start_time = microtime(true);

        try {
            $stmt = $this->pdo->query($sql);
            $this->log_query($sql, [], $start_time, $stmt ? $stmt->rowCount() : 0);
            return $stmt;

        } catch (PDOException $e) {
            $this->handle_error("Query failed", $sql, [], $e);
            return false;
        }
    }

    /**
     * Safe prepared query - primary method for all database operations
     */
    public function safe_query($sql, $params = [])
    {
        $start_time = microtime(true);

        try {
            $stmt = $this->pdo->prepare($sql);
            $result = $stmt->execute($params);

            $this->log_query($sql, $params, $start_time, $stmt->rowCount());

            return [
                'success' => true,
                'statement' => $stmt,
                'affected_rows' => $stmt->rowCount()
            ];

        } catch (PDOException $e) {
            $this->handle_error("Prepared query failed", $sql, $params, $e);
            return [
                'success' => false,
                'error' => $e->getMessage(),
                'affected_rows' => 0
            ];
        }
    }

    /**
     * Get first row from query results
     */
    public function safe_query_first($sql, $params = [])
    {
        $result = $this->safe_query($sql, $params);

        if (!$result['success']) {
            return false;
        }

        $row = $result['statement']->fetch();
        return $row !== false ? $row : false;
    }

    /**
     * Get all rows from query results
     */
    public function safe_query_all($sql, $params = [])
    {
        $result = $this->safe_query($sql, $params);

        if (!$result['success']) {
            return [];
        }

        return $result['statement']->fetchAll();
    }

    /**
     * Execute query and return success status
     */
    public function safe_execute($sql, $params = [])
    {
        $result = $this->safe_query($sql, $params);
        return $result['success'];
    }

    /**
     * Get last inserted ID
     */
    public function get_last_insert_id()
    {
        return $this->pdo->lastInsertId();
    }

    /**
     * Start transaction
     */
    public function begin_transaction()
    {
        return $this->pdo->beginTransaction();
    }

    /**
     * Commit transaction
     */
    public function commit()
    {
        return $this->pdo->commit();
    }

    /**
     * Rollback transaction
     */
    public function rollback()
    {
        return $this->pdo->rollBack();
    }

    /**
     * User authentication (enhanced from original)
     */
    public function authenticate($username, $password)
    {
        $user = $this->safe_query_first(
            "SELECT id, fb_pass FROM fb_users WHERE fb_login = ? AND locked IS NULL",
            [$username]
        );

        if ($user && password_verify($password, $user['fb_pass'])) {
            return $user['id'];
        }

        return false;
    }

    /**
     * System heartbeat (consistent with iv_sql.js)
     */
    public function heartbeat($hostname, $user_id = 0, $group_id = 0, $version = '')
    {
        return $this->safe_execute(
            "INSERT INTO heartbeat (host, up, user_id, group_id, version)
             VALUES (?, NOW(), ?, ?, ?)
             ON DUPLICATE KEY UPDATE up = NOW(), user_id = ?, group_id = ?, version = ?",
            [$hostname, $user_id, $group_id, $version, $user_id, $group_id, $version]
        );
    }

    /**
     * Get user by hostname (consistent with iv_sql.js)
     */
    public function get_user($hostname)
    {
        return $this->safe_query_first(
            "SELECT * FROM fb_users
             WHERE host LIKE ? AND COALESCE(next_worktime, NOW()) <= NOW()
             ORDER BY COALESCE(next_worktime, NOW() - INTERVAL 2 DAY) ASC
             LIMIT 1",
            [$hostname]
        );
    }

    /**
     * System logging (consistent with iv_sql.js)
     */
    public function system_log($hostname, $title, $text, $data = [])
    {
        return $this->safe_execute(
            "INSERT INTO log_s (time, hostname, title, text, data)
             VALUES (NOW(), ?, ?, ?, ?)",
            [$hostname, $title, $text, json_encode($data)]
        );
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
     * Get query log
     */
    public function get_query_log()
    {
        return $this->query_log;
    }

    /**
     * Get errors
     */
    public function get_errors()
    {
        return $this->errors;
    }

    /**
     * Check if connection is alive
     */
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
     * Get database stats for debugging
     */
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
            'recent_errors' => array_slice($this->errors, -3)
        ];
    }
}
