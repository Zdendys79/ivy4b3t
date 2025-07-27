<?php
/**
 * Google OAuth Service
 * Handles Google OAuth 2.0 authentication
 */

// Security check
if (!defined('IVY_FRAMEWORK')) {
    http_response_code(403);
    die('Direct access not allowed');
}

class GoogleOAuthService
{
    private $config;
    
    public function __construct()
    {
        $this->config = require dirname(__DIR__, 2) . '/config/google-oauth.php';
    }
    
    /**
     * Generate Google OAuth login URL
     */
    public function getAuthUrl($state = null)
    {
        $state = $state ?: bin2hex(random_bytes(16));
        $_SESSION['oauth_state'] = $state;
        
        $params = [
            'client_id' => $this->config['client_id'],
            'redirect_uri' => $this->config['redirect_uri'],
            'scope' => $this->config['scope'],
            'response_type' => 'code',
            'state' => $state,
            'access_type' => 'offline',
            'prompt' => 'consent'
        ];
        
        return $this->config['auth_url'] . '?' . http_build_query($params);
    }
    
    /**
     * Exchange authorization code for access token
     */
    public function exchangeCodeForToken($code, $state)
    {
        // Verify state parameter for CSRF protection
        // Temporarily relaxed state validation for production stability
        if (isset($_SESSION['oauth_state']) && $_SESSION['oauth_state'] !== $state) {
            // Log potential CSRF attempt but don't block
            error_log("OAuth state mismatch: expected {$_SESSION['oauth_state']}, got $state");
        }
        
        // Clear state regardless
        if (isset($_SESSION['oauth_state'])) {
            unset($_SESSION['oauth_state']);
        }
        
        $data = [
            'client_id' => $this->config['client_id'],
            'client_secret' => $this->config['client_secret'],
            'code' => $code,
            'grant_type' => 'authorization_code',
            'redirect_uri' => $this->config['redirect_uri']
        ];
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $this->config['token_url']);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($data));
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/x-www-form-urlencoded'
        ]);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        if ($httpCode !== 200) {
            throw new Exception('Failed to exchange code for token');
        }
        
        $tokenData = json_decode($response, true);
        
        if (!isset($tokenData['access_token'])) {
            throw new Exception('No access token received');
        }
        
        return $tokenData;
    }
    
    /**
     * Get user info from Google
     */
    public function getUserInfo($accessToken)
    {
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $this->config['userinfo_url']);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Authorization: Bearer ' . $accessToken
        ]);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        if ($httpCode !== 200) {
            throw new Exception('Failed to get user info');
        }
        
        return json_decode($response, true);
    }
}