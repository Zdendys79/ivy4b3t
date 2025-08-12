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
        .sleep-item {
            border: 1px solid #dee2e6;
            margin-bottom: 15px;
            border-radius: 4px;
            overflow: hidden;
        }
        .sleep-header {
            background-color: #6f42c1;
            color: white;
            padding: 12px 15px;
            font-weight: bold;
        }
        .sleep-content {
            padding: 15px;
        }
        .timestamp {
            color: #6c757d;
            font-size: 0.9em;
        }
        .account-info {
            background-color: #e7f3ff;
            padding: 8px 12px;
            border-radius: 4px;
            margin: 8px 0;
            border-left: 4px solid #007bff;
        }
        .sleep-info {
            background-color: #f3e5f5;
            padding: 10px;
            border-radius: 4px;
            margin: 8px 0;
            border-left: 4px solid #6f42c1;
            font-size: 0.95em;
        }
        .wake-time {
            background-color: #d4edda;
            padding: 8px 12px;
            border-radius: 4px;
            margin: 8px 0;
            border-left: 4px solid #28a745;
            font-weight: bold;
        }
        .stats {
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
            <a href="/dont_panic">← Zpět na přehled</a>
        </nav>
        
        <h1><?= htmlspecialchars($title) ?></h1>
        
        <div class="stats">
            <strong>💤 Spící účty:</strong> <?= count($actions) ?> záznamů • 
            <strong>📅 Den:</strong> <?= date('j.n.Y', strtotime($date)) ?> •
            <strong>⏱️ Doba spánku:</strong> 2h - 3+ dnů (72h+)
        </div>
        
        <?php if (empty($actions)): ?>
            <p>Žádné záznamy nebyly nalezeny pro tento den.</p>
        <?php else: ?>
            
            <?php foreach ($actions as $action): ?>
                <div class="sleep-item">
                    <div class="sleep-header">
                        💤 Spící účet - <?= date('H:i:s', strtotime($action['timestamp'])) ?>
                    </div>
                    <div class="sleep-content">
                        <div class="account-info">
                            <strong>👤 Účet:</strong> 
                            ID<?= $action['account_id'] ?> - <?= htmlspecialchars($action['surname'] ?? $action['name'] ?? 'Neznámý') ?>
                        </div>
                        
                        <?php if ($action['text']): ?>
                            <div class="sleep-info">
                                <strong>💤 Doba spánku:</strong><br>
                                <?php 
                                $text = $action['text'];
                                
                                // Extrakce počtu hodin
                                if (preg_match('/(\d+)h/', $text, $matches)) {
                                    $hours = $matches[1];
                                    echo "<span style='font-size: 1.2em; font-weight: bold; color: #6f42c1;'>{$hours} hodin</span>";
                                    
                                    // Převod na dny pro lepší představu
                                    if ($hours >= 24) {
                                        $days = floor($hours / 24);
                                        $remaining_hours = $hours % 24;
                                        echo "<br><small>(" . $days . " " . ($days == 1 ? 'den' : ($days < 5 ? 'dny' : 'dní'));
                                        if ($remaining_hours > 0) {
                                            echo " a {$remaining_hours} " . ($remaining_hours == 1 ? 'hodinu' : ($remaining_hours < 5 ? 'hodiny' : 'hodin'));
                                        }
                                        echo ")</small>";
                                    }
                                } else {
                                    echo htmlspecialchars($text);
                                }
                                ?>
                            </div>
                        <?php endif; ?>
                        
                        <?php if ($action['reference_id']): ?>
                            <div>
                                <small><strong>Reference:</strong> <?= htmlspecialchars($action['reference_id']) ?></small>
                            </div>
                        <?php endif; ?>
                    </div>
                </div>
            <?php endforeach; ?>
            
        <?php endif; ?>
    </div>
</body>
</html>