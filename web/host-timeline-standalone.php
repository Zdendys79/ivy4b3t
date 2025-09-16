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

// Získat všechny aktivity hostů bez seskupování - seskupíme v PHP
$query = "
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
      AND al.timestamp <= NOW()
      AND u.host IS NOT NULL
    ORDER BY u.host, al.timestamp ASC
";

$stmt = $conn->prepare($query);
$stmt->bind_param('s', $start_time);
$stmt->execute();
$result = $stmt->get_result();

// Zpracovat data do struktur
$hosts = [];
$sessions = [];
$current_sessions = []; // Sledování aktuální session pro každý host
$session_counter = 0;
$max_gap_minutes = 10; // Maximální mezera mezi akcemi v minutách

while ($row = $result->fetch_assoc()) {
    $host_name = $row['host'];
    $user_id = $row['account_id'];
    $timestamp = strtotime($row['timestamp']);
    
    // Inicializovat host
    if (!isset($hosts[$host_name])) {
        $hosts[$host_name] = [
            'name' => $host_name,
            'sessions' => []
        ];
    }
    
    // Klíč pro aktuální session daného hosta
    $host_session_key = $host_name;
    
    // Rozhodnout, zda vytvořit novou session
    $create_new_session = false;
    
    if (!isset($current_sessions[$host_session_key])) {
        // První session pro tento host
        $create_new_session = true;
    } else {
        $last_session_key = $current_sessions[$host_session_key];
        $last_session = $sessions[$last_session_key];
        
        // Vytvořit novou session pokud:
        // 1. Změnil se user_id
        // 2. Je větší než 10 minutová mezera od poslední akce
        if ($last_session['user_id'] != $user_id || 
            ($timestamp - $last_session['end']) > ($max_gap_minutes * 60)) {
            $create_new_session = true;
        }
    }
    
    // Vytvořit novou session pokud je potřeba
    if ($create_new_session) {
        $session_counter++;
        $session_key = $host_name . '_' . $user_id . '_' . $session_counter;
        
        $sessions[$session_key] = [
            'host' => $host_name,
            'user_id' => $user_id,
            'surname' => $row['surname'],
            'start' => $timestamp,
            'end' => $timestamp,
            'actions' => [],
            'action_counts' => []
        ];
        
        $current_sessions[$host_session_key] = $session_key;
        $hosts[$host_name]['sessions'][] = $session_key;
    } else {
        $session_key = $current_sessions[$host_session_key];
    }
    
    // Aktualizovat časy session
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
}

// Seřadit hosty podle názvu
ksort($hosts);

// Vypočítat parametry zobrazení
$min_time = strtotime($start_time);
$max_time = strtotime($end_time);
$total_minutes = ($max_time - $min_time) / 60;
// Vrátit původní šířku sloupců - hosté vedle sebe
$column_width = count($hosts) > 0 ? floor(90 / count($hosts)) : 90;

