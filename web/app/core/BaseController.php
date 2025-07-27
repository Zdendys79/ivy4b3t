<?php
/**
 * File: BaseController.php
 * Location: ~/web/app/core/BaseController.php
 *
 * Purpose: Base controller class providing common functionality for all controllers.
 *          Handles view rendering, data passing, authentication checks, and utilities.
 */

// Security check
if (!defined('IVY_FRAMEWORK')) {
    http_response_code(403);
    die('Direct access not allowed');
}

abstract class BaseController
{
    protected $db;
    protected $data = [];
    protected $layout = 'app';
    protected $debug_mode = false;

    public function __construct()
    {
        $this->debug_mode = isset($_GET['debug']) && $_GET['debug'] === 'true';
        $this->db = new Database($this->debug_mode);
        $this->init();
    }

    /**
     * Initialize controller - override in child classes
     */
    protected function init()
    {
        // Override in child classes
    }

    /**
     * Render a view with layout
     */
    protected function render($view, $data = [], $layout = null)
    {
        $layout = $layout ?: $this->layout;
        $this->data = array_merge($this->data, $data);

        // Add global data
        $this->data['current_user'] = $this->get_current_user();
        $this->data['debug_mode'] = $this->debug_mode;
        $this->data['page_title'] = $this->data['page_title'] ?? 'IVY4B3T';
        $this->data['assets_version'] = $this->get_assets_version();

        if ($this->debug_mode) {
            error_log("[BaseController] Rendering view: {$view} with layout: {$layout}");
        }

        // Start output buffering for the view
        ob_start();
        $this->render_view($view);
        $content = ob_get_clean();

        // Add content to data for layout
        $this->data['content'] = $content;

        // Render layout
        $this->render_layout($layout);
    }

    /**
     * Render view without layout
     */
    protected function render_partial($view, $data = [])
    {
        $this->data = array_merge($this->data, $data);
        $this->render_view($view);
    }

    /**
     * Render JSON response
     */
    protected function json($data, $status_code = 200)
    {
        http_response_code($status_code);
        header('Content-Type: application/json');
        echo json_encode($data);
        exit;
    }

    /**
     * Redirect to URL
     */
    protected function redirect($url, $status_code = 302)
    {
        http_response_code($status_code);
        header("Location: {$url}");
        exit;
    }

    /**
     * Redirect back to previous page
     */
    protected function redirect_back($fallback = '/')
    {
        $referer = $_SERVER['HTTP_REFERER'] ?? $fallback;
        $this->redirect($referer);
    }

    /**
     * Set flash message
     */
    protected function flash($type, $message)
    {
        if (!isset($_SESSION)) {
            session_start();
        }

        $_SESSION['flash'] = [
            'type' => $type,
            'message' => $message
        ];
    }

    /**
     * Get flash message and clear it
     */
    protected function get_flash()
    {
        if (!isset($_SESSION)) {
            session_start();
        }

        if (isset($_SESSION['flash'])) {
            $flash = $_SESSION['flash'];
            unset($_SESSION['flash']);
            return $flash;
        }

        return null;
    }

    /**
     * Check if user is authenticated
     */
    protected function require_auth()
    {
        if (!$this->is_authenticated()) {
            $this->flash('error', 'You must be logged in to access this page.');
            $this->redirect('/login');
        }
    }

    /**
     * Check authentication status
     */
    protected function is_authenticated()
    {
        if (!isset($_SESSION)) {
            session_start();
        }

        return isset($_SESSION['user_id']) && !empty($_SESSION['user_id']);
    }

    /**
     * Get current authenticated user
     */
    protected function get_current_user()
    {
        if (!$this->is_authenticated()) {
            return null;
        }

        // Cache user data in session to avoid repeated DB queries
        if (!isset($_SESSION['user_data'])) {
            $_SESSION['user_data'] = $this->db->get_user_by_id($_SESSION['user_id']);
        }

        return $_SESSION['user_data'];
    }

    /**
     * Get request data
     */
    protected function get_input($key = null, $default = null)
    {
        $data = [];

        // Merge GET and POST data
        $data = array_merge($_GET, $_POST);

        // Handle JSON input
        if (isset($_SERVER['CONTENT_TYPE']) &&
            strpos($_SERVER['CONTENT_TYPE'], 'application/json') !== false) {
            $json = file_get_contents('php://input');
            $json_data = json_decode($json, true);
            if (is_array($json_data)) {
                $data = array_merge($data, $json_data);
            }
        }

        if ($key === null) {
            return $data;
        }

        return isset($data[$key]) ? $data[$key] : $default;
    }

