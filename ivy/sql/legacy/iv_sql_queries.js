/**
 * Název souboru: iv_sql_queries.js
 * Umístění: ~/ivy/sql/iv_sql_queries.js
 *
 * Popis: Obsahuje definici všech SQL dotazů jako ESM export.
 *         Používá se v modulu iv_sql.js k jejich dynamickému vykonávání.
 */

export default {
  user_spec: `
SELECT * FROM fb_users
  WHERE host IS NULL
    OR host = ''
  LIMIT 1`,

  any_user: `
SELECT * FROM fb_users
  WHERE host = ?
  LIMIT 1`,

  users_by_hostname: `
SELECT *
  FROM fb_users
  WHERE host = ?
  ORDER BY id ASC`,

  locked_user_by_hostname: `
SELECT * FROM fb_users
  WHERE host = ?
  AND locked IS NOT NULL
  ORDER BY next_worktime
  LIMIT 1`,

  user_locked: `
WITH logcount AS (
    SELECT user_id, COUNT(*) AS log_count FROM log
    WHERE inserted > NOW() - INTERVAL 22 HOUR
    GROUP BY user_id
 )
 SELECT * FROM fb_users LEFT JOIN logcount
  on logcount.user_id = fb_users.id
  WHERE locked IS NOT NULL
  LIMIT 1`,

  user_for_statement: `
SELECT * FROM fb_users
  WHERE host = ?
    AND locked IS NULL
  ORDER BY COALESCE(next_statement, NOW())
  LIMIT 1`,

  user_by_id: `
SELECT * FROM fb_users
  WHERE id = ?
  LIMIT 1`,

  get_recently_loged_user_from_neighborhood: `
SELECT user_loged
  FROM heartbeat
  WHERE SUBSTRING(host, 8, 1) = SUBSTRING(?, 8, 1)
  AND user_loged > NOW() - INTERVAL ? MINUTE`,

  select_statement: `
SELECT *
  FROM statements
  ORDER BY COALESCE(posted, NOW() - INTERVAL 90 DAY) ASC
  LIMIT 1`,

  update_statement: `
UPDATE statements SET
  posted = NOW()
  WHERE hash = ?`,

  heartbeat: `
INSERT LOW_PRIORITY INTO heartbeat (host, up, user_id, group_id, version)
VALUES ( ?, NOW(), ? ,?, ?)
ON DUPLICATE KEY UPDATE up = NOW(), user_id = ?, group_id = ?, version = ?`,

  lock_account: `
UPDATE fb_users
SET locked = NOW()
WHERE fb_users.id=?`,

  insert_to_log: `
INSERT LOW_PRIORITY INTO log
( inserted, user_id, group_id, region_id, district_id, portal_id, hostname, posted_data, md5 )
VALUES (NOW(),?,?,?,?,?,?,?,?)`,

  insert_to_system_log: `
INSERT LOW_PRIORITY INTO log_s
( time, hostname, title, text, data )
VALUES (NOW(), ?, ?, ?, ?)`,

  insert_to_user_log: `
INSERT INTO log_u (time, user_id, type, data, text)
VALUES (NOW(), ?, ?, ?, CONCAT('User ',? ,' ',? ,' [',? ,'] says: ', ?))`,

  update_group_last_seen: `
UPDATE fb_groups
SET last_seen = NOW()
WHERE id = ?`,

  update_group_next_seen: `
UPDATE fb_groups
SET next_seen = NOW() + INTERVAL ? MINUTE
WHERE id = ?`,

  update_sell_group: `
UPDATE fb_groups
SET sell = 1
WHERE id = ?`,

  update_user_group_warning: `
INSERT LOW_PRIORITY INTO user_groups (user_id, group_id, note, time)
VALUES (?, ?, ?, NOW())
ON DUPLICATE KEY UPDATE note = ?, time = NOW()` ,

  update_group_user_counter: `
UPDATE fb_groups
SET user_counter = ?
WHERE id = ?`,

  update_user_loged_to_fb: `
INSERT LOW_PRIORITY INTO heartbeat (host, user_id, user_loged, up)
VALUES (?, ?, NOW(), NOW())
ON DUPLICATE KEY UPDATE up = NOW(), user_loged = NOW(), user_id = ?`,

  update_user_worktime: `
UPDATE LOW_PRIORITY fb_users
SET next_worktime = NOW() + INTERVAL ? MINUTE
WHERE id = ?`,

  update_user_next_statement: `
UPDATE LOW_PRIORITY fb_users
SET next_statement = NOW() + INTERVAL ? HOUR
WHERE id = ?`,

  update_user_add_group: `
UPDATE LOW_PRIORITY fb_users
SET last_add_group = DATE(NOW())
WHERE id = ?`,

  update_user_profile: `
UPDATE LOW_PRIORITY fb_users
SET profile_set = 1
WHERE id = ?`,

  set_user_limit: `
UPDATE LOW_PRIORITY fb_users
SET day_limit = ?,
day_limit_updated = NOW()
WHERE id = ?`,

  verify_posted_data: `
SELECT count(group_id) AS c
FROM log
WHERE
  group_id = ?
  AND md5 = ?
  AND inserted > NOW() - INTERVAL 30 DAY`,

  load_url: `
SELECT *
FROM urls
ORDER BY used ASC, RAND()
LIMIT 1`,

  use_url: `
UPDATE urls
SET used = used + 1
WHERE url = ?`,

  get_production_version_code: `
SELECT code
FROM variables
WHERE name = 'version'
LIMIT 1;`,

  get_count_of_ui_commands: `
SELECT IFNULL(SUM(fulfilled = '0'), 0) as c
FROM ui_commands
WHERE host = ?;`,

  get_ui_command: `
SELECT *
FROM ui_commands
WHERE host = ? AND fulfilled = '0'
ORDER BY created ASC
LIMIT 1`,

  ui_command_solved: `
UPDATE ui_commands
SET fulfilled = '1'
WHERE id = ?`,

  ui_command_accepted: `
UPDATE ui_commands
SET accepted = now()
WHERE id = ?`,

  group_by_id: `
SELECT * FROM fb_groups WHERE id = ?`,

  get_version_code: `
SELECT code FROM versions ORDER BY created DESC LIMIT 1`,

  get_random_referer: `
SELECT url FROM referers ORDER BY RAND() LIMIT 1`,

  get_action_definitions: `
  SELECT * FROM action_definitions
  WHERE active = 1
  ORDER BY weight DESC
`,

  get_available_actions: `
  SELECT action_code FROM user_action_plan
  WHERE user_id = ? AND next_time <= NOW()
`,

  insert_to_action_plan: `
  INSERT INTO user_action_plan (user_id, action_code, next_time)
  VALUES (?, ?, ?)
  ON DUPLICATE KEY UPDATE next_time = VALUES(next_time)
`,

  get_reference_sleep_time: `
  SELECT COALESCE(
    (SELECT timestamp FROM action_log WHERE account_id = ? AND action_code = 'account_sleep' ORDER BY timestamp DESC LIMIT 1),
    (SELECT MIN(timestamp) FROM action_log WHERE account_id = ?),
    NOW() - INTERVAL 8 HOUR
  ) AS time`,

  get_user_last_sleep: `
  SELECT timestamp, text
  FROM action_log
  WHERE account_id = ?
    AND action_code IN ('account_sleep', 'account_delay')
  ORDER BY timestamp DESC
  LIMIT 1`,

  get_user_sleep_history: `
  SELECT timestamp, action_code, text
  FROM action_log
  WHERE account_id = ?
    AND action_code IN ('account_sleep', 'account_delay')
  ORDER BY timestamp DESC
  LIMIT ?`,

  get_user_actions: `
  SELECT
    ad.action_code,
    ad.weight,
    ad.min_minutes,
    ad.max_minutes
  FROM action_definitions ad
  JOIN user_action_plan uap
    ON ad.action_code = uap.action_code
 WHERE uap.user_id = ?
   AND (uap.next_time IS NULL OR uap.next_time <= NOW())
   AND ad.active = 1
   AND NOT (
     ad.action_code IN ('account_sleep','account_delay')
     AND EXISTS (
       SELECT 1
         FROM user_action_plan uap2
        WHERE uap2.user_id = ?
          AND uap2.action_code NOT IN ('account_sleep','account_delay')
          AND (uap2.next_time IS NULL OR uap2.next_time <= NOW())
     )
   );
`,

  update_user_action_plan: `UPDATE user_action_plan
  SET next_time = DATE_ADD(NOW(), INTERVAL ? MINUTE)
WHERE user_id = ?
  AND action_code = ?;
`,

  init_user_action_plan: `
  INSERT IGNORE INTO user_action_plan (user_id, action_code, next_time)
  SELECT ?, action_code, NULL
  FROM action_definitions;
`,

  get_random_quote: `
SELECT q.id, q.text, q.author
FROM quotes q
LEFT JOIN action_log l ON l.reference_id = q.id AND l.action_code = 'quote_post' AND l.account_id = ?
WHERE (q.next_seen IS NULL OR q.next_seen <= NOW())
  AND l.id IS NULL
ORDER BY RAND()
LIMIT 1
`,

  insert_to_action_log: `
INSERT INTO action_log (account_id, action_code, reference_id, text)
VALUES (?, ?, ?, ?);
`,

  update_quote_next_seen: `
UPDATE quotes
SET next_seen = NOW() + INTERVAL ? DAY
WHERE id = ?
`,

  reset_quote_post_debug: `
  UPDATE user_action_plan
  SET next_time = NOW() - INTERVAL 5 MINUTE
  WHERE action_code = 'quote_post'
`,

  // Získání limitů uživatele pro konkrétní typ skupiny
  get_user_group_limit: `
  SELECT max_posts, time_window_hours
  FROM user_group_limits
  WHERE user_id = ? AND group_type = ?
`,

  // Počet příspěvků uživatele v daném typu skupin za časové okno
  count_user_posts_in_timeframe: `
  SELECT COUNT(*) as post_count
  FROM action_log al
  JOIN fb_groups fg ON al.reference_id = fg.id
  WHERE al.account_id = ?
    AND al.action_code LIKE 'post_utio_%'
    AND fg.typ = ?
    AND al.timestamp >= NOW() - INTERVAL ? HOUR
`,

  // Získání dostupných skupin podle typu pro sdílení
  get_available_groups_by_type: `
  SELECT fg.*
  FROM fb_groups fg
  WHERE fg.typ = ?
    AND fg.priority > 0
    AND fg.id NOT IN (
      SELECT ug.group_id
      FROM user_groups ug
      WHERE ug.user_id = ?
        AND ug.time > NOW() - INTERVAL 3 DAY
    )
    AND COALESCE(fg.next_seen, NOW() - INTERVAL 1 MINUTE) < NOW()
    AND COALESCE(fg.last_seen, NOW() - INTERVAL 6 MINUTE) < (NOW() - INTERVAL 5 MINUTE)
  ORDER BY COALESCE(fg.last_seen, NOW() - INTERVAL 6 MINUTE) ASC
  LIMIT 5
`,

  // Aktualizace nebo vytvoření limitů pro uživatele
  upsert_user_group_limit: `
  INSERT INTO user_group_limits (user_id, group_type, max_posts, time_window_hours)
  VALUES (?, ?, ?, ?)
  ON DUPLICATE KEY UPDATE
    max_posts = VALUES(max_posts),
    time_window_hours = VALUES(time_window_hours),
    updated = CURRENT_TIMESTAMP
`,

  // Získání všech limitů uživatele
  get_user_all_limits: `
  SELECT group_type, max_posts, time_window_hours
  FROM user_group_limits
  WHERE user_id = ?
  ORDER BY group_type
`,

  // Rozšíření pro správu zablokovaných účtů
  lock_account_with_reason: `
  UPDATE fb_users
  SET locked = NOW(),
      lock_reason = ?,
      lock_type = ?
  WHERE id = ?`,

  log_account_issue: `
  INSERT INTO log_s (time, hostname, title, text, data)
  VALUES (NOW(), ?,
          CONCAT('Account Lock - User ', ?),
          CONCAT('Account locked: ', ?, ' (Type: ', ?, ')'),
          ?)`,

  get_locked_accounts_stats: `
  SELECT
    lock_type,
    COUNT(*) as count,
    COUNT(CASE WHEN locked > NOW() - INTERVAL 24 HOUR THEN 1 END) as last_24h,
    COUNT(CASE WHEN locked > NOW() - INTERVAL 7 DAY THEN 1 END) as last_7d
  FROM fb_users
  WHERE locked IS NOT NULL AND lock_type IS NOT NULL
  GROUP BY lock_type
  ORDER BY count DESC`,

  get_locked_accounts_details: `
  SELECT
    id, name, surname, host, locked, lock_reason, lock_type,
    TIMESTAMPDIFF(HOUR, locked, NOW()) as hours_locked
  FROM fb_users
  WHERE locked IS NOT NULL
  ORDER BY locked DESC
  LIMIT ?`,

  unlock_account_with_log: `
  UPDATE fb_users
  SET locked = NULL,
      lock_reason = NULL,
      lock_type = NULL,
      unlocked = CURDATE()
  WHERE id = ?`,

  check_account_lock_status: `
  SELECT id, locked, lock_reason, lock_type,
         CASE WHEN locked IS NOT NULL THEN TRUE ELSE FALSE END as is_locked
  FROM fb_users
  WHERE id = ?`,

  get_recent_locks_by_type: `
  SELECT
    lock_type,
    DATE(locked) as lock_date,
    COUNT(*) as daily_count
  FROM fb_users
  WHERE locked > NOW() - INTERVAL ? DAY
    AND lock_type IS NOT NULL
  GROUP BY lock_type, DATE(locked)
  ORDER BY lock_date DESC, daily_count DESC`,

  // Aktualizace user_for_statement pro vyloučení zablokovaných
  user_for_statement: `
  SELECT * FROM fb_users
  WHERE host = ?
    AND locked IS NULL
  ORDER BY COALESCE(next_statement, NOW())
  LIMIT 1`,

  // Nové dotazy pro user_group_limits

  // Získá aktuální využití limitů pro uživatele a typ skupiny
  get_user_limit_usage_detailed: `
  SELECT
    ugl.group_type,
    ugl.max_posts,
    ugl.time_window_hours,
    COALESCE(current_usage.post_count, 0) as current_posts,
    GREATEST(0, ugl.max_posts - COALESCE(current_usage.post_count, 0)) as remaining_posts,
    FLOOR(ugl.max_posts / 3) as max_posts_per_cycle,
    CASE
      WHEN COALESCE(current_usage.post_count, 0) >= ugl.max_posts THEN 0
      ELSE LEAST(
        FLOOR(ugl.max_posts / 3),
        ugl.max_posts - COALESCE(current_usage.post_count, 0)
      )
    END as posts_available_this_cycle
  FROM user_group_limits ugl
  LEFT JOIN (
    SELECT COUNT(*) as post_count
    FROM action_log al
    JOIN fb_groups fg ON al.reference_id = fg.id
    WHERE al.account_id = ?
      AND al.action_code LIKE 'post_utio_%'
      AND fg.typ = ?
      AND al.timestamp >= NOW() - INTERVAL ? HOUR
  ) current_usage ON 1=1
  WHERE ugl.user_id = ? AND ugl.group_type = ?
`,

  // Získá statistiky pro všechny typy skupin uživatele
  get_user_all_limits_with_usage: `
  SELECT
    ugl.group_type,
    ugl.max_posts,
    ugl.time_window_hours,
    COALESCE(usage_stats.current_posts, 0) as current_posts,
    GREATEST(0, ugl.max_posts - COALESCE(usage_stats.current_posts, 0)) as remaining_posts,
    FLOOR(ugl.max_posts / 3) as max_posts_per_cycle,
    ROUND(COALESCE(usage_stats.current_posts, 0) / ugl.max_posts * 100, 1) as usage_percent
  FROM user_group_limits ugl
  LEFT JOIN (
    SELECT
      fg.typ as group_type,
      COUNT(*) as current_posts
    FROM action_log al
    JOIN fb_groups fg ON al.reference_id = fg.id
    JOIN user_group_limits ugl2 ON fg.typ = ugl2.group_type AND al.account_id = ugl2.user_id
    WHERE al.account_id = ?
      AND al.action_code LIKE 'post_utio_%'
      AND al.timestamp >= NOW() - INTERVAL ugl2.time_window_hours HOUR
    GROUP BY fg.typ
  ) usage_stats ON ugl.group_type = usage_stats.group_type
  WHERE ugl.user_id = ?
  ORDER BY
    CASE ugl.group_type
      WHEN 'G' THEN 1
      WHEN 'GV' THEN 2
      WHEN 'P' THEN 3
      WHEN 'Z' THEN 4
    END
`,

  // Zkontroluje zda může uživatel postovat do typu skupiny (optimalizovaná verze)
  can_user_post_to_group_type_optimized: `
  SELECT
    CASE
      WHEN ugl.max_posts IS NULL THEN 0
      WHEN COALESCE(current_usage.post_count, 0) < ugl.max_posts THEN 1
      ELSE 0
    END as can_post,
    ugl.max_posts,
    COALESCE(current_usage.post_count, 0) as current_posts,
    ugl.time_window_hours
  FROM user_group_limits ugl
  LEFT JOIN (
    SELECT COUNT(*) as post_count
    FROM action_log al
    JOIN fb_groups fg ON al.reference_id = fg.id
    WHERE al.account_id = ?
      AND al.action_code LIKE 'post_utio_%'
      AND fg.typ = ?
      AND al.timestamp >= NOW() - INTERVAL (
        SELECT time_window_hours FROM user_group_limits
        WHERE user_id = ? AND group_type = ?
      ) HOUR
  ) current_usage ON 1=1
  WHERE ugl.user_id = ? AND ugl.group_type = ?
`,

  // Najde skupiny dostupné pro postování s respektováním cooldownů
  get_available_groups_by_type_with_cooldown: `
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

  // Získá dostupné akce s respektováním limitů pro kolo štěstí
  get_user_actions_with_limits: `
  SELECT
    ad.action_code,
    ad.weight,
    ad.min_minutes,
    ad.max_minutes,
    ad.repeatable,
    CASE
      WHEN ad.action_code LIKE 'post_utio_%' THEN
        CASE
          WHEN limit_check.can_post = 1 THEN ad.weight
          ELSE 0
        END
      ELSE ad.weight
    END as effective_weight
  FROM action_definitions ad
  JOIN user_action_plan uap ON ad.action_code = uap.action_code
  LEFT JOIN (
    SELECT
      CONCAT('post_utio_', ugl.group_type) as action_code,
      CASE
        WHEN COALESCE(usage.current_posts, 0) < ugl.max_posts THEN 1
        ELSE 0
      END as can_post
    FROM user_group_limits ugl
    LEFT JOIN (
      SELECT
        fg.typ,
        COUNT(*) as current_posts
      FROM action_log al
      JOIN fb_groups fg ON al.reference_id = fg.id
      WHERE al.account_id = ?
        AND al.action_code LIKE 'post_utio_%'
        AND al.timestamp >= NOW() - INTERVAL ugl.time_window_hours HOUR
      GROUP BY fg.typ
    ) usage ON ugl.group_type = usage.typ
    WHERE ugl.user_id = ?
  ) limit_check ON ad.action_code = limit_check.action_code
  WHERE uap.user_id = ?
    AND (uap.next_time IS NULL OR uap.next_time <= NOW())
    AND ad.active = 1
    AND (
      ad.action_code NOT LIKE 'post_utio_%'
      OR limit_check.can_post = 1
    )
    AND NOT (
      ad.action_code IN ('account_sleep','account_delay')
      AND EXISTS (
        SELECT 1
        FROM user_action_plan uap2
        WHERE uap2.user_id = ?
          AND uap2.action_code NOT IN ('account_sleep','account_delay')
          AND (uap2.next_time IS NULL OR uap2.next_time <= NOW())
      )
    )
  ORDER BY effective_weight DESC
`,

  // Statistiky pro administrativní účely
  get_system_limit_stats: `
  SELECT
    ugl.group_type,
    COUNT(DISTINCT ugl.user_id) as users_with_limits,
    AVG(ugl.max_posts) as avg_max_posts,
    MIN(ugl.max_posts) as min_max_posts,
    MAX(ugl.max_posts) as max_max_posts,
    AVG(ugl.time_window_hours) as avg_time_window,
    COUNT(DISTINCT al.account_id) as active_users_today
  FROM user_group_limits ugl
  LEFT JOIN action_log al ON ugl.user_id = al.account_id
    AND al.action_code LIKE 'post_utio_%'
    AND al.timestamp >= CURDATE()
  GROUP BY ugl.group_type
  ORDER BY ugl.group_type
`,

  // Detailní log posledních akcí s informacemi o limitech
  get_recent_posts_with_limits: `
  SELECT
    al.timestamp,
    u.name,
    u.surname,
    al.action_code,
    fg.nazev as group_name,
    fg.typ as group_type,
    al.text,
    ugl.max_posts,
    ugl.time_window_hours,
    (
      SELECT COUNT(*)
      FROM action_log al2
      JOIN fb_groups fg2 ON al2.reference_id = fg2.id
      WHERE al2.account_id = al.account_id
        AND al2.action_code LIKE 'post_utio_%'
        AND fg2.typ = fg.typ
        AND al2.timestamp >= al.timestamp - INTERVAL ugl.time_window_hours HOUR
        AND al2.timestamp <= al.timestamp
    ) as posts_in_window_at_time
  FROM action_log al
  JOIN fb_users u ON al.account_id = u.id
  JOIN fb_groups fg ON al.reference_id = fg.id
  JOIN user_group_limits ugl ON al.account_id = ugl.user_id AND fg.typ = ugl.group_type
  WHERE al.action_code LIKE 'post_utio_%'
    AND al.timestamp >= NOW() - INTERVAL 24 HOUR
  ORDER BY al.timestamp DESC
  LIMIT ?
`,

// Optimalizovaný výběr uživatele - garantuje že má akce
get_user_optimized: `
  SELECT u.*
  FROM fb_users u
  WHERE u.host LIKE ?
    AND u.locked IS NULL
    AND COALESCE(u.next_worktime, NOW()) <= NOW()
    AND EXISTS (
      SELECT 1
      FROM user_action_plan uap
      JOIN action_definitions ad ON uap.action_code = ad.action_code
      WHERE uap.user_id = u.id
        AND (uap.next_time IS NULL OR uap.next_time <= NOW())
        AND ad.active = 1
        AND NOT (
          ad.action_code IN ('account_sleep','account_delay')
          AND EXISTS (
            SELECT 1
            FROM user_action_plan uap2
            JOIN action_definitions ad2 ON uap2.action_code = ad2.action_code
            WHERE uap2.user_id = u.id
              AND uap2.action_code NOT IN ('account_sleep','account_delay')
              AND (uap2.next_time IS NULL OR uap2.next_time <= NOW())
              AND ad2.active = 1
          )
        )
    )
  ORDER BY COALESCE(u.next_worktime, NOW() - INTERVAL 2 DAY) ASC
  LIMIT 1
`,

// Kombinovaný dotaz - uživatel s akcemi najednou
get_user_with_actions: `
  SELECT
    u.id,
    u.name,
    u.surname,
    u.host,
    u.fb_login,
    u.fb_pass,
    u.next_worktime,
    u.locked,
    u.day_limit,
    u.max_limit,
    u.last_add_group,
    ad.action_code,
    ad.weight,
    ad.min_minutes,
    ad.max_minutes,
    ad.repeatable
  FROM fb_users u
  JOIN user_action_plan uap ON u.id = uap.user_id
  JOIN action_definitions ad ON uap.action_code = ad.action_code
  WHERE u.host LIKE ?
    AND u.locked IS NULL
    AND COALESCE(u.next_worktime, NOW()) <= NOW()
    AND (uap.next_time IS NULL OR uap.next_time <= NOW())
    AND ad.active = 1
    AND NOT (
      ad.action_code IN ('account_sleep','account_delay')
      AND EXISTS (
        SELECT 1
        FROM user_action_plan uap2
        JOIN action_definitions ad2 ON uap2.action_code = ad2.action_code
        WHERE uap2.user_id = u.id
          AND uap2.action_code NOT IN ('account_sleep','account_delay')
          AND (uap2.next_time IS NULL OR uap2.next_time <= NOW())
          AND ad2.active = 1
      )
    )
  ORDER BY
    COALESCE(u.next_worktime, NOW() - INTERVAL 2 DAY) ASC,
    ad.weight DESC
`,

// Konzistentní dotaz na akce uživatele - stejná logika jako výběr uživatele
get_user_actions_consistent: `
  SELECT
    ad.action_code,
    ad.weight,
    ad.min_minutes,
    ad.max_minutes,
    ad.repeatable
  FROM action_definitions ad
  JOIN user_action_plan uap ON ad.action_code = uap.action_code
  WHERE uap.user_id = ?
    AND (uap.next_time IS NULL OR uap.next_time <= NOW())
    AND ad.active = 1
    AND NOT (
      ad.action_code IN ('account_sleep','account_delay')
      AND EXISTS (
        SELECT 1
        FROM user_action_plan uap2
        WHERE uap2.user_id = ?
          AND uap2.action_code NOT IN ('account_sleep','account_delay')
          AND (uap2.next_time IS NULL OR uap2.next_time <= NOW())
      )
    )
  ORDER BY ad.weight DESC
`,

// Debug dotazy pro diagnostiku
debug_user_action_plan: `
  SELECT
    uap.action_code,
    uap.next_time,
    CASE
      WHEN uap.next_time IS NULL THEN 'NULL'
      WHEN uap.next_time <= NOW() THEN 'READY'
      ELSE 'WAITING'
    END as status,
    ad.active,
    ad.weight
  FROM user_action_plan uap
  LEFT JOIN action_definitions ad ON uap.action_code = ad.action_code
  WHERE uap.user_id = ?
  ORDER BY uap.action_code
`,

debug_active_definitions: `
  SELECT action_code, active, weight, min_minutes, max_minutes
  FROM action_definitions
  ORDER BY active DESC, weight DESC
`,

// Rychlý test dotaz pro ověření logiky
test_user_selection_logic: `
  SELECT
    u.id,
    u.name,
    u.surname,
    u.locked,
    u.next_worktime,
    COUNT(ready_actions.action_code) as available_actions,
    GROUP_CONCAT(ready_actions.action_code ORDER BY ready_actions.weight DESC) as action_list
  FROM fb_users u
  LEFT JOIN (
    SELECT
      uap.user_id,
      ad.action_code,
      ad.weight
    FROM user_action_plan uap
    JOIN action_definitions ad ON uap.action_code = ad.action_code
    WHERE (uap.next_time IS NULL OR uap.next_time <= NOW())
      AND ad.active = 1
      AND NOT (
        ad.action_code IN ('account_sleep','account_delay')
        AND EXISTS (
          SELECT 1 FROM user_action_plan uap2
          JOIN action_definitions ad2 ON uap2.action_code = ad2.action_code
          WHERE uap2.user_id = uap.user_id
            AND uap2.action_code NOT IN ('account_sleep','account_delay')
            AND (uap2.next_time IS NULL OR uap2.next_time <= NOW())
            AND ad2.active = 1
        )
      )
  ) ready_actions ON u.id = ready_actions.user_id
  WHERE u.host LIKE ?
    AND u.locked IS NULL
    AND COALESCE(u.next_worktime, NOW()) <= NOW()
  GROUP BY u.id, u.name, u.surname, u.locked, u.next_worktime
  ORDER BY available_actions DESC, u.id
`,

};
