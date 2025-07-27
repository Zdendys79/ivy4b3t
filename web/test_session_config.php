<?php
// Test current session configuration
if (!defined('IVY_FRAMEWORK')) {
    define('IVY_FRAMEWORK', true);
}

echo "<h2>Session Configuration Test</h2>";

echo "<h3>PHP ini settings:</h3>";
echo "gc_maxlifetime: " . ini_get('session.gc_maxlifetime') . "<br>";
echo "cookie_secure: " . ini_get('session.cookie_secure') . "<br>";
echo "cookie_httponly: " . ini_get('session.cookie_httponly') . "<br>";  
echo "cookie_samesite: " . ini_get('session.cookie_samesite') . "<br>";

echo "<h3>Before session_start():</h3>";
echo "Session status: " . session_status() . "<br>";
echo "Session cookie params: " . json_encode(session_get_cookie_params()) . "<br>";

session_start();

echo "<h3>After session_start():</h3>";
echo "Session ID: " . session_id() . "<br>";
echo "Session cookie params: " . json_encode(session_get_cookie_params()) . "<br>";

$_SESSION['test'] = 'OAuth test session';

echo "<h3>Test session data:</h3>";
echo "Session data: " . json_encode($_SESSION) . "<br>";

echo "<h3>Headers sent:</h3>";
foreach (headers_list() as $header) {
    if (strpos($header, 'Set-Cookie') !== false) {
        echo "Cookie header: " . htmlspecialchars($header) . "<br>";
    }
}
?>