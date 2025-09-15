<?php
// Pokud voláno přímo (ne přes index.php)
if (!defined('IVY_FRAMEWORK')) {
    // Použít stejnou session konfiguraci jako index.php
    ini_set('session.gc_maxlifetime', 30 * 24 * 60 * 60);
    ini_set('session.cookie_lifetime', 30 * 24 * 60 * 60);
    ini_set('session.cookie_samesite', 'Lax');

    $session_path = __DIR__ . '/storage/sessions';
    if (!is_dir($session_path)) {
        mkdir($session_path, 0755, true);
    }
    session_save_path($session_path);
    session_start();

    // Kontrola přihlášení
    if (!isset($_SESSION['authenticated']) || $_SESSION['authenticated'] !== true) {
        header('Location: /login');
        exit();
    }
}
// Pokud voláno přes index.php, session už je aktivní a ověřená

// Databázové připojení
$host = getenv('MYSQL_HOST') ?: 'localhost';
$port = getenv('MYSQL_PORT') ?: '3306';
$user = getenv('MYSQL_USER') ?: 'ivy_user';
$pass = getenv('MYSQL_PASSWORD') ?: '';
$dbname = getenv('MYSQL_DATABASE') ?: 'ivy';

$conn = new mysqli($host, $user, $pass, $dbname, $port);
if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}

// Získat časové rozmezí - výchozí posledních 24 hodin
$hours = isset($_GET['hours']) ? intval($_GET['hours']) : 24;
$start_time = date('Y-m-d H:i:s', strtotime("-{$hours} hours"));
$end_time = date('Y-m-d H:i:s');

// Získat aktivity hostů z action_log - seskupené podle času
$query = "
    SELECT 
        u.host,
        al.account_id,
        u.surname,
        al.action_code,
        al.timestamp,
        al.text,
        MIN(al.timestamp) as session_start,
        MAX(al.timestamp) as session_end,
        TIMESTAMPDIFF(MINUTE, MIN(al.timestamp), MAX(al.timestamp)) as session_duration
    FROM action_log al
    JOIN fb_users u ON al.account_id = u.id
    WHERE al.timestamp >= ?
      AND u.host IS NOT NULL
    GROUP BY u.host, al.account_id, FLOOR(UNIX_TIMESTAMP(al.timestamp) / 3600)
    ORDER BY u.host, al.timestamp DESC
";

// Získat detailní aktivity pro každou session
$detail_query = "
    SELECT 
        u.host,
        al.account_id,
        u.surname,
        al.action_code,
        al.timestamp,
        al.text,
        al.reference_id
    FROM action_log al
    JOIN fb_users u ON al.account_id = u.id
    WHERE al.timestamp >= ?
      AND u.host IS NOT NULL
    ORDER BY u.host, al.timestamp DESC
";

$stmt = $conn->prepare($detail_query);
$stmt->bind_param('s', $start_time);
$stmt->execute();
$result = $stmt->get_result();

// Zpracovat data do struktur
$hosts = [];
$sessions = [];

while ($row = $result->fetch_assoc()) {
    $host_name = $row['host'];
    $user_id = $row['account_id'];
    $session_key = $host_name . '_' . $user_id . '_' . floor(strtotime($row['timestamp']) / 3600);
    
    // Inicializovat host
    if (!isset($hosts[$host_name])) {
        $hosts[$host_name] = [
            'name' => $host_name,
            'sessions' => []
        ];
    }
    
    // Inicializovat session
    if (!isset($sessions[$session_key])) {
        $sessions[$session_key] = [
            'host' => $host_name,
            'user_id' => $user_id,
            'surname' => $row['surname'],
            'start' => strtotime($row['timestamp']),
            'end' => strtotime($row['timestamp']),
            'actions' => [],
            'action_counts' => []
        ];
    }
    
    // Aktualizovat časy session
    $timestamp = strtotime($row['timestamp']);
    if ($timestamp < $sessions[$session_key]['start']) {
        $sessions[$session_key]['start'] = $timestamp;
    }
    if ($timestamp > $sessions[$session_key]['end']) {
        $sessions[$session_key]['end'] = $timestamp;
    }
    
    // Přidat akci
    $sessions[$session_key]['actions'][] = [
        'code' => $row['action_code'],
        'time' => $timestamp,
        'text' => $row['text'],
        'reference_id' => $row['reference_id']
    ];
    
    // Počítat akce
    if (!isset($sessions[$session_key]['action_counts'][$row['action_code']])) {
        $sessions[$session_key]['action_counts'][$row['action_code']] = 0;
    }
    $sessions[$session_key]['action_counts'][$row['action_code']]++;
    
    // Přidat session k hostu
    if (!in_array($session_key, $hosts[$host_name]['sessions'])) {
        $hosts[$host_name]['sessions'][] = $session_key;
    }
}

