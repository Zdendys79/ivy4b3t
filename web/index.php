<?php
// Define framework constant for security
define('IVY_FRAMEWORK', true);

// Configure session for 30 days
ini_set('session.gc_maxlifetime', 30 * 24 * 60 * 60); // 30 days in seconds
ini_set('session.cookie_lifetime', 30 * 24 * 60 * 60); // 30 days in seconds
ini_set('session.cookie_samesite', 'Lax'); // Explicit SameSite for mobile compatibility

// Start session
session_start();

// Error handling
set_error_handler(function($severity, $message, $file, $line) {
    if (!(error_reporting() & $severity)) {
        return false;
    }
    throw new ErrorException($message, 0, $severity, $file, $line);
});

set_exception_handler(function($exception) {
    http_response_code(500);

    // Debug mode pouze pro localhost a s konkrétním IP
    $allowed_debug_ips = ['127.0.0.1', '::1', '89.177.204.191'];
    $client_ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $debug_mode = (
        isset($_GET['debug']) && 
        $_GET['debug'] === 'true' && 
        (in_array($client_ip, $allowed_debug_ips) || $_SERVER['SERVER_NAME'] === 'localhost')
    );

    if ($debug_mode) {
        echo '<!DOCTYPE html>
<html>
<head>
    <title>Application Error</title>
    <style>
        body { font-family: monospace; margin: 20px; }
        .error { background: #f8f8f8; padding: 20px; border-left: 4px solid #d32f2f; }
        .trace { background: #f0f0f0; padding: 10px; margin-top: 10px; overflow-x: auto; }
    </style>
</head>
<body>
    <div class="error">
        <h1>Application Error</h1>
        <p><strong>Message:</strong> ' . htmlspecialchars($exception->getMessage()) . '</p>
        <p><strong>File:</strong> ' . htmlspecialchars($exception->getFile()) . '</p>
        <p><strong>Line:</strong> ' . $exception->getLine() . '</p>
        <div class="trace">
            <strong>Stack Trace:</strong><br>
            <pre>' . htmlspecialchars($exception->getTraceAsString()) . '</pre>
        </div>
    </div>
</body>
</html>';
    } else {
        echo '<!DOCTYPE html>
<html>
<head>
    <title>500 - Internal Server Error</title>
    <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
        h1 { color: #d32f2f; }
        p { color: #666; }
        a { color: #667eea; text-decoration: none; }
        a:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <h1>500 - Internal Server Error</h1>
    <p>Something went wrong. Please try again later.</p>
    <p><a href="/">Return to Homepage</a></p>
</body>
</html>';
    }

    error_log("IVY Application Error: " . $exception->getMessage() . " in " .
              $exception->getFile() . " on line " . $exception->getLine());
});

// Simple routing without complex router class
$request_uri = $_SERVER['REQUEST_URI'] ?? '/';

// Remove query string
if (($pos = strpos($request_uri, '?')) !== false) {
    $path = substr($request_uri, 0, $pos);
} else {
    $path = $request_uri;
}

// Remove /ivy prefix only if present (for IP access)
if (strpos($path, '/ivy') === 0) {
    $path = substr($path, 4);
}

$path = $path ?: '/';

// Helper function to initialize and call controller
function callController($controllerName, $method) {
    require_once __DIR__ . '/app/core/DatabaseConnection.php';
    require_once __DIR__ . '/app/core/Database.php';
    require_once __DIR__ . '/app/core/BaseController.php';
    require_once __DIR__ . "/app/controllers/{$controllerName}.php";
    
    $controller = new $controllerName();
    $controller->$method();
}

try {
    // Load AuthMiddleware for auth-first architecture
    require_once __DIR__ . '/app/middleware/AuthMiddleware.php';
    
    // Protect all routes except public ones
    AuthMiddleware::protect($path);
    
    switch ($path) {
        case '/':
            require_once __DIR__ . '/app/views/main-menu.php';
            break;
            
        case '/test-db':
            callController('SystemController', 'testDb');
            break;
            
        case '/scheme':
            callController('SystemController', 'scheme');
            break;
            
        case '/users':
            callController('UsersController', 'management');
            break;
            
        case '/users/group-limits':
            callController('UsersController', 'groupLimits');
            break;
            
        case '/dashboard':
            callController('DashboardController', 'index');
            break;
            
        case '/api/status':
            callController('SystemController', 'apiStatus');
            break;
            
        case '/action-log':
            callController('ActionLogController', 'dailyOverview');
            break;
            
        case '/action-log/detail':
            callController('ActionLogController', 'actionDetail');
            break;
            
        case '/action-log/user':
            callController('ActionLogController', 'userActions');
            break;
            
        case '/dont_panic':
            callController('ActionLogController', 'dailyOverview');
            break;
            
        case '/login':
            callController('AuthController', 'login');
            break;
            
        case '/logout':
            callController('AuthController', 'logout');
            break;
            
            
            
        default:
            http_response_code(404);
            echo "404 - Stránka nenalezena<br>";
            echo "Cesta: " . htmlspecialchars($path) . "<br>";
            echo "<a href='/'>← Zpět na hlavní stránku</a>";
    }
    
} catch (Exception $e) {
    http_response_code(500);
    echo "Chyba: " . htmlspecialchars($e->getMessage());
}
