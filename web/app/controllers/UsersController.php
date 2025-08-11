<?php

class UsersController extends BaseController
{
    /**
     * Správa uživatelů - přehled zablokovaných
     */
    public function management()
    {
        // Zpracování AJAX požadavků
        if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action'])) {
            $this->handleAjaxRequest();
            return;
        }
        
        try {
            $pdo = $this->db->getPdo();
            
            // Získat počet uživatelů
            $stmt = $pdo->query("SELECT COUNT(*) as count FROM fb_users");
            $usersCount = $stmt->fetch()['count'];
            
            // Získat uživatele seskupené podle hostname s informací o zamčení a odpočinku
            $stmt = $pdo->query("
                SELECT host, COUNT(*) as user_count, 
                       GROUP_CONCAT(
                           CONCAT(
                               id, ':', 
                               REPLACE(REPLACE(CONCAT(name, ' ', surname), ':', ''), '|', ''), ':', 
                               IFNULL(locked, 0), ':',
                               -- Odpočinek info
                               CASE
                                   -- Pokud má aktivní sleep nebo delay (v budoucnosti)
                                   WHEN sleep_delay.next_time > NOW() THEN 
                                       CONCAT('active:', TIMESTAMPDIFF(SECOND, NOW(), sleep_delay.next_time))
                                   -- Pokud má sleep/delay akce v minulosti = ve frontě
                                   WHEN sleep_delay.next_time IS NOT NULL AND sleep_delay.next_time <= NOW() THEN 
                                       'queue'
                                   -- Pokud nemá žádné sleep/delay akce
                                   WHEN sleep_delay.next_time IS NULL THEN 
                                       'none'
                                   ELSE 'none'
                               END
                           )
                           ORDER BY 
                               -- Řadit podle odpočinku: vypršelé -> ve frontě -> bez nastavení -> nejdéle odpočívající
                               CASE
                                   WHEN sleep_delay.next_time IS NULL THEN 1                           -- nenastaveno
                                   WHEN sleep_delay.next_time <= NOW() THEN 2                         -- ve frontě
                                   WHEN sleep_delay.next_time > NOW() THEN 3 + TIMESTAMPDIFF(SECOND, NOW(), sleep_delay.next_time)  -- aktivní (podle zbývajícího času)
                                   ELSE 4
                               END
                           SEPARATOR '|'
                       ) as users_list
                FROM fb_users 
                LEFT JOIN (
                    SELECT user_id, MAX(next_time) as next_time
                    FROM user_action_plan 
                    WHERE action_code IN ('account_sleep', 'account_delay')
                    GROUP BY user_id
                ) sleep_delay ON fb_users.id = sleep_delay.user_id
                GROUP BY host 
                ORDER BY host
            ");
            $hosts = $stmt->fetchAll();
            
            // Rozložit uživatele pro každý host
            $hosts_data = [];
            foreach ($hosts as $host) {
                $users_array = [];
                if (!empty($host['users_list'])) {
                    $users_parts = explode('|', $host['users_list']);
                    foreach ($users_parts as $user_part) {
                        $parts = explode(':', $user_part);
                        if (count($parts) >= 3) {
                            $id = $parts[0];
                            $name_surname = $parts[1];
                            $locked = $parts[2] !== '0' && !empty($parts[2]);
                            $rest_info = $parts[3];
                            
                            // Parse rest info
                            $rest_display = 'nenastaveno';
                            $sort_priority = 1; // nenastaveno = nejdříve
                            
                            if (strpos($rest_info, 'active:') === 0) {
                                $seconds = (int)substr($rest_info, 7);
                                if ($seconds > 0) {
                                    $hours = floor($seconds / 3600);
                                    $minutes = floor(($seconds % 3600) / 60);
                                    $secs = $seconds % 60;
                                    
                                    if ($hours > 0) {
                                        $rest_display = "{$hours}h {$minutes}m {$secs}s";
                                    } elseif ($minutes > 0) {
                                        $rest_display = "{$minutes}m {$secs}s";
                                    } else {
                                        $rest_display = "{$secs}s";
                                    }
                                    $sort_priority = 3 + $seconds; // aktivní podle zbývajícího času
                                } else {
                                    $rest_display = 've frontě';
                                    $sort_priority = 2; // ve frontě = druhé
                                }
                            } elseif ($rest_info === 'queue') {
                                $rest_display = 've frontě';
                                $sort_priority = 2; // ve frontě = druhé
                            }
                            
                            $users_array[] = [
                                'id' => $id,
                                'name_surname' => $name_surname,
                                'host' => $host['host'],
                                'locked' => $locked,
                                'rest_display' => $rest_display,
                                'sort_priority' => $sort_priority
                            ];
                        }
                    }
                }
                
                // Seřadit uživatele podle odpočinku - nejdříve vypršelé/nenastavené, pak ve frontě, pak aktivní
                usort($users_array, function($a, $b) {
                    return $a['sort_priority'] <=> $b['sort_priority'];
                });
                
                $hosts_data[] = [
                    'host' => $host['host'],
                    'user_count' => $host['user_count'],
                    'users' => $users_array
                ];
            }
            
            $this->render_partial('users/management', [
                'title' => 'Správa uživatelů',
                'users_count' => $usersCount,
                'hosts_data' => $hosts_data
            ]);
            
        } catch (Exception $e) {
            $this->render_partial('users/management', [
                'title' => 'Správa uživatelů',
                'error' => 'Chyba při načítání dat: ' . $e->getMessage(),
                'users_count' => 0,
                'users' => []
            ]);
        }
    }
    
