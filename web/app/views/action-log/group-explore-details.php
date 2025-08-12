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
            margin-bottom: 10px;
            border-radius: 4px;
            overflow: hidden;
        }
        .action-header {
            background-color: #f8f9fa;
            padding: 8px 12px;
            border-bottom: 1px solid #dee2e6;
            font-size: 0.9em;
        }
        .action-content {
            padding: 12px;
        }
        .timestamp {
            color: #6c757d;
            font-size: 0.85em;
        }
        .group-info {
            background-color: #e8f5e8;
            padding: 8px 10px;
            border-radius: 4px;
            margin: 5px 0;
            border-left: 4px solid #28a745;
            font-size: 0.9em;
        }
        .stats {
            background-color: #d4edda;
            padding: 15px;
            border-radius: 4px;
            margin-bottom: 20px;
            border-left: 4px solid #28a745;
        }
        .no-user-note {
            font-style: italic;
            color: #6c757d;
            font-size: 0.9em;
            margin-top: 10px;
            padding: 8px;
            background-color: #f8f9fa;
            border-radius: 4px;
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
            <strong>🔍 Celkem prozkoumáno:</strong> <?= count($actions) ?> skupin • 
            <strong>📅 Den:</strong> <?= date('j.n.Y', strtotime($date)) ?>
        </div>
        
        <div class="no-user-note">
            💡 <strong>Poznámka:</strong> U group_explore se nezobrazuje konkrétní uživatel - průzkum probíhá systémově bez přiřazení k účtu.
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
                        <?php if ($action['text']): ?>
                            <div class="group-info">
                                <strong>🎯 Prozkoumáno:</strong><br>
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