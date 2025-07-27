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
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
        }
        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #dee2e6;
        }
        th {
            background-color: #f8f9fa;
            font-weight: bold;
        }
        tr:hover {
            background-color: #f8f9fa;
        }
        .no-data {
            text-align: center;
            padding: 40px;
            color: #6c757d;
            font-style: italic;
        }
        .error {
            background-color: #f8d7da;
            color: #721c24;
            padding: 15px;
            border-radius: 4px;
            margin: 15px 0;
        }
        .stats {
            background-color: #d1ecf1;
            padding: 15px;
            border-radius: 4px;
            margin-bottom: 20px;
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
        .limit-badge {
            padding: 3px 8px;
            border-radius: 12px;
            font-size: 0.85em;
            font-weight: bold;
        }
        .limit-normal { background-color: #d4edda; color: #155724; }
        .limit-high { background-color: #fff3cd; color: #856404; }
        .limit-critical { background-color: #f8d7da; color: #721c24; }
    </style>
</head>
<body>
    <div class="container">
        <nav>
            <a href="/">← Zpět na hlavní stránku</a>
            <a href="/users">Správa uživatelů</a>
            <a href="/scheme">Systémový strom</a>
            <a href="/test-db">Test DB</a>
        </nav>
        
        <h1><?= htmlspecialchars($title) ?></h1>
        
        <?php if (isset($error)): ?>
            <div class="error">
                <?= htmlspecialchars($error) ?>
            </div>
        <?php else: ?>
            
            <div class="stats">
                <strong>Přehled:</strong>
                Skupinových limitů: <?= count($limits) ?>
            </div>
            
            <?php if (empty($limits)): ?>
                <div class="no-data">
                    Žádné skupinové limity nejsou nastaveny.
                </div>
            <?php else: ?>
                <table>
                    <thead>
                        <tr>
                            <th>Název skupiny</th>
                            <th>Denní limit</th>
                            <th>Týdenní limit</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($limits as $limit): ?>
                            <tr>
                                <td><strong><?= htmlspecialchars($limit['group_name']) ?></strong></td>
                                <td><?= htmlspecialchars($limit['daily_limit']) ?></td>
                                <td><?= htmlspecialchars($limit['weekly_limit']) ?></td>
                                <td>
                                    <?php 
                                    $dailyLimit = intval($limit['daily_limit']);
                                    $weeklyLimit = intval($limit['weekly_limit']);
                                    
                                    if ($dailyLimit <= 10) {
                                        $class = 'limit-normal';
                                        $status = 'Nízký';
                                    } elseif ($dailyLimit <= 50) {
                                        $class = 'limit-high';
                                        $status = 'Střední';
                                    } else {
                                        $class = 'limit-critical';
                                        $status = 'Vysoký';
                                    }
                                    ?>
                                    <span class="limit-badge <?= $class ?>">
                                        <?= $status ?>
                                    </span>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            <?php endif; ?>
            
        <?php endif; ?>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; font-size: 0.9em; color: #6c757d;">
            <p><strong>Poznámka:</strong> Skupinové limity řídí maximální počet akcí pro Facebook skupiny v daném časovém období.</p>
        </div>
    </div>
</body>
</html>