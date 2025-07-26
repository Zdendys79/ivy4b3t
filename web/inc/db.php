<?php
/**
 * Název souboru: db.php
 * Umístění: ~/web/inc/db.php
 * 
 * Popis: Bezpečné připojení k databázi pomocí systémových proměnných
 * Používá environment variables místo hardcoded config souborů
 */

try {
    // Načtení konfigurace z environment variables
    $db_host = getenv('DB_HOST');
    $db_user = getenv('DB_USER'); 
    $db_pass = getenv('DB_PASS');
    $db_name = getenv('DB_NAME');
    
    // Kontrola dostupnosti všech potřebných proměnných
    if (!$db_host || !$db_user || !$db_pass || !$db_name) {
        throw new Exception("Chybějící databázové environment variables (DB_HOST, DB_USER, DB_PASS, DB_NAME)");
    }
    
    // DSN pro PDO
    $dsn = "mysql:host={$db_host};dbname={$db_name};charset=utf8mb4";
    
    // Připojení k databázi
    $pdo = new PDO($dsn, $db_user, $db_pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false
    ]);
    
} catch (Exception $e) {
    // Bezpečné logování chyby bez odhalení citlivých údajů
    error_log("Database connection error: " . $e->getMessage());
    die("Chyba připojení k databázi. Zkontrolujte systémové nastavení.");
}
?>