// HLAVNÍ PROMĚNNÁ PRO VERTIKÁLNÍ ROZŠÍŘENÍ - 48x (4x * 12x)
$vertical_scale = 48;
$timeline_height = $hours * 100 * $vertical_scale; // Výška časové osy v pixelech

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
            min-height: <?php echo $timeline_height; ?>px; /* Dynamická výška */
            margin-top: 50px;
            padding-top: 30px; /* Prostor pro host headers */
        }
        .time-axis {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: <?php echo $timeline_height; ?>px; /* Dynamická výška */
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
            bottom: -<?php echo $timeline_height; ?>px; /* Dynamická výška */
            width: 1px;
            background: rgba(255, 255, 255, 0.1);
        }
        .host-column {
            position: absolute;
            top: 0;
            min-height: <?php echo $timeline_height; ?>px; /* Dynamická výška */
            width: <?php echo $column_width; ?>%;
            border-left: 1px solid rgba(255, 255, 255, 0.1);
        }
        .host-header {
            position: sticky;
            top: 0;
            left: 0;
            right: 0;
            height: 25px;
            text-align: center;
            font-weight: bold;
            font-size: 12px;
            background: rgba(255, 255, 255, 0.25);
            border-radius: 5px 5px 0 0;
            padding: 3px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            z-index: 100; /* Nad session bloky */
            margin-bottom: 5px; /* Mezera mezi header a prvním blokem */
        }
        .session-block {
            position: absolute;
            width: 96%; /* Širší DIV */
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.3);
            border-radius: 4px;
            padding: 2px; /* Zmenšený vnitřní okraj */
            margin: 2px; /* Vnější okraj */
            cursor: pointer;
            transition: all 0.3s ease;
            overflow: hidden;
            font-size: 10px; /* Menší písmo pro lepší zobrazení */
        }
        .session-block:hover {
            transform: scale(1.02);
            z-index: 100;
            background: rgba(255, 255, 255, 0.2);
            box-shadow: 0 4px 20px rgba(0,0,0,0.4);
        }
        .session-header {
            font-weight: bold;
            font-size: 10px;
            margin-bottom: 2px;
            padding-bottom: 2px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.2);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .session-actions {
            font-size: 9px;
            line-height: 1.2;
        }
        .action-line {
            margin: 1px 0;
            padding: 1px 2px;
            border-radius: 2px;
            background: rgba(0, 0, 0, 0.2);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .action-failed {
            opacity: 0.5;
            text-decoration: line-through;
            font-style: italic;
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
                        $top = (($max_time - $label_time) / ($max_time - $min_time)) * $timeline_height; // Použití dynamické výšky
                        
                        // Zobrazit pouze každou celou hodinu s textem, ostatní jen čáru
                        if ($i % 4 == 0) { // Každá 4. značka = celá hodina
                            echo "<div class='time-label' style='top: {$top}px; left: 10px;'>" . date('H:00', $label_time) . "</div>";
                            echo "<div class='hour-line' style='top: {$top}px; left: 80px; right: 0; height: 1px; width: auto; background: rgba(255, 255, 255, 0.3);'></div>";
                        } else {
                            echo "<div class='hour-line' style='top: {$top}px; left: 80px; right: 0; height: 1px; width: auto; background: rgba(255, 255, 255, 0.05);'></div>";
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
                        
                        // Vypočítat pozici s použitím dynamické výšky (NOW je nahoře = 0)
                        // Omezit session pouze na viditelný rozsah
                        $session_start_time = max($session['start'], $min_time);
                        $session_end_time = min($session['end'], $max_time);
                        
                        // Přeskočit session mimo rozsah
                        if ($session_end_time < $min_time || $session_start_time > $max_time) {
                            continue;
                        }
                        
                        // Najít poslední akci (account_delay nebo account_sleep) pro určení konce session
                        $actual_session_end = $session['start']; // Výchozí je začátek
                        foreach ($session['actions'] as $action) {
                            // Aktualizovat konec na čas každé akce
                            if ($action['time'] > $actual_session_end) {
                                $actual_session_end = $action['time'];
                            }
                            // Pokud je to account_delay nebo account_sleep, je to konec session
                            if ($action['code'] === 'account_delay' || $action['code'] === 'account_sleep') {
                                $actual_session_end = $action['time'];
                                break; // Konec session nalezen
                            }
                        }
                        
                        // Vypočítat pozici - session začíná nahoře v čase začátku a roste dolů
                        // Top pozice je začátek session (první akce)
                        // Přidat offset pro host header (30px = 25px header + 5px margin)
                        $session_top = (($max_time - $session['start']) / ($max_time - $min_time)) * $timeline_height + 30;
                        
                        // Výška podle skutečné délky session (od začátku do konce/delay/sleep)
                        $session_duration_seconds = $actual_session_end - $session['start'];
                        $session_height = ($session_duration_seconds / ($max_time - $min_time)) * $timeline_height;
                        
                        // Minimální výška pro viditelnost
                        if ($session_height < 20) $session_height = 20;
                        
                        // Pevná šířka 96% sloupce, zarovnáno na střed
                        $session_left = 2; // 2% od kraje (96% šířka = 2% zleva, 2% zprava)
                        
                        // Vypočítat délku trvání session (použít stejnou logiku jako pro výšku)
                        $duration_seconds = $session_duration_seconds; // Už vypočítáno výše
                        $duration_minutes = floor($duration_seconds / 60);
                        $duration_secs = $duration_seconds % 60;
                        $duration_str = sprintf("%02d:%02d", $duration_minutes, $duration_secs);
                        
                        echo "<div class='session-block' style='left: {$session_left}%; top: {$session_top}px; height: {$session_height}px;'>";
                        echo "<div class='session-header'>#{$session['user_id']} {$session['surname']} ({$duration_str})</div>";
                        echo "<div class='session-actions'>";
                        
                        // Zobrazit sumář akcí
                        foreach ($session['action_counts'] as $action => $count) {
                            $color_class = getActionColor($action);
                            
                            // Speciální zpracování pro account_delay a account_sleep
                            if ($action === 'account_delay') {
                                // Najít delay akci a získat délku
                                $delay_minutes = 0;
                                foreach ($session['actions'] as $act) {
                                    if ($act['code'] === 'account_delay') {
                                        // Nejdřív zkusit reference_id (nové záznamy)
                                        if ($act['reference_id'] && is_numeric($act['reference_id'])) {
                                            $delay_minutes = intval($act['reference_id']);
                                            break;
                                        }
                                        // Fallback na parsování textu (staré záznamy)
                                        elseif ($act['text'] && preg_match('/(\d+)\s*h/i', $act['text'], $matches)) {
                                            $delay_minutes = intval($matches[1]) * 60; // Převést hodiny na minuty
                                            break;
                                        }
                                    }
                                }
                                $hours = floor($delay_minutes / 60);
                                $minutes = $delay_minutes % 60;
                                echo "<div class='action-line {$color_class}'>account_delay ({$hours}h:{$minutes}m)</div>";
                            } elseif ($action === 'account_sleep') {
                                // Najít sleep akci a získat délku
                                $sleep_minutes = 0;
                                foreach ($session['actions'] as $act) {
                                    if ($act['code'] === 'account_sleep') {
                                        // Nejdřív zkusit reference_id (nové záznamy)
                                        if ($act['reference_id'] && is_numeric($act['reference_id'])) {
                                            $sleep_minutes = intval($act['reference_id']);
                                            break;
                                        }
                                        // Fallback na parsování textu (staré záznamy)
                                        elseif ($act['text'] && preg_match('/(\d+)\s*h/i', $act['text'], $matches)) {
                                            $sleep_minutes = intval($matches[1]) * 60; // Převést hodiny na minuty
                                            break;
                                        }
                                    }
                                }
                                $sleep_hours = $sleep_minutes / 60;
                                $days = floor($sleep_hours / 24);
                                $hours = floor($sleep_hours % 24);
                                $minutes = $sleep_minutes % 60;
                                echo "<div class='action-line {$color_class}'>account_sleep ({$days}d:{$hours}h:{$minutes}m)</div>";
                            } else {
                                // Běžné akce - zkontrolovat pokud jsou FAILED
                                $failed_count = 0;
                                $success_count = 0;
                                
                                // Spočítat úspěšné a neúspěšné akce
                                foreach ($session['actions'] as $act) {
                                    if ($act['code'] === $action) {
                                        if (strpos($act['text'], 'FAILED') !== false) {
                                            $failed_count++;
                                        } else {
                                            $success_count++;
                                        }
                                    }
                                }
                                
                                // Zobrazit s informací o selhání
                                if ($failed_count > 0 && $success_count > 0) {
                                    echo "<div class='action-line {$color_class}'>{$count}x {$action} ({$success_count}✓/{$failed_count}✗)</div>";
                                } elseif ($failed_count > 0) {
                                    echo "<div class='action-line {$color_class} action-failed'>{$count}x {$action} (all failed)</div>";
                                } elseif ($count > 1) {
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