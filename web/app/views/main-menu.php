<!DOCTYPE html>
<html lang="cs">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>IVY4B3T - Hlavní menu</title>
    <style>
        body { 
            font-family: Arial, sans-serif; 
            margin: 0; 
            padding: 20px; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            color: white;
        }
        .container { 
            max-width: 1200px; 
            margin: 0 auto; 
            padding: 30px; 
        }
        .header {
            text-align: center;
            margin-bottom: 50px;
        }
        .header h1 {
            font-size: 3em;
            margin-bottom: 10px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }
        .header p {
            font-size: 1.2em;
            opacity: 0.9;
        }
        .modules {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 25px;
            margin-top: 40px;
        }
        .module {
            background: rgba(255,255,255,0.1);
            backdrop-filter: blur(10px);
            padding: 25px;
            border-radius: 12px;
            border: 1px solid rgba(255,255,255,0.2);
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        .module:hover {
            transform: translateY(-5px);
            box-shadow: 0 10px 25px rgba(0,0,0,0.3);
        }
        .module h3 {
            margin-top: 0;
            font-size: 1.4em;
            margin-bottom: 15px;
        }
        .module p {
            opacity: 0.8;
            margin-bottom: 20px;
            line-height: 1.5;
        }
        .module-links {
            list-style: none;
            padding: 0;
            margin: 0;
        }
        .module-links li {
            margin: 10px 0;
        }
        .module-links a {
            color: white;
            text-decoration: none;
            display: block;
            padding: 10px 15px;
            background: rgba(255,255,255,0.1);
            border-radius: 6px;
            transition: background 0.3s ease;
        }
        .module-links a:hover {
            background: rgba(255,255,255,0.2);
        }
        .status-info {
            background: rgba(255,255,255,0.1);
            padding: 20px;
            border-radius: 8px;
            margin: 30px 0;
            text-align: center;
            backdrop-filter: blur(5px);
        }
        .footer {
            text-align: center;
            margin-top: 50px;
            opacity: 0.7;
            font-size: 0.9em;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🤖 IVY4B3T</h1>
            <p>Facebook Automation System - Centrální řídící panel</p>
        </div>
        
        <?php
        // GitHub PAT Token Monitoring
        require_once __DIR__ . '/../helpers/TokenMonitor.php';
        $tokenMonitor = new TokenMonitor(); // Použij přímé připojení
        echo $tokenMonitor->getCompleteAlert();
        ?>
        
        <div class="status-info">
            <strong>Status:</strong> Systém online | 
            <strong>PHP:</strong> <?= PHP_VERSION ?> | 
            <strong>Server:</strong> <?= $_SERVER['SERVER_SOFTWARE'] ?? 'Unknown' ?> |
            <strong>Čas:</strong> <?= date('Y-m-d H:i:s') ?>
        </div>
        
        <div class="modules">
            <!-- Systémové nástroje -->
            <div class="module">
                <h3>🔧 Systémové nástroje</h3>
                <p>Diagnostika, testování a přehled systému</p>
                <ul class="module-links">
                    <li><a href="test-db">🔍 Test databázového připojení</a></li>
                    <li><a href="scheme">🌳 Systémový strom projektů</a></li>
                </ul>
            </div>
            
            <!-- Správa uživatelů -->
            <div class="module">
                <h3>👥 Správa uživatelů</h3>
                <p>Správa Facebook účtů, jejich stavů a omezení</p>  
                <ul class="module-links">
                    <li><a href="users">👤 Správa uživatelů</a></li>
                    <li><a href="users/group-limits">⚖️ Skupinové limity</a></li>
                </ul>
            </div>
            
            <!-- Dashboard & Monitoring -->
            <div class="module">
                <h3>📊 Monitoring & Dashboard</h3>
                <p>Pokročilé přehledy, statistiky a monitoring systému</p>
                <ul class="module-links">
                    <li><a href="dashboard">📈 Pokročilý dashboard</a></li>
                    <li><a href="quotes">📝 Citáty</a></li>
                    <li><a href="dont_panic"><img src="public/assets/images/hitchhiker-symbol.svg" alt="Don't Panic!" style="width: 32px; height: auto; vertical-align: middle; margin-right: 8px;"> Don't panic!</a></li>
                    <li><a href="host-timeline">🤖 Host Timeline</a></li>
                    <li><a href="api/status">🔌 API Status</a></li>
                </ul>
            </div>
            
            <!-- Autentizace -->
            <div class="module">
                <h3>🔐 Autentizace & Bezpečnost</h3>
                <p>Přihlášení, správa session a bezpečnostní nastavení</p>
                <ul class="module-links">
                    <li><a href="login">🔑 Přihlášení</a></li>
                    <li><a href="logout">🚪 Odhlášení</a></li>
                </ul>
            </div>
        </div>
        
        <div class="footer">
            <p><strong>IVY4B3T</strong> - Facebook Automation System | Production Environment</p>
            <p>Developed with ❤️ for efficient social media management</p>
        </div>
    </div>
</body>
</html>