<?php
/**
 * Database configuration - reads from environment variables only
 * NO hardcoded values allowed!
 */

// Get database configuration from MYSQL_ environment variables
$db_config = [
    'host' => $_ENV['MYSQL_HOST'] ?? getenv('MYSQL_HOST') ?? false,
    'name' => $_ENV['MYSQL_DATABASE'] ?? getenv('MYSQL_DATABASE') ?? false,
    'user' => $_ENV['MYSQL_USER'] ?? getenv('MYSQL_USER') ?? false,
    'pass' => $_ENV['MYSQL_PASSWORD'] ?? getenv('MYSQL_PASSWORD') ?? false
];

// Validate all required variables are set
$missing = [];
foreach (['host', 'name', 'user', 'pass'] as $key) {
    if (!$db_config[$key]) {
        $missing[] = 'MYSQL_' . strtoupper($key === 'name' ? 'DATABASE' : ($key === 'pass' ? 'PASSWORD' : $key));
    }
}

if (!empty($missing)) {
    die("ERROR: Missing environment variables: " . implode(', ', $missing) . 
        "\nUsing MYSQL_* environment variables." .
        "\nPlease ensure Apache envvars are properly configured.");
}

// Create PDO connection
try {
    $pdo = new \PDO(
        "mysql:host={$db_config['host']};dbname={$db_config['name']};charset=utf8mb4",
        $db_config['user'],
        $db_config['pass'],
        [
            \PDO::ATTR_ERRMODE => \PDO::ERRMODE_EXCEPTION,
            \PDO::ATTR_DEFAULT_FETCH_MODE => \PDO::FETCH_ASSOC,
            \PDO::ATTR_EMULATE_PREPARES => false
        ]
    );
} catch (\PDOException $e) {
    die("Database connection failed: " . $e->getMessage());
}