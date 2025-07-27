/**
 * Název souboru: limits.js
 * Umístění: ~/ivy/sql/queries/limits.js
 *
 * Popis: SQL dotazy pro správu limitů postování (user_group_limits)
 * Obsahuje kontrolu limitů, statistiky, CRUD operace
 */

export const LIMITS = {
  // ===== ZÁKLADNÍ CRUD OPERACE =====

  getUserLimit: `
    SELECT max_posts, time_window_hours, updated
    FROM user_group_limits
    WHERE user_id = ? AND group_type = ?
  `,

  getAllUserLimits: `
    SELECT group_type, max_posts, time_window_hours, updated
    FROM user_group_limits
    WHERE user_id = ?
    ORDER BY CASE group_type
      WHEN 'G' THEN 1
      WHEN 'GV' THEN 2
      WHEN 'P' THEN 3
      WHEN 'Z' THEN 4
    END
  `,

  upsertLimit: `
    INSERT INTO user_group_limits (user_id, group_type, max_posts, time_window_hours)
    VALUES (?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      max_posts = VALUES(max_posts),
      time_window_hours = VALUES(time_window_hours),
      updated = CURRENT_TIMESTAMP
  `,

  deleteUserLimits: `
    DELETE FROM user_group_limits
    WHERE user_id = ?
  `,

  // ===== KONTROLA LIMITŮ =====

  countPostsInTimeframe: `
    SELECT COUNT(*) as post_count
    FROM action_log al
    JOIN fb_groups fg ON al.reference_id = fg.id
    WHERE al.account_id = ?
      AND al.action_code LIKE 'post_utio_%'
      AND fg.type = ?
      AND al.timestamp >= NOW() - INTERVAL ? HOUR
  `,

  canUserPost: `
    SELECT
      CASE
        WHEN ugl.max_posts IS NULL THEN 0
        WHEN COALESCE(current_usage.post_count, 0) < ugl.max_posts THEN 1
        ELSE 0
      END as can_post,
      ugl.max_posts,
      COALESCE(current_usage.post_count, 0) as current_posts,
      ugl.time_window_hours
    FROM user_group_limits ugl
    LEFT JOIN (
      SELECT COUNT(*) as post_count
      FROM action_log al
      JOIN fb_groups fg ON al.reference_id = fg.id
      WHERE al.account_id = ?
        AND al.action_code LIKE 'post_utio_%'
        AND fg.type = ?
        AND al.timestamp >= NOW() - INTERVAL ? HOUR
    ) current_usage ON 1=1
    WHERE ugl.user_id = ? AND ugl.group_type = ?
  `,

  // ===== DETAILNÍ STATISTIKY LIMITŮ =====

  getUserLimitUsageDetailed: `
    SELECT
      ugl.group_type,
      ugl.max_posts,
      ugl.time_window_hours,
      COALESCE(current_usage.post_count, 0) as current_posts,
      GREATEST(0, ugl.max_posts - COALESCE(current_usage.post_count, 0)) as remaining_posts,
      FLOOR(ugl.max_posts / 3) as max_posts_per_cycle,
      CASE
        WHEN COALESCE(current_usage.post_count, 0) >= ugl.max_posts THEN 0
        ELSE LEAST(
          FLOOR(ugl.max_posts / 3),
          ugl.max_posts - COALESCE(current_usage.post_count, 0)
        )
      END as posts_available_this_cycle
    FROM user_group_limits ugl
    LEFT JOIN (
      SELECT COUNT(*) as post_count
      FROM action_log al
      JOIN fb_groups fg ON al.reference_id = fg.id
      WHERE al.account_id = ?
        AND al.action_code LIKE 'post_utio_%'
        AND fg.type = ?
        AND al.timestamp >= NOW() - INTERVAL ? HOUR
    ) current_usage ON 1=1
    WHERE ugl.user_id = ? AND ugl.group_type = ?
  `,

  getUserAllLimitsWithUsage: `
    SELECT
      ugl.group_type,
      ugl.max_posts,
      ugl.time_window_hours,
      COALESCE(usage_stats.current_posts, 0) as current_posts,
      GREATEST(0, ugl.max_posts - COALESCE(usage_stats.current_posts, 0)) as remaining_posts,
      FLOOR(ugl.max_posts / 3) as max_posts_per_cycle,
      ROUND(COALESCE(usage_stats.current_posts, 0) / ugl.max_posts * 100, 1) as usage_percent
    FROM user_group_limits ugl
    LEFT JOIN (
      SELECT
        fg.type as group_type,
        COUNT(*) as current_posts
      FROM action_log al
      JOIN fb_groups fg ON al.reference_id = fg.id
      JOIN user_group_limits ugl2 ON fg.type = ugl2.group_type AND al.account_id = ugl2.user_id
      WHERE al.account_id = ?
        AND al.action_code LIKE 'post_utio_%'
        AND al.timestamp >= NOW() - INTERVAL ugl2.time_window_hours HOUR
      GROUP BY fg.type
    ) usage_stats ON ugl.group_type = usage_stats.group_type
    WHERE ugl.user_id = ?
    ORDER BY CASE ugl.group_type
      WHEN 'G' THEN 1
      WHEN 'GV' THEN 2
      WHEN 'P' THEN 3
      WHEN 'Z' THEN 4
    END
  `,

  // ===== HROMADNÉ OPERACE =====

  initDefaultLimitsForUser: `
    INSERT IGNORE INTO user_group_limits (user_id, group_type, max_posts, time_window_hours)
    VALUES
      (?, 'G', 15, 24),
      (?, 'GV', 1, 8),
      (?, 'P', 2, 8),
      (?, 'Z', 1, 48)
  `,

  initDefaultLimitsForAllUsers: `
    INSERT IGNORE INTO user_group_limits (user_id, group_type, max_posts, time_window_hours)
    SELECT u.id, 'G', 15, 24 FROM fb_users u
    UNION ALL
    SELECT u.id, 'GV', 1, 8 FROM fb_users u
    UNION ALL
    SELECT u.id, 'P', 2, 8 FROM fb_users u
    UNION ALL
    SELECT u.id, 'Z', 1, 48 FROM fb_users u
  `,

  bulkUpdateLimits: `
    UPDATE user_group_limits
    SET max_posts = ?, time_window_hours = ?, updated = CURRENT_TIMESTAMP
    WHERE user_id IN (%s) AND group_type = ?
  `,

  resetAllLimitTimestamps: `
    UPDATE user_group_limits
    SET updated = NOW() - INTERVAL 25 HOUR
  `,

  // ===== SYSTÉMOVÉ STATISTIKY =====

  getSystemLimitStats: `
    SELECT
      ugl.group_type,
      COUNT(DISTINCT ugl.user_id) as users_with_limits,
      AVG(ugl.max_posts) as avg_max_posts,
      MIN(ugl.max_posts) as min_max_posts,
      MAX(ugl.max_posts) as max_max_posts,
      AVG(ugl.time_window_hours) as avg_time_window,
      COUNT(DISTINCT al.account_id) as active_users_today
    FROM user_group_limits ugl
    LEFT JOIN action_log al ON ugl.user_id = al.account_id
      AND al.action_code LIKE 'post_utio_%'
      AND al.timestamp >= CURDATE()
    GROUP BY ugl.group_type
    ORDER BY ugl.group_type
  `,

  getAllUsersLimitsOverview: `
    SELECT
      u.id,
      u.name,
      u.surname,
      u.host,
      u.locked,
      GROUP_CONCAT(
        CONCAT(ugl.group_type, ':', ugl.max_posts, '/', ugl.time_window_hours, 'h')
        ORDER BY CASE ugl.group_type
          WHEN 'G' THEN 1
          WHEN 'GV' THEN 2
          WHEN 'P' THEN 3
          WHEN 'Z' THEN 4
        END
        SEPARATOR ' | '
      ) as limits_summary
    FROM fb_users u
    LEFT JOIN user_group_limits ugl ON u.id = ugl.user_id
    GROUP BY u.id, u.name, u.surname, u.host, u.locked
    ORDER BY u.id
  `,

  // ===== MONITORING A REPORTING =====

  getRecentPostsWithLimits: `
    SELECT
      al.timestamp,
      u.name,
      u.surname,
      al.action_code,
      fg.name as group_name,
      fg.type as group_type,
      al.text,
      ugl.max_posts,
      ugl.time_window_hours,
      (
        SELECT COUNT(*)
        FROM action_log al2
        JOIN fb_groups fg2 ON al2.reference_id = fg2.id
        WHERE al2.account_id = al.account_id
          AND al2.action_code LIKE 'post_utio_%'
          AND fg2.type = fg.type
          AND al2.timestamp >= al.timestamp - INTERVAL ugl.time_window_hours HOUR
          AND al2.timestamp <= al.timestamp
      ) as posts_in_window_at_time
    FROM action_log al
    JOIN fb_users u ON al.account_id = u.id
    JOIN fb_groups fg ON al.reference_id = fg.id
    JOIN user_group_limits ugl ON al.account_id = ugl.user_id AND fg.type = ugl.group_type
    WHERE al.action_code LIKE 'post_utio_%'
      AND al.timestamp >= NOW() - INTERVAL 24 HOUR
    ORDER BY al.timestamp DESC
    LIMIT ?
  `,

  getUserLimitViolations: `
    SELECT
      al.timestamp,
      al.account_id,
      u.name,
      u.surname,
      fg.type as group_type,
      COUNT(*) OVER (
        PARTITION BY al.account_id, fg.type
        ORDER BY al.timestamp
        RANGE BETWEEN INTERVAL ugl.time_window_hours HOUR PRECEDING AND CURRENT ROW
      ) as posts_in_window,
      ugl.max_posts
    FROM action_log al
    JOIN fb_users u ON al.account_id = u.id
    JOIN fb_groups fg ON al.reference_id = fg.id
    JOIN user_group_limits ugl ON al.account_id = ugl.user_id AND fg.type = ugl.group_type
    WHERE al.action_code LIKE 'post_utio_%'
      AND al.timestamp >= NOW() - INTERVAL 7 DAY
    HAVING posts_in_window > max_posts
    ORDER BY al.timestamp DESC
  `,

  // ===== DIAGNOSTICKÉ DOTAZY =====

  checkMissingLimits: `
    SELECT
      u.id,
      u.name,
      u.surname,
      GROUP_CONCAT(missing_types.group_type) as missing_limit_types
    FROM fb_users u
    CROSS JOIN (
      SELECT 'G' as group_type
      UNION SELECT 'GV'
      UNION SELECT 'P'
      UNION SELECT 'Z'
    ) missing_types
    LEFT JOIN user_group_limits ugl ON u.id = ugl.user_id AND missing_types.group_type = ugl.group_type
    WHERE ugl.user_id IS NULL
    GROUP BY u.id, u.name, u.surname
    HAVING missing_limit_types IS NOT NULL
    ORDER BY u.id
  `,

  getLimitEffectiveness: `
    SELECT
      ugl.group_type,
      ugl.user_id,
      u.name,
      u.surname,
      ugl.max_posts,
      COUNT(al.id) as actual_posts_24h,
      CASE
        WHEN COUNT(al.id) = 0 THEN 'UNUSED'
        WHEN COUNT(al.id) < ugl.max_posts * 0.5 THEN 'UNDERUSED'
        WHEN COUNT(al.id) >= ugl.max_posts THEN 'MAXED_OUT'
        ELSE 'NORMAL'
      END as usage_status
    FROM user_group_limits ugl
    JOIN fb_users u ON ugl.user_id = u.id
    LEFT JOIN action_log al ON al.account_id = ugl.user_id
      AND al.action_code LIKE 'post_utio_%'
      AND al.timestamp >= NOW() - INTERVAL 24 HOUR
      AND EXISTS (
        SELECT 1 FROM fb_groups fg
        WHERE fg.id = al.reference_id AND fg.type = ugl.group_type
      )
    WHERE u.locked IS NULL
    GROUP BY ugl.group_type, ugl.user_id, u.name, u.surname, ugl.max_posts
    ORDER BY ugl.group_type, actual_posts_24h DESC
  `,

    canUserPostSimple: `
    SELECT max_posts, time_window_hours
    FROM user_group_limits
    WHERE user_id = ? AND group_type = ?
  `,

  countUserPostsInWindow: `
    SELECT COUNT(*) as post_count
    FROM action_log al
    JOIN fb_groups fg ON al.reference_id = fg.id
    WHERE al.account_id = ?
      AND al.action_code LIKE 'post_utio_%'
      AND fg.type = ?
      AND al.timestamp >= NOW() - INTERVAL ? HOUR
  `,
};
