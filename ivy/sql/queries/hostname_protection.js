/**
 * Název souboru: hostname_protection.js
 * Umístění: ~/ivy/sql/queries/hostname_protection.js
 *
 * Popis: SQL dotazy pro hostname ochranu proti lavině banů
 * Chrání před přihlašováním dalších účtů ze stejného VM po detekci banu
 */

export const HOSTNAME_PROTECTION = {
  // ===== KONTROLA BLOKACE =====

  checkBlocked: `
    SELECT hostname, blocked_until, blocked_reason, blocked_user_id,
           TIMESTAMPDIFF(MINUTE, NOW(), blocked_until) as remaining_minutes
    FROM hostname_protection
    WHERE hostname = ? AND blocked_until > NOW()
    LIMIT 1
  `,

  // ===== NASTAVENÍ BLOKACE =====

  insertBlock: `
    INSERT INTO hostname_protection (hostname, blocked_until, blocked_reason, blocked_user_id)
    VALUES (?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      blocked_until = VALUES(blocked_until),
      blocked_reason = VALUES(blocked_reason),
      blocked_user_id = VALUES(blocked_user_id),
      created_at = CURRENT_TIMESTAMP
  `,

  // ===== UVOLNĚNÍ BLOKACE =====

  removeBlock: `
    DELETE FROM hostname_protection
    WHERE hostname = ?
  `,

  removeExpiredBlocks: `
    DELETE FROM hostname_protection
    WHERE blocked_until <= NOW()
  `,

  // ===== MONITORING A STATISTIKY =====

  getActiveBlocks: `
    SELECT hostname, blocked_until, blocked_reason, blocked_user_id,
           TIMESTAMPDIFF(MINUTE, NOW(), blocked_until) as remaining_minutes,
           created_at
    FROM hostname_protection
    WHERE blocked_until > NOW()
    ORDER BY blocked_until DESC
  `,

  getBlockHistory: `
    SELECT hostname, blocked_until, blocked_reason, blocked_user_id, created_at,
           CASE 
             WHEN blocked_until > NOW() THEN 'ACTIVE'
             ELSE 'EXPIRED'
           END as status
    FROM hostname_protection
    WHERE created_at > NOW() - INTERVAL ? HOUR
    ORDER BY created_at DESC
    LIMIT ?
  `,

  getHostnameStats: `
    SELECT hostname,
           COUNT(*) as total_blocks,
           COUNT(CASE WHEN blocked_until > NOW() THEN 1 END) as active_blocks,
           MAX(created_at) as last_block_time
    FROM hostname_protection
    WHERE created_at > NOW() - INTERVAL 24 HOUR
    GROUP BY hostname
    ORDER BY total_blocks DESC
  `
};