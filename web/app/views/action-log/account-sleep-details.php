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
            <strong>💤 Spící účty:</strong> <?= count($actions) ?> záznamů • 
            <strong>📅 Den:</strong> <?= date('j.n.Y', strtotime($date)) ?> •
            <strong>⏱️ Doba spánku:</strong> 2h - 3+ dnů (72h+)
        </div>
        
        <?php if (empty($actions)): ?>
            <p>Žádné záznamy nebyly nalezeny pro tento den.</p>
        <?php else: ?>
            
            <div class="action-list">
                <?php foreach ($actions as $action): ?>
                    <div class="action-item">
                        <div class="timestamp"><?= date('H:i:s', strtotime($action['timestamp'])) ?></div>
                        <div class="account-info">
                            👤 ID<?= $action['account_id'] ?> - <?= htmlspecialchars($action['surname'] ?? $action['name'] ?? 'Neznámý') ?>
                        </div>
                        <div class="sleep-info">
                            💤 
                            <?php 
                            $text = $action['text'];
                            if (preg_match('/(\d+)h/', $text, $matches)) {
                                $hours = $matches[1];
                                echo "<span class='sleep-duration'>{$hours}h</span>";
                                if ($hours >= 24) {
                                    $days = floor($hours / 24);
                                    echo " ({$days}d)";
                                }
                            } else {
                                echo htmlspecialchars($text);
                            }
                            ?>
                        </div>
                    </div>
                <?php endforeach; ?>
            </div>
            
        <?php endif; ?>
    </div>
</body>
</html>