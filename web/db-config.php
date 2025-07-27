<?php
/**
 * Database configuration - reads from environment variables only
 * NO hardcoded values allowed!
 */

// Get database configuration from environment
$db_config = [
    'host' => $_ENV['DB_HOST'] ?? getenv('DB_HOST') ?? false,
    'name' => $_ENV['DB_NAME'] ?? getenv('DB_NAME') ?? false,
    'user' => $_ENV['DB_USER'] ?? getenv('DB_USER') ?? false,
    'pass' => $_ENV['DB_PASS'] ?? getenv('DB_PASS') ?? false
];

// Validate all required variables are set
$missing = [];
foreach (['host', 'name', 'user', 'pass'] as $key) {
    if (!$db_config[$key]) {
        $missing[] = 'DB_' . strtoupper($key);
    }
}

if (!empty($missing)) {
    die("ERROR: Missing environment variables: " . implode(', ', $missing) . 
        "\nPlease ensure Apache envvars are properly configured.");
}

// Create PDO connection
try {
    $pdo = new PDO(
        "mysql:host={$db_config['host']};dbname={$db_config['name']};charset=utf8mb4",
        $db_config['user'],
        $db_config['pass'],
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false
        ]
    );
} catch (PDOException $e) {
    die("Database connection failed: " . $e->getMessage());
}