    /**
     * Správa skupinových limitů
     */
    public function groupLimits()
    {
        try {
            $pdo = $this->db->getPdo();
            
            // Pro testování - jednoduché demo data
            $limits = [
                ['group_name' => 'Test Group 1', 'daily_limit' => 50, 'weekly_limit' => 300],
                ['group_name' => 'Test Group 2', 'daily_limit' => 100, 'weekly_limit' => 600]
            ];
            
            $this->render_partial('users/group-limits', [
                'title' => 'Skupinové limity',
                'limits' => $limits
            ]);
            
        } catch (Exception $e) {
            $this->render_partial('users/group-limits', [
                'title' => 'Skupinové limity',
                'error' => 'Chyba při načítání dat: ' . $e->getMessage(),
                'limits' => []
            ]);
        }
    }
    
    /**
     * AJAX handler pro UI příkazy
     */
    private function handleAjaxRequest()
    {
        header('Content-Type: application/json');
        
        try {
            $db = new Database();
            $pdo = $db->getPdo();
            
            switch ($_POST['action']) {
                case 'login_user':
                    $userId = intval($_POST['user_id']);
                    $host = $_POST['host'];
                    $data = json_encode(['user_id' => $userId]);
                    
                    // Vložit UI příkaz pro přihlášení uživatele
                    $stmt = $pdo->prepare("
                        INSERT INTO ui_commands (host, command, data, created) 
                        VALUES (?, 'call_user', ?, NOW())
                    ");
                    
                    $result = $stmt->execute([$host, $data]);
                    
                    if ($result) {
                        echo json_encode(['success' => true, 'message' => 'UI příkaz byl zařazen']);
                    } else {
                        echo json_encode(['success' => false, 'message' => 'Chyba při vkládání příkazu']);
                    }
                    break;
                    
                case 'get_ui_status':
                    $userId = intval($_POST['user_id']);
                    
                    // Získat status UI příkazu pro daného uživatele
                    $stmt = $pdo->prepare("
                        SELECT id, accepted, fulfilled, created,
                               CASE 
                                   WHEN fulfilled IS NOT NULL THEN 'completed'
                                   WHEN accepted IS NOT NULL THEN 'in_progress' 
                                   ELSE 'pending'
                               END as status
                        FROM ui_commands 
                        WHERE JSON_EXTRACT(data, '$.user_id') = ?
                        ORDER BY created DESC 
                        LIMIT 1
                    ");
                    
                    $stmt->execute([$userId]);
                    $status = $stmt->fetch();
                    echo json_encode(['success' => true, 'status' => $status]);
                    break;
                    
                default:
                    echo json_encode(['success' => false, 'message' => 'Neznámá akce']);
            }
            
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
        
        exit;
    }
}