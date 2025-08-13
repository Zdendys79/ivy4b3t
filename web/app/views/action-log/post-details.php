<!DOCTYPE html>
<html lang="cs">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= $title ?> - IVY4B3T</title>
    <link rel="stylesheet" href="/assets/css/action-log.css">
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
            
            <div class="action-list">
                <?php foreach ($actions as $action): ?>
                    <div class="action-item">
                        <div class="timestamp"><?= date('H:i:s', strtotime($action['timestamp'])) ?></div>
                        <div class="account-info">
                            <a href="/action-log/user?user_id=<?= $action['account_id'] ?>" class="user-link">
                                👤 ID<?= $action['account_id'] ?> - <?= htmlspecialchars($action['surname'] ?? $action['name'] ?? 'Neznámý') ?>
                            </a>
                        </div>
                        <div class="group-info">
                            🎯 <?= htmlspecialchars($action['text']) ?>
                            <?php if ($action['group_fb_id']): ?>
                                <a href="https://www.facebook.com/groups/<?= htmlspecialchars($action['group_fb_id']) ?>" 
                                   target="_blank" 
                                   class="reference-id">
                                    🔗 <?= htmlspecialchars($action['group_fb_id']) ?>
                                </a>
                            <?php endif; ?>
                        </div>
                    </div>
                <?php endforeach; ?>
            </div>
            
        <?php endif; ?>
    </div>
</body>
</html>