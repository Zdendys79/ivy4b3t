<?php
// Test parsování account_delay a account_sleep

// Test data z databáze
$test_delays = [
    "Account delay: 110min",
    "Account delay: 82min", 
    "Account delay: 176min",
    "Account delay: 5min"
];

$test_sleeps = [
    "Account sleep: 38h",
    "Account sleep: 25h",
    "Account sleep: 2h",
    "Account sleep: 144h"
];

echo "=== TESTOVÁNÍ PARSOVÁNÍ account_delay ===\n";
foreach ($test_delays as $text) {
    $delay_duration = 0;
    if (preg_match('/(\d+)\s*min/i', $text, $matches)) {
        $delay_duration = intval($matches[1]);
    }
    $hours = floor($delay_duration / 60);
    $minutes = $delay_duration % 60;
    echo "$text => {$hours}h:{$minutes}m\n";
}

echo "\n=== TESTOVÁNÍ PARSOVÁNÍ account_sleep ===\n";
foreach ($test_sleeps as $text) {
    $sleep_duration_hours = 0;
    if (preg_match('/(\d+)\s*h/i', $text, $matches)) {
        $sleep_duration_hours = intval($matches[1]);
    }
    $days = floor($sleep_duration_hours / 24);
    $hours = $sleep_duration_hours % 24;
    echo "$text => {$days}d:{$hours}h\n";
}

// Test z reálné databáze
$host = getenv('MYSQL_HOST') ?: 'localhost';
$port = getenv('MYSQL_PORT') ?: '3306';
$user = getenv('MYSQL_USER') ?: 'ivy_user';
$pass = getenv('MYSQL_PASSWORD') ?: '';
$dbname = getenv('MYSQL_DATABASE') ?: 'ivy';

$conn = new mysqli($host, $user, $pass, $dbname, $port);

echo "\n=== REÁLNÁ DATA Z DATABÁZE ===\n";

// Zkontrolovat account_delay
$result = $conn->query("SELECT text FROM action_log WHERE action_code = 'account_delay' AND text IS NOT NULL LIMIT 5");
echo "Account Delay vzorky:\n";
while ($row = $result->fetch_assoc()) {
    echo "  - " . $row['text'] . "\n";
}

// Zkontrolovat account_sleep
$result = $conn->query("SELECT text FROM action_log WHERE action_code = 'account_sleep' AND text IS NOT NULL LIMIT 5");
echo "\nAccount Sleep vzorky:\n";
while ($row = $result->fetch_assoc()) {
    echo "  - " . $row['text'] . "\n";
}

$conn->close();
?>