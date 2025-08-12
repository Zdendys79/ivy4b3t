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
            max-width: 1200px;
            margin: 20px auto;
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
        .stats {
            background-color: #d4edda;
            padding: 15px;
            border-radius: 4px;
            margin-bottom: 20px;
            border-left: 4px solid #28a745;
        }
        .timeline-grid {
            margin: 30px 0;
            overflow-x: auto;
        }
        .time-labels {
            display: grid;
            grid-template-columns: repeat(96, 1fr);
            gap: 1px;
            margin-bottom: 5px;
            font-size: 10px;
            text-align: center;
        }
        .time-label {
            writing-mode: vertical-rl;
            text-orientation: mixed;
            height: 40px;
            display: flex;
            align-items: end;
            justify-content: center;
            color: #666;
        }
        .time-blocks {
            display: grid;
            grid-template-columns: repeat(96, 1fr);
            gap: 1px;
            min-width: 960px;
        }
        .time-block {
            height: 15px;
            background-color: #e9ecef;
            border: 1px solid #dee2e6;
            position: relative;
            cursor: pointer;
        }
        .time-block.has-activity {
            background-color: #dc3545;
        }
        .time-block:hover {
            border-color: #007bff;
            box-shadow: 0 0 3px rgba(0,123,255,0.5);
        }
        .host-group {
            margin-bottom: 40px;
            border: 2px solid #007bff;
            border-radius: 8px;
            overflow: hidden;
        }
        .host-header {
            background-color: #007bff;
            color: white;
            padding: 15px;
            font-weight: bold;
            font-size: 1.1em;
        }
        .host-content {
            padding: 20px;
        }
        .user-timeline {
            margin-bottom: 25px;
            border: 1px solid #dee2e6;
            border-radius: 6px;
            overflow: hidden;
        }
        .user-header {
            background-color: #f8f9fa;
            padding: 10px 15px;
            border-bottom: 1px solid #dee2e6;
            font-weight: bold;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .user-info {
            color: #495057;
        }
        .delay-count {
            background-color: #dc3545;
            color: white;
            padding: 2px 8px;
            border-radius: 10px;
            font-size: 0.8em;
        }
        .user-timeline-content {
            padding: 15px;
        }
        .legend {
            margin-top: 15px;
            padding: 10px;
            background-color: #f8f9fa;
            border-radius: 4px;
            font-size: 0.9em;
        }
        .legend-item {
            display: inline-block;
            margin-right: 20px;
        }
        .legend-color {
            display: inline-block;
            width: 15px;
            height: 15px;
            margin-right: 5px;
            vertical-align: middle;
            border: 1px solid #dee2e6;
        }
        .activity-details {
            margin-top: 20px;
            padding: 15px;
            background-color: #f8f9fa;
            border-radius: 4px;
            border-left: 4px solid #007bff;
        }
        .user-list {
            columns: 3;
            column-gap: 20px;
            margin-top: 10px;
        }
        .user-item {
            break-inside: avoid;
            margin-bottom: 5px;
            font-size: 0.9em;
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
                                        👤 ID<?= $user_data['user_info']['account_id'] ?> - 
                                        <?= htmlspecialchars($user_data['user_info']['surname'] ?? $user_data['user_info']['name'] ?? 'Neznámý') ?>
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