<?php
/**
 * Database connection using existing Database class
 * Fallback for when PDO is not directly available
 */

// Security check
if (!defined('IVY_FRAMEWORK')) {
    http_response_code(403);
    die('Direct access not allowed');
}

// Use existing Database class instead of direct PDO
require_once __DIR__ . '/Database.php';

try {
    $database = new Database();
    $pdo = $database->getPdo();
} catch (Exception $e) {
    die("Database connection failed: " . $e->getMessage());
}