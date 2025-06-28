-- ~/ivy/sql/iv_user.sql
-- Výběr uživatele s kontrolou dostupných akcí
-- Účel: Vybere pouze uživatele, kteří mají alespoň jednu dostupnou akci

-- POZN: Stejnou logiku je nutné aplikovat i v iv_sql_queries.js
-- pro dotaz "user" aby byla zachována konzistence

SELECT u.*
FROM fb_users AS u
WHERE
    u.host LIKE ?
    AND u.locked IS NULL -- Vyloučí všechny zablokované účty
    AND COALESCE(u.next_worktime, NOW()) <= NOW()
    AND EXISTS (
        -- Zkontroluj, zda má uživatel alespoň jednu dostupnou akci
        SELECT 1
        FROM action_definitions ad
        JOIN user_action_plan uap ON ad.action_code = uap.action_code
        WHERE uap.user_id = u.id
          AND (uap.next_time IS NULL OR uap.next_time <= NOW())
          AND ad.active = 1
          AND NOT (
            -- Vyloučí account_sleep/account_delay pokud existují jiné akce
            ad.action_code IN ('account_sleep','account_delay')
            AND EXISTS (
              SELECT 1
              FROM user_action_plan uap2
              JOIN action_definitions ad2 ON uap2.action_code = ad2.action_code
              WHERE uap2.user_id = u.id
                AND uap2.action_code NOT IN ('account_sleep','account_delay')
                AND (uap2.next_time IS NULL OR uap2.next_time <= NOW())
                AND ad2.active = 1
            )
          )
    )
ORDER BY
    COALESCE(u.next_worktime, NOW() - INTERVAL 2 DAY) ASC
LIMIT 1
