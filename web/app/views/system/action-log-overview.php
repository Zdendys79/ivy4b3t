<!DOCTYPE html>
<html lang="cs">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= $title ?> - IVY4B3T</title>
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
        .date-section {
            margin-bottom: 30px;
            border: 1px solid #dee2e6;
            border-radius: 4px;
            overflow: hidden;
        }
        .date-header {
            background-color: #007bff;
            color: white;
            padding: 15px;
            font-weight: bold;
            font-size: 1.1em;
        }
        .actions-table {
            width: 100%;
            border-collapse: collapse;
        }
        .actions-table th, .actions-table td {
            padding: 12px 15px;
            text-align: left;
            border-bottom: 1px solid #dee2e6;
        }
        .actions-table th {
            background-color: #f8f9fa;
            font-weight: bold;
        }
        .actions-table tbody tr:hover {
            background-color: #f8f9fa;
        }
        .action-code {
            font-family: 'Courier New', monospace;
            background-color: #e9ecef;
            padding: 3px 6px;
            border-radius: 3px;
            font-size: 0.9em;
        }
        .account-details {
            background-color: #fff3cd;
            padding: 8px;
            border-radius: 4px;
            font-size: 0.85em;
            margin-top: 5px;
            border-left: 4px solid #ffc107;
        }
        .error { 
            background-color: #f8d7da; 
            color: #721c24; 
            padding: 15px;
            border-radius: 4px;
            border-left: 4px solid #dc3545;
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
        .stats-summary {
            background-color: #d4edda;
            padding: 15px;
            border-radius: 4px;
            margin-bottom: 20px;
            border-left: 4px solid #28a745;
        }
        .action-code-link {
            text-decoration: none;
            color: inherit;
        }
        .action-code-link:hover {
            text-decoration: none;
        }
        .action-code-link:hover .action-code {
            background-color: #007bff;
            color: white;
        }
        .host-stats-section {
            margin-bottom: 30px;
            border: 1px solid #dee2e6;
            border-radius: 4px;
            overflow: hidden;
        }
        .host-stats-header {
            background-color: #28a745;
            color: white;
            padding: 15px;
            font-weight: bold;
            font-size: 1.1em;
        }
        .host-stats-table {
            width: 100%;
            border-collapse: collapse;
        }
        .host-stats-table th, .host-stats-table td {
            padding: 10px;
            text-align: left;
            border-bottom: 1px solid #dee2e6;
        }
        .host-stats-table th {
            background-color: #f8f9fa;
            font-weight: bold;
        }
        .host-name {
            font-weight: bold;
            color: #007bff;
        }
        .version-badge {
            background-color: #6c757d;
            color: white;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 0.85em;
        }
        .stats-detail {
            font-size: 0.9em;
            color: #666;
        }
        .stats-number {
            font-weight: bold;
            color: #28a745;
        }
    </style>
</head>
<body>
    <div class="container">
        <nav>
            <a href="/">← Zpět na hlavní stránku</a>
            <a href="/scheme">Systémový strom</a>
            <a href="/users">Správa uživatelů</a>
            <a href="/dashboard">Dashboard</a>
        </nav>
        
        <h1><?= htmlspecialchars($title) ?></h1>
        
        <?php if (isset($error)): ?>
            <div class="error">
                <?= htmlspecialchars($error) ?>
            </div>
        <?php else: ?>
            
            <div class="stats-summary">
                <strong>📊 Zobrazeno:</strong> Posledních 30 dní aktivity • 
                <strong>📅 Seřazeno:</strong> Nejnovější den nahoře • 
                <strong>👥 Detail účtů:</strong> Pro akce s méně než 6 účastníky
            </div>
            
            <?php if (!empty($host_stats)): ?>
                <div class="host-stats-section">
                    <div class="host-stats-header">
                        🤖 Statistiky aktivních hostů
                    </div>
                    
                    <table class="host-stats-table">
                        <thead>
                            <tr>
                                <th>Host</th>
                                <th>Verze</th>
                                <th>Aktuální uživatel</th>
                                <th>Poslední hodina</th>
                                <th>Posledních 24 hodin</th>
                                <th>Detail akcí (24h)</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach ($host_stats as $host => $stats): ?>
                                <tr>
                                    <td>
                                        <span class="host-name"><?= htmlspecialchars($host) ?></span>
                                    </td>
                                    <td>
                                        <span class="version-badge"><?= htmlspecialchars($stats['version'] ?: 'N/A') ?></span>
                                    </td>
                                    <td>
                                        <?= htmlspecialchars($stats['current_user']) ?>
                                    </td>
                                    <td>
                                        <span class="stats-number"><?= $stats['total_1h'] ?></span> akcí
                                    </td>
                                    <td>
                                        <span class="stats-number"><?= $stats['total_24h'] ?></span> akcí
                                    </td>
                                    <td>
                                        <?php if (!empty($stats['stats_24h'])): ?>
                                            <div class="stats-detail">
                                                <?php 
                                                $actions_list = [];
                                                foreach ($stats['stats_24h'] as $action => $count) {
                                                    $actions_list[] = "<strong>{$action}</strong>: {$count}";
                                                }
                                                echo implode(', ', $actions_list);
                                                ?>
                                            </div>
                                        <?php else: ?>
                                            <span class="stats-detail">-</span>
                                        <?php endif; ?>
                                    </td>
                                </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                </div>
            <?php endif; ?>
            
            <?php if (empty($grouped_data)): ?>
                <p>Žádné záznamy akcí nebyly nalezeny za posledních 30 dní.</p>
            <?php else: ?>
                
                <?php foreach ($grouped_data as $date => $actions): ?>
                    <div class="date-section">
                        <div class="date-header">
                            📅 <?= date('j.n.Y', strtotime($date)) ?> (<?= date('l', strtotime($date)) ?>)
                        </div>
                        
                        <table class="actions-table">
                            <thead>
                                <tr>
                                    <th>Typ akce</th>
                                    <th>Počet akcí</th>
                                    <th>Počet účtů</th>
                                    <th>Poznámka</th>
                                </tr>
                            </thead>
                            <tbody>
                                <?php foreach ($actions as $action): ?>
                                    <tr>
                                        <td>
                                            <a href="/action-log/detail?date=<?= htmlspecialchars($action['action_date']) ?>&action=<?= htmlspecialchars($action['action_code']) ?>" 
                                               class="action-code-link">
                                                <span class="action-code"><?= htmlspecialchars($action['action_code']) ?></span>
                                            </a>
                                        </td>
                                        <td>
                                            <?= number_format($action['action_count']) ?>x
                                        </td>
                                        <td>
                                            <?= $action['unique_accounts'] ?> účtů
                                        </td>
                                        <td>
                                            <?php 
                                            $detail_key = $action['action_date'] . '_' . $action['action_code'];
                                            if (isset($action_details[$detail_key]) && $action['unique_accounts'] < 6): 
                                            ?>
                                                <div class="account-details">
                                                    <strong>👤 Účty:</strong>
                                                    <?php 
                                                    $account_list = [];
                                                    foreach ($action_details[$detail_key] as $account) {
                                                        $surname = $account['surname'] ?: 'Neznámý';
                                                        $account_list[] = "ID{$account['account_id']} ({$surname})";
                                                    }
                                                    echo htmlspecialchars(implode(', ', $account_list));
                                                    ?>
                                                </div>
                                            <?php else: ?>
                                                -
                                            <?php endif; ?>
                                        </td>
                                    </tr>
                                <?php endforeach; ?>
                            </tbody>
                        </table>
                    </div>
                <?php endforeach; ?>
                
            <?php endif; ?>
        <?php endif; ?>
    </div>
</body>
</html>