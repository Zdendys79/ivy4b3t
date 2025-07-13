/**
 * Název souboru: discovered_links.js
 * Umístění: ~/ivy/sql/queries/discovered_links.js
 *
 * Popis: SQL dotazy pro správu objevených odkazů na skupiny.
 */

export const DISCOVERED_LINKS = {
  insertLink: `
    INSERT IGNORE INTO discovered_group_links (url, discovered_by_user_id)
    VALUES (?, ?)
  `,

  getUnprocessedLinks: `
    SELECT * FROM discovered_group_links
    WHERE processed = FALSE
    ORDER BY discovered_at ASC
    LIMIT ?
  `,

  markAsProcessed: `
    UPDATE discovered_group_links
    SET processed = TRUE
    WHERE id IN (?)
  `,
};

