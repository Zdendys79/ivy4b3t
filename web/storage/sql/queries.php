<?php
// Security check
if (!defined('IVY_FRAMEWORK')) {
    http_response_code(403);
    die('Direct access not allowed');
}

return [
    'test_connection' => "SELECT 'Database connection successful!' AS status",
    'get_version' => "SELECT value FROM variables WHERE name = 'version'",
    'get_users_count' => "SELECT COUNT(*) as count FROM users",
    'get_system_info' => "SELECT name, value FROM variables WHERE name IN ('version', 'last_update')",
    
    // Auth queries
    'auth' => [
        'get_user_by_id' => "SELECT 'admin' as id, 'Administrator' as name, 'admin@system' as email"
    ]
];