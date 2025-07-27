<?php
// Debug endpoint pro kontrolu locked uživatelů - pouze z tvého IP
define('IVY_FRAMEWORK', true);

$client_ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
if ($client_ip !== '89.177.204.191') {
    echo "Access denied. Your IP: $client_ip";
    exit;
}

// Zapnout error reporting
error_reporting(E_ALL);
ini_set('display_errors', 1);

echo "<h2>Debug: Locked Users</h2>";
echo "<pre>";

try {
    require_once __DIR__ . '/db-config.php';
    require_once __DIR__ . '/app/core/Database.php';
    
    $db = new Database();
    $pdo = $db->getPdo();
    
    echo "=== Struktura tabulky fb_users ===\n";
    $stmt = $pdo->query("DESCRIBE fb_users");
    $columns = $stmt->fetchAll();
    foreach ($columns as $col) {
        echo sprintf("%-15s %-15s %-10s\n", $col['Field'], $col['Type'], $col['Null']);
    }
    
    echo "\n=== Kontrola locked sloupce ===\n";
    $stmt = $pdo->query("SHOW COLUMNS FROM fb_users LIKE 'locked'");
    if ($stmt->rowCount() > 0) {
        echo "✓ Sloupec 'locked' existuje\n";
    } else {
        echo "❌ Sloupec 'locked' NEEXISTUJE!\n";
    }
    
    echo "\n=== Statistiky locked hodnot ===\n";
    try {
        $stmt = $pdo->query("SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN locked = 1 THEN 1 ELSE 0 END) as locked_count,
            SUM(CASE WHEN locked = 0 OR locked IS NULL THEN 1 ELSE 0 END) as unlocked_count
        FROM fb_users");
        $stats = $stmt->fetch();
        
        echo "Celkem uživatelů: {$stats['total']}\n";
        echo "Uzamčených (locked=1): {$stats['locked_count']}\n";
        echo "Odemčených (locked=0/NULL): {$stats['unlocked_count']}\n";
        
    } catch (Exception $e) {
        echo "❌ Chyba při čtení locked hodnot: " . $e->getMessage() . "\n";
    }
    
    echo "\n=== Seznam všech uživatelů s locked statusem ===\n";
    try {
        $stmt = $pdo->query("SELECT id, name, surname, host, locked FROM fb_users ORDER BY id LIMIT 20");
        $users = $stmt->fetchAll();
        
        echo sprintf("%-5s %-20s %-15s %-8s\n", "ID", "Jméno", "Host", "Locked");
        echo str_repeat("-", 60) . "\n";
        
        foreach ($users as $user) {
            $locked_status = $user['locked'] === null ? 'NULL' : ($user['locked'] ? 'YES' : 'NO');
            echo sprintf("%-5s %-20s %-15s %-8s\n", 
                $user['id'], 
                $user['name'] . ' ' . $user['surname'], 
                $user['host'], 
                $locked_status
            );
        }
        
    } catch (Exception $e) {
        echo "❌ Chyba při výpisu uživatelů: " . $e->getMessage() . "\n";
    }
    
} catch (Exception $e) {
    echo "❌ Database error: " . $e->getMessage() . "\n";
}

echo "</pre>";
?>