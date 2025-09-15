<?php
require_once 'app/core/DatabaseConnection.php';
require_once 'app/middleware/AuthMiddleware.php';

// Inicializace databázového připojení
$dbConnection = new DatabaseConnection();
$conn = $dbConnection->getConnection();

// Kontrola autentizace
$authMiddleware = new AuthMiddleware();
if (!$authMiddleware->isAuthenticated()) {
    header('Location: /login');
    exit();
}

// Získat časové rozmezí - výchozí posledních 24 hodin
$hours = isset($_GET['hours']) ? intval($_GET['hours']) : 24;
$start_time = date('Y-m-d H:i:s', strtotime("-{$hours} hours"));

// Získat aktivity hostů z action_log
$query = "
    SELECT 
        u.host,
        al.account_id,
        CONCAT(u.name, ' ', u.surname) as user_name,
        al.action_code,
        al.timestamp,
        al.text,
        TIMESTAMPDIFF(MINUTE, 
            al.timestamp,
            IFNULL(
                (SELECT MIN(al2.timestamp) 
                 FROM action_log al2 
                 WHERE al2.account_id = al.account_id 
                   AND al2.timestamp > al.timestamp),
                NOW()
            )
        ) as duration_minutes
    FROM action_log al
    JOIN fb_users u ON al.account_id = u.id
    WHERE al.timestamp >= ?
      AND u.host IS NOT NULL
    ORDER BY u.host, al.timestamp
";

$stmt = $conn->prepare($query);
$stmt->bind_param('s', $start_time);
$stmt->execute();
$result = $stmt->get_result();

// Zpracovat data do struktur pro zobrazení
$hosts = [];
$activities = [];
$min_time = strtotime($start_time);
$max_time = time();

while ($row = $result->fetch_assoc()) {
    $host = $row['host'];
    if (!isset($hosts[$host])) {
        $hosts[$host] = [
            'name' => $host,
            'users' => []
        ];
    }
    
    $user_id = $row['account_id'];
    if (!isset($hosts[$host]['users'][$user_id])) {
        $hosts[$host]['users'][$user_id] = $row['user_name'];
    }
    
    $activities[] = [
        'host' => $host,
        'user_id' => $user_id,
        'user_name' => $row['user_name'],
        'action' => $row['action_code'],
        'start' => strtotime($row['timestamp']),
        'duration' => min($row['duration_minutes'], 60), // Max 60 minut pro vizualizaci
        'text' => $row['text']
    ];
}

// Seřadit hosty podle názvu
ksort($hosts);

