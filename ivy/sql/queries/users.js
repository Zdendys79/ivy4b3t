/**
 * Název souboru: users.js
 * Umístění: ~/ivy/sql/queries/users.js
 *
 * Popis: SQL dotazy pro správu uživatelů (fb_users)
 * Obsahuje CRUD operace, výběr podle stavu, aktualizace
 */

export const USERS = {
  // ===== ZÁKLADNÍ CRUD OPERACE =====

  getById: `
    SELECT * FROM fb_users
    WHERE id = ?
  `,

  getByHostname: `
    SELECT * FROM fb_users
    WHERE host = ?
    ORDER BY id ASC
  `,

  getAll: `
    SELECT * FROM fb_users
    ORDER BY id
  `,

  // ===== VÝBĚR PODLE STAVU =====

  getActive: `
    SELECT * FROM fb_users
    WHERE locked IS NULL
    ORDER BY id
  `,

  getLocked: `
    SELECT * FROM fb_users
    WHERE locked IS NOT NULL
    ORDER BY locked DESC
  `,

  getReady: `
    SELECT * FROM fb_users
    WHERE locked IS NULL
      AND COALESCE(next_worktime, NOW()) <= NOW()
    ORDER BY COALESCE(next_worktime, NOW() - INTERVAL 2 DAY) ASC
  `,

  getOldestReadyForHost: `
    SELECT *
    FROM fb_users
    WHERE host LIKE ?
      AND locked IS NULL
    ORDER BY next_worktime ASC
    LIMIT 1
  `,

  // ===== SPECIÁLNÍ VÝBĚRY =====

  getForStatement: `
    SELECT * FROM fb_users
    WHERE host = ?
      AND locked IS NULL
    ORDER BY COALESCE(next_statement, NOW())
    LIMIT 1
  `,

  getFromNeighborhood: `
    SELECT user_loged
    FROM heartbeat
    WHERE SUBSTRING(host, 8, 1) = SUBSTRING(?, 8, 1)
      AND user_loged > NOW() - INTERVAL ? MINUTE
  `,

  // ===== KOMPLEXNÍ DOTAZY S AKCEMI =====

  getWithAvailableActions: `
    SELECT u.*
    FROM fb_users u
    WHERE u.host LIKE ?
      AND u.locked IS NULL
      -- User's sleep/delay periods have expired (if they exist)
      AND NOT EXISTS (
        SELECT 1
        FROM user_action_plan uap_sleep
        WHERE uap_sleep.user_id = u.id
          AND uap_sleep.action_code IN ('account_sleep', 'account_delay')
          AND uap_sleep.next_time > NOW()
      )
      -- User has at least one available non-sleep/delay action
      AND (
        -- User has available regular actions in their action plan
        EXISTS (
          SELECT 1
          FROM user_action_plan uap
          JOIN action_definitions ad ON uap.action_code = ad.action_code
          WHERE uap.user_id = u.id
            AND (uap.next_time IS NULL OR uap.next_time <= NOW())
            AND ad.active = 1
            AND ad.action_code NOT IN ('account_sleep','account_delay')
        )
        OR
        -- User has missing action plans for regular actions (treat as available)
        EXISTS (
          SELECT 1
          FROM action_definitions ad
          WHERE ad.active = 1
            AND ad.action_code NOT IN ('account_sleep','account_delay')
            AND NOT EXISTS (
              SELECT 1 
              FROM user_action_plan uap 
              WHERE uap.user_id = u.id AND uap.action_code = ad.action_code
            )
        )
      )
    ORDER BY COALESCE(u.next_worktime, '1970-01-01 00:00:00') ASC
    LIMIT 1
  `,

  // ===== AKTUALIZACE STAVU UŽIVATELE =====

  lock: `
    UPDATE fb_users
    SET locked = NOW()
    WHERE id = ?
  `,

  lockWithReason: `
    UPDATE fb_users
    SET locked = NOW(), lock_reason = ?, lock_type = ?
    WHERE id = ?
  `,

  unlock: `
    UPDATE fb_users
    SET locked = NULL, lock_reason = NULL, lock_type = NULL, unlocked = CURDATE()
    WHERE id = ?
  `,

  updateWorktime: `
    UPDATE fb_users
    SET next_worktime = NOW() + INTERVAL ? MINUTE
    WHERE id = ?
  `,

  updateDayCount: `
    UPDATE fb_users 
    SET day_count = (
      SELECT COUNT(*) 
      FROM action_log 
      WHERE account_id = ? 
        AND DATE(timestamp) = CURDATE()
    )
    WHERE id = ?
  `,

  updateStatement: `
    UPDATE fb_users
    SET next_statement = NOW() + INTERVAL ? HOUR
    WHERE id = ?
  `,

  updateLastAddGroup: `
    UPDATE fb_users
    SET last_add_group = DATE(NOW())
    WHERE id = ?
  `,

  setLimit: `
    UPDATE fb_users
    SET day_limit = ?, day_limit_updated = NOW()
    WHERE id = ?
  `,

  updateProfile: `
    UPDATE fb_users
    SET profile_set = 1
    WHERE id = ?
  `,

  // ===== BATCH OPERACE =====

  unlockAll: `
    UPDATE fb_users
    SET locked = NULL, lock_reason = NULL, lock_type = NULL
    WHERE locked IS NOT NULL
  `,

  resetWorktimeAll: `
    UPDATE fb_users
    SET next_worktime = NOW() - INTERVAL 1 MINUTE
    WHERE locked IS NULL
  `,

  // ===== DIAGNOSTICKÉ DOTAZY =====

  getStats: `
    SELECT
      COUNT(*) as total_users,
      COUNT(CASE WHEN locked IS NULL THEN 1 END) as active_users,
      COUNT(CASE WHEN locked IS NOT NULL THEN 1 END) as locked_users,
      COUNT(CASE WHEN locked IS NOT NULL AND locked > NOW() - INTERVAL 24 HOUR THEN 1 END) as recently_locked
    FROM fb_users
  `,

  getLockedDetails: `
    SELECT
      id, name, surname, host, locked, lock_reason, lock_type,
      TIMESTAMPDIFF(HOUR, locked, NOW()) as hours_locked
    FROM fb_users
    WHERE locked IS NOT NULL
    ORDER BY locked DESC
    LIMIT ?
  `,

  getReadyForWork: `
    SELECT
      u.id, u.name, u.surname, u.host, u.next_worktime,
      COUNT(CASE WHEN uap.next_time <= NOW() AND ad.active = 1 THEN 1 END) as ready_actions
    FROM fb_users u
    LEFT JOIN user_action_plan uap ON u.id = uap.user_id
    LEFT JOIN action_definitions ad ON uap.action_code = ad.action_code
    WHERE u.locked IS NULL
      AND COALESCE(u.next_worktime, NOW()) <= NOW()
    GROUP BY u.id, u.name, u.surname, u.host, u.next_worktime
    HAVING ready_actions > 0
    ORDER BY u.next_worktime ASC, ready_actions DESC
  `,

  // ===== LEGACY KOMPATIBILITA =====

  userSpec: `
    SELECT * FROM fb_users
    WHERE host IS NULL OR host = ''
    LIMIT 1
  `,

  anyUser: `
    SELECT * FROM fb_users
    WHERE host = ?
    LIMIT 1
  `,

  lockedUserByHostname: `
    SELECT * FROM fb_users
    WHERE host = ?
      AND locked IS NOT NULL
    ORDER BY next_worktime
    LIMIT 1
  `,

  userLocked: `
    WITH logcount AS (
        SELECT user_id, COUNT(*) AS log_count
        FROM log
        WHERE inserted > NOW() - INTERVAL 22 HOUR
        GROUP BY user_id
    )
    SELECT * FROM fb_users
    LEFT JOIN logcount ON logcount.user_id = fb_users.id
    WHERE locked IS NOT NULL
    LIMIT 1
  `
};
