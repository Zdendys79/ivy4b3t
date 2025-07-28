/**
 * Název souboru: error-reports.js
 * Umístění: ~/ivy/sql/queries/error-reports.js
 *
 * Popis: SQL dotazy pro správu FB error reportů
 * Obsahuje funkce pro ukládání, čtení a správu error reportů z FB analýzy
 */

export const ERROR_REPORTS = {
  // ===== VYTVOŘENÍ ERROR REPORTU =====

  insertErrorReport: `
    INSERT INTO fb_error_reports (
      user_id, user_name, user_surname, group_id, group_fb_id,
      error_type, error_reason, page_url, page_title,
      page_elements_summary, detected_buttons, detected_texts,
      full_analysis_data, hostname, user_agent
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,

  insertBasicErrorReport: `
    INSERT INTO fb_error_reports (
      user_id, error_type, error_reason, page_url, hostname
    ) VALUES (?, ?, ?, ?, ?)
  `,

  // ===== VÝBĚR ERROR REPORTŮ =====

  getAllErrorReports: `
    SELECT
      id, created, user_id, user_name, user_surname,
      group_id, group_fb_id, error_type, error_reason,
      page_url, page_title, hostname, reviewed, resolved
    FROM fb_error_reports
    ORDER BY created DESC
    LIMIT ?
  `,

  getErrorReportById: `
    SELECT *
    FROM fb_error_reports
    WHERE id = ?
  `,

  getErrorReportsByUser: `
    SELECT
      id, created, error_type, error_reason, page_url,
      reviewed, resolved, hostname
    FROM fb_error_reports
    WHERE user_id = ?
    ORDER BY created DESC
    LIMIT ?
  `,

  getErrorReportsByType: `
    SELECT
      id, created, user_id, user_name, user_surname,
      error_reason, page_url, hostname, reviewed, resolved
    FROM fb_error_reports
    WHERE error_type = ?
    ORDER BY created DESC
    LIMIT ?
  `,

  getUnreviewedErrorReports: `
    SELECT
      id, created, user_id, user_name, user_surname,
      error_type, error_reason, page_url, hostname
    FROM fb_error_reports
    WHERE reviewed = 0
    ORDER BY created DESC
    LIMIT ?
  `,

  getUnresolvedErrorReports: `
    SELECT
      id, created, user_id, user_name, user_surname,
      error_type, error_reason, page_url, hostname, reviewed
    FROM fb_error_reports
    WHERE resolved = 0
    ORDER BY created DESC
    LIMIT ?
  `,

  // ===== STATISTIKY ERROR REPORTŮ =====

  getErrorReportStats: `
    SELECT
      error_type,
      COUNT(*) as total_count,
      COUNT(DISTINCT user_id) as affected_users,
      COUNT(CASE WHEN reviewed = 1 THEN 1 END) as reviewed_count,
      COUNT(CASE WHEN resolved = 1 THEN 1 END) as resolved_count,
      MAX(created) as last_occurrence
    FROM fb_error_reports
    WHERE created >= NOW() - INTERVAL ? DAY
    GROUP BY error_type
    ORDER BY total_count DESC
  `,

  getErrorReportsByHostname: `
    SELECT
      hostname,
      COUNT(*) as total_errors,
      COUNT(DISTINCT error_type) as unique_error_types,
      MAX(created) as last_error
    FROM fb_error_reports
    WHERE created >= NOW() - INTERVAL ? DAY
    GROUP BY hostname
    ORDER BY total_errors DESC
  `,

  getErrorTrendsByDay: `
    SELECT
      DATE(created) as error_date,
      COUNT(*) as error_count,
      COUNT(DISTINCT user_id) as affected_users,
      COUNT(DISTINCT error_type) as unique_types
    FROM fb_error_reports
    WHERE created >= NOW() - INTERVAL ? DAY
    GROUP BY DATE(created)
    ORDER BY error_date DESC
  `,

  // ===== AKTUALIZACE ERROR REPORTŮ =====

  markAsReviewed: `
    UPDATE fb_error_reports
    SET reviewed = 1
    WHERE id = ?
  `,

  markAsResolved: `
    UPDATE fb_error_reports
    SET resolved = 1, resolution_notes = ?
    WHERE id = ?
  `,

  markAsResolvedWithNotes: `
    UPDATE fb_error_reports
    SET resolved = 1, reviewed = 1, resolution_notes = ?
    WHERE id = ?
  `,

  bulkMarkAsReviewed: `
    UPDATE fb_error_reports
    SET reviewed = 1
    WHERE error_type = ? AND reviewed = 0
  `,

  // ===== PATTERN ANALYSIS =====

  getSimilarErrorReports: `
    SELECT
      id, created, user_id, error_type, error_reason,
      page_url, hostname, reviewed, resolved
    FROM fb_error_reports
    WHERE error_type = ?
      AND error_reason LIKE ?
      AND created >= NOW() - INTERVAL ? DAY
    ORDER BY created DESC
    LIMIT ?
  `,

  getFrequentErrorCombinations: `
    SELECT
      error_type,
      error_reason,
      COUNT(*) as occurrence_count,
      COUNT(DISTINCT user_id) as affected_users,
      MAX(created) as last_seen,
      AVG(CASE WHEN resolved = 1 THEN 1 ELSE 0 END) as resolution_rate
    FROM fb_error_reports
    WHERE created >= NOW() - INTERVAL ? DAY
    GROUP BY error_type, error_reason
    HAVING occurrence_count >= ?
    ORDER BY occurrence_count DESC
  `,

  // ===== ÚDRŽBA A CLEANING =====

  deleteOldErrorReports: `
    DELETE FROM fb_error_reports
    WHERE created < NOW() - INTERVAL ? DAY
      AND resolved = 1
  `,

  getOldestUnresolvedReport: `
    SELECT
      id, created, user_id, error_type, error_reason,
      DATEDIFF(NOW(), created) as days_old
    FROM fb_error_reports
    WHERE resolved = 0
    ORDER BY created ASC
    LIMIT 1
  `,

  // ===== DETAILNÍ ANALÝZA =====

  getDetailedErrorReport: `
    SELECT
      er.*,
      u.e_mail as user_email,
      u.locked as user_locked,
      g.name as group_name,
      g.type as group_type
    FROM fb_error_reports er
    LEFT JOIN fb_users u ON er.user_id = u.id
    LEFT JOIN fb_groups g ON er.group_id = g.id
    WHERE er.id = ?
  `,

  getErrorReportsWithFullData: `
    SELECT
      er.id, er.created, er.error_type, er.error_reason,
      er.page_url, er.page_title, er.full_analysis_data,
      er.hostname, er.reviewed, er.resolved,
      u.name as user_name, u.surname as user_surname,
      g.name as group_name, g.fb_id as group_fb_id
    FROM fb_error_reports er
    LEFT JOIN fb_users u ON er.user_id = u.id
    LEFT JOIN fb_groups g ON er.group_id = g.id
    WHERE er.full_analysis_data IS NOT NULL
      AND er.full_analysis_data != ''
    ORDER BY er.created DESC
    LIMIT ?
  `
};
