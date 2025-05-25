<?php
// web/system/db_class.php
class DbClass
{
    private $conn;
    private $errors;
    private $queryLog;

    public function __construct()
    {
        $this->conn = null;
        $this->errors = [];
        $this->queryLog = [];

        // Načtení konfiguračních údajů z JSON souboru
        $config = json_decode(file_get_contents($_SERVER['DOCUMENT_ROOT'] . "/restricted/db_config.json"), true);

        try {
            $this->conn = new mysqli($config['host'], $config['user'], $config['password'], $config['database']);
            $this->conn->set_charset("utf8");
        } catch (mysqli_sql_exception $e) {
            $this->errors[] = "Connection failed: " . $e->getMessage();
        }
    }

    public function __destruct()
    {
        if ($this->conn) {
            $this->conn->close();
        }
        if (!empty($this->errors)) {
            // Zpracování chybových zpráv
            echo "<hr weight='85%'>Errors in Database class [db_class.php]:<br>\n";
            foreach ($this->errors as $error) {
                echo $error . "<br>\n";
            }
        }
    }

    public function query($sql)
    {
        $start = microtime(true);
        if ($this->conn) {
            $result = $this->conn->query($sql);
            $this->logQuery($sql, $start, $result);
            return $result;
        }
        $this->errors[] = "Query failed: No connection to database.";
        return false;
    }

    public function preparedQuery($sql, $params = [], $paramTypes = "")
    {
        $start = microtime(true);
        $stmt = $this->conn->prepare($sql);

        if (!$stmt) {
            $this->errors[] = "Failed to prepare statement: " . $this->conn->error;
            return [false, $this->errors];
        }

        if ($params) {
            $types = $paramTypes ?: str_repeat("s", count($params)); // Default to 'string' type
            $stmt->bind_param($types, ...$params);
        }

        if (!$stmt->execute()) {
            $this->errors[] = "Failed to execute statement: " . $stmt->error;
            return [false, $this->errors];
        }

        $result = $stmt->get_result();
        if ($result) {
            $data = $result->fetch_all(MYSQLI_ASSOC);
            $this->logQuery($sql, $start, $result, $params);
            return [true, $data];
        } else {
            $this->logQuery($sql, $start, null, $params, $stmt->affected_rows);
            return [true, $stmt->affected_rows];
        }
    }

    private function logQuery($sql, $start, $result = null, $params = [], $affectedRows = null)
    {
        $duration = microtime(true) - $start;
        $this->queryLog[] = [
            'sql' => $sql,
            'params' => $params,
            'duration' => $duration,
            'rows' => $result ? $result->num_rows : $affectedRows,
        ];
    }

    public function getQueryLog()
    {
        return $this->queryLog;
    }

    public function authenticate($username, $password)
    {
        $query = $this->conn->prepare("SELECT id, password_hash FROM users WHERE username = ?");
        $query->bind_param("s", $username);
        $query->execute();
        $result = $query->get_result();

        if ($result->num_rows === 1) {
            $user = $result->fetch_assoc();
            if (password_verify($password, $user['password_hash'])) {
                return $user['id'];
            }
        }
        return false;
    }
}
