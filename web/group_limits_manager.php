<?php
/**
 * Název souboru: group_limits_manager.php
 * Umístění: ~/web/group_limits_manager.php
 *
 * Popis: PHP funkce pro správu limitů uživatelů na jednotlivé typy skupin.
 * Umožňuje načítání, úpravu a validaci limitů přes webové rozhraní.
 */

class GroupLimitsManager {
    private $db;

    public function __construct($database) {
        $this->db = $database;
    }

    /**
     * Získá všechny limity pro konkrétního uživatele
     */
    public function getUserLimits($user_id) {
        $sql = "SELECT group_type, max_posts, time_window_hours, updated
                FROM user_group_limits
                WHERE user_id = ?
                ORDER BY
                  CASE group_type
                    WHEN 'G' THEN 1
                    WHEN 'GV' THEN 2
                    WHEN 'P' THEN 3
                    WHEN 'Z' THEN 4
                  END";

        return $this->db->query($sql, [$user_id]);
    }

    /**
     * Aktualizuje limit pro konkrétní typ skupiny
     */
    public function updateUserLimit($user_id, $group_type, $max_posts, $time_window_hours) {
        // Validace vstupů
        if (!$this->validateGroupType($group_type)) {
            throw new InvalidArgumentException("Neplatný typ skupiny: $group_type");
        }

        if (!$this->validateLimits($max_posts, $time_window_hours)) {
            throw new InvalidArgumentException("Neplatné hodnoty limitů");
        }

        $sql = "INSERT INTO user_group_limits (user_id, group_type, max_posts, time_window_hours)
                VALUES (?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                  max_posts = VALUES(max_posts),
                  time_window_hours = VALUES(time_window_hours),
                  updated = CURRENT_TIMESTAMP";

        return $this->db->execute($sql, [$user_id, $group_type, $max_posts, $time_window_hours]);
    }

    /**
     * Získá statistiky využití limitů pro uživatele
     */
    public function getUserLimitStats($user_id) {
        $sql = "SELECT
                  ugl.group_type,
                  ugl.max_posts,
                  ugl.time_window_hours,
                  COALESCE(post_counts.current_posts, 0) as current_posts,
                  ROUND(COALESCE(post_counts.current_posts, 0) / ugl.max_posts * 100, 1) as usage_percent,
                  (ugl.max_posts - COALESCE(post_counts.current_posts, 0)) as remaining_posts
                FROM user_group_limits ugl
                LEFT JOIN (
                  SELECT
                    fg.typ as group_type,
                    COUNT(*) as current_posts
                  FROM action_log al
                  JOIN fb_groups fg ON al.reference_id = fg.id
                  JOIN user_group_limits ugl2 ON fg.typ = ugl2.group_type AND al.account_id = ugl2.user_id
                  WHERE al.account_id = ?
                    AND al.action_code LIKE 'share_post_%'
                    AND al.timestamp >= NOW() - INTERVAL ugl2.time_window_hours HOUR
                  GROUP BY fg.typ
                ) post_counts ON ugl.group_type = post_counts.group_type
                WHERE ugl.user_id = ?
                ORDER BY
                  CASE ugl.group_type
                    WHEN 'G' THEN 1
                    WHEN 'GV' THEN 2
                    WHEN 'P' THEN 3
                    WHEN 'Z' THEN 4
                  END";

        return $this->db->query($sql, [$user_id, $user_id]);
    }

    /**
     * Nastaví výchozí limity pro nového uživatele
     */
    public function setDefaultLimitsForUser($user_id) {
        $defaultLimits = [
            ['G', 15, 24],
            ['GV', 1, 8],
            ['P', 2, 8],
            ['Z', 1, 48]
        ];

        foreach ($defaultLimits as [$type, $posts, $hours]) {
            $this->updateUserLimit($user_id, $type, $posts, $hours);
        }

        return true;
    }

    /**
     * Hromadná aktualizace limitů pro více uživatelů
     */
    public function bulkUpdateLimits($user_ids, $group_type, $max_posts, $time_window_hours) {
        if (!$this->validateGroupType($group_type)) {
            throw new InvalidArgumentException("Neplatný typ skupiny");
        }

        if (!$this->validateLimits($max_posts, $time_window_hours)) {
            throw new InvalidArgumentException("Neplatné hodnoty limitů");
        }

        $placeholders = str_repeat('?,', count($user_ids) - 1) . '?';
        $params = array_merge($user_ids, [$group_type, $max_posts, $time_window_hours]);

        $sql = "UPDATE user_group_limits
                SET max_posts = ?, time_window_hours = ?, updated = CURRENT_TIMESTAMP
                WHERE user_id IN ($placeholders) AND group_type = ?";

        // Přeuspořádání parametrů pro správné pořadí
        $reorderedParams = [$max_posts, $time_window_hours];
        $reorderedParams = array_merge($reorderedParams, $user_ids, [$group_type]);

        return $this->db->execute($sql, $reorderedParams);
    }

    /**
     * Získá přehled všech uživatelů a jejich limitů
     */
    public function getAllUsersLimitsOverview() {
        $sql = "SELECT
                  u.id,
                  u.name,
                  u.surname,
                  u.host,
                  GROUP_CONCAT(
                    CONCAT(ugl.group_type, ':', ugl.max_posts, '/', ugl.time_window_hours, 'h')
                    ORDER BY
                      CASE ugl.group_type
                        WHEN 'G' THEN 1
                        WHEN 'GV' THEN 2
                        WHEN 'P' THEN 3
                        WHEN 'Z' THEN 4
                      END
                    SEPARATOR ' | '
                  ) as limits_summary
                FROM fb_users u
                LEFT JOIN user_group_limits ugl ON u.id = ugl.user_id
                GROUP BY u.id, u.name, u.surname, u.host
                ORDER BY u.id";

        return $this->db->query($sql);
    }

    /**
     * Validuje typ skupiny
     */
    private function validateGroupType($group_type) {
        return in_array($group_type, ['G', 'GV', 'P', 'Z']);
    }

    /**
     * Validuje hodnoty limitů
     */
    private function validateLimits($max_posts, $time_window_hours) {
        return (
            is_numeric($max_posts) &&
            $max_posts > 0 &&
            $max_posts <= 999 &&
            is_numeric($time_window_hours) &&
            $time_window_hours > 0 &&
            $time_window_hours <= 168 // max týden
        );
    }

    /**
     * Získá typ skupiny podle jejího názvu/popisku
     */
    public function getGroupTypeLabels() {
        return [
            'G' => 'Běžné skupiny',
            'GV' => 'Vlastní skupiny',
            'P' => 'Prodejní skupiny',
            'Z' => 'Zájmové skupiny'
        ];
    }
}

// Příklad použití:
/*
$db = new DatabaseConnection();
$manager = new GroupLimitsManager($db);

// Získání limitů uživatele
$limits = $manager->getUserLimits(85);

// Aktualizace limitu
$manager->updateUserLimit(85, 'G', 20, 24);

// Statistiky využití
$stats = $manager->getUserLimitStats(85);

// Hromadná aktualizace
$manager->bulkUpdateLimits([85, 86, 87], 'P', 3, 8);
*/
