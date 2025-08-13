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
            <strong>🔍 Celkem prozkoumáno:</strong> <?= count($actions) ?> skupin • 
            <strong>📅 Den:</strong> <?= date('j.n.Y', strtotime($date)) ?>
        </div>
        
        <div class="no-user-note">
            💡 <strong>Poznámka:</strong> U group_explore se nezobrazuje konkrétní uživatel - průzkum probíhá systémově bez přiřazení k účtu.
        </div>
        
        <?php if (empty($actions)): ?>
            <p>Žádné záznamy nebyly nalezeny pro tento den.</p>
        <?php else: ?>
            
            <div class="action-list">
                <?php foreach ($actions as $action): ?>
                    <div class="action-item">
                        <div class="timestamp"><?= date('H:i:s', strtotime($action['timestamp'])) ?></div>
                        <div class="group-info">
                            🔍 <?= htmlspecialchars($action['text']) ?>
                            <?php if ($action['reference_id']): ?>
                                <span class="reference-id">ID: <?= htmlspecialchars($action['reference_id']) ?></span>
                            <?php endif; ?>
                        </div>
                    </div>
                <?php endforeach; ?>
            </div>
            
        <?php endif; ?>
    </div>
</body>
</html>