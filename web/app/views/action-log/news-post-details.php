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
        .news-item {
            border: 1px solid #dee2e6;
            margin-bottom: 15px;
            border-radius: 4px;
            overflow: hidden;
        }
        .news-header {
            background-color: #17a2b8;
            color: white;
            padding: 12px 15px;
            font-weight: bold;
        }
        .news-content {
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
        .rss-info {
            background-color: #d1ecf1;
            padding: 10px;
            border-radius: 4px;
            margin: 8px 0;
            border-left: 4px solid #17a2b8;
            font-size: 0.95em;
        }
        .rss-url {
            background-color: #f8f9fa;
            padding: 8px;
            border-radius: 4px;
            font-family: 'Courier New', monospace;
            font-size: 0.85em;
            word-break: break-all;
            margin-top: 8px;
        }
        .rss-url a {
            color: #007bff;
            text-decoration: none;
        }
        .rss-url a:hover {
            text-decoration: underline;
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
            <strong>📰 RSS příspěvky:</strong> <?= count($actions) ?> záznamů • 
            <strong>📅 Den:</strong> <?= date('j.n.Y', strtotime($date)) ?>
        </div>
        
        <?php if (empty($actions)): ?>
            <p>Žádné záznamy nebyly nalezeny pro tento den.</p>
        <?php else: ?>
            
            <?php foreach ($actions as $action): ?>
                <div class="news-item">
                    <div class="news-header">
                        📰 RSS Příspěvek - <?= date('H:i:s', strtotime($action['timestamp'])) ?>
                    </div>
                    <div class="news-content">
                        <div class="account-info">
                            <strong>👤 Publikoval:</strong> 
                            ID<?= $action['account_id'] ?> - <?= htmlspecialchars($action['surname'] ?? $action['name'] ?? 'Neznámý') ?>
                        </div>
                        
                        <div class="rss-info">
                            <strong>📄 RSS URL ID:</strong> <?= htmlspecialchars($action['text'] ?? 'N/A') ?><br>
                            
                            <?php if ($action['rss_title']): ?>
                                <strong>📑 Název:</strong> <?= htmlspecialchars($action['rss_title']) ?><br>
                            <?php endif; ?>
                            
                            <?php if ($action['url']): ?>
                                <div class="rss-url">
                                    <strong>🔗 URL:</strong><br>
                                    <a href="<?= htmlspecialchars($action['url']) ?>" target="_blank" rel="noopener">
                                        <?= htmlspecialchars($action['url']) ?>
                                    </a>
                                </div>
                            <?php endif; ?>
                            
                            <?php if ($action['reference_id']): ?>
                                <br><small><strong>Reference:</strong> <?= htmlspecialchars($action['reference_id']) ?></small>
                            <?php endif; ?>
                        </div>
                    </div>
                </div>
            <?php endforeach; ?>
            
        <?php endif; ?>
    </div>
</body>
</html>