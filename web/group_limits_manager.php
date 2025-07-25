<?php
// group_limits_manager.php
// Upraveno pro použití třídy Database z app/core/Database.php

// Bezpečné nastavení chybového výstupu pouze pro development
if (isset($_SERVER['SERVER_NAME']) && $_SERVER['SERVER_NAME'] === 'localhost') {
    error_reporting(E_ALL);
    ini_set('display_errors', 1);
} else {
    error_reporting(0);
    ini_set('display_errors', 0);
}

// Načtení třídy Database
require_once __DIR__ . '/app/core/Database.php';

// Inicializace databáze
$db = new Database();

// Dotaz na limity skupin
$query = "SELECT * FROM group_limits ORDER BY group_name ASC";
$db->query($query);

try {
    $limits = $db->resultSet();
} catch (Exception $e) {
    die("Database error: " . $e->getMessage());
}

// Zobrazení výsledků (příklad jednoduchého výpisu)
echo "<h1>Group Limits</h1>";
if (empty($limits)) {
    echo "<p>No records found.</p>";
} else {
    echo "<ul>";
    foreach ($limits as $row) {
        echo "<li><strong>{$row['group_name']}</strong>: {$row['daily_limit']} / {$row['weekly_limit']}</li>";
    }
    echo "</ul>";
}
