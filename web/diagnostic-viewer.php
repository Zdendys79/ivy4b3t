<?php
/**
 * Název souboru: diagnostic-viewer.php
 * Umístění: ~/ivy4b3t/web/diagnostic-viewer.php
 *
 * Popis: Webové rozhraní pro prohlížení diagnostických dat z user_groups
 * - Screenshots jako base64 obrázky
 * - DOM fingerprint jako strukturovaný výpis
 * - Filtrování podle uživatele/skupiny
 */

require_once __DIR__ . '/app/bootstrap.php';

use App\Database;
use App\Auth;

// Ověření přihlášení
if (!Auth::isLoggedIn()) {
    header('Location: /login');
    exit;
}

$db = Database::getInstance();
$error = null;
$diagnostics = [];
$totalCount = 0;

// Získat parametry
$userId = $_GET['user_id'] ?? null;
$groupId = $_GET['group_id'] ?? null;
$limit = min((int)($_GET['limit'] ?? 20), 100); // Max 100
$offset = (int)($_GET['offset'] ?? 0);

try {
    // Sestavit query s filtry
    $whereConditions = ['(ug.screenshot IS NOT NULL OR ug.dom IS NOT NULL)'];
    $params = [];
    
    if ($userId) {
        $whereConditions[] = 'ug.user_id = ?';
        $params[] = $userId;
    }
    
    if ($groupId) {
        $whereConditions[] = 'ug.group_id = ?';  
        $params[] = $groupId;
    }
    
    $whereClause = implode(' AND ', $whereConditions);
    
    // Získat celkový počet
    $countQuery = "
        SELECT COUNT(*) as total
        FROM user_groups ug
        JOIN fb_users u ON ug.user_id = u.id  
        JOIN fb_groups g ON ug.group_id = g.id
        WHERE $whereClause
    ";
    
    $stmt = $db->prepare($countQuery);
    $stmt->execute($params);
    $totalCount = $stmt->fetch(PDO::FETCH_ASSOC)['total'];
    
    // Získat diagnostická data s paginací
    $dataQuery = "
        SELECT 
            ug.user_id,
            ug.group_id,
            ug.screenshot,
            ug.dom,
            ug.note,
            ug.blocked_until,
            ug.last_block_reason,
            ug.time,
            u.name as user_name,
            u.surname as user_surname,
            g.name as group_name,
            g.fb_id as group_fb_id,
            g.type as group_type
        FROM user_groups ug
        JOIN fb_users u ON ug.user_id = u.id  
        JOIN fb_groups g ON ug.group_id = g.id
        WHERE $whereClause
        ORDER BY ug.time DESC
        LIMIT ? OFFSET ?
    ";
    
    $params[] = $limit;
    $params[] = $offset;
    
    $stmt = $db->prepare($dataQuery);
    $stmt->execute($params);
    $diagnostics = $stmt->fetchAll(PDO::FETCH_ASSOC);

} catch (Exception $e) {
    $error = "Chyba při načítání dat: " . $e->getMessage();
}

// Helper funkce
function formatFileSize($bytes) {
    if ($bytes >= 1048576) return round($bytes / 1048576, 2) . ' MB';
    if ($bytes >= 1024) return round($bytes / 1024, 2) . ' KB';
    return $bytes . ' B';
}

function truncateText($text, $length = 100) {
    return strlen($text) > $length ? substr($text, 0, $length) . '...' : $text;
}
?>

