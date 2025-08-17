<?php
/**
 * Název souboru: TokenMonitor.php
 * Umístění: ~/web/app/helpers/TokenMonitor.php
 *
 * Popis: Helper třída pro monitoring expiraci GitHub PAT tokenu
 * - Kontroluje datum expiraci z databáze
 * - Generuje upozornění 30 dní a 7 dní před expirací
 * - Poskytuje HTML alerty pro zobrazení na stránkách
 */

if (!defined('IVY_FRAMEWORK')) {
    die('Direct access not allowed');
}

class TokenMonitor
{
    private $pdo;
    
    public function __construct($database = null)
    {
        // Pokud dostaneme database objekt, použijeme jeho PDO
        if ($database && method_exists($database, 'getPDO')) {
            $this->pdo = $database->getPDO();
        } else {
            // Fallback - přímé připojení k databázi
            $this->initDirectConnection();
        }
    }
    
    /**
     * Inicializuje přímé připojení k databázi
     */
    private function initDirectConnection()
    {
        try {
            $host = getenv('MYSQL_HOST') ?: 'localhost';
            $port = getenv('MYSQL_PORT') ?: '3306';
            $dbname = getenv('MYSQL_DATABASE') ?: 'ivy';
            $username = getenv('MYSQL_USER') ?: 'root';
            $password = getenv('MYSQL_PASSWORD') ?: '';
            
            $dsn = "mysql:host={$host};port={$port};dbname={$dbname};charset=utf8mb4";
            $this->pdo = new PDO($dsn, $username, $password, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
            ]);
        } catch (PDOException $e) {
            error_log("[TokenMonitor] Database connection failed: " . $e->getMessage());
            $this->pdo = null;
        }
    }
    
    /**
     * Získá informace o stavu GitHub PAT tokenu
     * @return array|null Array s informacemi o tokenu nebo null při chybě
     */
    public function getTokenStatus()
    {
        try {
            if (!$this->pdo) {
                return null;
            }
            
            // Načti datum expiraci z databáze
            $stmt = $this->pdo->prepare("SELECT value FROM variables WHERE name = 'github_pat_expires'");
            $stmt->execute();
            $result = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$result || !$result['value']) {
                return null;
            }
            
            $expiresDate = new DateTime($result['value']);
            $now = new DateTime();
            $interval = $now->diff($expiresDate);
            
            // Vypočítej počet dní do expiraci
            $daysUntilExpiry = $interval->invert ? -$interval->days : $interval->days;
            
            return [
                'expires_date' => $expiresDate,
                'expires_formatted' => $expiresDate->format('d.m.Y'),
                'days_until_expiry' => $daysUntilExpiry,
                'is_expired' => $daysUntilExpiry < 0,
                'is_critical' => $daysUntilExpiry <= 7 && $daysUntilExpiry >= 0,
                'is_warning' => $daysUntilExpiry <= 30 && $daysUntilExpiry > 7,
                'is_ok' => $daysUntilExpiry > 30
            ];
            
        } catch (Exception $e) {
            error_log("[TokenMonitor] Chyba při kontrole tokenu: " . $e->getMessage());
            return null;
        }
    }
    
    /**
     * Generuje HTML alert pro zobrazení na stránce
     * @return string HTML kód alertu nebo prázdný string
     */
    public function generateAlert()
    {
        $status = $this->getTokenStatus();
        
        if (!$status) {
            return '';
        }
        
        // Není potřeba alert
        if ($status['is_ok']) {
            return '';
        }
        
        $html = '';
        
        if ($status['is_expired']) {
            // Token už vypršel - kritická chyba
            $html = '<div class="token-alert critical-expired">
                <h3>🚨 KRITICKÁ CHYBA: GitHub Token Vypršel!</h3>
                <p>GitHub Personal Access Token vypršel ' . abs($status['days_until_expiry']) . ' dní nazpět (' . $status['expires_formatted'] . ').</p>
                <p><strong>Git operace nebudou fungovat!</strong> Nutné okamžitě obnovit token.</p>
            </div>';
            
        } elseif ($status['is_critical']) {
            // Posledních 7 dní - velké červené varování
            $html = '<div class="token-alert critical">
                <h3>🚨 URGENTNÍ: GitHub Token Vyprší Za ' . $status['days_until_expiry'] . ' Dní!</h3>
                <p>GitHub Personal Access Token vyprší <strong>' . $status['expires_formatted'] . '</strong>.</p>
                <p><strong>Akce požadována do ' . $status['days_until_expiry'] . ' dní!</strong> Jinak přestane fungovat Git a deployment.</p>
                <p><a href="https://github.com/settings/tokens" target="_blank">→ Obnovit token na GitHub.com</a></p>
            </div>';
            
        } elseif ($status['is_warning']) {
            // 30 dní před expirací - malé červené varování  
            $html = '<div class="token-alert warning">
                <h4>⚠️ GitHub Token Vyprší Za ' . $status['days_until_expiry'] . ' Dní</h4>
                <p>GitHub Personal Access Token vyprší ' . $status['expires_formatted'] . '. Doporučuje se obnovit v blízké době.</p>
                <p><a href="https://github.com/settings/tokens" target="_blank">→ Obnovit token</a></p>
            </div>';
        }
        
        return $html;
    }
    
    /**
     * Generuje CSS styly pro alerty
     * @return string CSS kód
     */
    public function getAlertStyles()
    {
        return '
        <style>
        .token-alert {
            margin: 15px 0;
            padding: 15px;
            border-radius: 8px;
            border-left: 6px solid;
            font-family: Arial, sans-serif;
        }
        
        .token-alert.warning {
            background-color: #fff3cd;
            border-color: #ffc107;
            color: #856404;
            font-size: 14px;
        }
        
        .token-alert.warning h4 {
            margin: 0 0 8px 0;
            font-size: 16px;
        }
        
        .token-alert.critical {
            background-color: #f8d7da;
            border-color: #dc3545;
            color: #721c24;
            font-size: 16px;
            box-shadow: 0 4px 12px rgba(220, 53, 69, 0.3);
        }
        
        .token-alert.critical h3 {
            margin: 0 0 10px 0;
            font-size: 20px;
        }
        
        .token-alert.critical-expired {
            background-color: #ff6b6b;
            border-color: #ff0000;
            color: white;
            font-size: 16px;
            box-shadow: 0 4px 12px rgba(255, 0, 0, 0.4);
            animation: pulse 2s infinite;
        }
        
        .token-alert.critical-expired h3 {
            margin: 0 0 10px 0;
            font-size: 22px;
        }
        
        .token-alert a {
            color: inherit;
            text-decoration: underline;
            font-weight: bold;
        }
        
        .token-alert p {
            margin: 8px 0;
        }
        
        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.8; }
            100% { opacity: 1; }
        }
        </style>';
    }
    
    /**
     * Kompletní output s CSS a alertem
     * @return string Kompletní HTML s CSS a alertem
     */
    public function getCompleteAlert()
    {
        $alert = $this->generateAlert();
        
        if (empty($alert)) {
            return '';
        }
        
        return $this->getAlertStyles() . $alert;
    }
}