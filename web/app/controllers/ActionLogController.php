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
}