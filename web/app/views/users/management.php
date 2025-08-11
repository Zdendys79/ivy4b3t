<!DOCTYPE html>
<html lang="cs">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= $title ?? 'Správa uživatelů' ?> - IVY4B3T</title>
    <style>
        body { 
            font-family: Arial, sans-serif; 
            margin: 20px; 
            background-color: #f5f5f5; 
        }
        .container { 
            background: white; 
            padding: 20px; 
            border-radius: 8px; 
            box-shadow: 0 2px 4px rgba(0,0,0,0.1); 
        }
        .hosts-grid {
            columns: 1;
            column-gap: 20px;
        }
        
        @media (min-width: 800px) {
            .hosts-grid {
                columns: 2;
            }
        }
        
        @media (min-width: 1600px) {
            .hosts-grid {
                columns: 3;
            }
        }
        
        .host-section {
            margin-bottom: 20px;
            padding: 15px;
            border: 1px solid #dee2e6;
            border-radius: 4px;
            break-inside: avoid;
        }
        .host-header {
            background-color: #f8f9fa;
            padding: 10px;
            margin: -15px -15px 15px -15px;
            border-radius: 4px 4px 0 0;
            font-weight: bold;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
        }
        th, td {
            padding: 6px 8px;
            text-align: left;
            border-bottom: 1px solid #dee2e6;
            vertical-align: middle;
        }
        
        td:first-child {
            width: 40%;
        }
        
        td:nth-child(2) {
            width: 30%;
            text-align: center;
            font-family: monospace;
            font-size: 12px;
        }
        
        td:nth-child(3) {
            width: 30%;
            text-align: center;
        }
        th {
            background-color: #f8f9fa;
            font-weight: bold;
        }
        .btn {
            padding: 4px 8px;
            border: none;
            border-radius: 3px;
            cursor: pointer;
            font-size: 11px;
            margin: 2px;
            display: inline-block;
        }
        .btn-primary { background-color: #007bff; color: white; }
        .btn-success { background-color: #28a745; color: white; }
        .btn-warning { background-color: #ffc107; color: black; }
        .btn:hover { opacity: 0.8; }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; }
        
        .status-online { color: #28a745; font-weight: bold; }
        .status-offline { color: #dc3545; font-weight: bold; }
        .locked { background-color: #f8d7da; }
        
        .stats {
            background-color: #d1ecf1;
            padding: 15px;
            border-radius: 4px;
            margin-bottom: 20px;
        }
        .error {
            background-color: #f8d7da;
            color: #721c24;
            padding: 15px;
            border-radius: 4px;
            margin: 15px 0;
        }
        
        nav {
            margin-bottom: 20px;
        }
        nav a {
            margin-right: 15px;
            color: #007bff;
            text-decoration: none;
        }
        nav a:hover {
            text-decoration: underline;
        }
        
        #status-messages {
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 1000;
        }
        .message {
            padding: 10px 15px;
            margin-bottom: 10px;
            border-radius: 4px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        .message.success { background-color: #d4edda; color: #155724; }
        .message.error { background-color: #f8d7da; color: #721c24; }
        .message.info { background-color: #d1ecf1; color: #0c5460; }
    </style>
</head>
<body>
    <div class="container">
        <nav>
            <a href="/">← Zpět na hlavní stránku</a>
            <a href="/scheme">Systémový strom</a>
            <a href="/test-db">Test DB</a>
            <a href="/users/group-limits">Skupinové limity</a>
        </nav>
        
        <h1><?= htmlspecialchars($title) ?></h1>
        
        <?php if (isset($error)): ?>
            <div class="error">
                <?= htmlspecialchars($error) ?>
            </div>
        <?php else: ?>
            
            <div class="stats">
                <strong>Přehled:</strong>
                Celkem uživatelů: <?= $users_count ?? 0 ?> | 
                Hostů: <?= count($hosts_data ?? []) ?>
            </div>
            
            <?php if (empty($hosts_data)): ?>
                <div class="info" style="background-color: #d1ecf1; padding: 15px; border-radius: 4px;">
                    Žádní uživatelé nebyli nalezeni.
                </div>
            <?php else: ?>
                <div class="hosts-grid">
                    <?php foreach ($hosts_data as $host_info): ?>
                        <div class="host-section">
                            <div class="host-header">
                                🖥️ Host: <?= htmlspecialchars($host_info['host']) ?> 
                                (<?= $host_info['user_count'] ?> uživatelů)
                            </div>
                            
                            <?php if (empty($host_info['users'])): ?>
                                <p style="color: #666; font-style: italic;">Žádní uživatelé na tomto hostu.</p>
                            <?php else: ?>
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Uživatel</th>
                                            <th>Odpočinek</th>
                                            <th>UI příkazy</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <?php foreach ($host_info['users'] as $user): ?>
                                            <tr class="<?= $user['locked'] ? 'locked' : '' ?>">
                                                <td>
                                                    <strong>#<?= htmlspecialchars($user['id']) ?></strong> 
                                                    <?= htmlspecialchars($user['name_surname']) ?>
                                                    <?php if ($user['locked']): ?>
                                                        <br><span style="color: #dc3545; font-weight: bold;">🔒 UZAMČEN</span>
                                                    <?php endif; ?>
                                                </td>
                                                <td>
                                                    <?php 
                                                    $rest_color = '#666'; 
                                                    if (isset($user['rest_display'])) {
                                                        if ($user['rest_display'] === 've frontě') {
                                                            $rest_color = '#28a745'; // zelená pro "ve frontě"
                                                        } elseif ($user['rest_display'] !== 'nenastaveno') {
                                                            $rest_color = '#dc3545'; // červená pro aktivní odpočinek
                                                        }
                                                    }
                                                    ?>
                                                    <span style="color: <?= $rest_color ?>; font-weight: bold;">
                                                        <?= htmlspecialchars($user['rest_display'] ?? 'nenastaveno') ?>
                                                    </span>
                                                </td>
                                                <td>
                                                    <button class="btn btn-primary" 
                                                            onclick="loginUser(<?= $user['id'] ?>, '<?= htmlspecialchars($user['host']) ?>')">
                                                        📲 Přihlásit
                                                    </button>
                                                    <button class="btn btn-warning" 
                                                            onclick="checkUIStatus(<?= $user['id'] ?>)">
                                                        📊 Status
                                                    </button>
                                                </td>
                                            </tr>
                                        <?php endforeach; ?>
                                    </tbody>
                                </table>
                            <?php endif; ?>
                        </div>
                    <?php endforeach; ?>
                </div>
            <?php endif; ?>
        <?php endif; ?>
    </div>

    <!-- Status Messages -->
    <div id="status-messages"></div>

    <script>
    // UI příkazy funkcionalita
    function loginUser(userId, host) {
        showMessage('Odesílám UI příkaz pro přihlášení uživatele...', 'info');
        
        fetch('/users', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `action=login_user&user_id=${userId}&host=${encodeURIComponent(host)}`
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showMessage(data.message, 'success');
                // Auto-check status po 2 sekundách
                setTimeout(() => checkUIStatus(userId), 2000);
            } else {
                showMessage(data.message, 'error');
            }
        })
        .catch(error => {
            showMessage('Chyba při odesílání příkazu: ' + error, 'error');
        });
    }
    
    function checkUIStatus(userId) {
        fetch('/users', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `action=get_ui_status&user_id=${userId}`
        })
        .then(response => response.json())
        .then(data => {
            if (data.success && data.status) {
                const status = data.status;
                let statusText = '';
                switch(status.status) {
                    case 'completed':
                        statusText = `✅ Dokončeno (${status.fulfilled})`;
                        break;
                    case 'in_progress':
                        statusText = `⏳ Zpracovává se (${status.accepted})`;
                        break;
                    case 'pending':
                        statusText = `⏰ Čeká (${status.created})`;
                        break;
                    default:
                        statusText = '❓ Neznámý status';
                }
                showMessage(`UI Status pro uživatele ${userId}: ${statusText}`, 'info');
            } else {
                showMessage(`Žádný UI příkaz pro uživatele ${userId}`, 'info');
            }
        })
        .catch(error => {
            showMessage('Chyba při získávání statusu: ' + error, 'error');
        });
    }
    
    function showMessage(text, type) {
        const container = document.getElementById('status-messages');
        const message = document.createElement('div');
        message.className = `message ${type}`;
        message.textContent = text;
        
        container.appendChild(message);
        
        // Auto-remove po 5 sekundách
        setTimeout(() => {
            if (message.parentNode) {
                message.parentNode.removeChild(message);
            }
        }, 5000);
    }
    </script>
</body>
</html>