<?php
// Debug endpoint pro OAuth callback - dostupný pouze z tvého IP
define('IVY_FRAMEWORK', true);

// Pouze tvoje IP
if (($_SERVER['REMOTE_ADDR'] ?? '') !== '89.177.204.191') {
    http_response_code(403);
    die('Access denied');
}

// Zapnout error reporting
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Start session
session_start();

echo "<h2>OAuth Callback Debug</h2>";
echo "<pre>";

// Zkontrolovat GET parametry
echo "=== GET Parameters ===\n";
foreach ($_GET as $key => $value) {
    echo "$key: " . htmlspecialchars($value) . "\n";
}

if (!isset($_GET['code']) || !isset($_GET['state'])) {
    die("\nERROR: Missing code or state parameter");
}

echo "\n=== Session Debug ===\n";
echo "Session ID: " . session_id() . "\n";
echo "Session data:\n";
print_r($_SESSION);

echo "\n=== Expected vs Actual State ===\n";
echo "Expected state (from session): " . ($_SESSION['oauth_state'] ?? 'NOT_SET') . "\n";
echo "Actual state (from URL): " . ($_GET['state'] ?? 'NOT_SET') . "\n";
echo "Match: " . (($_SESSION['oauth_state'] ?? '') === ($_GET['state'] ?? '') ? 'YES' : 'NO') . "\n";

echo "\n=== Testing OAuth Service ===\n";

try {
    require_once __DIR__ . '/app/services/GoogleOAuthService.php';
    $oauth = new GoogleOAuthService();
    echo "✓ GoogleOAuthService loaded\n";
    
    // Test config
    $config = include __DIR__ . '/config/google-oauth.php';
    echo "✓ Client ID: " . substr($config['client_id'], 0, 20) . "...\n";
    echo "✓ Client Secret: " . (empty($config['client_secret']) ? 'EMPTY!' : 'SET (' . strlen($config['client_secret']) . ' chars)') . "\n";
    
    // Test token exchange
    echo "\n=== Testing Token Exchange ===\n";
    $tokenData = $oauth->exchangeCodeForToken($_GET['code'], $_GET['state']);
    echo "✓ Token exchange successful\n";
    print_r($tokenData);
    
} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
    echo "File: " . $e->getFile() . ":" . $e->getLine() . "\n";
    echo "Stack trace:\n" . $e->getTraceAsString() . "\n";
}

echo "</pre>";
?>