<!DOCTYPE html>
<html lang="cs">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= $title ?> - IVY4B3T</title>
    <link rel="stylesheet" href="/assets/css/action-log.css">
</head>
<body>
    <div class="container delay-container">
        <nav>
            <a href="/dont_panic">← Zpět na přehled</a>
        </nav>
        
        <h1><?= htmlspecialchars($title) ?></h1>
        
        <div class="stats">
            <strong>⏸️ Celkem uspání:</strong> <?= count($actions) ?> akcí • 
            <strong>📅 Den:</strong> <?= date('j.n.Y', strtotime($date)) ?> •
            <strong>📊 Seřazeno:</strong> Podle času (nejstarší nahoře)
        </div>
        
        <?php if (empty($actions)): ?>
            <p>Žádné záznamy nebyly nalezeny pro tento den.</p>
        <?php else: ?>
            
            <?php 
            // Seskupení podle host a pak podle uživatelů
            $by_host = [];
            foreach ($actions as $action) {
                $host = $action['host'] ?? 'Neznámý host';
                $user_key = $action['account_id'];
                
                if (!isset($by_host[$host])) {
                    $by_host[$host] = [];
                }
                
                if (!isset($by_host[$host][$user_key])) {
                    $by_host[$host][$user_key] = [
                        'user_info' => $action,
                        'actions' => []
                    ];
                }
                
                $by_host[$host][$user_key]['actions'][] = $action;
            }
            
            // Seřazení hostů
            ksort($by_host);
            ?>
            
            <!-- Globální časové značky (pouze jednou na začátku) -->
            <div class="timeline-grid">
                <div class="time-labels">
                    <?php for ($i = 0; $i < 96; $i++): ?>
                        <?php 
                        $hour = floor($i / 4);
                        $minute = ($i % 4) * 15;
                        $show_label = ($minute == 0) ? sprintf('%02d:00', $hour) : '';
                        ?>
                        <div class="time-label"><?= $show_label ?></div>
                    <?php endfor; ?>
                </div>
            </div>
            
            <?php foreach ($by_host as $host => $users): ?>
                <div class="host-group">
                    <div class="host-header">
                        🖥️ <?= htmlspecialchars($host) ?> - <?= count($users) ?> účtů
                    </div>
                    <div class="host-content">
                        
                        <?php foreach ($users as $user_data): ?>
                            <?php
                            // Vytvoření 24h gridu pro tohoto uživatele
                            $user_time_grid = [];
                            for ($i = 0; $i < 96; $i++) {
                                $user_time_grid[$i] = [];
                            }
                            
                            // Mapování akcí tohoto uživatele na časové bloky
                            foreach ($user_data['actions'] as $action) {
                                $timestamp = strtotime($action['timestamp']);
                                $hour = date('G', $timestamp);
                                $minute = date('i', $timestamp);
                                
                                $block_index = ($hour * 4) + floor($minute / 15);
                                
                                if ($block_index >= 0 && $block_index < 96) {
                                    $user_time_grid[$block_index][] = $action;
                                }
                            }
                            ?>
                            
                            <div class="user-timeline">
                                <div class="user-header">
                                    <div class="user-info">
                                        <a href="/action-log/user?user_id=<?= $user_data['user_info']['account_id'] ?>" class="user-link">
                                            👤 ID<?= $user_data['user_info']['account_id'] ?> - 
                                            <?= htmlspecialchars($user_data['user_info']['surname'] ?? $user_data['user_info']['name'] ?? 'Neznámý') ?>
                                        </a>
                                    </div>
                                    <div class="delay-count">
                                        <?= count($user_data['actions']) ?> uspání
                                    </div>
                                </div>
                                
                                <div class="user-timeline-content">
                                    <div class="time-blocks">
                                        <?php for ($i = 0; $i < 96; $i++): ?>
                                            <?php 
                                            $has_activity = !empty($user_time_grid[$i]);
                                            $activity_count = count($user_time_grid[$i]);
                                            $hour = floor($i / 4);
                                            $minute = ($i % 4) * 15;
                                            $time_label = sprintf('%02d:%02d', $hour, $minute);
                                            
                                            $style = '';
                                            if ($has_activity) {
                                                $style = "background-color: #dc3545;";
                                            }
                                            ?>
                                            <div class="time-block <?= $has_activity ? 'has-activity' : '' ?>" 
                                                 title="<?= $time_label ?>: <?= $activity_count ?> uspání"
                                                 style="<?= $style ?>">
                                            </div>
                                        <?php endfor; ?>
                                    </div>
                                </div>
                            </div>
                        <?php endforeach; ?>
                        
                    </div>
                </div>
            <?php endforeach; ?>
            
            <!-- Legenda -->
            <div class="legend">
                <div class="legend-item">
                    <span class="legend-color" style="background-color: #e9ecef;"></span>
                    Bez aktivity
                </div>
                <div class="legend-item">
                    <span class="legend-color" style="background-color: #dc3545;"></span>
                    Uspávání účtů
                </div>
                <div class="legend-item">
                    <strong>📊 Celkem:</strong> <?= count($actions) ?> akcí
                </div>
                <div class="legend-item">
                    <strong>🖥️ Hostů:</strong> <?= count($by_host) ?>
                </div>
            </div>
            
        <?php endif; ?>
    </div>
</body>
</html>