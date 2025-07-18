<?php
echo "Hello World - PHP funguje!";
exit;

/*
// Zbytek kódu je zakomentován
// Define framework constant for security
define('IVY_FRAMEWORK', true);
*/

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

    $debug_mode = isset($_GET['debug']) && $_GET['debug'] === 'true';

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

try {
    // Load core classes
    require_once __DIR__ . '/app/core/Database.php';
    require_once __DIR__ . '/app/core/Router.php';
    require_once __DIR__ . '/app/core/BaseController.php';

    // Check debug mode
    $debug_mode = isset($_GET['debug']) && $_GET['debug'] === 'true';

    // Initialize router
    $router = new Router('', $debug_mode);

    // Define routes
    // Dashboard routes
    $router->get('/', 'Dashboard@index', 'home');
    $router->get('/dashboard', 'Dashboard@index', 'dashboard');
    $router->post('/dashboard/refresh', 'Dashboard@refresh', 'dashboard.refresh');

    // User management routes
    $router->get('/users', 'UserManagement@index', 'users');
    $router->get('/users/{id}', 'UserManagement@show', 'users.show');
    $router->post('/users/{id}/update', 'UserManagement@update', 'users.update');
    $router->post('/users/{id}/toggle', 'UserManagement@toggle', 'users.toggle');

    // Group limits routes
    $router->get('/group-limits', 'GroupLimits@index', 'group-limits');
    $router->post('/group-limits/update', 'GroupLimits@update', 'group-limits.update');

    // Authentication routes
    $router->get('/login', 'Auth@login', 'login');
    $router->post('/login', 'Auth@authenticate', 'auth.login');
    $router->get('/logout', 'Auth@logout', 'logout');

    // System routes
    $router->get('/system', 'System@index', 'system');
    $router->post('/system/command', 'System@command', 'system.command');

    // Export routes
    $router->get('/export/{type}', 'Export@export', 'export');

    // Legacy routes for backwards compatibility
    $router->get('/scheme', function() {
        require_once __DIR__ . '/scheme.php';
    }, 'scheme');

    // API routes
    $router->group('/api', function($router) {
        $router->get('/status', 'Api@status');
        $router->get('/users', 'Api@users');
        $router->post('/users/{id}/action', 'Api@userAction');
        $router->get('/system/health', 'Api@systemHealth');
    });

    // Dispatch request
    $router->dispatch();

} catch (Exception $e) {
    // Let the exception handler deal with it
    throw $e;
}
