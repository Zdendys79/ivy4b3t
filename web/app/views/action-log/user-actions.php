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
        
        <!-- Informace o uživateli -->
        <div class="user-profile">
            <div class="user-basic-info">
                <strong>👤 Uživatel:</strong> ID<?= $user_info['id'] ?> - <?= htmlspecialchars($user_info['surname'] ?? $user_info['name'] ?? 'Neznámý') ?><br>
                <?php if ($user_info['e_mail']): ?>
                    <strong>📧 Email:</strong> <?= htmlspecialchars($user_info['e_mail']) ?><br>
                <?php endif; ?>
                <?php if ($user_info['host']): ?>
                    <strong>🖥️ Host:</strong> <?= htmlspecialchars($user_info['host']) ?>
                <?php endif; ?>
            </div>
        </div>
        
        <div class="stats">
            <strong>📊 Akce:</strong> <?= count($actions) ?> záznamů • 
            <strong>⏱️ Období:</strong> Posledních 24h nebo 25 nejnovějších • 
            <strong>🔄 Seřazení:</strong> Nejnovější nahoře
        </div>
        
        <?php if (empty($actions)): ?>
            <p>Žádné akce nebyly nalezeny pro tohoto uživatele.</p>
        <?php else: ?>
            
            <div class="action-list">
                <?php foreach ($actions as $action): ?>
                    <div class="action-item">
                        <div class="timestamp"><?= date('H:i:s', strtotime($action['timestamp'])) ?></div>
                        <div class="action-type">
                            <?php 
                            // Mapování action_code na popisky
                            $action_labels = [
                                'post_utio_g' => '📝 Post do skupiny',
                                'post_utio_gv' => '📝 Post do skupiny B3',
                                'group_explore' => '🔍 Průzkum skupin',
                                'account_delay' => '⏸️ Uspání účtu',
                                'account_sleep' => '💤 Spící účet',
                                'news_post' => '📰 RSS příspěvek',
                                'quote_post' => '💬 Citát'
                            ];
                            
                            echo $action_labels[$action['action_code']] ?? '❓ ' . htmlspecialchars($action['action_code']);
                            ?>
                        </div>
                        <div class="action-details">
                            <?php 
                            // Zobrazení detailů podle typu akce
                            switch ($action['action_code']) {
                                case 'post_utio_g':
                                case 'post_utio_gv':
                                    echo htmlspecialchars($action['group_name'] ?? $action['text'] ?? 'Skupina');
                                    if ($action['group_fb_id']) {
                                        echo ' <a href="https://www.facebook.com/groups/' . htmlspecialchars($action['group_fb_id']) . '" target="_blank" class="reference-id">🔗 ' . htmlspecialchars($action['group_fb_id']) . '</a>';
                                    }
                                    break;
                                    
                                case 'group_explore':
                                    echo htmlspecialchars($action['text'] ?? 'Průzkum');
                                    if ($action['group_fb_id']) {
                                        echo ' <a href="https://www.facebook.com/groups/' . htmlspecialchars($action['group_fb_id']) . '" target="_blank" class="reference-id">🔗 ' . htmlspecialchars($action['group_fb_id']) . '</a>';
                                    }
                                    break;
                                    
                                case 'account_delay':
                                case 'account_sleep':
                                    echo htmlspecialchars($action['text'] ?? 'Spánek/Uspání');
                                    break;
                                    
                                case 'news_post':
                                    echo htmlspecialchars($action['rss_title'] ?? 'RSS ID: ' . ($action['text'] ?? 'N/A'));
                                    if ($action['rss_url']) {
                                        echo ' <a href="' . htmlspecialchars($action['rss_url']) . '" target="_blank" class="url-link">🔗 Odkaz</a>';
                                    }
                                    break;
                                    
                                case 'quote_post':
                                    if ($action['quote_text']) {
                                        echo '"' . htmlspecialchars(substr($action['quote_text'], 0, 60)) . (strlen($action['quote_text']) > 60 ? '...' : '') . '"';
                                        if ($action['quote_author']) {
                                            echo ' <span class="quote-author">— ' . htmlspecialchars($action['quote_author']) . '</span>';
                                        }
                                    } else {
                                        echo 'Citát ID: ' . htmlspecialchars($action['reference_id'] ?? 'N/A');
                                    }
                                    break;
                                    
                                default:
                                    echo htmlspecialchars($action['text'] ?? 'Bez detailů');
                                    break;
                            }
                            ?>
                        </div>
                        <div class="action-date">
                            <?= date('j.n. H:i', strtotime($action['timestamp'])) ?>
                        </div>
                    </div>
                <?php endforeach; ?>
            </div>
            
        <?php endif; ?>
    </div>
</body>
</html>