<!DOCTYPE html>
<html lang="cs">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Diagnostická Data - IVY</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        .filters { background: #e8f4f8; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        .filters input, .filters select { margin: 5px; padding: 5px; }
        .diagnostic-item { border: 1px solid #ddd; margin: 15px 0; border-radius: 5px; overflow: hidden; }
        .diagnostic-header { background: #f8f9fa; padding: 10px; border-bottom: 1px solid #ddd; }
        .diagnostic-content { padding: 15px; }
        .screenshot { text-align: center; margin: 10px 0; }
        .screenshot img { max-width: 100%; height: auto; border: 1px solid #ccc; }
        .dom-elements { background: #f8f8f8; padding: 10px; border-radius: 3px; font-family: monospace; }
        .dom-element { margin: 5px 0; padding: 5px; background: white; border-left: 3px solid #007cba; }
        .pagination { margin: 20px 0; text-align: center; }
        .pagination a { margin: 0 5px; padding: 5px 10px; text-decoration: none; border: 1px solid #ddd; }
        .pagination .current { background: #007cba; color: white; }
        .error { color: red; padding: 10px; background: #ffe6e6; border-radius: 3px; }
        .stats { background: #e8f5e8; padding: 10px; border-radius: 3px; margin-bottom: 15px; }
    </style>
</head>
<body>

<div class="header">
    <h1>🔍 Diagnostická Data</h1>
    <p>Prohlížení screenshotů a DOM otisků při selhání UTIO akcí</p>
</div>

<?php if ($error): ?>
<div class="error"><?= htmlspecialchars($error) ?></div>
<?php endif; ?>

<div class="stats">
    <strong>📊 Statistiky:</strong> 
    Celkem <?= $totalCount ?> záznamů | 
    Zobrazeno <?= count($diagnostics) ?> | 
    Stránka <?= floor($offset / $limit) + 1 ?> z <?= ceil($totalCount / $limit) ?>
</div>

<div class="filters">
    <form method="GET" action="">
        <label>🔍 Filtry:</label>
        <input type="number" name="user_id" placeholder="User ID" value="<?= htmlspecialchars($userId ?? '') ?>" />
        <input type="number" name="group_id" placeholder="Group ID" value="<?= htmlspecialchars($groupId ?? '') ?>" />
        <select name="limit">
            <option value="10"<?= $limit === 10 ? ' selected' : '' ?>>10 záznamů</option>
            <option value="20"<?= $limit === 20 ? ' selected' : '' ?>>20 záznamů</option>
            <option value="50"<?= $limit === 50 ? ' selected' : '' ?>>50 záznamů</option>
        </select>
        <button type="submit">Filtrovat</button>
        <a href="/diagnostic-viewer.php">🔄 Reset</a>
    </form>
</div>

<?php if (empty($diagnostics)): ?>
<p><em>📭 Žádná diagnostická data nenalezena.</em></p>
<?php else: ?>

<?php foreach ($diagnostics as $item): ?>
<div class="diagnostic-item">
    <div class="diagnostic-header">
        <strong>👤 <?= htmlspecialchars($item['user_name'] . ' ' . $item['user_surname']) ?></strong> (ID: <?= $item['user_id'] ?>) → 
        <strong>📁 <?= htmlspecialchars($item['group_name']) ?></strong> (ID: <?= $item['group_id'] ?>, FB: <?= htmlspecialchars($item['group_fb_id']) ?>)
        <br>
        <small>⏰ <?= $item['time'] ?> | 🚫 Blokace: <?= $item['blocked_until'] ?: 'Ne' ?></small>
    </div>
    
    <div class="diagnostic-content">
        <?php if ($item['note']): ?>
            <?php $note = json_decode($item['note'], true); ?>
            <p><strong>📋 Důvod selhání:</strong> <?= htmlspecialchars($note['reason'] ?? 'N/A') ?></p>
            <p><strong>🌐 URL:</strong> <a href="<?= htmlspecialchars($note['url'] ?? '#') ?>" target="_blank"><?= truncateText($note['url'] ?? 'N/A', 80) ?></a></p>
        <?php endif; ?>
        
        <?php if ($item['screenshot']): ?>
        <div class="screenshot">
            <h4>📸 Screenshot (<?= formatFileSize(strlen($item['screenshot']) * 3/4) ?>)</h4>
            <img src="data:image/png;base64,<?= $item['screenshot'] ?>" alt="Diagnostic Screenshot" />
        </div>
        <?php endif; ?>
        
        <?php if ($item['dom']): ?>
            <?php $domElements = json_decode($item['dom'], true); ?>
            <h4>🌳 DOM Elementy (<?= count($domElements) ?>)</h4>
            <div class="dom-elements">
                <?php foreach ($domElements as $element): ?>
                <div class="dom-element">
                    <strong><?= htmlspecialchars($element['tag']) ?></strong>
                    <?php if ($element['zIndex']): ?><em>(z-index: <?= $element['zIndex'] ?>)</em><?php endif; ?>
                    <?php if ($element['className']): ?><span style="color: #666;">.<?= htmlspecialchars($element['className']) ?></span><?php endif; ?>
                    <br>
                    <span style="color: #333;"><?= htmlspecialchars(truncateText($element['text'], 200)) ?></span>
                </div>
                <?php endforeach; ?>
            </div>
        <?php endif; ?>
    </div>
</div>
<?php endforeach; ?>

<div class="pagination">
    <?php 
    $currentPage = floor($offset / $limit);
    $totalPages = ceil($totalCount / $limit);
    
    $baseUrl = "/diagnostic-viewer.php?" . http_build_query(array_filter(['user_id' => $userId, 'group_id' => $groupId, 'limit' => $limit]));
    
    if ($currentPage > 0): ?>
        <a href="<?= $baseUrl ?>&offset=<?= ($currentPage - 1) * $limit ?>">← Předchozí</a>
    <?php endif; ?>
    
    <?php for ($i = max(0, $currentPage - 2); $i <= min($totalPages - 1, $currentPage + 2); $i++): ?>
        <a href="<?= $baseUrl ?>&offset=<?= $i * $limit ?>" <?= $i === $currentPage ? 'class="current"' : '' ?>>
            <?= $i + 1 ?>
        </a>
    <?php endfor; ?>
    
    <?php if ($currentPage < $totalPages - 1): ?>
        <a href="<?= $baseUrl ?>&offset=<?= ($currentPage + 1) * $limit ?>">Další →</a>
    <?php endif; ?>
</div>

<?php endif; ?>

<p><a href="/action-log/overview">← Zpět na přehled akcí</a> | <a href="/">🏠 Hlavní menu</a></p>

</body>
</html>