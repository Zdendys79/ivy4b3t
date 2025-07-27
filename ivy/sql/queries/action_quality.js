export default {
  insert: `
    INSERT INTO action_quality
    (user_id, action_code, success, details, verification_used, created_at)
    VALUES (?, ?, ?, ?, ?, NOW())
  `,

  getStats: `
    SELECT
      action_code,
      COUNT(*) as total,
      SUM(success) as successful,
      ROUND(SUM(success) * 100.0 / COUNT(*), 2) as success_rate
    FROM action_quality
    WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
    GROUP BY action_code
  `
};