    /**
     * Validate request data
     */
    protected function validate($rules, $data = null)
    {
        $data = $data ?: $this->get_input();
        $errors = [];

        foreach ($rules as $field => $rule_string) {
            $rules_array = explode('|', $rule_string);
            $value = isset($data[$field]) ? $data[$field] : null;

            foreach ($rules_array as $rule) {
                $rule_parts = explode(':', $rule);
                $rule_name = $rule_parts[0];
                $rule_value = isset($rule_parts[1]) ? $rule_parts[1] : null;

                switch ($rule_name) {
                    case 'required':
                        if (empty($value)) {
                            $errors[$field][] = ucfirst($field) . ' is required';
                        }
                        break;

                    case 'email':
                        if ($value && !filter_var($value, FILTER_VALIDATE_EMAIL)) {
                            $errors[$field][] = ucfirst($field) . ' must be a valid email';
                        }
                        break;

                    case 'min':
                        if ($value && strlen($value) < $rule_value) {
                            $errors[$field][] = ucfirst($field) . " must be at least {$rule_value} characters";
                        }
                        break;

                    case 'max':
                        if ($value && strlen($value) > $rule_value) {
                            $errors[$field][] = ucfirst($field) . " must not exceed {$rule_value} characters";
                        }
                        break;

                    case 'numeric':
                        if ($value && !is_numeric($value)) {
                            $errors[$field][] = ucfirst($field) . ' must be a number';
                        }
                        break;

                    case 'in':
                        $allowed_values = explode(',', $rule_value);
                        if ($value && !in_array($value, $allowed_values)) {
                            $errors[$field][] = ucfirst($field) . ' must be one of: ' . implode(', ', $allowed_values);
                        }
                        break;
                }
            }
        }

        return [
            'valid' => empty($errors),
            'errors' => $errors,
            'data' => $data
        ];
    }

    /**
     * Log system event
     */
    protected function log_event($title, $text, $data = [])
    {
        $hostname = $_SERVER['HTTP_HOST'] ?? 'unknown';
        return $this->db->log_system_event($hostname, $title, $text, $data);
    }

    /**
     * Render view file
     */
    private function render_view($view)
    {
        $view_file = dirname(__DIR__) . "/views/{$view}.php";

        if (!file_exists($view_file)) {
            throw new Exception("View not found: {$view}");
        }

        // Extract data variables for view
        extract($this->data);

        // Include view file
        include $view_file;
    }

    /**
     * Render layout file
     */
    private function render_layout($layout)
    {
        $layout_file = dirname(__DIR__) . "/views/layouts/{$layout}.php";

        if (!file_exists($layout_file)) {
            throw new Exception("Layout not found: {$layout}");
        }

        // Extract data variables for layout
        extract($this->data);

        // Include layout file
        include $layout_file;
    }

    /**
     * Get assets version for cache busting
     */
    private function get_assets_version()
    {
        static $version = null;

        if ($version === null) {
            // Try to get version from git commit or use timestamp
            $version_file = dirname(__DIR__, 2) . '/package.json';
            if (file_exists($version_file)) {
                $package = json_decode(file_get_contents($version_file), true);
                $version = $package['versionCode'] ?? time();
            } else {
                $version = time();
            }
        }

        return $version;
    }

    /**
     * Helper to generate asset URLs with versioning
     */
    protected function asset($path)
    {
        $version = $this->get_assets_version();
        return "/assets/{$path}?v={$version}";
    }

    /**
     * CSRF protection
     */
    protected function csrf_token()
    {
        if (!isset($_SESSION)) {
            session_start();
        }

        if (!isset($_SESSION['csrf_token'])) {
            $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        }

        return $_SESSION['csrf_token'];
    }

    protected function verify_csrf($token)
    {
        if (!isset($_SESSION)) {
            session_start();
        }

        return isset($_SESSION['csrf_token']) && hash_equals($_SESSION['csrf_token'], $token);
    }

    /**
     * Error handling
     */
    protected function abort($code, $message = '')
    {
        http_response_code($code);

        if ($code === 404) {
            $this->render('errors/404', ['message' => $message], 'error');
        } else {
            $this->render('errors/500', ['message' => $message], 'error');
        }

        exit;
    }
}
