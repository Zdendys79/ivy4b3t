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
        .quote-item {
            border: 1px solid #dee2e6;
            margin-bottom: 15px;
            border-radius: 4px;
            overflow: hidden;
        }
        .quote-header {
            background-color: #6c757d;
            color: white;
            padding: 12px 15px;
            font-weight: bold;
        }
        .quote-content {
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
        .quote-text {
            background-color: #f8f9fa;
            padding: 15px;
            border-radius: 4px;
            margin: 10px 0;
            border-left: 4px solid #6c757d;
            font-style: italic;
            position: relative;
        }
        .quote-text::before {
            content: '"';
            font-size: 3em;
            color: #6c757d;
            position: absolute;
            top: -10px;
            left: 10px;
            font-family: serif;
        }
        .quote-text::after {
            content: '"';
            font-size: 3em;
            color: #6c757d;
            position: absolute;
            bottom: -30px;
            right: 10px;
            font-family: serif;
        }
        .quote-author {
            background-color: #fff3cd;
            padding: 8px 12px;
            border-radius: 4px;
            margin: 8px 0;
            border-left: 4px solid #ffc107;
            font-weight: bold;
            text-align: right;
        }
        .quote-id {
            color: #6c757d;
            font-size: 0.85em;
            margin-top: 5px;
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
            <strong>💬 Zveřejněné citáty:</strong> <?= count($actions) ?> záznamů • 
            <strong>📅 Den:</strong> <?= date('j.n.Y', strtotime($date)) ?>
        </div>
        
        <?php if (empty($actions)): ?>
            <p>Žádné záznamy nebyly nalezeny pro tento den.</p>
        <?php else: ?>
            
            <?php foreach ($actions as $action): ?>
                <div class="quote-item">
                    <div class="quote-header">
                        💬 Citát - <?= date('H:i:s', strtotime($action['timestamp'])) ?>
                    </div>
                    <div class="quote-content">
                        <div class="account-info">
                            <strong>👤 Zveřejnil:</strong> 
                            ID<?= $action['account_id'] ?> - <?= htmlspecialchars($action['surname'] ?? $action['name'] ?? 'Neznámý') ?>
                        </div>
                        
                        <?php if ($action['quote_text']): ?>
                            <div class="quote-text">
                                <?= htmlspecialchars($action['quote_text']) ?>
                            </div>
                            
                            <?php if ($action['author']): ?>
                                <div class="quote-author">
                                    — <?= htmlspecialchars($action['author']) ?>
                                </div>
                            <?php endif; ?>
                        <?php else: ?>
                            <div style="color: #dc3545; padding: 10px; background: #f8d7da; border-radius: 4px;">
                                ⚠️ Text citátu nenalezen (možná byl smazán z databáze)
                            </div>
                        <?php endif; ?>
                        
                        <div class="quote-id">
                            <strong>🆔 Quote ID:</strong> <?= htmlspecialchars($action['reference_id'] ?? 'N/A') ?>
                            <?php if ($action['text']): ?>
                                | <strong>Log text:</strong> <?= htmlspecialchars($action['text']) ?>
                            <?php endif; ?>
                        </div>
                    </div>
                </div>
            <?php endforeach; ?>
            
        <?php endif; ?>
    </div>
</body>
</html>