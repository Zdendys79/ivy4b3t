/**
 * Název souboru: groups.js
 * Umístění: ~/ivy/sql/queries/groups.js
 *
 * Popis: SQL dotazy pro správu Facebook skupin (fb_groups)
 * Obsahuje výběr skupin, aktualizace stavu, cooldown management
 */

export const GROUPS = {
  // ===== ZÁKLADNÍ CRUD OPERACE =====

  getById: `
    SELECT * FROM fb_groups
    WHERE id = ?
  `,

  getByFbId: `
    SELECT * FROM fb_groups
    WHERE fb_id = ?
  `,

  getByType: `
    SELECT * FROM fb_groups
    WHERE typ = ?
      AND priority > 0
    ORDER BY priority DESC, nazev
  `,

  getAll: `
    SELECT * FROM fb_groups
    ORDER BY typ, priority DESC, nazev
  `,

  getActive: `
    SELECT * FROM fb_groups
    WHERE active = 1
      AND priority > 0
    ORDER BY typ, priority DESC
  `,

  // ===== VÝBĚR SKUPIN PRO POSTOVÁNÍ =====

  getAvailableByType: `
    SELECT
      fg.*,
      COALESCE(fg.last_seen, NOW() - INTERVAL 1 HOUR) as last_activity,
      COALESCE(fg.next_seen, NOW()) as next_available
    FROM fb_groups fg
    WHERE fg.typ = ?
      AND fg.priority > 0
      AND fg.active = 1
      AND fg.id NOT IN (
        SELECT DISTINCT al.reference_id
        FROM action_log al
        WHERE al.account_id = ?
          AND al.action_code LIKE 'post_utio_%'
          AND al.timestamp >= NOW() - INTERVAL 6 HOUR
          AND al.reference_id IS NOT NULL
      )
      AND COALESCE(fg.next_seen, NOW()) <= NOW()
      AND COALESCE(fg.last_seen, NOW() - INTERVAL 1 HOUR) <= NOW() - INTERVAL 10 MINUTE
    ORDER BY
      COALESCE(fg.last_seen, NOW() - INTERVAL 1 HOUR) ASC,
      RAND()
    LIMIT 10
  `,

  getAvailableByTypeSimple: `
    SELECT * FROM fb_groups
    WHERE typ = ?
      AND priority > 0
      AND active = 1
      AND (next_seen IS NULL OR next_seen <= NOW())
    ORDER BY COALESCE(last_seen, NOW() - INTERVAL 6 HOUR) ASC, RAND()
    LIMIT ?
  `,

  getUnusedByType: `
    SELECT fg.*
    FROM fb_groups fg
    WHERE fg.typ = ?
      AND fg.priority > 0
      AND fg.active = 1
      AND fg.id NOT IN (
        SELECT DISTINCT al.reference_id
        FROM action_log al
        WHERE al.reference_id IS NOT NULL
          AND al.timestamp >= NOW() - INTERVAL ? HOUR
      )
    ORDER BY fg.priority DESC, RAND()
    LIMIT ?
  `,

  // ===== AKTUALIZACE STAVU SKUPIN =====

  updateLastSeen: `
    UPDATE fb_groups
    SET last_seen = NOW()
    WHERE id = ?
  `,

  updateNextSeen: `
    UPDATE fb_groups
    SET next_seen = NOW() + INTERVAL ? MINUTE
    WHERE id = ?
  `,

  updateUserCounter: `
    UPDATE fb_groups
    SET user_counter = ?
    WHERE id = ?
  `,

  markAsSell: `
    UPDATE fb_groups
    SET sell = 1
    WHERE id = ?
  `,

  resetCooldowns: `
    UPDATE fb_groups
    SET
      last_seen = NOW() - INTERVAL 2 HOUR,
      next_seen = NOW() - INTERVAL 1 HOUR
    WHERE next_seen > NOW() OR last_seen > NOW() - INTERVAL 1 HOUR
  `,

  resetCooldownsByType: `
    UPDATE fb_groups
    SET
      last_seen = NOW() - INTERVAL 2 HOUR,
      next_seen = NOW() - INTERVAL 1 HOUR
    WHERE typ = ?
      AND (next_seen > NOW() OR last_seen > NOW() - INTERVAL 1 HOUR)
  `,

  // ===== USER GROUPS (vazební tabulka) =====

  addUserGroupWarning: `
    INSERT LOW_PRIORITY INTO user_groups (user_id, group_id, note, time)
    VALUES (?, ?, ?, NOW())
    ON DUPLICATE KEY UPDATE note = ?, time = NOW()
  `,

  getUserGroupNotes: `
    SELECT ug.*, fg.nazev, fg.typ
    FROM user_groups ug
    JOIN fb_groups fg ON ug.group_id = fg.id
    WHERE ug.user_id = ?
    ORDER BY ug.time DESC
  `,

  cleanOldUserGroups: `
    DELETE FROM user_groups
    WHERE time < NOW() - INTERVAL ? DAY
  `,

  // ===== STATISTIKY A MONITORING =====

  getGroupStats: `
    SELECT
      fg.typ,
      COUNT(*) as total_groups,
      COUNT(CASE WHEN fg.active = 1 THEN 1 END) as active_groups,
      COUNT(CASE WHEN fg.priority > 0 THEN 1 END) as priority_groups,
      AVG(fg.priority) as avg_priority,
      COUNT(CASE WHEN fg.sell = 1 THEN 1 END) as sell_groups
    FROM fb_groups fg
    GROUP BY fg.typ
    ORDER BY fg.typ
  `,

  getGroupActivity: `
    SELECT
      fg.id,
      fg.nazev,
      fg.typ,
      fg.priority,
      fg.last_seen,
      fg.next_seen,
      COUNT(al.id) as posts_last_24h,
      COUNT(DISTINCT al.account_id) as unique_users_24h
    FROM fb_groups fg
    LEFT JOIN action_log al ON fg.id = al.reference_id
      AND al.action_code LIKE 'post_utio_%'
      AND al.timestamp >= NOW() - INTERVAL 24 HOUR
    WHERE fg.active = 1
    GROUP BY fg.id, fg.nazev, fg.typ, fg.priority, fg.last_seen, fg.next_seen
    ORDER BY posts_last_24h DESC, fg.typ, fg.priority DESC
  `,

  getMostUsedGroups: `
    SELECT
      fg.nazev,
      fg.typ,
      COUNT(al.id) as post_count,
      COUNT(DISTINCT al.account_id) as unique_users,
      MIN(al.timestamp) as first_post,
      MAX(al.timestamp) as last_post
    FROM fb_groups fg
    JOIN action_log al ON fg.id = al.reference_id
    WHERE al.action_code LIKE 'post_utio_%'
      AND al.timestamp >= NOW() - INTERVAL ? DAY
    GROUP BY fg.id, fg.nazev, fg.typ
    ORDER BY post_count DESC
    LIMIT ?
  `,

  getUnderusedGroups: `
    SELECT
      fg.id,
      fg.nazev,
      fg.typ,
      fg.priority,
      COALESCE(recent_posts.post_count, 0) as posts_last_7d
    FROM fb_groups fg
    LEFT JOIN (
      SELECT
        al.reference_id,
        COUNT(*) as post_count
      FROM action_log al
      WHERE al.action_code LIKE 'post_utio_%'
        AND al.timestamp >= NOW() - INTERVAL 7 DAY
      GROUP BY al.reference_id
    ) recent_posts ON fg.id = recent_posts.reference_id
    WHERE fg.active = 1
      AND fg.priority > 0
      AND COALESCE(recent_posts.post_count, 0) < ?
    ORDER BY fg.priority DESC, recent_posts.post_count ASC
  `,

  // ===== COOLDOWN MANAGEMENT =====

  getGroupsInCooldown: `
    SELECT
      fg.id,
      fg.nazev,
      fg.typ,
      fg.last_seen,
      fg.next_seen,
      TIMESTAMPDIFF(MINUTE, NOW(), fg.next_seen) as minutes_until_available
    FROM fb_groups fg
    WHERE fg.next_seen > NOW()
    ORDER BY fg.next_seen ASC
  `,

  getReadyGroups: `
    SELECT
      fg.typ,
      COUNT(*) as ready_groups
    FROM fb_groups fg
    WHERE fg.active = 1
      AND fg.priority > 0
      AND (fg.next_seen IS NULL OR fg.next_seen <= NOW())
    GROUP BY fg.typ
    ORDER BY fg.typ
  `,

  // ===== MAINTENANCE A CLEANUP =====

  deactivateUnusedGroups: `
    UPDATE fb_groups
    SET active = 0
    WHERE id NOT IN (
      SELECT DISTINCT al.reference_id
      FROM action_log al
      WHERE al.reference_id IS NOT NULL
        AND al.timestamp >= NOW() - INTERVAL ? DAY
    )
    AND active = 1
  `,

  updateGroupPriorities: `
    UPDATE fb_groups fg
    JOIN (
      SELECT
        al.reference_id,
        COUNT(*) as post_count
      FROM action_log al
      WHERE al.action_code LIKE 'post_utio_%'
        AND al.timestamp >= NOW() - INTERVAL 30 DAY
      GROUP BY al.reference_id
    ) stats ON fg.id = stats.reference_id
    SET fg.priority = GREATEST(1, LEAST(10, FLOOR(stats.post_count / 5)))
    WHERE fg.active = 1
  `,

  // ===== DIAGNOSTICKÉ DOTAZY =====

  findDuplicateGroups: `
    SELECT
      fb_id,
      COUNT(*) as duplicate_count,
      GROUP_CONCAT(id) as duplicate_ids,
      GROUP_CONCAT(nazev SEPARATOR ' | ') as names
    FROM fb_groups
    WHERE fb_id IS NOT NULL
    GROUP BY fb_id
    HAVING COUNT(*) > 1
    ORDER BY duplicate_count DESC
  `,

  findProblematicGroups: `
    SELECT
      fg.*,
      'ISSUE' as issue_type,
      CASE
        WHEN fg.fb_id IS NULL THEN 'Missing FB ID'
        WHEN fg.nazev IS NULL OR fg.nazev = '' THEN 'Missing name'
        WHEN fg.priority = 0 THEN 'Zero priority'
        WHEN fg.active = 0 THEN 'Inactive'
        ELSE 'Unknown'
      END as issue_description
    FROM fb_groups fg
    WHERE fg.fb_id IS NULL
       OR fg.nazev IS NULL
       OR fg.nazev = ''
       OR (fg.priority = 0 AND fg.active = 1)
    ORDER BY fg.typ, fg.id
  `,

  getGroupPerformance: `
    SELECT
      fg.typ,
      fg.nazev,
      COUNT(al.id) as total_posts,
      COUNT(DISTINCT al.account_id) as unique_users,
      COUNT(DISTINCT DATE(al.timestamp)) as active_days,
      AVG(HOUR(al.timestamp)) as avg_post_hour,
      STDDEV(HOUR(al.timestamp)) as post_time_variance
    FROM fb_groups fg
    JOIN action_log al ON fg.id = al.reference_id
    WHERE al.action_code LIKE 'post_utio_%'
      AND al.timestamp >= NOW() - INTERVAL ? DAY
    GROUP BY fg.id, fg.typ, fg.nazev
    HAVING total_posts >= ?
    ORDER BY total_posts DESC
  `
};
