/**
 * Název souboru: groups.js
 * Umístění: ~/ivy/sql/queries/groups.js
 *
 * Popis: OPRAVENÉ SQL dotazy pro správu FB skupin (fb_groups)
 * 
 * Typy skupin:
 * G = group - cizí skupina pro UTIO příspěvky (nevlastníme)
 * GV = vlastní skupina - B3 vlastní, správce z B3 (vlastníme)
 * P = prodejní skupina - zatím neřešíme
 * Z = zájmová skupina - speciální obsah, ne realitní příspěvky
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
    WHERE type = ?
      AND priority > 0
    ORDER BY priority DESC, name
  `,

  getAll: `
    SELECT * FROM fb_groups
    ORDER BY type, priority DESC, name
  `,

  getActive: `
    SELECT * FROM fb_groups
    WHERE priority > 0
    ORDER BY type, priority DESC
  `,

  // ===== VÝBĚR SKUPIN PRO POSTOVÁNÍ =====

  getSingleAvailableGroup: `
    SELECT g.*
    FROM fb_groups g
    LEFT JOIN user_groups ug ON g.id = ug.group_id AND ug.user_id = ?
    WHERE g.type = ?
      AND g.priority > 0
      AND (g.next_seen IS NULL OR g.next_seen <= NOW())
      AND (ug.blocked_until IS NULL OR ug.blocked_until <= NOW())
    ORDER BY RAND()
    LIMIT 1
  `,

  getUnusedByType: `
    SELECT fg.*
    FROM fb_groups fg
    WHERE fg.type = ?
      AND fg.priority > 0
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

  updateMemberCount: `
    UPDATE fb_groups
    SET member_count = ?
    WHERE id = ?
  `,

  updateBuySellFlag: `
    UPDATE fb_groups
    SET is_buy_sell_group = ?
    WHERE id = ?
  `,

  updateBuySellFlagByFbId: `
    UPDATE fb_groups
    SET is_buy_sell_group = ?
    WHERE fb_id = ?
  `,

  // ===== NOVÉ DOTAZY PRO KONSOLIDOVANOU TABULKU =====

  insertOrUpdateGroup: `
    INSERT INTO fb_groups (
      fb_id, name, member_count, description, category, type, priority
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      name = VALUES(name),
      member_count = VALUES(member_count),
      description = VALUES(description),
      category = VALUES(category),
      last_seen = NOW()
  `,

  saveGroupExplorationDetails: `
    UPDATE fb_groups
    SET 
      name = ?,
      member_count = ?,
      description = ?,
      category = ?,
      last_seen = NOW()
    WHERE fb_id = ?
  `,

  getGroupsForExploration: `
    SELECT * FROM fb_groups
    WHERE type = 'Z'
      AND priority > 0
    ORDER BY 
      CASE WHEN name IS NULL THEN 0 ELSE 1 END ASC,
      priority DESC
    LIMIT ?
  `,

  getRelevantGroups: `
    SELECT * FROM fb_groups
    WHERE priority > 0
      AND type IN ('G', 'GV', 'Z')
    ORDER BY member_count DESC, priority DESC
  `,

  insertDiscoveredLink: `
    INSERT IGNORE INTO fb_groups (fb_id, type, priority)
    VALUES (?, 'Z', 3)
  `,

  markDiscoveryAsProcessed: `
    UPDATE fb_groups
    SET note = 'processed'
    WHERE fb_id = ?
  `,

  getUnprocessedDiscoveries: `
    SELECT * FROM fb_groups
    WHERE (note IS NULL OR note != 'processed')
      AND type = 'Z'
    ORDER BY id ASC
    LIMIT ?
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
    WHERE type = ?
      AND (next_seen > NOW() OR last_seen > NOW() - INTERVAL 1 HOUR)
  `,

  // ===== USER GROUPS (vazební tabulka) =====

  getUserGroupNotes: `
    SELECT ug.*, fg.name, fg.type
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
      fg.type,
      COUNT(*) as total_groups,
      COUNT(CASE WHEN fg.priority > 0 THEN 1 END) as active_groups,
      COUNT(CASE WHEN fg.priority > 0 THEN 1 END) as priority_groups,
      AVG(fg.priority) as avg_priority
    FROM fb_groups fg
    GROUP BY fg.type
    ORDER BY fg.type
  `,

  getGroupActivity: `
    SELECT
      fg.id,
      fg.name,
      fg.type,
      fg.priority,
      fg.last_seen,
      fg.next_seen,
      COUNT(al.id) as posts_last_24h,
      COUNT(DISTINCT al.account_id) as unique_users_24h
    FROM fb_groups fg
    LEFT JOIN action_log al ON fg.id = al.reference_id
      AND al.action_code LIKE 'post_utio_%'
      AND al.timestamp >= NOW() - INTERVAL 24 HOUR
    WHERE fg.priority > 0
    GROUP BY fg.id, fg.name, fg.type, fg.priority, fg.last_seen, fg.next_seen
    ORDER BY posts_last_24h DESC, fg.type, fg.priority DESC
  `,

  getMostUsedGroups: `
    SELECT
      fg.name,
      fg.type,
      COUNT(al.id) as post_count,
      COUNT(DISTINCT al.account_id) as unique_users,
      MIN(al.timestamp) as first_post,
      MAX(al.timestamp) as last_post
    FROM fb_groups fg
    JOIN action_log al ON fg.id = al.reference_id
    WHERE al.action_code LIKE 'post_utio_%'
      AND al.timestamp >= NOW() - INTERVAL ? DAY
    GROUP BY fg.id, fg.name, fg.type
    ORDER BY post_count DESC
    LIMIT ?
  `,

  getUnderusedGroups: `
    SELECT
      fg.id,
      fg.name,
      fg.type,
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
    WHERE fg.priority > 0
      AND COALESCE(recent_posts.post_count, 0) < ?
    ORDER BY fg.priority DESC, recent_posts.post_count ASC
  `,

  // ===== COOLDOWN MANAGEMENT =====

  getGroupsInCooldown: `
    SELECT
      fg.id,
      fg.name,
      fg.type,
      fg.last_seen,
      fg.next_seen,
      TIMESTAMPDIFF(MINUTE, NOW(), fg.next_seen) as minutes_until_available
    FROM fb_groups fg
    WHERE fg.next_seen > NOW()
    ORDER BY fg.next_seen ASC
  `,

  getReadyGroups: `
    SELECT
      fg.type,
      COUNT(*) as ready_groups
    FROM fb_groups fg
    WHERE fg.priority > 0
      AND (fg.next_seen IS NULL OR fg.next_seen <= NOW())
    GROUP BY fg.type
    ORDER BY fg.type
  `,

  // ===== MAINTENANCE A CLEANUP =====

  deactivateUnusedGroups: `
    UPDATE fb_groups
    SET priority = 0
    WHERE id NOT IN (
      SELECT DISTINCT al.reference_id
      FROM action_log al
      WHERE al.reference_id IS NOT NULL
        AND al.timestamp >= NOW() - INTERVAL ? DAY
    )
    AND priority > 0
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
    WHERE fg.priority > 0
  `,

  // ===== DIAGNOSTICKÉ DOTAZY =====

  findDuplicateGroups: `
    SELECT
      fb_id,
      COUNT(*) as duplicate_count,
      GROUP_CONCAT(id) as duplicate_ids,
      GROUP_CONCAT(name SEPARATOR ' | ') as names
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
        WHEN fg.name IS NULL OR fg.name = '' THEN 'Missing name'
        WHEN fg.priority = 0 THEN 'Zero priority'
        ELSE 'Unknown'
      END as issue_description
    FROM fb_groups fg
    WHERE fg.fb_id IS NULL
       OR fg.name IS NULL
       OR fg.name = ''
    ORDER BY fg.type, fg.id
  `,

  getGroupPerformance: `
    SELECT
      fg.type,
      fg.name,
      COUNT(al.id) as total_posts,
      COUNT(DISTINCT al.account_id) as unique_users,
      COUNT(DISTINCT DATE(al.timestamp)) as active_days,
      AVG(HOUR(al.timestamp)) as avg_post_hour,
      STDDEV(HOUR(al.timestamp)) as post_time_variance
    FROM fb_groups fg
    JOIN action_log al ON fg.id = al.reference_id
    WHERE al.action_code LIKE 'post_utio_%'
      AND al.timestamp >= NOW() - INTERVAL ? DAY
    GROUP BY fg.id, fg.type, fg.name
    HAVING total_posts >= ?
    ORDER BY total_posts DESC
  `,

  // ===== DOTAZY PRO FB GROUP ANALYZER =====

  upsertGroupInfo: `
    INSERT INTO fb_groups (
      fb_id, name, member_count, type, priority
    ) VALUES (?, ?, ?, 'Z', 3)
    ON DUPLICATE KEY UPDATE
      name = VALUES(name),
      member_count = VALUES(member_count),
      last_seen = NOW()
  `,

  getUserExplorationStats: `
    SELECT 
      COUNT(*) as groups_discovered,
      COUNT(CASE WHEN fg.last_seen >= DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 1 END) as groups_today,
      COUNT(CASE WHEN fg.last_seen >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) as groups_this_week
    FROM fb_groups fg
    WHERE fg.type = 'Z'
  `
};
