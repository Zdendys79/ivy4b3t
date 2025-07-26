<?php
// Debug script to check real IP address reaching the server
echo "<h2>IP Address Debug Info</h2>";
echo "<table border='1' style='border-collapse: collapse; font-family: monospace;'>";
echo "<tr><th style='padding: 10px;'>Source</th><th style='padding: 10px;'>Value</th></tr>";

// All possible IP sources
$ip_sources = [
    'REMOTE_ADDR' => $_SERVER['REMOTE_ADDR'] ?? 'not set',
    'HTTP_CLIENT_IP' => $_SERVER['HTTP_CLIENT_IP'] ?? 'not set',
    'HTTP_X_FORWARDED_FOR' => $_SERVER['HTTP_X_FORWARDED_FOR'] ?? 'not set',
    'HTTP_X_FORWARDED' => $_SERVER['HTTP_X_FORWARDED'] ?? 'not set',
    'HTTP_X_CLUSTER_CLIENT_IP' => $_SERVER['HTTP_X_CLUSTER_CLIENT_IP'] ?? 'not set',
    'HTTP_FORWARDED_FOR' => $_SERVER['HTTP_FORWARDED_FOR'] ?? 'not set',
    'HTTP_FORWARDED' => $_SERVER['HTTP_FORWARDED'] ?? 'not set',
    'HTTP_X_REAL_IP' => $_SERVER['HTTP_X_REAL_IP'] ?? 'not set',
    'HTTP_CF_CONNECTING_IP' => $_SERVER['HTTP_CF_CONNECTING_IP'] ?? 'not set'
];

foreach ($ip_sources as $source => $value) {
    $color = ($value !== 'not set') ? 'background: #e8f5e8;' : '';
    echo "<tr><td style='padding: 10px; $color'>$source</td><td style='padding: 10px; $color'>$value</td></tr>";
}

echo "</table>";

echo "<h3>Apache sees your IP as: <strong style='background: yellow; padding: 5px;'>" . ($_SERVER['REMOTE_ADDR'] ?? 'UNKNOWN') . "</strong></h3>";
echo "<p>This is the IP that must be in .htaccess Require ip directive.</p>";
echo "<p>Current time: " . date('Y-m-d H:i:s') . "</p>";
?>