// Seřadit hosty podle názvu
ksort($hosts);

// Vypočítat parametry zobrazení
$min_time = strtotime($start_time);
$max_time = strtotime($end_time);
$total_minutes = ($max_time - $min_time) / 60;
// Vrátit původní šířku sloupců - hosté vedle sebe
$column_width = count($hosts) > 0 ? floor(90 / count($hosts)) : 90;

// Funkce pro formátování času
function formatDuration($seconds) {
    if ($seconds < 60) {
        return $seconds . 's';
    } elseif ($seconds < 3600) {
        $minutes = floor($seconds / 60);
        $secs = $seconds % 60;
        return $minutes . 'm ' . $secs . 's';
    } elseif ($seconds < 86400) {
        $hours = floor($seconds / 3600);
        $minutes = floor(($seconds % 3600) / 60);
        return $hours . 'h ' . $minutes . 'm';
    } else {
        $days = floor($seconds / 86400);
        $hours = floor(($seconds % 86400) / 3600);
        $minutes = floor(($seconds % 3600) / 60);
        return $days . 'd ' . $hours . 'h ' . $minutes . 'm';
    }
}

// Funkce pro získání barvy akce
function getActionColor($action) {
    if (strpos($action, 'post_utio_g') !== false) return 'activity-post_utio_g';
    if (strpos($action, 'post_utio_gv') !== false) return 'activity-post_utio_gv';
    if ($action === 'quote_post') return 'activity-quote_post';
    if ($action === 'news_post') return 'activity-news_post';
    if ($action === 'group_explore') return 'activity-group_explore';
    if ($action === 'stories_view') return 'activity-stories_view';
    if ($action === 'video_watch') return 'activity-video_watch';
    if ($action === 'account_delay') return 'activity-account_delay';
    if ($action === 'account_sleep') return 'activity-account_sleep';
    return 'activity-other';
}
?>
<!DOCTYPE html>
<html lang="cs">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Host Timeline - IVY4B3T</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
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
            min-height: 2400px; /* 4x výška pro vertikální rozšíření */
            margin-top: 100px;
        }
        .time-axis {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 2400px; /* 4x výška */
            border-left: 2px solid rgba(255, 255, 255, 0.3);
        }
        .time-label {
            position: absolute;
            font-size: 12px;
            color: rgba(255, 255, 255, 0.7);
            transform: translateY(-50%);
        }
        .hour-line {
            position: absolute;
            top: 70px;
            bottom: -2400px; /* 4x výška */
            width: 1px;
            background: rgba(255, 255, 255, 0.1);
        }
        .host-column {
            position: absolute;
            top: 0;
            min-height: 2400px; /* 4x výška */
            width: <?php echo $column_width; ?>%;
            border-left: 1px solid rgba(255, 255, 255, 0.1);
        }
        .host-header {
            position: absolute;
            top: -100px;
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
        .session-block {
            position: absolute;
            left: 2px;
            right: 2px;
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.3);
            border-radius: 8px;
            padding: 8px;
            cursor: pointer;
            transition: all 0.3s ease;
            overflow: hidden;
        }
        .session-block:hover {
            transform: scale(1.02);
            z-index: 100;
            background: rgba(255, 255, 255, 0.2);
            box-shadow: 0 4px 20px rgba(0,0,0,0.4);
        }
        .session-header {
            font-weight: bold;
            font-size: 12px;
            margin-bottom: 5px;
            padding-bottom: 3px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.2);
        }
        .session-actions {
            font-size: 11px;
            line-height: 1.4;
        }
        .action-line {
            margin: 2px 0;
            padding: 2px 4px;
            border-radius: 3px;
            background: rgba(0, 0, 0, 0.2);
        }
        /* Barvy akcí */
        .activity-post_utio_g { background: linear-gradient(45deg, #4CAF50, #45a049); }
        .activity-post_utio_gv { background: linear-gradient(45deg, #2196F3, #1976D2); }
        .activity-quote_post { background: linear-gradient(45deg, #FF9800, #F57C00); }
        .activity-news_post { background: linear-gradient(45deg, #9C27B0, #7B1FA2); }
        .activity-group_explore { background: linear-gradient(45deg, #00BCD4, #00ACC1); }
        .activity-stories_view { background: linear-gradient(45deg, #FFC107, #FFA000); }
        .activity-video_watch { background: linear-gradient(45deg, #F44336, #D32F2F); }
        .activity-account_delay { background: linear-gradient(45deg, #795548, #5D4037); }
        .activity-account_sleep { background: linear-gradient(45deg, #3F51B5, #303F9F); }
        .activity-other { background: linear-gradient(45deg, #607D8B, #455A64); }
        
        .tooltip {
            position: absolute;
            background: rgba(0, 0, 0, 0.95);
            color: white;
            padding: 12px;
            border-radius: 8px;
            font-size: 12px;
            z-index: 1000;
            pointer-events: none;
            display: none;
            max-width: 400px;
            word-wrap: break-word;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5);
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
                <!-- Časová osa nahoře -->
                <div class="time-axis">
                    <?php
                    // Zobrazit časové značky - každých 15 minut
                    $interval_minutes = 15; // Každých 15 minut
                    $num_markers = ($hours * 60) / $interval_minutes;
                    
                    for ($i = 0; $i <= $num_markers; $i++) {
                        $label_time = $max_time - ($i * $interval_minutes * 60);
                        $top = (($max_time - $label_time) / ($max_time - $min_time)) * 2400; // Vertikální pozice
                        
                        // Zobrazit pouze každou celou hodinu s textem, ostatní jen čáru
                        if ($i % 4 == 0) { // Každá 4. značka = celá hodina
                            echo "<div class='time-label' style='top: " . ($top + 50) . "px; left: -60px;'>" . date('H:00', $label_time) . "</div>";
                            echo "<div class='hour-line' style='top: " . ($top + 70) . "px; left: 0; right: 0; height: 1px; width: auto; background: rgba(255, 255, 255, 0.3);'></div>";
                        } else {
                            echo "<div class='hour-line' style='top: " . ($top + 70) . "px; left: 0; right: 0; height: 1px; width: auto; background: rgba(255, 255, 255, 0.05);'></div>";
                        }
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
                    
                    // Zobrazit sessions pro tento host
                    foreach ($host_data['sessions'] as $session_key) {
                        if (!isset($sessions[$session_key])) continue;
                        $session = $sessions[$session_key];
                        
                        // Vypočítat pozici - 4x více vertikálního prostoru
                        $session_top = (($max_time - $session['end']) / ($max_time - $min_time)) * 2400; // 4x výška
                        $session_height = (($session['end'] - $session['start']) / ($max_time - $min_time)) * 2400; // 4x výška
                        if ($session_height < 30) $session_height = 30; // Minimální výška
                        
                        $session_left = 10 + (($session['user_id'] % 3) * 30); // Horizontální rozložení podle user_id
                        
                        echo "<div class='session-block' style='left: {$session_left}%; right: {$session_left}%; top: {$session_top}px; height: {$session_height}px;'>";
                        echo "<div class='session-header'>#{$session['user_id']} {$session['surname']}</div>";
                        echo "<div class='session-actions'>";
                        
                        // Zobrazit sumář akcí
                        foreach ($session['action_counts'] as $action => $count) {
                            $color_class = getActionColor($action);
                            
                            // Speciální zpracování pro account_delay a account_sleep
                            if ($action === 'account_delay') {
                                // Najít delay akci a získat délku
                                $delay_duration = 0;
                                foreach ($session['actions'] as $act) {
                                    if ($act['code'] === 'account_delay' && $act['text']) {
                                        // Parsovat délku z textu (očekáváme formát typu "300 minut")
                                        if (preg_match('/(\d+)\s*(minut|hodin|sekund)/i', $act['text'], $matches)) {
                                            $delay_duration = intval($matches[1]);
                                            if (stripos($matches[2], 'hodin') !== false) {
                                                $delay_duration *= 60; // Převést na minuty
                                            } elseif (stripos($matches[2], 'sekund') !== false) {
                                                $delay_duration = floor($delay_duration / 60); // Převést na minuty
                                            }
                                        }
                                    }
                                }
                                $hours = floor($delay_duration / 60);
                                $minutes = $delay_duration % 60;
                                echo "<div class='action-line {$color_class}'>account_delay ({$hours}h:{$minutes}m)</div>";
                            } elseif ($action === 'account_sleep') {
                                // Najít sleep akci a získat délku
                                $sleep_duration = 0;
                                foreach ($session['actions'] as $act) {
                                    if ($act['code'] === 'account_sleep' && $act['text']) {
                                        if (preg_match('/(\d+)\s*(dní|hodin|minut)/i', $act['text'], $matches)) {
                                            $sleep_duration = intval($matches[1]);
                                            if (stripos($matches[2], 'dní') !== false) {
                                                $sleep_duration *= 1440; // Převést na minuty
                                            } elseif (stripos($matches[2], 'hodin') !== false) {
                                                $sleep_duration *= 60; // Převést na minuty
                                            }
                                        }
                                    }
                                }
                                $days = floor($sleep_duration / 1440);
                                $hours = floor(($sleep_duration % 1440) / 60);
                                $minutes = $sleep_duration % 60;
                                echo "<div class='action-line {$color_class}'>account_sleep ({$days}d:{$hours}h:{$minutes}m)</div>";
                            } else {
                                // Běžné akce
                                if ($count > 1) {
                                    echo "<div class='action-line {$color_class}'>{$count}x {$action}</div>";
                                } else {
                                    echo "<div class='action-line {$color_class}'>{$action}</div>";
                                }
                            }
                        }
                        
                        echo "</div>";
                        echo "</div>";
                    }
                    
                    echo "</div>";
                    $col_index++;
                }
                ?>
            </div>
        </div>
        
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
                    <div class="legend-color activity-account_delay"></div>
                    <span>Account Delay</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color activity-account_sleep"></div>
                    <span>Account Sleep</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color activity-other"></div>
                    <span>Ostatní</span>
                </div>
            </div>
        </div>
        
        <?php
        // Statistiky
        $total_sessions = count($sessions);
        $total_actions = 0;
        $action_summary = [];
        
        foreach ($sessions as $session) {
            foreach ($session['action_counts'] as $action => $count) {
                $total_actions += $count;
                if (!isset($action_summary[$action])) {
                    $action_summary[$action] = 0;
                }
                $action_summary[$action] += $count;
            }
        }
        
        arsort($action_summary);
        $top_action = array_key_first($action_summary) ?? 'N/A';
        $top_action_count = array_values($action_summary)[0] ?? 0;
        ?>
        
        <div class="stats">
            <div class="stat-card">
                <div class="stat-value"><?php echo count($hosts); ?></div>
                <div class="stat-label">Aktivních hostů</div>
            </div>
            <div class="stat-card">
                <div class="stat-value"><?php echo $total_sessions; ?></div>
                <div class="stat-label">Pracovních sessions</div>
            </div>
            <div class="stat-card">
                <div class="stat-value"><?php echo $total_actions; ?></div>
                <div class="stat-label">Celkem akcí</div>
            </div>
            <div class="stat-card">
                <div class="stat-value"><?php echo $top_action; ?></div>
                <div class="stat-label">Nejčastější akce (<?php echo $top_action_count; ?>x)</div>
            </div>
        </div>
    </div>
    
    <div class="tooltip" id="tooltip"></div>
    
    <script>
        function changeTimeRange(hours) {
            window.location.href = '?hours=' + hours;
        }
        
        // Tooltip pro sessions
        const tooltip = document.getElementById('tooltip');
        const sessionBlocks = document.querySelectorAll('.session-block');
        
        sessionBlocks.forEach(block => {
            block.addEventListener('mouseenter', function(e) {
                const rect = this.getBoundingClientRect();
                const header = this.querySelector('.session-header').textContent;
                const actions = this.querySelector('.session-actions').innerHTML;
                
                tooltip.innerHTML = `<strong>${header}</strong><br><br>${actions}`;
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