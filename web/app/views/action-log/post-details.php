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
        .action-item {
            border: 1px solid #dee2e6;
            margin-bottom: 15px;
            border-radius: 4px;
            overflow: hidden;
        }
        .action-header {
            background-color: #f8f9fa;
            padding: 12px 15px;
            border-bottom: 1px solid #dee2e6;
            font-weight: bold;
        }
        .action-content {
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
        .group-info {
            background-color: #fff3cd;
            padding: 10px;
            border-radius: 4px;
            margin: 8px 0;
            border-left: 4px solid #ffc107;
            font-size: 0.95em;
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
            <strong>📊 Celkem:</strong> <?= count($actions) ?> příspěvků • 
            <strong>📅 Den:</strong> <?= date('j.n.Y', strtotime($date)) ?> • 
            <strong>🎯 Typ:</strong> <?= strtoupper($action_type) ?>
        </div>
        
        <?php if (empty($actions)): ?>
            <p>Žádné záznamy nebyly nalezeny pro tento den.</p>
        <?php else: ?>
            
            <?php foreach ($actions as $action): ?>
                <div class="action-item">
                    <div class="action-header">
                        <span class="timestamp"><?= date('H:i:s', strtotime($action['timestamp'])) ?></span>
                    </div>
                    <div class="action-content">
                        <div class="account-info">
                            <strong>👤 Účet:</strong> 
                            ID<?= $action['account_id'] ?> - <?= htmlspecialchars($action['surname'] ?? $action['name'] ?? 'Neznámý') ?>
                        </div>
                        
                        <?php if ($action['text']): ?>
                            <div class="group-info">
                                <strong>🎯 Skupina:</strong><br>
                                <?= htmlspecialchars($action['text']) ?>
                                
                                <?php if ($action['reference_id']): ?>
                                    <br><small><strong>Reference ID:</strong> <?= htmlspecialchars($action['reference_id']) ?></small>
                                <?php endif; ?>
                            </div>
                        <?php endif; ?>
                    </div>
                </div>
            <?php endforeach; ?>
            
        <?php endif; ?>
    </div>
</body>
</html>