// Vypočítat šířku sloupce
$column_width = count($hosts) > 0 ? floor(90 / count($hosts)) : 90;
?>
<!DOCTYPE html>
<html lang="cs">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Host Timeline - IVY4B3T</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #fff;
            padding: 20px;
            min-height: 100vh;
        }
        
        .container {
            max-width: 100%;
            margin: 0 auto;
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            border-radius: 20px;
            padding: 30px;
            box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37);
        }
        
        h1 {
            text-align: center;
            margin-bottom: 30px;
            font-size: 2.5em;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }
        
        .controls {
            text-align: center;
            margin-bottom: 30px;
        }
        
        .controls select {
            padding: 10px 20px;
            font-size: 16px;
            border-radius: 10px;
            border: none;
            background: rgba(255, 255, 255, 0.9);
            color: #333;
            cursor: pointer;
        }
        
        .timeline-container {
            position: relative;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 15px;
            padding: 20px;
            overflow-x: auto;
        }
        
        .timeline-grid {
            position: relative;
            min-height: <?php echo $hours * 60; ?>px;
            margin-left: 80px;
        }
        
        .time-labels {
            position: absolute;
            left: 0;
            top: 0;
            width: 70px;
            height: 100%;
        }
        
        .time-label {
            position: absolute;
            right: 10px;
            font-size: 12px;
            color: rgba(255, 255, 255, 0.7);
            transform: translateY(-50%);
        }
        
        .hour-line {
            position: absolute;
            left: 70px;
            right: 0;
            height: 1px;
            background: rgba(255, 255, 255, 0.1);
        }
        
        .host-column {
            position: absolute;
            top: -40px;
            bottom: 0;
            width: <?php echo $column_width; ?>%;
            border-left: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .host-header {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 30px;
            text-align: center;
            font-weight: bold;
            font-size: 14px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 5px 5px 0 0;
            padding: 5px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        
        .activity-block {
            position: absolute;
            left: 2px;
            right: 2px;
            border-radius: 5px;
            padding: 2px 5px;
            font-size: 11px;
            overflow: hidden;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        }
        
        .activity-block:hover {
            transform: scale(1.05);
            z-index: 100;
            box-shadow: 0 4px 15px rgba(0,0,0,0.4);
        }
        
        /* Barvy podle typu akce */
        .activity-post_utio_g { background: linear-gradient(45deg, #4CAF50, #45a049); }
        .activity-post_utio_gv { background: linear-gradient(45deg, #2196F3, #1976D2); }
        .activity-quote_post { background: linear-gradient(45deg, #FF9800, #F57C00); }
        .activity-news_post { background: linear-gradient(45deg, #9C27B0, #7B1FA2); }
        .activity-group_explore { background: linear-gradient(45deg, #00BCD4, #00ACC1); }
        .activity-stories_view { background: linear-gradient(45deg, #FFC107, #FFA000); }
        .activity-video_watch { background: linear-gradient(45deg, #F44336, #D32F2F); }
        .activity-other { background: linear-gradient(45deg, #607D8B, #455A64); }
        
        .tooltip {
            position: absolute;
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 10px;
            border-radius: 5px;
            font-size: 12px;
            z-index: 1000;
            pointer-events: none;
            display: none;
            max-width: 300px;
            word-wrap: break-word;
        }
        
        .legend {
            margin-top: 30px;
            padding: 20px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 10px;
        }
        
        .legend-title {
            font-size: 18px;
            margin-bottom: 15px;
            font-weight: bold;
        }
        
        .legend-items {
            display: flex;
            flex-wrap: wrap;
            gap: 15px;
        }
        
        .legend-item {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .legend-color {
            width: 20px;
            height: 20px;
            border-radius: 3px;
        }
        
        .stats {
            margin-top: 20px;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
        }
        
        .stat-card {
            background: rgba(255, 255, 255, 0.1);
            padding: 15px;
            border-radius: 10px;
            text-align: center;
        }
        
        .stat-value {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 5px;
        }
        
        .stat-label {
            font-size: 14px;
            opacity: 0.8;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🤖 Host Timeline - Časová osa aktivit</h1>
        
        <div class="controls">
            <label for="hours-select">Zobrazit posledních: </label>
            <select id="hours-select" onchange="changeTimeRange(this.value)">
                <option value="6" <?php echo $hours == 6 ? 'selected' : ''; ?>>6 hodin</option>
                <option value="12" <?php echo $hours == 12 ? 'selected' : ''; ?>>12 hodin</option>
                <option value="24" <?php echo $hours == 24 ? 'selected' : ''; ?>>24 hodin</option>
                <option value="48" <?php echo $hours == 48 ? 'selected' : ''; ?>>48 hodin</option>
                <option value="72" <?php echo $hours == 72 ? 'selected' : ''; ?>>72 hodin</option>
            </select>
        </div>
        
        <div class="timeline-container">
            <div class="timeline-grid">
                <!-- Časové značky -->
                <div class="time-labels">
                    <?php
                    for ($h = 0; $h <= $hours; $h++) {
                        $label_time = $min_time + ($h * 3600);
                        $top = ($h * 60);
                        echo "<div class='time-label' style='top: {$top}px;'>" . date('H:00', $label_time) . "</div>";
                        echo "<div class='hour-line' style='top: {$top}px;'></div>";
                    }
                    ?>
                </div>
                
                <!-- Sloupce hostů -->
                <?php
                $col_index = 0;
                foreach ($hosts as $host_name => $host_data) {
                    $left = $col_index * $column_width;
                    echo "<div class='host-column' style='left: {$left}%; width: {$column_width}%;'>";
                    echo "<div class='host-header'>{$host_name}</div>";
                    
                    // Aktivity pro tento host
                    foreach ($activities as $activity) {
                        if ($activity['host'] !== $host_name) continue;
                        
                        $top = (($activity['start'] - $min_time) / 60);
                        $height = max(15, $activity['duration']); // Minimální výška 15px
                        
                        // Určit třídu podle typu akce
                        $action_class = 'activity-other';
                        if (strpos($activity['action'], 'post_utio_g') !== false) {
                            $action_class = 'activity-post_utio_g';
                        } elseif (strpos($activity['action'], 'post_utio_gv') !== false) {
                            $action_class = 'activity-post_utio_gv';
                        } elseif ($activity['action'] === 'quote_post') {
                            $action_class = 'activity-quote_post';
                        } elseif ($activity['action'] === 'news_post') {
                            $action_class = 'activity-news_post';
                        } elseif ($activity['action'] === 'group_explore') {
                            $action_class = 'activity-group_explore';
                        } elseif ($activity['action'] === 'stories_view') {
                            $action_class = 'activity-stories_view';
                        } elseif ($activity['action'] === 'video_watch') {
                            $action_class = 'activity-video_watch';
                        }
                        
                        $text_preview = htmlspecialchars(substr($activity['text'] ?? '', 0, 50));
                        $full_text = htmlspecialchars($activity['text'] ?? '');
                        
                        echo "<div class='activity-block {$action_class}' 
                              style='top: {$top}px; height: {$height}px;'
                              data-user='" . htmlspecialchars($activity['user_name']) . "'
                              data-action='{$activity['action']}'
                              data-time='" . date('H:i', $activity['start']) . "'
                              data-duration='{$activity['duration']}'
                              data-text='{$full_text}'>
                              <div style='font-size: 10px; font-weight: bold;'>{$activity['action']}</div>
                              </div>";
                    }
                    
                    echo "</div>";
                    $col_index++;
                }
                ?>
            </div>
        </div>
        
        <!-- Legenda -->
        <div class="legend">
            <div class="legend-title">Legenda akcí</div>
            <div class="legend-items">
                <div class="legend-item">
                    <div class="legend-color activity-post_utio_g"></div>
                    <span>UTIO Post (G)</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color activity-post_utio_gv"></div>
                    <span>UTIO Post (GV)</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color activity-quote_post"></div>
                    <span>Quote Post</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color activity-news_post"></div>
                    <span>News Post</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color activity-group_explore"></div>
                    <span>Group Explore</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color activity-stories_view"></div>
                    <span>Stories View</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color activity-video_watch"></div>
                    <span>Video Watch</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color activity-other"></div>
                    <span>Ostatní</span>
                </div>
            </div>
        </div>
        
        <!-- Statistiky -->
        <?php
        // Počet aktivních hostů
        $active_hosts = count($hosts);
        
        // Celkový počet aktivit
        $total_activities = count($activities);
        
        // Nejaktivnější host
        $host_activity_count = [];
        foreach ($activities as $activity) {
            if (!isset($host_activity_count[$activity['host']])) {
                $host_activity_count[$activity['host']] = 0;
            }
            $host_activity_count[$activity['host']]++;
        }
        arsort($host_activity_count);
        $most_active_host = array_key_first($host_activity_count) ?? 'N/A';
        $most_active_count = array_values($host_activity_count)[0] ?? 0;
        
        // Průměrný počet aktivit na host
        $avg_activities = $active_hosts > 0 ? round($total_activities / $active_hosts, 1) : 0;
        ?>
        
        <div class="stats">
            <div class="stat-card">
                <div class="stat-value"><?php echo $active_hosts; ?></div>
                <div class="stat-label">Aktivních hostů</div>
            </div>
            <div class="stat-card">
                <div class="stat-value"><?php echo $total_activities; ?></div>
                <div class="stat-label">Celkem aktivit</div>
            </div>
            <div class="stat-card">
                <div class="stat-value"><?php echo $avg_activities; ?></div>
                <div class="stat-label">Průměr na host</div>
            </div>
            <div class="stat-card">
                <div class="stat-value"><?php echo $most_active_host; ?></div>
                <div class="stat-label">Nejaktivnější (<?php echo $most_active_count; ?>x)</div>
            </div>
        </div>
    </div>
    
    <div class="tooltip" id="tooltip"></div>
    
    <script>
        function changeTimeRange(hours) {
            window.location.href = '?hours=' + hours;
        }
        
        // Tooltip funkce
        const tooltip = document.getElementById('tooltip');
        const activityBlocks = document.querySelectorAll('.activity-block');
        
        activityBlocks.forEach(block => {
            block.addEventListener('mouseenter', function(e) {
                const user = this.dataset.user;
                const action = this.dataset.action;
                const time = this.dataset.time;
                const duration = this.dataset.duration;
                const text = this.dataset.text;
                
                let content = `<strong>${user}</strong><br>`;
                content += `Akce: ${action}<br>`;
                content += `Čas: ${time}<br>`;
                content += `Trvání: ${duration} min`;
                if (text && text !== 'null') {
                    content += `<br><br>Detail: ${text.substring(0, 200)}${text.length > 200 ? '...' : ''}`;
                }
                
                tooltip.innerHTML = content;
                tooltip.style.display = 'block';
            });
            
            block.addEventListener('mousemove', function(e) {
                tooltip.style.left = e.pageX + 10 + 'px';
                tooltip.style.top = e.pageY + 10 + 'px';
            });
            
            block.addEventListener('mouseleave', function() {
                tooltip.style.display = 'none';
            });
        });
    </script>
</body>
</html>