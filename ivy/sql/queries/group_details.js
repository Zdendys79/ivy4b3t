/**
 * Název souboru: group_details.js
 * Umístění: ~/ivy/sql/queries/group_details.js
 *
 * Popis: SQL dotazy pro správu detailů prozkoumávaných FB skupin
 * Obsahuje operace pro ukládání, aktualizaci a vyhledávání skupin
 */

export const GROUP_DETAILS = {
  // ===== ZÁKLADNÍ OPERACE =====
  
  insertGroup: `
    INSERT INTO group_details (
      fb_group_id, name, member_count, description, category,
      privacy_type, discovered_by_user_id, notes, is_relevant,
      posting_allowed, language, activity_level
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      name = VALUES(name),
      member_count = VALUES(member_count),
      description = VALUES(description),
      category = VALUES(category),
      privacy_type = VALUES(privacy_type),
      notes = VALUES(notes),
      is_relevant = VALUES(is_relevant),
      posting_allowed = VALUES(posting_allowed),
      language = VALUES(language),
      activity_level = VALUES(activity_level),
      last_updated = CURRENT_TIMESTAMP
  `,

  getGroupByFbId: `
    SELECT * FROM group_details
    WHERE fb_group_id = ?
  `,

  getGroupById: `
    SELECT * FROM group_details
    WHERE id = ?
  `,

  updateGroupInfo: `
    UPDATE group_details 
    SET name = ?, member_count = ?, description = ?, 
        category = ?, privacy_type = ?, notes = ?,
        is_relevant = ?, posting_allowed = ?, language = ?,
        activity_level = ?, last_updated = CURRENT_TIMESTAMP
    WHERE fb_group_id = ?
  `,

  markAsRelevant: `
    UPDATE group_details 
    SET is_relevant = ?, notes = CONCAT(COALESCE(notes, ''), ?, '\n')
    WHERE fb_group_id = ?
  `,

  // ===== VYHLEDÁVÁNÍ A FILTROVÁNÍ =====

  getRelevantGroups: `
    SELECT * FROM group_details
    WHERE is_relevant = 1
    ORDER BY member_count DESC, discovered_at DESC
  `,

  getGroupsForExploration: `
    SELECT * FROM group_details
    WHERE is_relevant IS NULL
       OR last_updated < DATE_SUB(NOW(), INTERVAL 7 DAY)
    ORDER BY 
      CASE WHEN name IS NULL THEN 0 ELSE 1 END ASC,  -- Prioritně neanalyzované (name IS NULL)
      CASE WHEN is_relevant IS NULL THEN 0 ELSE 1 END ASC,  -- Pak nehodnocené
      RAND()
    LIMIT ?
  `,

  getGroupsByCategory: `
    SELECT * FROM group_details
    WHERE category LIKE ?
    ORDER BY member_count DESC
    LIMIT ?
  `,

  getGroupsByMemberCount: `
    SELECT * FROM group_details
    WHERE member_count BETWEEN ? AND ?
    ORDER BY member_count DESC
    LIMIT ?
  `,

  getRecentlyDiscovered: `
    SELECT gd.*, u.name as discoverer_name, u.surname as discoverer_surname
    FROM group_details gd
    LEFT JOIN fb_users u ON gd.discovered_by_user_id = u.id
    WHERE gd.discovered_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
    ORDER BY gd.discovered_at DESC
    LIMIT ?
  `,

  // ===== STATISTIKY A ANALÝZY =====

  getExplorationStats: `
    SELECT 
      COUNT(*) as total_groups,
      COUNT(CASE WHEN is_relevant = 1 THEN 1 END) as relevant_groups,
      COUNT(CASE WHEN is_relevant = 0 THEN 1 END) as irrelevant_groups,
      COUNT(CASE WHEN is_relevant IS NULL THEN 1 END) as unanalyzed_groups,
      COUNT(CASE WHEN posting_allowed = 1 THEN 1 END) as posting_allowed_groups,
      AVG(member_count) as avg_member_count,
      MAX(member_count) as max_member_count,
      COUNT(DISTINCT discovered_by_user_id) as active_explorers
    FROM group_details
  `,

  getCategoryStats: `
    SELECT 
      category,
      COUNT(*) as group_count,
      AVG(member_count) as avg_members,
      COUNT(CASE WHEN is_relevant = 1 THEN 1 END) as relevant_count
    FROM group_details
    WHERE category IS NOT NULL
    GROUP BY category
    ORDER BY group_count DESC
    LIMIT ?
  `,

  getUserExplorationStats: `
    SELECT 
      u.id,
      u.name,
      u.surname,
      COUNT(gd.id) as groups_discovered,
      COUNT(CASE WHEN gd.is_relevant = 1 THEN 1 END) as relevant_found,
      MAX(gd.discovered_at) as last_discovery
    FROM fb_users u
    LEFT JOIN group_details gd ON u.id = gd.discovered_by_user_id
    WHERE u.id = ?
    GROUP BY u.id
  `,

  // ===== ÚDRŽBA A ČIŠTĚNÍ =====

  deleteOldUnrelevant: `
    DELETE FROM group_details
    WHERE is_relevant = 0 
      AND discovered_at < DATE_SUB(NOW(), INTERVAL ? DAY)
  `,

  updateStaleRecords: `
    UPDATE group_details 
    SET notes = CONCAT(COALESCE(notes, ''), 'Údaje mohou být zastaralé - ')
    WHERE last_updated < DATE_SUB(NOW(), INTERVAL ? DAY)
      AND notes NOT LIKE '%zastaralé%'
  `,

  // ===== DOPORUČENÍ PRO EXPLORACI =====

  getGroupsNeedingUpdate: `
    SELECT * FROM group_details
    WHERE last_updated < DATE_SUB(NOW(), INTERVAL ? DAY)
      AND (is_relevant = 1 OR is_relevant IS NULL)
    ORDER BY last_updated ASC
    LIMIT ?
  `,

  findSimilarGroups: `
    SELECT * FROM group_details
    WHERE (category LIKE ? OR name LIKE ? OR description LIKE ?)
      AND fb_group_id != ?
    ORDER BY 
      CASE WHEN category LIKE ? THEN 3
           WHEN name LIKE ? THEN 2
           WHEN description LIKE ? THEN 1
           ELSE 0 END DESC,
      member_count DESC
    LIMIT ?
  `,

  // ===== EXPORT A REPORTING =====

  exportRelevantGroups: `
    SELECT 
      fb_group_id,
      name,
      member_count,
      category,
      privacy_type,
      posting_allowed,
      activity_level,
      discovered_at,
      notes
    FROM group_details
    WHERE is_relevant = 1
    ORDER BY member_count DESC
  `,

  getWeeklyDiscoveryReport: `
    SELECT 
      DATE(discovered_at) as discovery_date,
      COUNT(*) as groups_found,
      COUNT(CASE WHEN is_relevant = 1 THEN 1 END) as relevant_found,
      AVG(member_count) as avg_member_count
    FROM group_details
    WHERE discovered_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
    GROUP BY DATE(discovered_at)
    ORDER BY discovery_date DESC
  `
};