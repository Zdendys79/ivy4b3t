/**
 * Název souboru: userGroupBlocking.js
 * Umístění: ~/ivy/sql/queries/userGroupBlocking.js
 *
 * Popis: SQL dotazy pro per-user group blocking systém
 * Řeší problém s vyřizováním žádostí o členství a opakovanými problémy
 */

export const USER_GROUP_BLOCKING = {
  // ===== BLOKOVÁNÍ SKUPINY PRO UŽIVATELE =====

  blockUserGroup: `
    UPDATE user_groups 
    SET blocked_until = ?, 
        block_count = block_count + 1,
        last_block_reason = ?,
        last_block_date = NOW()
    WHERE user_id = ? AND group_id = ?
  `,

  // ===== KONTROLA BLOKACE =====

  isUserGroupBlocked: `
    SELECT ug.group_id, ug.blocked_until, ug.block_count, ug.last_block_reason,
           g.name as group_name, g.fb_id as group_fb_id,
           TIMESTAMPDIFF(HOUR, NOW(), ug.blocked_until) as hours_remaining
    FROM user_groups ug
    JOIN fb_groups g ON ug.group_id = g.id
    WHERE ug.user_id = ? AND ug.group_id = ? 
      AND ug.blocked_until > NOW()
    LIMIT 1
  `,

  // ===== DOSTUPNÉ SKUPINY PRO UŽIVATELE =====

  getAvailableGroupsForUser: `
    SELECT g.*, 
           ug.block_count,
           ug.blocked_until,
           ug.last_block_reason
    FROM fb_groups g
    LEFT JOIN user_groups ug ON g.id = ug.group_id AND ug.user_id = ?
    WHERE g.type = ?
      AND g.priority > 0
      AND (g.next_seen IS NULL OR g.next_seen <= NOW())
      AND (ug.blocked_until IS NULL OR ug.blocked_until <= NOW())
    ORDER BY 
      g.last_seen ASC  -- Preferuj skupiny obsloužené před nejdelším časem
  `,

  // ===== UVOLNĚNÍ BLOKACE =====

  unblockUserGroup: `
    UPDATE user_groups 
    SET blocked_until = NULL,
        last_block_reason = NULL
    WHERE user_id = ? AND group_id = ?
  `,

  unblockExpiredUserGroups: `
    UPDATE user_groups 
    SET blocked_until = NULL,
        last_block_reason = NULL
    WHERE blocked_until <= NOW()
  `,

  // ===== STATISTIKY A MONITORING =====

  getUserGroupBlockStats: `
    SELECT 
      COUNT(*) as total_groups,
      COUNT(CASE WHEN blocked_until > NOW() THEN 1 END) as blocked_groups,
      COUNT(CASE WHEN block_count > 0 THEN 1 END) as groups_with_issues,
      AVG(block_count) as avg_block_count,
      MAX(block_count) as max_block_count
    FROM user_groups 
    WHERE user_id = ?
  `,

  getActiveUserGroupBlocks: `
    SELECT ug.user_id, ug.group_id, ug.blocked_until, ug.block_count, 
           ug.last_block_reason, ug.last_block_date,
           u.name, u.surname, g.name as group_name, g.fb_id as group_fb_id,
           TIMESTAMPDIFF(HOUR, NOW(), ug.blocked_until) as hours_remaining
    FROM user_groups ug
    JOIN fb_users u ON ug.user_id = u.id
    JOIN fb_groups g ON ug.group_id = g.id
    WHERE ug.blocked_until > NOW()
    ORDER BY ug.blocked_until ASC
    LIMIT ?
  `,

  getProblematicGroups: `
    SELECT g.id, g.name, g.fb_id, g.type,
           COUNT(ug.user_id) as affected_users,
           AVG(ug.block_count) as avg_block_count,
           MAX(ug.last_block_date) as last_issue
    FROM fb_groups g
    JOIN user_groups ug ON g.id = ug.group_id
    WHERE ug.block_count > 0
    GROUP BY g.id, g.name, g.fb_id, g.type
    HAVING affected_users >= ?
    ORDER BY avg_block_count DESC, affected_users DESC
  `,

  // ===== RESET A ÚDRŽBA =====

  resetUserGroupBlockCounts: `
    UPDATE user_groups 
    SET block_count = 0,
        last_block_reason = NULL,
        last_block_date = NULL
    WHERE user_id = ? AND block_count > 0
  `,

  resetAllBlockCounts: `
    UPDATE user_groups 
    SET block_count = 0,
        blocked_until = NULL,
        last_block_reason = NULL,
        last_block_date = NULL
    WHERE block_count > 0
  `,

  // ===== ESCALATION QUERIES =====

  getBlockCountForGroup: `
    SELECT block_count 
    FROM user_groups 
    WHERE user_id = ? AND group_id = ?
  `,

  // Pro debugging a reporting
  getUserGroupHistory: `
    SELECT ug.*, g.name, g.fb_id, g.type,
           CASE 
             WHEN ug.blocked_until > NOW() THEN 'BLOCKED'
             WHEN ug.block_count > 0 THEN 'HAS_ISSUES'
             ELSE 'OK'
           END as status
    FROM user_groups ug
    JOIN fb_groups g ON ug.group_id = g.id
    WHERE ug.user_id = ?
    ORDER BY ug.block_count DESC, g.name ASC
  `
};