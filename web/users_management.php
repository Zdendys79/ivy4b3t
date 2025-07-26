<?php
/**
 * Název souboru: blocked_users.php
 * Umístění: ~/web/blocked_users.php
 * 
 * Popis: Přehled blokovaných uživatelů s možností správy přes UI příkazy
 * Funkce: Zobrazuje zablokované uživatele podle hostů, umožňuje přihlášení uživatele
 */

require_once 'inc/db.php';
require_once 'inc/header.php';

// Zpracování AJAX požadavků
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action'])) {
    header('Content-Type: application/json');
    
    switch ($_POST['action']) {
        case 'login_user':
            $user_id = intval($_POST['user_id']);
            $host = $_POST['host'];
            
            // Vložení UI příkazu pro přihlášení uživatele
            $stmt = $pdo->prepare("
                INSERT INTO ui_commands (host, command, data, created) 
                VALUES (?, 'call_user', ?, NOW())
            ");
            
            $data = json_encode(['user_id' => $user_id]);
            $result = $stmt->execute([$host, $data]);
            
            if ($result) {
                echo json_encode(['success' => true, 'message' => 'UI příkaz byl zařazen']);
            } else {
                echo json_encode(['success' => false, 'message' => 'Chyba při vkládání příkazu']);
            }
            exit;
            
        case 'get_ui_status':
            $user_id = intval($_POST['user_id']);
            
            // Získání statusu UI příkazu pro daného uživatele
            $stmt = $pdo->prepare("
                SELECT id, accepted, fulfilled, created,
                       CASE 
                           WHEN fulfilled IS NOT NULL THEN 'completed'
                           WHEN accepted IS NOT NULL THEN 'in_progress' 
                           ELSE 'pending'
                       END as status,
                       CASE 
                           WHEN accepted IS NOT NULL AND fulfilled IS NULL 
                           THEN GREATEST(0, 300 - TIMESTAMPDIFF(SECOND, accepted, NOW()))
                           ELSE 0
                       END as remaining_seconds
                FROM ui_commands 
                WHERE command = 'call_user' 
                  AND JSON_EXTRACT(data, '$.user_id') = ?
                  AND fulfilled IS NULL
                ORDER BY created DESC 
                LIMIT 1
            ");
            
            $stmt->execute([$user_id]);
            $command = $stmt->fetch(PDO::FETCH_ASSOC);
            
            echo json_encode($command ?: ['status' => 'none']);
            exit;
    }
}

// Získání všech uživatelů seskupených podle hostů
$stmt = $pdo->prepare("
    SELECT 
        f.id,
        f.name,
        f.surname,
        f.locked,
        f.lock_reason,
        f.lock_type,
        f.host,
        f.fb_login,
        f.next_worktime,
        CASE 
            WHEN f.host IS NULL OR f.host = '' THEN 'Nezařazeni'
            ELSE f.host
        END as host_group,
        CASE 
            WHEN f.host IS NULL OR f.host = '' THEN 1
            ELSE 0
        END as host_sort_order
    FROM fb_users f
    ORDER BY host_sort_order ASC, host_group ASC, f.name, f.surname
");

$stmt->execute();
$users = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Získání informací o heartbeat pro všechny hosty
$stmt = $pdo->prepare("
    SELECT 
        host,
        up as last_heartbeat,
        user_id,
        action_name,
        version,
        TIMESTAMPDIFF(MINUTE, up, NOW()) as minutes_ago,
        CASE 
            WHEN up > NOW() - INTERVAL 5 MINUTE THEN 'online'
            WHEN up > NOW() - INTERVAL 15 MINUTE THEN 'warning' 
            ELSE 'offline'
        END as status
    FROM heartbeat 
    ORDER BY up DESC
");

$stmt->execute();
$heartbeats = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Indexování heartbeat podle hostů
$heartbeat_by_host = [];
foreach ($heartbeats as $hb) {
    if (!isset($heartbeat_by_host[$hb['host']])) {
        $heartbeat_by_host[$hb['host']] = $hb;
    }
}

// Získání posledních systémových logů pro každého hostitele
$stmt = $pdo->prepare("
    SELECT 
        hostname,
        event_type,
        event_level,
        message,
        timestamp,
        TIMESTAMPDIFF(MINUTE, timestamp, NOW()) as minutes_ago
    FROM log_system 
    WHERE timestamp > NOW() - INTERVAL 2 HOUR
    ORDER BY timestamp DESC
");

$stmt->execute();
$system_logs = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Indexování systémových logů podle hostů (nejnovější log pro každého hostitele)
$latest_logs_by_host = [];
foreach ($system_logs as $log) {
    if (!isset($latest_logs_by_host[$log['hostname']])) {
        $latest_logs_by_host[$log['hostname']] = $log;
    }
}

// Seskupení podle hostů
$users_by_host = [];
foreach ($users as $user) {
    $host = $user['host_group'];
    if (!isset($users_by_host[$host])) {
        $users_by_host[$host] = [];
    }
    $users_by_host[$host][] = $user;
}

// Seřazení uživatelů v každém hostu podle ID
foreach ($users_by_host as $host => &$host_users) {
    usort($host_users, function($a, $b) {
        return $a['id'] <=> $b['id'];
    });
}
?>

<!DOCTYPE html>
<html lang="cs">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Správa uživatelů podle hostů - IVY Management</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }
        
        .container {
            max-width: 1400px;
            margin: 0 auto;
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        
        
        h1 {
            color: #333;
            margin-bottom: 30px;
            text-align: center;
        }
        
        .host-group {
            margin-bottom: 30px;
            border: 1px solid #ddd;
            border-radius: 8px;
            overflow: hidden;
        }
        
        .host-header {
            background: #4CAF50;
            color: white;
            padding: 15px;
            font-weight: bold;
            font-size: 18px;
            cursor: pointer;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .host-header:hover {
            background: #45a049;
        }
        
        .host-header.offline {
            background: #f44336;
        }
        
        .host-header.warning {
            background: #ff9800;
        }
        
        .host-info {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            flex: 1;
        }
        
        .host-status {
            font-size: 12px;
            margin-top: 3px;
            opacity: 0.9;
        }
        
        .host-actions {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .user-count {
            background: rgba(255,255,255,0.2);
            padding: 5px 10px;
            border-radius: 15px;
            font-size: 14px;
        }
        
        .users-list {
            display: none;
            padding: 0;
        }
        
        .users-list.show {
            display: block;
        }
        
        .user-item {
            border-bottom: 1px solid #eee;
            padding: 15px;
            cursor: pointer;
            transition: background-color 0.3s;
        }
        
        .user-item:hover {
            background-color: #f9f9f9;
        }
        
        .user-item:last-child {
            border-bottom: none;
        }
        
        .user-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .user-info {
            flex: 1;
        }
        
        .user-name {
            font-weight: bold;
            font-size: 16px;
            color: #333;
        }
        
        .user-details {
            color: #666;
            font-size: 14px;
            margin-top: 5px;
        }
        
        .lock-badge {
            padding: 5px 10px;
            border-radius: 15px;
            font-size: 12px;
            font-weight: bold;
            text-transform: uppercase;
        }
        
        .lock-checkpoint { background: #ff5722; color: white; }
        .lock-videoselfie { background: #ff9800; color: white; }
        .lock-other { background: #9e9e9e; color: white; }
        
        .user-actions {
            display: none;
            padding: 15px;
            background: #f8f9fa;
            border-top: 1px solid #eee;
        }
        
        .user-actions.show {
            display: block;
        }
        
        .action-button {
            background: #2196F3;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            margin-right: 10px;
            font-size: 14px;
            transition: all 0.3s;
        }
        
        .action-button:hover {
            background: #1976D2;
        }
        
        .action-button.pending {
            background: #f44336;
            animation: pulse 2s infinite;
        }
        
        .action-button.in-progress {
            background: #4CAF50;
            position: relative;
        }
        
        .action-button.completed {
            background: #9E9E9E;
            cursor: not-allowed;
        }
        
        .timer {
            font-size: 12px;
            margin-left: 10px;
            font-weight: bold;
        }
        
        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.7; }
            100% { opacity: 1; }
        }
        
        .expand-icon {
            transition: transform 0.3s;
        }
        
        .expand-icon.rotated {
            transform: rotate(180deg);
        }
        
        .status-info {
            font-size: 12px;
            margin-top: 5px;
            padding: 5px;
            border-radius: 3px;
        }
        
        .status-pending { background: #ffebee; color: #c62828; }
        .status-in-progress { background: #e8f5e8; color: #2e7d32; }
        .status-completed { background: #f3e5f5; color: #7b1fa2; }
    </style>
</head>
<body>
    <div class="container">
        <h1>👥 Správa uživatelů podle hostů</h1>
        
        <?php if (empty($users_by_host)): ?>
            <div style="text-align: center; color: #666; padding: 50px;">
                <h3>Žádní uživatelé</h3>
                <p>V databázi nejsou nalezeni žádní uživatelé.</p>
            </div>
        <?php else: ?>
            <?php foreach ($users_by_host as $host => $host_users): ?>
                <?php
                // Získání heartbeat informací pro hostitele
                $hb = isset($heartbeat_by_host[$host]) ? $heartbeat_by_host[$host] : null;
                $log = isset($latest_logs_by_host[$host]) ? $latest_logs_by_host[$host] : null;
                
                // Určení třídy CSS podle statusu
                $status_class = '';
                if (!$hb) {
                    $status_class = 'offline';
                } else {
                    $status_class = $hb['status'];
                }
                ?>
                <div class="host-group">
                    <div class="host-header <?php echo $status_class; ?>" onclick="toggleHost('<?php echo htmlspecialchars($host); ?>')">
                        <div class="host-info">
                            <div><?php echo htmlspecialchars($host); ?></div>
                            <div class="host-status">
                                <?php if (!$hb): ?>
                                    ❌ Žádný heartbeat - hostitel neběží
                                <?php else: ?>
                                    <?php 
                                    $status_icon = $hb['status'] === 'online' ? '✅' : ($hb['status'] === 'warning' ? '⚠️' : '❌');
                                    echo $status_icon . ' Heartbeat: ' . $hb['minutes_ago'] . ' min';
                                    
                                    if ($hb['action_name'] && $hb['user_id']) {
                                        echo ' | Akce: ' . htmlspecialchars($hb['action_name']) . ' (User ' . $hb['user_id'] . ')';
                                    } elseif ($hb['action_name']) {
                                        echo ' | Akce: ' . htmlspecialchars($hb['action_name']);
                                    }
                                    ?>
                                <?php endif; ?>
                                
                                <?php 
                                // Zobrazit systémový log pokud je novější než heartbeat
                                if ($log && (!$hb || strtotime($log['timestamp']) > strtotime($hb['last_heartbeat']))): 
                                ?>
                                    <br>🔧 Log: <?php echo htmlspecialchars($log['message']); ?> (<?php echo $log['minutes_ago']; ?> min)
                                <?php endif; ?>
                            </div>
                        </div>
                        <div class="host-actions">
                            <span class="user-count"><?php echo count($host_users); ?> uživatelů</span>
                            <span class="expand-icon" id="icon-<?php echo htmlspecialchars($host); ?>">▼</span>
                        </div>
                    </div>
                    
                    <div class="users-list" id="users-<?php echo htmlspecialchars($host); ?>">
                        <?php foreach ($host_users as $user): ?>
                            <div class="user-item" onclick="toggleUser(<?php echo $user['id']; ?>)">
                                <div class="user-header">
                                    <div class="user-info">
                                        <div class="user-name">
                                            <?php echo htmlspecialchars($user['name'] . ' ' . $user['surname']); ?>
                                        </div>
                                        <div class="user-details">
                                            ID: <?php echo $user['id']; ?> | 
                                            Login: <?php echo htmlspecialchars($user['fb_login']); ?>
                                            <?php if ($user['locked']): ?>
                                                | Zablokován: <?php echo date('d.m.Y H:i', strtotime($user['locked'])); ?>
                                                <?php if ($user['lock_reason']): ?>
                                                    <br>Důvod: <?php echo htmlspecialchars($user['lock_reason']); ?>
                                                <?php endif; ?>
                                            <?php elseif ($user['next_worktime']): ?>
                                                | Další práce: <?php echo date('d.m.Y H:i', strtotime($user['next_worktime'])); ?>
                                            <?php endif; ?>
                                        </div>
                                    </div>
                                    
                                    <?php if ($user['locked']): ?>
                                        <?php
                                        $lockClass = 'lock-other';
                                        if ($user['lock_type'] === 'CHECKPOINT') $lockClass = 'lock-checkpoint';
                                        elseif ($user['lock_type'] === 'VIDEOSELFIE') $lockClass = 'lock-videoselfie';
                                        ?>
                                        <span class="lock-badge <?php echo $lockClass; ?>">
                                            <?php echo htmlspecialchars($user['lock_type'] ?: 'BLOKOVÁN'); ?>
                                        </span>
                                    <?php else: ?>
                                        <span class="lock-badge" style="background: #4CAF50; color: white;">
                                            AKTIVNÍ
                                        </span>
                                    <?php endif; ?>
                                </div>
                                
                                <div class="user-actions" id="actions-<?php echo $user['id']; ?>">
                                    <button class="action-button" id="login-btn-<?php echo $user['id']; ?>" 
                                            onclick="event.stopPropagation(); loginUser(<?php echo $user['id']; ?>, '<?php echo htmlspecialchars($user['host']); ?>')">
                                        🖥️ Přihlásit uživatele
                                    </button>
                                    
                                    <div class="status-info" id="status-<?php echo $user['id']; ?>" style="display: none;">
                                        <span id="status-text-<?php echo $user['id']; ?>"></span>
                                        <span class="timer" id="timer-<?php echo $user['id']; ?>"></span>
                                    </div>
                                </div>
                            </div>
                        <?php endforeach; ?>
                    </div>
                </div>
            <?php endforeach; ?>
        <?php endif; ?>
    </div>

    <script>
        // Globální proměnné pro timery
        const timers = {};
        const statusCheckers = {};
        
        // Toggle zobrazení hostů
        function toggleHost(host) {
            const usersList = document.getElementById('users-' + host);
            const icon = document.getElementById('icon-' + host);
            
            if (usersList && icon) {
                if (usersList.classList.contains('show')) {
                    usersList.classList.remove('show');
                    icon.classList.remove('rotated');
                } else {
                    usersList.classList.add('show');
                    icon.classList.add('rotated');
                }
            }
        }
        
        // Toggle zobrazení akcí uživatele
        function toggleUser(userId) {
            const actions = document.getElementById('actions-' + userId);
            
            if (actions.classList.contains('show')) {
                actions.classList.remove('show');
            } else {
                actions.classList.add('show');
                // Zkontrolovat status při otevření
                checkUIStatus(userId);
            }
        }
        
        // Přihlášení uživatele
        function loginUser(userId, host) {
            const button = document.getElementById('login-btn-' + userId);
            const statusDiv = document.getElementById('status-' + userId);
            
            // Odeslat AJAX požadavek
            fetch('blocked_users.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: 'action=login_user&user_id=' + userId + '&host=' + encodeURIComponent(host)
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Změnit stav tlačítka na pending
                    button.classList.add('pending');
                    button.textContent = '⏳ Čeká na akceptaci...';
                    button.disabled = true;
                    
                    // Zobrazit status
                    statusDiv.style.display = 'block';
                    statusDiv.className = 'status-info status-pending';
                    statusDiv.querySelector('#status-text-' + userId).textContent = 'Příkaz zařazen do fronty';
                    
                    // Spustit kontrolu statusu
                    startStatusCheck(userId);
                } else {
                    alert('Chyba: ' + data.message);
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert('Chyba při odesílání požadavku');
            });
        }
        
        // Kontrola statusu UI příkazu
        function checkUIStatus(userId) {
            fetch('blocked_users.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: 'action=get_ui_status&user_id=' + userId
            })
            .then(response => response.json())
            .then(data => {
                updateUIStatus(userId, data);
            })
            .catch(error => {
                console.error('Error checking status:', error);
            });
        }
        
        // Aktualizace UI podle statusu
        function updateUIStatus(userId, data) {
            const button = document.getElementById('login-btn-' + userId);
            const statusDiv = document.getElementById('status-' + userId);
            const statusText = document.getElementById('status-text-' + userId);
            const timer = document.getElementById('timer-' + userId);
            
            if (data.status === 'none') {
                // Žádný aktivní příkaz
                button.className = 'action-button';
                button.textContent = '🖥️ Přihlásit uživatele';
                button.disabled = false;
                statusDiv.style.display = 'none';
                stopStatusCheck(userId);
                return;
            }
            
            statusDiv.style.display = 'block';
            
            switch (data.status) {
                case 'pending':
                    button.className = 'action-button pending';
                    button.textContent = '⏳ Čeká na akceptaci...';
                    button.disabled = true;
                    statusDiv.className = 'status-info status-pending';
                    statusText.textContent = 'Příkaz čeká na zpracování';
                    timer.textContent = '';
                    break;
                    
                case 'in_progress':
                    button.className = 'action-button in-progress';
                    button.textContent = '✅ Připojen - dostupný na vzdálené ploše';
                    button.disabled = true;
                    statusDiv.className = 'status-info status-in-progress';
                    statusText.textContent = 'Uživatel je připojen';
                    
                    if (data.remaining_seconds > 0) {
                        startTimer(userId, data.remaining_seconds);
                    }
                    break;
                    
                case 'completed':
                    button.className = 'action-button completed';
                    button.textContent = '✓ Dokončeno';
                    button.disabled = true;
                    statusDiv.className = 'status-info status-completed';
                    statusText.textContent = 'Příkaz byl dokončen';
                    timer.textContent = '';
                    stopStatusCheck(userId);
                    
                    // Po 5 sekundách obnovit tlačítko
                    setTimeout(() => {
                        button.className = 'action-button';
                        button.textContent = '🖥️ Přihlásit uživatele';
                        button.disabled = false;
                        statusDiv.style.display = 'none';
                    }, 5000);
                    break;
            }
        }
        
        // Spustit pravidelnou kontrolu statusu
        function startStatusCheck(userId) {
            if (statusCheckers[userId]) {
                clearInterval(statusCheckers[userId]);
            }
            
            statusCheckers[userId] = setInterval(() => {
                checkUIStatus(userId);
            }, 2000); // Kontrola každé 2 sekundy
        }
        
        // Zastavit kontrolu statusu
        function stopStatusCheck(userId) {
            if (statusCheckers[userId]) {
                clearInterval(statusCheckers[userId]);
                delete statusCheckers[userId];
            }
        }
        
        // Spustit odpočet času
        function startTimer(userId, seconds) {
            if (timers[userId]) {
                clearInterval(timers[userId]);
            }
            
            const timer = document.getElementById('timer-' + userId);
            let remaining = seconds;
            
            const updateTimer = () => {
                const minutes = Math.floor(remaining / 60);
                const secs = remaining % 60;
                timer.textContent = `⏱️ ${minutes}:${secs.toString().padStart(2, '0')}`;
                
                if (remaining <= 0) {
                    clearInterval(timers[userId]);
                    delete timers[userId];
                    timer.textContent = '⏰ Čas vypršel';
                } else {
                    remaining--;
                }
            };
            
            updateTimer(); // První aktualizace okamžitě
            timers[userId] = setInterval(updateTimer, 1000);
        }
        
        // Automaticky otevřít první host při načtení
        document.addEventListener('DOMContentLoaded', function() {
            const firstHost = document.querySelector('.host-header');
            if (firstHost) {
                firstHost.click();
            }
        });
    </script>
</body>
</html>