<?php

class SystemController extends BaseController
{
    /**
     * Zobrazení systémového stromu (scheme)
     */
    public function scheme()
    {
        try {
            // Demo tree struktura
            $tree_lines = [
                '🏠 IVY4B3T Facebook Automation System',
                '├── 📁 Web Interface (/web/)',
                '│   ├── 🏠 index.php - Main router',
                '│   ├── 📁 app/',
                '│   │   ├── 📁 controllers/',
                '│   │   ├── 📁 views/',
                '│   │   └── 📁 core/',
                '│   └── 📁 public/',
                '├── 📁 Core System (/ivy/)',
                '│   ├── 🤖 ivy.js - Main bot engine',
                '│   ├── 📁 modules/',
                '│   └── 📁 config/',
                '└── 🗄️ Database',
                '    ├── 👥 users table',
                '    ├── ⚙️ variables table',
                '    └── 📊 heartbeat table'
            ];
            
            $this->render_partial('system/scheme', [
                'title' => 'Systémový strom',
                'tree_lines' => $tree_lines
            ]);
            
        } catch (Exception $e) {
            $this->render_partial('system/scheme', [
                'title' => 'Systémový strom',
                'error' => 'Chyba při načítání dat: ' . $e->getMessage()
            ]);
        }
    }
    
    /**
     * Testování databázového připojení
     */
    public function testDb()
    {
        $results = [];
        
        // Test 1: PDO připojení
        try {
            $results['pdo_test'] = [
                'status' => 'success', 
                'message' => 'Připojení úspěšné!'
            ];
            
            // Získat info o DB pomocí Database třídy
            $pdo = $this->db->getPdo();
            $info = $pdo->query("SELECT DATABASE() as db_name, USER() as user_info")->fetch();
            $results['db_info'] = $info;
            
            // Počet tabulek
            $tables = $pdo->query("SHOW TABLES")->fetchAll(PDO::FETCH_COLUMN);
            $results['tables_count'] = count($tables);
            $results['tables'] = $tables;
            
        } catch (Exception $e) {
            $results['pdo_test'] = [
                'status' => 'error',
                'message' => $e->getMessage()
            ];
        }
        
        // Test 2: Environment variables
        $env_vars = ['MYSQL_HOST', 'MYSQL_DATABASE', 'MYSQL_USER', 'MYSQL_PASSWORD'];
        $results['env_vars'] = [];
        foreach ($env_vars as $var) {
            $value = getenv($var);
            $results['env_vars'][$var] = $value ? ($var === 'MYSQL_PASSWORD' ? '[NASTAVENO]' : $value) : '[NENALEZENO]';
        }
        
        // Test 3: Ukázkové tabulky
        $results['table_samples'] = [];
        if (isset($pdo)) {
            $sample_tables = array_slice($tables, 0, 5); // První 5 tabulek
            foreach ($sample_tables as $table) {
                try {
                    $stmt = $pdo->query("SELECT COUNT(*) as cnt FROM `$table`");
                    $count = $stmt->fetch()['cnt'];
                    $results['table_samples'][$table] = $count . ' záznamů';
                } catch (PDOException $e) {
                    $results['table_samples'][$table] = 'Chyba čtení';
                }
            }
        }
        
        $this->render_partial('system/test-db', [
            'page_title' => 'Test databázového připojení',
            'title' => 'Test databázového připojení',
            'results' => $results
        ]);
    }
    
    /**
     * Generování ASCII stromu
     */
    private function generateTree($items, &$lines, $parentId = null, $prefix = '', $isLast = true)
    {
        // Najít kořenové prvky (délka 6 znaků)
        if ($parentId === null) {
            foreach ($items as $id => $item) {
                if (strlen($id) == 6 && in_array($item['type'], ['osoba', 'MLM', 'systém', 'server', 'database', 'web'])) {
                    $this->printTreeNode($id, $items, '', true, $lines);
                }
            }
            return;
        }
        
        $this->printTreeNode($parentId, $items, $prefix, $isLast, $lines);
    }
    
    private function printTreeNode($id, $items, $prefix = '', $isLast = true, &$lines = [])
    {
        if (!isset($items[$id])) return;
        
        $linePrefix = $prefix;
        if ($prefix !== '') {
            $linePrefix .= $isLast ? '└─ ' : '├─ ';
        }
        
        $label = $items[$id]['name'] . ' [' . $items[$id]['type'] . ']';
        if (!empty($items[$id]['description'])) {
            $label .= ' – ' . $items[$id]['description'];
        }
        $lines[] = $linePrefix . $label;
        
        // Najít podřízené položky
        $children = [];
        foreach ($items as $childId => $item) {
            if (strlen($childId) == strlen($id) + 1 && strpos($childId, $id) === 0) {
                $children[] = $childId;
            }
        }
        
        $count = count($children);
        foreach ($children as $i => $childId) {
            $newPrefix = $prefix . ($isLast ? '    ' : '│   ');
            $this->printTreeNode($childId, $items, $newPrefix, $i === $count - 1, $lines);
        }
    }
    
    /**
     * API Status endpoint
     */
    public function apiStatus()
    {
        $status = [
            'status' => 'online',
            'timestamp' => date('Y-m-d H:i:s'),
            'database' => 'connected',
            'version' => 'unknown'
        ];
        
        try {
            $pdo = $this->db->getPdo();
            $stmt = $pdo->query("SELECT value FROM variables WHERE name = 'version'");
            $version = $stmt->fetchColumn();
            if ($version) {
                $status['version'] = $version;
            }
        } catch (Exception $e) {
            $status['database'] = 'error';
            $status['error'] = $e->getMessage();
        }
        
        header('Content-Type: application/json');
        echo json_encode($status);
    }
}