<?php
/**
 * Google OAuth Configuration
 * Store sensitive data in environment variables
 */

// Security check
if (!defined('IVY_FRAMEWORK')) {
    http_response_code(403);
    die('Direct access not allowed');
}

// Get client secret from environment variables ONLY
$client_secret = $_SERVER['GOOGLE_CLIENT_SECRET'] ?? getenv('GOOGLE_CLIENT_SECRET') ?? '';

// Check if client secret is available
if (empty($client_secret)) {
    throw new Exception('Google OAuth Client Secret not found in environment variables. Please set GOOGLE_CLIENT_SECRET.');
}

return [
    'client_id' => '248275060667-8of6j0dobbtrp2saosfi91hc89nialkl.apps.googleusercontent.com',
    'client_secret' => $client_secret,
    'redirect_uri' => 'https://ivy.zdendys79.website/auth/google/callback',
    'scope' => 'openid email profile',
    'auth_url' => 'https://accounts.google.com/o/oauth2/v2/auth',
    'token_url' => 'https://oauth2.googleapis.com/token',
    'userinfo_url' => 'https://www.googleapis.com/oauth2/v2/userinfo'
];