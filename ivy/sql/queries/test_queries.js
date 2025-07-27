/**
 * Název souboru: test_queries.js
 * Umístění: ~/ivy/sql/queries/test_queries.js
 *
 * Popis: SQL dotazy pro testování jednotlivých akcí wheel of fortune
 */

export const TEST_QUERIES = {
  // Získá uživatele pro testování konkrétní akce
  // Priorita: 1) Nikdy nepoužil akci na tomto hostname, 2) Nejstarší použití akce
  getUserForActionTest: `
    SELECT u.*, 
           COALESCE(al.last_used, '1970-01-01') as last_action_time,
           CASE WHEN al.last_used IS NULL THEN 1 ELSE 0 END as never_used
    FROM users u
    LEFT JOIN (
      SELECT user_id, MAX(created_at) as last_used
      FROM action_log 
      WHERE action_code = ? 
        AND hostname = ?
      GROUP BY user_id
    ) al ON u.id = al.user_id
    WHERE u.active = 1
      AND u.work_until > NOW()
      AND (u.hostname = ? OR u.hostname IS NULL)
    ORDER BY never_used DESC, last_action_time ASC
    LIMIT 1
  `,

  // Získá hostname ze systémových proměnných
  getCurrentHostname: `
    SELECT value as hostname 
    FROM variables 
    WHERE name = 'current_hostname'
  `,

  // Zalogu test akci
  logTestAction: `
    INSERT INTO action_log (user_id, action_code, reference_id, note, hostname, created_at)
    VALUES (?, ?, ?, ?, ?, NOW())
  `,

  // Získá statistiky testů pro akci
  getActionTestStats: `
    SELECT 
      action_code,
      COUNT(*) as total_tests,
      COUNT(DISTINCT user_id) as unique_users,
      MAX(created_at) as last_test,
      AVG(CASE WHEN note LIKE '%SUCCESS%' THEN 1 ELSE 0 END) as success_rate
    FROM action_log 
    WHERE action_code = ?
      AND note LIKE 'TEST:%'
      AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
  `,

  // Získá dostupné uživatele pro testing
  getAvailableTestUsers: `
    SELECT 
      u.id,
      u.name,
      u.surname, 
      u.hostname,
      u.work_until,
      COUNT(al.id) as recent_actions
    FROM users u
    LEFT JOIN action_log al ON u.id = al.user_id 
      AND al.created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
    WHERE u.active = 1
      AND u.work_until > NOW()
    GROUP BY u.id
    HAVING recent_actions < 3  -- Max 3 akce za hodinu pro testování
    ORDER BY recent_actions ASC, u.last_activity ASC
    LIMIT 10
  `
};