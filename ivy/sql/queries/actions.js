/**
 * Název souboru: actions.js
 * Umístění: ~/ivy/sql/queries/actions.js
 *
 * Popis: SQL dotazy pro akční systém (action_definitions, user_action_plan, action_log)
 * Obsahuje plánování akcí, logování, definice akcí
 */

export const ACTIONS = {
  // ===== ACTION DEFINITIONS =====

  getDefinitions: `
    SELECT * FROM action_definitions
    WHERE active = 1
    ORDER BY weight DESC
  `,

  getAllDefinitions: `
    SELECT * FROM action_definitions
    ORDER BY weight DESC, action_code
  `,

  getDefinitionByCode: `
    SELECT * FROM action_definitions
    WHERE action_code = ?
  `,

  // ===== USER ACTION PLAN =====

  getUserActions: `
    SELECT
      ad.action_code,
      ad.weight,
      ad.min_minutes,
      ad.max_minutes,
      ad.repeatable
    FROM action_definitions ad
    JOIN user_action_plan uap ON ad.action_code = uap.action_code
    WHERE uap.user_id = ?
      AND (uap.next_time IS NULL OR uap.next_time <= NOW())
      AND ad.active = 1
      AND NOT (
        ad.action_code IN ('account_sleep','account_delay')
        AND EXISTS (
          SELECT 1
          FROM user_action_plan uap2
          WHERE uap2.user_id = ?
            AND uap2.action_code NOT IN ('account_sleep','account_delay')
            AND (uap2.next_time IS NULL OR uap2.next_time <= NOW())
        )
      )
    ORDER BY ad.weight DESC
  `,

  getAvailableActions: `
    SELECT action_code
    FROM user_action_plan
    WHERE user_id = ?
      AND (next_time IS NULL OR next_time <= NOW())
  `,

  updatePlan: `
    INSERT INTO user_action_plan (next_time, user_id, action_code)
    VALUES (DATE_ADD(NOW(), INTERVAL ? MINUTE), ?, ?)
    ON DUPLICATE KEY UPDATE next_time = VALUES(next_time)
  `,

  scheduleNext: `
    INSERT INTO user_action_plan (next_time, user_id, action_code)
    VALUES (DATE_ADD(NOW(), INTERVAL ? MINUTE), ?, ?)
    ON DUPLICATE KEY UPDATE next_time = VALUES(next_time)
  `,

  scheduleNextHours: `
    INSERT INTO user_action_plan (next_time, user_id, action_code)
    VALUES (DATE_ADD(NOW(), INTERVAL ? HOUR), ?, ?)
    ON DUPLICATE KEY UPDATE next_time = VALUES(next_time)
  `,

  scheduleSpecific: `
    INSERT INTO user_action_plan (next_time, user_id, action_code)
    VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE next_time = VALUES(next_time)
  `,

  insertToPlan: `
    INSERT INTO user_action_plan (user_id, action_code, next_time)
    VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE next_time = VALUES(next_time)
  `,

  initPlan: `
    INSERT INTO user_action_plan (user_id, action_code, next_time)
    SELECT ?, action_code, NULL
    FROM action_definitions
    ON DUPLICATE KEY UPDATE next_time = COALESCE(next_time, NULL)
  `,

  resetUserPlan: `
    UPDATE user_action_plan
    SET next_time = NOW() - INTERVAL 1 MINUTE
    WHERE user_id = ?
  `,

  resetAllPlans: `
    UPDATE user_action_plan uap
    JOIN fb_users u ON uap.user_id = u.id
    SET next_time = NOW() - INTERVAL 1 MINUTE
    WHERE u.locked IS NULL
  `,

  // ===== ACTION LOGGING =====

  logAction: `
    INSERT INTO action_log (account_id, action_code, reference_id, text)
    VALUES (?, ?, ?, ?)
  `,

  getRecentActions: `
    SELECT timestamp, action_code, reference_id, text
    FROM action_log
    WHERE account_id = ?
    ORDER BY timestamp DESC
    LIMIT ?
  `,

  getActionHistory: `
    SELECT timestamp, action_code, text
    FROM action_log
    WHERE account_id = ?
      AND action_code IN ('account_sleep', 'account_delay')
    ORDER BY timestamp DESC
    LIMIT ?
  `,

  getUserLastSleep: `
    SELECT timestamp, text
    FROM action_log
    WHERE account_id = ?
      AND action_code IN ('account_sleep', 'account_delay')
    ORDER BY timestamp DESC
    LIMIT 1
  `,

  // getUserLastJoinGroup query removed - join tracking moved to fb_users.last_add_group

  getRecentJoinGroupAction: `
    SELECT timestamp
    FROM action_log
    WHERE account_id = ?
      AND action_code = ? 
      AND timestamp >= NOW() - INTERVAL 8 HOUR
    ORDER BY timestamp DESC
    LIMIT 1
  `,

  getReferenceSleepTime: `
    SELECT COALESCE(
      (SELECT timestamp FROM action_log WHERE account_id = ? AND action_code = 'account_sleep' ORDER BY timestamp DESC LIMIT 1),
      (SELECT MIN(timestamp) FROM action_log WHERE account_id = ?),
      NOW() - INTERVAL 8 HOUR
    ) AS time
  `,

  getAllRecentActions: `
    SELECT
      al.timestamp,
      al.action_code,
      u.name,
      u.surname,
      al.text
    FROM action_log al
    JOIN fb_users u ON al.account_id = u.id
    ORDER BY al.timestamp DESC
    LIMIT ?
  `,

  // ===== POKROČILÉ DOTAZY PRO KOLO ŠTĚSTÍ =====

  getEndingActions: `
    SELECT
      ad.action_code as code,
      ad.weight,
      ad.min_minutes,
      ad.max_minutes,
      ad.repeatable,
      ad.invasive,
      ad.weight as effective_weight
    FROM action_definitions ad
    JOIN user_action_plan uap ON ad.action_code = uap.action_code
    WHERE uap.user_id = ?
      AND ad.action_code IN ('account_sleep', 'account_delay')
      AND (uap.next_time IS NULL OR uap.next_time <= NOW())
      AND ad.active = 1
  `,

  checkEndingActions: `
    SELECT action_code
    FROM user_action_plan
    WHERE user_id = ?
      AND action_code IN ('account_sleep', 'account_delay')
  `,

  createEndingAction: `
    INSERT IGNORE INTO user_action_plan (user_id, action_code, next_time)
    VALUES (?, ?, NULL)
  `,

  getAllActiveActions: `
    SELECT action_code
    FROM action_definitions
    WHERE active = 1
  `,

  createUserAction: `
    INSERT IGNORE INTO user_action_plan (user_id, action_code, next_time)
    VALUES (?, ?, NULL)
  `,
  
  createUserActionWithTime: `
    INSERT IGNORE INTO user_action_plan (user_id, action_code, next_time)
    VALUES (?, ?, ?)
  `,
  
  getAllActiveActions: `
    SELECT action_code 
    FROM action_definitions 
    WHERE active = 1
  `,
  
  getUserPlanActions: `
    SELECT action_code 
    FROM user_action_plan 
    WHERE user_id = ?
  `,

  getMissingActionsForUser: `
    SELECT ad.action_code
    FROM action_definitions ad
    LEFT JOIN user_action_plan uap ON ad.action_code = uap.action_code AND uap.user_id = ?
    WHERE ad.active = 1 AND uap.action_code IS NULL
  `,

  getUserActionsWithLimitsSimple: `
    SELECT
      ad.action_code,
      ad.weight,
      ad.min_minutes,
      ad.max_minutes,
      ad.repeatable,
      ad.invasive,
      ad.weight as effective_weight
    FROM action_definitions ad
    JOIN user_action_plan uap ON ad.action_code = uap.action_code
    WHERE uap.user_id = ?
      AND (uap.next_time IS NULL OR uap.next_time <= NOW())
      AND ad.active = 1
      AND NOT (
        ad.action_code IN ('account_sleep','account_delay')
        AND EXISTS (
          SELECT 1
          FROM action_definitions ad2
          JOIN user_action_plan uap2 ON ad2.action_code = uap2.action_code
          WHERE uap2.user_id = ?
            AND ad2.action_code NOT IN ('account_sleep','account_delay')
            AND ad2.active = 1
            AND (uap2.next_time IS NULL OR uap2.next_time <= NOW())
        )
      )
    ORDER BY ad.weight DESC
  `,

    getUserActionsWithLimits: `
    SELECT
      ad.action_code,
      ad.weight,
      ad.min_minutes,
      ad.max_minutes,
      ad.repeatable,
      ad.invasive,
      CASE
        WHEN ad.action_code LIKE 'post_utio_%' THEN
          CASE
            WHEN limit_check.can_post = 1 THEN ad.weight
            ELSE 0
          END
        ELSE ad.weight
      END as effective_weight
    FROM action_definitions ad
    JOIN user_action_plan uap ON ad.action_code = uap.action_code
    LEFT JOIN (
      SELECT
        CONCAT('post_utio_', ugl.group_type) as action_code,
        CASE
          WHEN COALESCE(usage_stats.current_posts, 0) < ugl.max_posts THEN 1
          ELSE 0
        END as can_post
      FROM user_group_limits ugl
      LEFT JOIN (
        SELECT
          fg.type,
          COUNT(*) as current_posts
        FROM action_log al
        JOIN fb_groups fg ON al.reference_id = fg.id
        WHERE al.account_id = ?
          AND al.action_code LIKE 'post_utio_%'
          AND al.timestamp >= NOW() - INTERVAL ugl.time_window_hours HOUR
        GROUP BY fg.type
      ) usage_stats ON ugl.group_type = usage_stats.type
      WHERE ugl.user_id = ?
    ) limit_check ON ad.action_code = limit_check.action_code
    WHERE uap.user_id = ?
      AND (uap.next_time IS NULL OR uap.next_time <= NOW())
      AND ad.active = 1
      AND (
        ad.action_code NOT LIKE 'post_utio_%'
        OR limit_check.can_post = 1
      )
      AND NOT (
        ad.action_code IN ('account_sleep','account_delay')
        AND EXISTS (
          SELECT 1
          FROM user_action_plan uap2
          WHERE uap2.user_id = ?
            AND uap2.action_code NOT IN ('account_sleep','account_delay')
            AND (uap2.next_time IS NULL OR uap2.next_time <= NOW())
        )
      )
    ORDER BY effective_weight DESC
  `,

  // ===== DIAGNOSTICKÉ A DEBUG DOTAZY =====

  debugUserActionPlan: `
    SELECT
      uap.action_code,
      uap.next_time,
      CASE
        WHEN uap.next_time IS NULL THEN 'NULL'
        WHEN uap.next_time <= NOW() THEN 'READY'
        ELSE 'WAITING'
      END as status,
      ad.active,
      ad.weight,
      TIMESTAMPDIFF(MINUTE, NOW(), uap.next_time) as minutes_until_ready
    FROM user_action_plan uap
    LEFT JOIN action_definitions ad ON uap.action_code = ad.action_code
    WHERE uap.user_id = ?
    ORDER BY uap.action_code
  `,

  getActionStats: `
    SELECT
      ad.action_code,
      ad.active,
      COUNT(uap.user_id) as users_with_action,
      COUNT(CASE WHEN uap.next_time <= NOW() THEN 1 END) as ready_now,
      COUNT(CASE WHEN uap.next_time > NOW() THEN 1 END) as waiting
    FROM action_definitions ad
    LEFT JOIN user_action_plan uap ON ad.action_code = uap.action_code
    LEFT JOIN fb_users u ON uap.user_id = u.id AND u.locked IS NULL
    GROUP BY ad.action_code, ad.active
    ORDER BY ad.action_code
  `,

  // ===== QUOTE SYSTEM =====
  // Poznámka: updateQuoteNextSeen je duplicitní s quotes.markAsUsed - použij quotes.markAsUsed místo toho

  resetQuotePostDebug: `
    UPDATE user_action_plan
    SET next_time = NOW() - INTERVAL 5 MINUTE
    WHERE action_code = 'quote_post'
  `,

  // ===== PERFORMANCE QUERIES =====

  getSystemActionStats: `
    SELECT
      DATE_FORMAT(al.timestamp, '%H:%i') as time_window,
      COUNT(DISTINCT al.account_id) as active_users,
      COUNT(*) as total_actions,
      COUNT(DISTINCT CASE WHEN al.action_code LIKE 'post_utio_%' THEN al.account_id END) as posting_users,
      AVG(CASE
        WHEN al.action_code LIKE 'post_utio_%' THEN 1
        WHEN al.action_code IN ('account_sleep', 'account_delay') THEN 0
        ELSE 0.5
      END) as productivity_score
    FROM action_log al
    WHERE al.timestamp >= NOW() - INTERVAL ? HOUR
    GROUP BY DATE_FORMAT(al.timestamp, '%H:%i')
    ORDER BY time_window DESC
  `,

  // ===== INVASIVE ACTIONS CHECK =====
  
  getInvasiveActionsInPlan: `
    SELECT uap.action_code, uap.next_time
    FROM user_action_plan uap
    JOIN action_definitions ad ON uap.action_code = ad.action_code
    WHERE uap.user_id = ? 
      AND ad.invasive = 1 
      AND ad.active = 1
  `
};
