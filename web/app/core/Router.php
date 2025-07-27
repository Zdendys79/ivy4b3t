<?php
/**
 * File: Router.php
 * Location: ~/web/app/core/Router.php
 *
 * Purpose: URL routing system for IVY4B3T web application.
 *          Handles URL parsing, route matching, and controller dispatch.
 */

// Security check
if (!defined('IVY_FRAMEWORK')) {
    http_response_code(403);
    die('Direct access not allowed');
}

class Router
{
    private $routes = [];
    private $current_route = null;
    private $base_path = '';
    private $debug_mode = false;

    public function __construct($base_path = '', $debug_mode = false)
    {
        $this->base_path = rtrim($base_path, '/');
        $this->debug_mode = $debug_mode;
    }

    /**
     * Add a GET route
     */
    public function get($pattern, $handler, $name = null)
    {
        return $this->add_route('GET', $pattern, $handler, $name);
    }

    /**
     * Add a POST route
     */
    public function post($pattern, $handler, $name = null)
    {
        return $this->add_route('POST', $pattern, $handler, $name);
    }

    /**
     * Add a PUT route
     */
    public function put($pattern, $handler, $name = null)
    {
        return $this->add_route('PUT', $pattern, $handler, $name);
    }

    /**
     * Add a DELETE route
     */
    public function delete($pattern, $handler, $name = null)
    {
        return $this->add_route('DELETE', $pattern, $handler, $name);
    }

    /**
     * Add a route for any method
     */
    public function any($pattern, $handler, $name = null)
    {
        return $this->add_route(['GET', 'POST', 'PUT', 'DELETE'], $pattern, $handler, $name);
    }

    /**
     * Add route group with prefix
     */
    public function group($prefix, $callback)
    {
        $old_base = $this->base_path;
        $this->base_path = $old_base . '/' . trim($prefix, '/');

        $callback($this);

        $this->base_path = $old_base;
    }

    /**
     * Add a route to the collection
     */
    private function add_route($methods, $pattern, $handler, $name = null)
    {
        if (!is_array($methods)) {
            $methods = [$methods];
        }

        $pattern = $this->base_path . '/' . ltrim($pattern, '/');
        $pattern = rtrim($pattern, '/') ?: '/';

        $route = [
            'methods' => $methods,
            'pattern' => $pattern,
            'handler' => $handler,
            'name' => $name,
            'regex' => $this->compile_pattern($pattern),
            'params' => $this->extract_params($pattern)
        ];

        $this->routes[] = $route;

        if ($this->debug_mode) {
            error_log("[Router] Added route: " . implode('|', $methods) . " {$pattern}");
        }

        return $this;
    }

    /**
     * Convert route pattern to regex
     */
    private function compile_pattern($pattern)
    {
        // Escape special regex characters except our placeholders
        $pattern = preg_quote($pattern, '#');

        // Replace parameter placeholders
        $pattern = preg_replace('#\\\{([a-zA-Z_][a-zA-Z0-9_]*)\\\}#', '([^/]+)', $pattern);
        $pattern = preg_replace('#\\\{([a-zA-Z_][a-zA-Z0-9_]*):([^}]+)\\\}#', '($2)', $pattern);

        return '#^' . $pattern . '$#';
    }

    /**
     * Extract parameter names from pattern
     */
    private function extract_params($pattern)
    {
        preg_match_all('#\{([a-zA-Z_][a-zA-Z0-9_]*)\}#', $pattern, $matches);
        return $matches[1];
    }

    /**
     * Dispatch the current request
     */
    public function dispatch()
    {
        $method = $_SERVER['REQUEST_METHOD'];
        $path = $this->get_current_path();

        if ($this->debug_mode) {
            error_log("[Router] Dispatching: {$method} {$path}");
        }

        foreach ($this->routes as $route) {
            if (!in_array($method, $route['methods'])) {
                continue;
            }

            if (preg_match($route['regex'], $path, $matches)) {
                array_shift($matches); // Remove full match

                // Extract parameters
                $params = [];
                foreach ($route['params'] as $i => $param_name) {
                    if (isset($matches[$i])) {
                        $params[$param_name] = $matches[$i];
                    }
                }

                $this->current_route = $route;
                $this->current_route['params_values'] = $params;

                if ($this->debug_mode) {
                    error_log("[Router] Route matched: {$route['pattern']}");
                    error_log("[Router] Parameters: " . json_encode($params));
                }

                return $this->execute_handler($route['handler'], $params);
            }
        }

        // No route found
        if ($this->debug_mode) {
            error_log("[Router] No route found for: {$method} {$path}");
        }

        $this->handle_404();
    }

