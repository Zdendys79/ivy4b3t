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

  update_worktime_to_tomorow: `
UPDATE LOW_PRIORITY fb_users
SET next_worktime = NOW() + INTERVAL 12 HOUR
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
    (SELECT time FROM log_u WHERE user_id = ? AND type = 'account_sleep' ORDER BY time DESC LIMIT 1),
    (SELECT MIN(time) FROM log_u WHERE user_id = ?),
    NOW()
  ) AS time
`,

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
INSERT INTO action_log (account_id, action_code, reference_id, text, timestamp)
VALUES (?, ?, ?, ?, NOW());
`,

update_quote_next_seen: `
UPDATE quotes
SET next_seen = NOW() + INTERVAL ? DAY
WHERE id = ?
`,


};
