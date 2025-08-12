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
        .test-section {
            margin-bottom: 25px;
            padding: 15px;
            border: 1px solid #dee2e6;
            border-radius: 4px;
        }
        .success { background-color: #d4edda; color: #155724; }
        .error { background-color: #f8d7da; color: #721c24; }
        .warning { background-color: #fff3cd; color: #856404; }
        .info { background-color: #d1ecf1; color: #0c5460; }
        
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
        }
        th, td {
            padding: 8px 12px;
            text-align: left;
            border-bottom: 1px solid #dee2e6;
        }
        th {
            background-color: #f8f9fa;
            font-weight: bold;
        }
        .status-ok { color: #28a745; font-weight: bold; }
        .status-error { color: #dc3545; font-weight: bold; }
        
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
    </style>
</head>
<body>
    <div class="container">
        <nav>
            <a href="/">← Zpět na hlavní stránku</a>
            <a href="/scheme">Systémový strom</a>
            <a href="/users">Správa uživatelů</a>
        </nav>
        
        <h1><?= htmlspecialchars($title) ?></h1>
        
        <!-- Test 1: PDO připojení -->
        <div class="test-section <?= $results['pdo_test']['status'] === 'success' ? 'success' : 'error' ?>">
            <h2>1. Test přes DatabaseConnection.php (PDO)</h2>
            <p class="<?= $results['pdo_test']['status'] === 'success' ? 'status-ok' : 'status-error' ?>">
                <?= $results['pdo_test']['status'] === 'success' ? '✓' : '✗' ?> 
                <?= htmlspecialchars($results['pdo_test']['message']) ?>
            </p>
            
            <?php if ($results['pdo_test']['status'] === 'success' && isset($results['db_info'])): ?>
                <p><strong>Databáze:</strong> <?= htmlspecialchars($results['db_info']['db_name']) ?></p>
                <p><strong>Uživatel:</strong> <?= htmlspecialchars($results['db_info']['user_info']) ?></p>
                <p><strong>Počet tabulek:</strong> <?= $results['tables_count'] ?></p>
            <?php endif; ?>
        </div>
        
        <!-- Test 2: Environment variables -->
        <div class="test-section info">
            <h2>2. Kontrola environment variables</h2>
            <table>
                <thead>
                    <tr>
                        <th>Proměnná</th>
                        <th>Hodnota</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($results['env_vars'] as $var => $value): ?>
                        <tr>
                            <td><?= htmlspecialchars($var) ?></td>
                            <td class="<?= strpos($value, '[NENALEZENO]') !== false ? 'status-error' : 'status-ok' ?>">
                                <?= htmlspecialchars($value) ?>
                            </td>
                        </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        </div>
        
        <!-- Test 3: Ukázkové tabulky -->
        <?php if (!empty($results['table_samples'])): ?>
            <div class="test-section info">
                <h2>3. Test přístupu k tabulkám</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Tabulka</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($results['table_samples'] as $table => $status): ?>
                            <tr>
                                <td><strong><?= htmlspecialchars($table) ?></strong></td>
                                <td class="<?= strpos($status, 'Chyba') !== false ? 'status-error' : 'status-ok' ?>">
                                    <?= htmlspecialchars($status) ?>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
        <?php endif; ?>
        
        <!-- Debug info -->
        <div class="test-section" style="border-top: 2px solid #dee2e6; font-size: 0.9em; color: #6c757d;">
            <p><strong>PHP verze:</strong> <?= PHP_VERSION ?></p>
            <p><strong>Server:</strong> <?= $_SERVER['SERVER_SOFTWARE'] ?></p>
            <p><strong>Čas testu:</strong> <?= date('Y-m-d H:i:s') ?></p>
        </div>
    </div>
</body>
</html>