    /**
     * Execute the route handler
     */
    private function execute_handler($handler, $params)
    {
        try {
            if (is_string($handler)) {
                return $this->execute_controller_action($handler, $params);
            } elseif (is_callable($handler)) {
                return call_user_func_array($handler, array_values($params));
            } else {
                throw new Exception("Invalid route handler");
            }
        } catch (Exception $e) {
            if ($this->debug_mode) {
                error_log("[Router] Handler error: " . $e->getMessage());
            }
            $this->handle_error($e);
        }
    }

    /**
     * Execute controller action from string
     */
    private function execute_controller_action($handler, $params)
    {
        if (strpos($handler, '@') === false) {
            throw new Exception("Invalid controller@action format: {$handler}");
        }

        list($controller_name, $action) = explode('@', $handler, 2);

        // Build controller class name
        $controller_class = $controller_name . 'Controller';
        $controller_file = dirname(__DIR__) . "/controllers/{$controller_class}.php";

        if (!file_exists($controller_file)) {
            throw new Exception("Controller file not found: {$controller_file}");
        }

        require_once $controller_file;

        if (!class_exists($controller_class)) {
            throw new Exception("Controller class not found: {$controller_class}");
        }

        $controller = new $controller_class();

        if (!method_exists($controller, $action)) {
            throw new Exception("Action not found: {$controller_class}@{$action}");
        }

        // Pass parameters to the action
        return call_user_func_array([$controller, $action], array_values($params));
    }

    /**
     * Get current request path
     */
    private function get_current_path()
    {
        $path = $_SERVER['REQUEST_URI'];

        // Remove query string
        if (($pos = strpos($path, '?')) !== false) {
            $path = substr($path, 0, $pos);
        }

        // Remove base path if set
        if ($this->base_path && strpos($path, $this->base_path) === 0) {
            $path = substr($path, strlen($this->base_path));
        }

        return $path ?: '/';
    }

    /**
     * Generate URL for named route
     */
    public function url($name, $params = [])
    {
        foreach ($this->routes as $route) {
            if ($route['name'] === $name) {
                $url = $route['pattern'];

                // Replace parameters
                foreach ($params as $key => $value) {
                    $url = str_replace('{' . $key . '}', $value, $url);
                }

                // Check for unreplaced parameters
                if (preg_match('#\{[^}]+\}#', $url)) {
                    throw new Exception("Missing parameters for route: {$name}");
                }

                return $url;
            }
        }

        throw new Exception("Route not found: {$name}");
    }

    /**
     * Get current route information
     */
    public function current_route()
    {
        return $this->current_route;
    }

    /**
     * Check if current route matches pattern
     */
    public function is($pattern)
    {
        if (!$this->current_route) {
            return false;
        }

        return $this->current_route['pattern'] === $pattern;
    }

    /**
     * Handle 404 errors
     */
    private function handle_404()
    {
        http_response_code(404);

        // Try to load custom 404 page
        $error_page = dirname(__DIR__, 2) . '/public/errors/404.html';
        if (file_exists($error_page)) {
            include $error_page;
        } else {
            echo '<!DOCTYPE html>
<html>
<head>
    <title>404 - Page Not Found</title>
    <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
        h1 { color: #667eea; }
        p { color: #666; }
        a { color: #667eea; text-decoration: none; }
        a:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <h1>404 - Page Not Found</h1>
    <p>The page you are looking for could not be found.</p>
    <p><a href="/">Return to Homepage</a></p>
</body>
</html>';
        }
    }

    /**
     * Handle general errors
     */
    private function handle_error($exception)
    {
        http_response_code(500);

        if ($this->debug_mode) {
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
            // Try to load custom 500 page
            $error_page = dirname(__DIR__, 2) . '/public/errors/500.html';
            if (file_exists($error_page)) {
                include $error_page;
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
        }
    }

    /**
     * Get all registered routes (for debugging)
     */
    public function get_routes()
    {
        return $this->routes;
    }

    /**
     * Middleware support (basic implementation)
     */
    public function middleware($middleware)
    {
        // Simple middleware implementation
        // In a more advanced version, this would be more sophisticated
        if (is_callable($middleware)) {
            $result = $middleware();
            if ($result === false) {
                $this->handle_404();
                return false;
            }
        }
        return true;
    }
}
