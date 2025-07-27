<!DOCTYPE html>
<html lang="cs">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= $title ?> - IVY4B3T</title>
    <style>
        body { 
            font-family: 'Courier New', monospace; 
            margin: 20px; 
            background-color: #f5f5f5; 
        }
        .container { 
            background: white; 
            padding: 20px; 
            border-radius: 8px; 
            box-shadow: 0 2px 4px rgba(0,0,0,0.1); 
        }
        .tree { 
            background-color: #f8f9fa; 
            padding: 15px; 
            border: 1px solid #dee2e6; 
            border-radius: 4px; 
            white-space: pre-line; 
            overflow-x: auto; 
        }
        .error { 
            background-color: #f8d7da; 
            color: #721c24; 
            padding: 10px; 
            border-radius: 4px; 
            margin: 10px 0; 
        }
        .stats {
            background-color: #d1ecf1;
            padding: 10px;
            border-radius: 4px;
            margin-bottom: 15px;
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
    </style>
</head>
<body>
    <div class="container">
        <nav>
            <a href="/">← Zpět na hlavní stránku</a>
            <a href="/test-db">Test DB</a>
            <a href="/users">Správa uživatelů</a>
        </nav>
        
        <h1><?= htmlspecialchars($title) ?></h1>
        
        <?php if (isset($error)): ?>
            <div class="error">
                <?= htmlspecialchars($error) ?>
            </div>
        <?php else: ?>
            <div class="stats">
                <strong>Statistiky:</strong> 
                Celkem <?= count($tree_lines) ?> položek v systémovém stromu
            </div>
            
            <div class="tree">
<?php foreach ($tree_lines as $line): ?>
<?= htmlspecialchars($line) . "\n" ?>
<?php endforeach; ?>
            </div>
        <?php endif; ?>
    </div>
</body>
</html>