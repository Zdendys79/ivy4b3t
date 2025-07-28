export default {
  insert: `
    INSERT INTO system_metrics (data, timestamp)
    VALUES (?, ?)
  `,

  getRecent: `
    SELECT * FROM system_metrics
    WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
    ORDER BY timestamp DESC
  `
};
