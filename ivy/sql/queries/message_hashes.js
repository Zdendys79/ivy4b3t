export default {
  insert: `
    INSERT INTO message_hashes (group_id, hash, preview, created_at)
    VALUES (?, ?, ?, ?)
  `,

  checkDuplicate: `
    SELECT COUNT(*) as count
    FROM message_hashes
    WHERE group_id = ? AND hash = ?
  `
};
