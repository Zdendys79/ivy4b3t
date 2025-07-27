<?php
// Debug endpoint pro session management - pouze z tvého IP
define('IVY_FRAMEWORK', true);

$client_ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$allowed_ips = ['89.177.204.191', '83.167.224.200']; // Tvoje IP + server IP
if (!in_array($client_ip, $allowed_ips)) {
    echo "Access denied. Your IP: $client_ip";
    exit;
}

// Start session
session_start();

echo "<h2>Session Debug Info</h2>";
echo "<pre>";

echo "=== PHP Session Configuration ===\n";
echo "Session ID: " . session_id() . "\n";
echo "Session Name: " . session_name() . "\n";
echo "Session Status: " . session_status() . " (1=disabled, 2=active, 3=none)\n";
echo "Session Cookie Lifetime: " . ini_get('session.cookie_lifetime') . " seconds\n";
echo "Session GC Maxlifetime: " . ini_get('session.gc_maxlifetime') . " seconds\n";
echo "Session Cookie Domain: " . ini_get('session.cookie_domain') . "\n";
echo "Session Cookie Path: " . ini_get('session.cookie_path') . "\n";
echo "Session Cookie Secure: " . (ini_get('session.cookie_secure') ? 'YES' : 'NO') . "\n";
echo "Session Cookie HTTPOnly: " . (ini_get('session.cookie_httponly') ? 'YES' : 'NO') . "\n";
echo "Session Cookie SameSite: " . ini_get('session.cookie_samesite') . "\n";

echo "\n=== Session Data ===\n";
if (empty($_SESSION)) {
    echo "Session is EMPTY\n";
} else {
    foreach ($_SESSION as $key => $value) {
        if (is_array($value) || is_object($value)) {
            echo "$key: " . json_encode($value) . "\n";
        } else {
            echo "$key: $value\n";
        }
    }
}

echo "\n=== Cookie Data ===\n";
if (empty($_COOKIE)) {
    echo "No cookies found\n";
} else {
    foreach ($_COOKIE as $name => $value) {
        echo "$name: " . substr($value, 0, 50) . (strlen($value) > 50 ? '...' : '') . "\n";
    }
}

echo "\n=== AuthMiddleware Check ===\n";
require_once __DIR__ . '/app/middleware/AuthMiddleware.php';
echo "AuthMiddleware::isAuthenticated(): " . (AuthMiddleware::isAuthenticated() ? 'YES' : 'NO') . "\n";
$currentUser = AuthMiddleware::getCurrentUser();
if ($currentUser) {
    echo "Current User: " . json_encode($currentUser) . "\n";
} else {
    echo "Current User: NULL\n";
}

echo "\n=== Recommendations ===\n";
$lifetime = ini_get('session.cookie_lifetime');
if ($lifetime == 0) {
    echo "✓ Session cookie lifetime is 0 (browser session)\n";
} else {
    echo "⚠️ Session cookie lifetime is $lifetime seconds\n";
}

$gc_maxlifetime = ini_get('session.gc_maxlifetime');
if ($gc_maxlifetime < 86400) {
    echo "⚠️ Session GC maxlifetime is only $gc_maxlifetime seconds (less than 24 hours)\n";
} else {
    echo "✓ Session GC maxlifetime is $gc_maxlifetime seconds\n";
}

echo "</pre>";
?>