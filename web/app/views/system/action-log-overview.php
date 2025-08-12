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
                                            <span class="action-code"><?= htmlspecialchars($action['action_code']) ?></span>
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