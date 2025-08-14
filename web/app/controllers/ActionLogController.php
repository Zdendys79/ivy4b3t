<?php

class ActionLogController extends BaseController
{
    /**
     * Přehled akcí podle dnů
     */
    public function dailyOverview()
    {
        try {
            $pdo = $this->db->getPdo();
            
            // Denní přehled akcí s počty účtů
            $query = "
                SELECT 
                    DATE(timestamp) as action_date,
                    action_code,
                    COUNT(*) as action_count,
                    COUNT(DISTINCT account_id) as unique_accounts
                FROM action_log 
                WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                GROUP BY DATE(timestamp), action_code
                ORDER BY action_date DESC, action_code ASC
            ";
            
            $stmt = $pdo->prepare($query);
            $stmt->execute();
            $daily_actions = $stmt->fetchAll();
            
            // Seskupení podle dnů
            $grouped_data = [];
            foreach ($daily_actions as $row) {
                $date = $row['action_date'];
                if (!isset($grouped_data[$date])) {
                    $grouped_data[$date] = [];
                }
                $grouped_data[$date][] = $row;
            }
            
            // Pro akce s méně než 6 účty získat detaily účtů
            $action_details = [];
            foreach ($daily_actions as $row) {
                if ($row['unique_accounts'] < 6) {
                    $detail_query = "
                        SELECT DISTINCT al.account_id, u.surname 
                        FROM action_log al
                        LEFT JOIN fb_users u ON al.account_id = u.id
                        WHERE DATE(al.timestamp) = ? AND al.action_code = ?
                        ORDER BY al.account_id
                    ";
                    
                    $stmt = $pdo->prepare($detail_query);
                    $stmt->execute([$row['action_date'], $row['action_code']]);
                    $accounts = $stmt->fetchAll();
                    
                    $key = $row['action_date'] . '_' . $row['action_code'];
                    $action_details[$key] = $accounts;
                }
            }
            
            $this->render_partial('system/action-log-overview', [
                'title' => 'Přehled akcí podle dnů',
                'grouped_data' => $grouped_data,
                'action_details' => $action_details
            ]);
            
        } catch (Exception $e) {
            $this->render_partial('system/action-log-overview', [
                'title' => 'Přehled akcí podle dnů',
                'error' => 'Chyba při načítání dat: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * Detail konkrétní akce pro daný den
     */
    public function actionDetail()
    {
        $date = $_GET['date'] ?? null;
        $action_code = $_GET['action'] ?? null;
        
        if (!$date || !$action_code) {
            http_response_code(400);
            echo "Missing date or action parameter";
            return;
        }

        try {
            $pdo = $this->db->getPdo();
            
            switch ($action_code) {
                case 'post_utio_g':
                case 'post_utio_gv':
                    $this->handlePostDetails($pdo, $date, $action_code);
                    break;
                    
                case 'group_explore':
                    $this->handleGroupExploreDetails($pdo, $date);
                    break;
                    
                case 'account_delay':
                    $this->handleAccountDelayDetails($pdo, $date);
                    break;
                    
                case 'account_sleep':
                    $this->handleAccountSleepDetails($pdo, $date);
                    break;
                    
                case 'news_post':
                    $this->handleNewsPostDetails($pdo, $date);
                    break;
                    
                case 'quote_post':
                    $this->handleQuotePostDetails($pdo, $date);
                    break;
                    
                default:
                    http_response_code(404);
                    echo "Unknown action type: " . htmlspecialchars($action_code);
                    return;
            }
            
        } catch (Exception $e) {
            http_response_code(500);
            echo "Error: " . htmlspecialchars($e->getMessage());
        }
    }

    private function handlePostDetails($pdo, $date, $action_code)
    {
        $query = "
            SELECT al.*, u.surname, u.name, g.fb_id as group_fb_id
            FROM action_log al
            LEFT JOIN fb_users u ON al.account_id = u.id
            LEFT JOIN fb_groups g ON al.reference_id = g.id
            WHERE DATE(al.timestamp) = ? AND al.action_code = ?
            ORDER BY al.timestamp DESC
        ";
        
        $stmt = $pdo->prepare($query);
        $stmt->execute([$date, $action_code]);
        $actions = $stmt->fetchAll();
        
        $this->render_partial('action-log/post-details', [
            'title' => "Detail: " . strtoupper($action_code) . " (" . date('j.n.Y', strtotime($date)) . ")",
            'actions' => $actions,
            'action_type' => $action_code,
            'date' => $date
        ]);
    }

    private function handleGroupExploreDetails($pdo, $date)
    {
        $query = "
            SELECT al.*, u.surname, u.name, g.fb_id as group_fb_id
            FROM action_log al
            LEFT JOIN fb_users u ON al.account_id = u.id
            LEFT JOIN fb_groups g ON al.reference_id = g.id
            WHERE DATE(al.timestamp) = ? AND al.action_code = 'group_explore'
            ORDER BY al.timestamp DESC
        ";
        
        $stmt = $pdo->prepare($query);
        $stmt->execute([$date]);
        $actions = $stmt->fetchAll();
        
        $this->render_partial('action-log/group-explore-details', [
            'title' => "Detail: Průzkum skupin (" . date('j.n.Y', strtotime($date)) . ")",
            'actions' => $actions,
            'date' => $date
        ]);
    }

    private function handleAccountDelayDetails($pdo, $date)
    {
        $query = "
            SELECT al.*, u.surname, u.name, u.host
            FROM action_log al
            LEFT JOIN fb_users u ON al.account_id = u.id
            WHERE DATE(al.timestamp) = ? AND al.action_code = 'account_delay'
            ORDER BY u.host, u.surname, al.timestamp ASC
        ";
        
        $stmt = $pdo->prepare($query);
        $stmt->execute([$date]);
        $actions = $stmt->fetchAll();
        
        $this->render_partial('action-log/account-delay-details', [
            'title' => "Detail: Uspávání účtů (" . date('j.n.Y', strtotime($date)) . ")",
            'actions' => $actions,
            'date' => $date
        ]);
    }

    private function handleAccountSleepDetails($pdo, $date)
    {
        $query = "
            SELECT al.*, u.surname, u.name
            FROM action_log al
            LEFT JOIN fb_users u ON al.account_id = u.id
            WHERE DATE(al.timestamp) = ? AND al.action_code = 'account_sleep'
            ORDER BY al.timestamp DESC
        ";
        
        $stmt = $pdo->prepare($query);
        $stmt->execute([$date]);
        $actions = $stmt->fetchAll();
        
        $this->render_partial('action-log/account-sleep-details', [
            'title' => "Detail: Spící účty (" . date('j.n.Y', strtotime($date)) . ")",
            'actions' => $actions,
            'date' => $date
        ]);
    }

    private function handleNewsPostDetails($pdo, $date)
    {
        $query = "
            SELECT al.*, u.surname, u.name, ru.url, ru.title as rss_title
            FROM action_log al
            LEFT JOIN fb_users u ON al.account_id = u.id
            LEFT JOIN rss_urls ru ON CAST(al.text AS UNSIGNED) = ru.id
            WHERE DATE(al.timestamp) = ? AND al.action_code = 'news_post'
            ORDER BY al.timestamp DESC
        ";
        
        $stmt = $pdo->prepare($query);
        $stmt->execute([$date]);
        $actions = $stmt->fetchAll();
        
        $this->render_partial('action-log/news-post-details', [
            'title' => "Detail: RSS příspěvky (" . date('j.n.Y', strtotime($date)) . ")",
            'actions' => $actions,
            'date' => $date
        ]);
    }

    private function handleQuotePostDetails($pdo, $date)
    {
        $query = "
            SELECT al.*, u.surname, u.name, 
                   COALESCE(q.translated_text, q.original_text) as quote_text, 
                   q.author
            FROM action_log al
            LEFT JOIN fb_users u ON al.account_id = u.id
            LEFT JOIN quotes q ON CAST(al.text AS UNSIGNED) = q.id
            WHERE DATE(al.timestamp) = ? AND al.action_code = 'quote_post'
            ORDER BY al.timestamp DESC
        ";
        
        $stmt = $pdo->prepare($query);
        $stmt->execute([$date]);
        $actions = $stmt->fetchAll();
        
        $this->render_partial('action-log/quote-post-details', [
            'title' => "Detail: Citáty (" . date('j.n.Y', strtotime($date)) . ")",
            'actions' => $actions,
            'date' => $date
        ]);
    }

    /**
     * Přehled akcí konkrétního uživatele
     */
    public function userActions()
    {
        $user_id = $_GET['user_id'] ?? null;
        
        if (!$user_id) {
            http_response_code(400);
            echo "Missing user_id parameter";
            return;
        }

        try {
            $pdo = $this->db->getPdo();
            
            // Získání základních informací o uživateli
            $user_query = "
                SELECT id, surname, name, e_mail, host
                FROM fb_users 
                WHERE id = ?
            ";
            
            $stmt = $pdo->prepare($user_query);
            $stmt->execute([$user_id]);
            $user_info = $stmt->fetch();
            
            if (!$user_info) {
                http_response_code(404);
                echo "Uživatel s ID {$user_id} nebyl nalezen";
                return;
            }
            
            // Získání posledních akcí uživatele (24h nebo 25 nejnovějších)
            $actions_query = "
                SELECT al.*, 
                       g.name as group_name, g.fb_id as group_fb_id,
                       ru.title as rss_title, ru.url as rss_url,
                       COALESCE(q.translated_text, q.original_text) as quote_text, 
                       q.author as quote_author
                FROM action_log al
                LEFT JOIN fb_groups g ON al.reference_id = g.id
                LEFT JOIN rss_urls ru ON CAST(al.text AS UNSIGNED) = ru.id
                LEFT JOIN quotes q ON CAST(al.reference_id AS UNSIGNED) = q.id
                WHERE al.account_id = ? 
                ORDER BY al.timestamp DESC
                LIMIT 50
            ";
            
            $stmt = $pdo->prepare($actions_query);
            $stmt->execute([$user_id]);
            $actions = $stmt->fetchAll();
            
            $this->render_partial('action-log/user-actions', [
                'title' => "Akce uživatele: " . ($user_info['surname'] ?? $user_info['name'] ?? 'ID' . $user_id),
                'user_info' => $user_info,
                'actions' => $actions,
                'user_id' => $user_id
            ]);
            
        } catch (Exception $e) {
            http_response_code(500);
            echo "Error: " . htmlspecialchars($e->getMessage());
        }
    }
}