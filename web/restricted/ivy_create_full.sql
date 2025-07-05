-- Adminer 5.3.0 MariaDB 10.11.13-MariaDB-0ubuntu0.24.04.1 dump
SET
  NAMES utf8;

SET
  time_zone = '+00:00';

SET
  foreign_key_checks = 0;

SET
  sql_mode = 'NO_AUTO_VALUE_ON_ZERO';

DELIMITER;

;

DROP PROCEDURE IF EXISTS `GetLockStatistics`;

;

CREATE PROCEDURE `GetLockStatistics` (IN `days_back` int) BEGIN
-- Nastavení výchozí hodnoty pokud je NULL
IF days_back IS NULL THEN
SET
  days_back = 30;

END IF;

-- Celkové statistiky
SELECT
  'Celkem zablokovaných' as metric,
  COUNT(*) as value
FROM
  fb_users
WHERE
  locked IS NOT NULL
UNION ALL
SELECT
  'Zablokováno za posledních 24h' as metric,
  COUNT(*) as value
FROM
  fb_users
WHERE
  locked > NOW () - INTERVAL 1 DAY
UNION ALL
SELECT
  'Zablokováno za posledních 7 dní' as metric,
  COUNT(*) as value
FROM
  fb_users
WHERE
  locked > NOW () - INTERVAL 7 DAY;

-- Statistiky podle typu
SELECT
  COALESCE(lock_type, 'UNKNOWN') as lock_type,
  COUNT(*) as total_count,
  COUNT(
    CASE
      WHEN locked > NOW () - INTERVAL 1 DAY THEN 1
    END
  ) as last_24h,
  COUNT(
    CASE
      WHEN locked > NOW () - INTERVAL 7 DAY THEN 1
    END
  ) as last_7d,
  ROUND(
    AVG(
      TIMESTAMPDIFF (HOUR, locked, COALESCE(unlocked, NOW ()))
    ),
    2
  ) as avg_lock_duration_hours
FROM
  account_lock_history
WHERE
  locked_at > NOW () - INTERVAL days_back DAY
GROUP BY
  lock_type
ORDER BY
  total_count DESC;

END;

;

DELIMITER;

SET
  NAMES utf8mb4;

-- Account lock history tracking table
-- Stores historical data of account locks and unlocks with detailed information
CREATE TABLE
  `account_lock_history` (
    `id` int (10) unsigned NOT NULL AUTO_INCREMENT,
    `user_id` smallint (5) unsigned NOT NULL,
    `locked_at` datetime NOT NULL,
    `unlocked_at` datetime DEFAULT NULL,
    `lock_reason` varchar(255) DEFAULT NULL,
    `lock_type` varchar(50) DEFAULT NULL,
    `hostname` varchar(64) DEFAULT NULL,
    `detection_details` longtext CHARACTER
    SET
      utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL COMMENT 'Detaily detekce (komplexnost stránky, nalezené texty, atd.)' CHECK (json_valid (`detection_details`)),
      `unlocked_by` varchar(64) DEFAULT NULL COMMENT 'Kdo/co účet odemkl',
      `unlock_reason` varchar(255) DEFAULT NULL,
      `created_at` timestamp NULL DEFAULT current_timestamp(),
      PRIMARY KEY (`id`),
      KEY `idx_user_id` (`user_id`),
      KEY `idx_locked_at` (`locked_at`),
      KEY `idx_lock_type` (`lock_type`),
      KEY `idx_hostname` (`hostname`),
      KEY `idx_lock_history_composite` (`user_id`, `locked_at` DESC, `unlocked_at`),
      CONSTRAINT `account_lock_history_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `fb_users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
  ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'Historie zablokování a odemčení účtů';

-- Action definitions table
-- Defines available actions with their parameters and constraints
CREATE TABLE
  `action_definitions` (
    `action_code` varchar(30) NOT NULL,
    `label` varchar(64) NOT NULL,
    `description` text DEFAULT NULL,
    `weight` int (10) unsigned DEFAULT 1,
    `min_minutes` int (10) unsigned NOT NULL,
    `max_minutes` int (10) unsigned NOT NULL,
    `repeatable` tinyint (1) DEFAULT 1,
    `active` tinyint (1) DEFAULT 1,
    PRIMARY KEY (`action_code`)
  ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

-- Action execution log table
-- Records all executed actions with timestamps and details
CREATE TABLE
  `action_log` (
    `id` int (10) unsigned NOT NULL AUTO_INCREMENT,
    `timestamp` datetime NOT NULL DEFAULT current_timestamp(),
    `account_id` smallint (5) unsigned NOT NULL,
    `action_code` varchar(30) NOT NULL,
    `reference_id` varchar(64) DEFAULT NULL,
    `text` text DEFAULT NULL,
    PRIMARY KEY (`id`),
    KEY `account_id` (`account_id`),
    CONSTRAINT `action_log_ibfk_1` FOREIGN KEY (`account_id`) REFERENCES `fb_users` (`id`) ON UPDATE CASCADE
  ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

-- Czech districts reference table
-- Contains district codes and names for geographical organization
CREATE TABLE
  `c_districts` (
    `id` tinyint (3) unsigned NOT NULL,
    `region_id` tinyint (3) unsigned DEFAULT NULL,
    `district` tinytext DEFAULT NULL,
    PRIMARY KEY (`id`),
    KEY `RegionKey` (`region_id`),
    CONSTRAINT `c_districts_FK` FOREIGN KEY (`region_id`) REFERENCES `c_regions` (`id`) ON UPDATE CASCADE
  ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

-- Portal reference table
-- Defines different portal types used in the system
CREATE TABLE
  `c_portals` (
    `id` tinyint (3) unsigned NOT NULL,
    `portal` tinytext DEFAULT NULL,
    PRIMARY KEY (`id`)
  ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

-- Czech regions reference table
-- Contains region codes and names for geographical organization
CREATE TABLE
  `c_regions` (
    `id` tinyint (3) unsigned NOT NULL,
    `region` tinytext DEFAULT NULL,
    PRIMARY KEY (`id`)
  ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

-- Facebook groups table
-- Stores information about Facebook groups for automation targeting
CREATE TABLE
  `fb_groups` (
    `id` smallint (5) unsigned NOT NULL AUTO_INCREMENT,
    `fb_id` varchar(255) DEFAULT NULL,
    `nazev` tinytext DEFAULT NULL,
    `priority` tinyint (1) unsigned NOT NULL DEFAULT 3,
    `user_counter` int (11) DEFAULT NULL,
    `note` tinytext DEFAULT NULL,
    `last_seen` datetime DEFAULT NULL,
    `next_seen` datetime DEFAULT NULL,
    `typ` varchar(2) DEFAULT NULL,
    `region_id` tinyint (3) unsigned NOT NULL DEFAULT 0,
    `district_id` tinyint (3) unsigned NOT NULL DEFAULT 0,
    `sell` tinyint (1) DEFAULT 0,
    PRIMARY KEY (`id`)
  ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

-- Facebook users/accounts table
-- Main table storing Facebook account credentials and status information
CREATE TABLE
  `fb_users` (
    `id` smallint (5) unsigned NOT NULL,
    `name` tinytext NOT NULL,
    `surname` tinytext NOT NULL,
    `day_limit` smallint (5) unsigned DEFAULT 10,
    `max_limit` smallint (5) unsigned DEFAULT NULL,
    `next_worktime` datetime DEFAULT NULL,
    `next_statement` datetime NOT NULL,
    `e_mail` tinytext NOT NULL,
    `e_pass` tinytext DEFAULT NULL,
    `fb_login` tinytext NOT NULL,
    `fb_pass` tinytext DEFAULT NULL,
    `u_login` tinytext NOT NULL,
    `u_pass` tinytext DEFAULT NULL,
    `locked` datetime DEFAULT NULL COMMENT 'Datum a čas zablokování účtu',
    `lock_reason` varchar(255) DEFAULT NULL COMMENT 'Důvod zablokování účtu',
    `lock_type` varchar(50) DEFAULT NULL COMMENT 'Typ problému (VIDEOSELFIE, CHECKPOINT, atd.)',
    `unlocked` date DEFAULT NULL,
    `day_limit_updated` date DEFAULT NULL,
    `last_add_group` date DEFAULT NULL,
    `portal_id` tinyint (3) unsigned DEFAULT 1,
    `host` varchar(15) DEFAULT NULL,
    PRIMARY KEY (`id`),
    KEY `idx_locked_type` (`locked`, `lock_type`),
    KEY `idx_lock_reason` (`lock_reason`)
  ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

DELIMITER;

;

CREATE TRIGGER `account_lock_history_insert` AFTER
UPDATE ON `fb_users` FOR EACH ROW BEGIN
-- Pokud se účet zablokoval (locked změněno z NULL na datetime)
IF OLD.locked IS NULL
AND NEW.locked IS NOT NULL THEN
INSERT INTO
  account_lock_history (
    user_id,
    locked_at,
    lock_reason,
    lock_type,
    hostname
  )
VALUES
  (
    NEW.id,
    NEW.locked,
    NEW.lock_reason,
    NEW.lock_type,
    NEW.host
  );

END IF;

-- Pokud se účet odemkl (locked změněno z datetime na NULL)
IF OLD.locked IS NOT NULL
AND NEW.locked IS NULL THEN
UPDATE account_lock_history
SET
  unlocked_at = NOW (),
  unlock_reason = 'Account unlocked'
WHERE
  user_id = NEW.id
  AND unlocked_at IS NULL
ORDER BY
  locked_at DESC
LIMIT
  1;

END IF;

END;

;

DELIMITER;

-- System heartbeat monitoring table
-- Tracks system status and active processes across different hosts
CREATE TABLE
  `heartBeat` (
    `host` varchar(15) NOT NULL,
    `up` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
    `version` varchar(7) DEFAULT NULL,
    `user_id` smallint (5) unsigned NOT NULL DEFAULT 0,
    `user_loged` datetime DEFAULT NULL,
    `group_id` smallint (5) unsigned NOT NULL DEFAULT 0,
    `data` varchar(32) NOT NULL DEFAULT '',
    `remote_url` varchar(48) NOT NULL DEFAULT '',
    UNIQUE KEY `host` (`host`)
  ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

-- Quotes/messages table
-- Stores text content for automated posting with hash-based deduplication
CREATE TABLE
  `quotes` (
    `id` int (10) unsigned NOT NULL AUTO_INCREMENT,
    `user_id` smallint (5) unsigned DEFAULT 0,
    `text` text NOT NULL,
    `author` varchar(255) DEFAULT NULL,
    `hash` varchar(32) CHARACTER
    SET
      utf8mb4 COLLATE utf8mb4_bin NOT NULL,
      `next_seen` datetime DEFAULT NULL,
      PRIMARY KEY (`id`),
      UNIQUE KEY `hash` (`hash`),
      KEY `user_id` (`user_id`)
  ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

DELIMITER;

;

CREATE TRIGGER `quotes_before_insert` BEFORE INSERT ON `quotes` FOR EACH ROW BEGIN
SET
  NEW.hash = MD5 (NEW.text);

END;

;

CREATE TRIGGER `quotes_before_update` BEFORE
UPDATE ON `quotes` FOR EACH ROW BEGIN
SET
  NEW.hash = MD5 (NEW.text);

END;

;

DELIMITER;

-- HTTP referers tracking table
-- Stores unique referer URLs for analytics and tracking
CREATE TABLE
  `referers` (
    `id` smallint (5) unsigned NOT NULL AUTO_INCREMENT,
    `url` varchar(255) NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `url` (`url`)
  ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

-- Development scheme/features tracking table
-- Tracks development tasks and feature implementation status
CREATE TABLE
  `scheme` (
    `id` varchar(6) NOT NULL,
    `name` varchar(128) NOT NULL,
    `type` varchar(64) NOT NULL,
    `description` text DEFAULT NULL,
    `status` enum ('todo', 'partial', 'done', 'deprecated') DEFAULT 'todo',
    `visible` tinyint (1) DEFAULT 1,
    `position_x` float DEFAULT NULL,
    `position_y` float DEFAULT NULL,
    PRIMARY KEY (`id`)
  ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_czech_ci;

-- UI commands queue table
-- Stores remote UI commands for distributed system control
CREATE TABLE
  `ui_commands` (
    `id` bigint (20) unsigned NOT NULL AUTO_INCREMENT,
    `host` varchar(15) NOT NULL,
    `command` varchar(15) NOT NULL,
    `data` longtext CHARACTER
    SET
      utf8mb4 COLLATE utf8mb4_bin NOT NULL,
      `created` timestamp NOT NULL DEFAULT current_timestamp(),
      `accepted` timestamp NULL DEFAULT NULL,
      `fulfilled` varchar(1) NOT NULL DEFAULT '0',
      PRIMARY KEY (`id`)
  ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

-- URLs tracking table
-- Tracks visited URLs with usage statistics
CREATE TABLE
  `urls` (
    `used` smallint (5) unsigned NOT NULL DEFAULT 0,
    `url` varchar(255) NOT NULL,
    `date` timestamp NOT NULL DEFAULT current_timestamp(),
    PRIMARY KEY (`url`)
  ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

-- User action scheduling table
-- Manages scheduled actions for each user with timing constraints
CREATE TABLE
  `user_action_plan` (
    `user_id` smallint (5) unsigned NOT NULL,
    `action_code` varchar(30) NOT NULL,
    `next_time` datetime NOT NULL,
    PRIMARY KEY (`user_id`, `action_code`),
    CONSTRAINT `user_action_plan_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `fb_users` (`id`) ON DELETE CASCADE
  ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

-- User-group relationships table
-- Links users to Facebook groups with relationship metadata
CREATE TABLE
  `user_groups` (
    `user_id` smallint (5) unsigned NOT NULL,
    `group_id` smallint (5) unsigned NOT NULL,
    `type` tinyint (3) unsigned NOT NULL DEFAULT 0,
    `note` tinytext DEFAULT NULL,
    `time` datetime DEFAULT NULL,
    UNIQUE KEY `user_group` (`user_id`, `group_id`) USING BTREE,
    KEY `group_id` (`group_id`),
    CONSTRAINT `user_groups_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `fb_users` (`id`) ON UPDATE CASCADE,
    CONSTRAINT `user_groups_ibfk_2` FOREIGN KEY (`group_id`) REFERENCES `fb_groups` (`id`) ON UPDATE CASCADE
  ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

-- User group posting limits table
-- Defines posting limits per user for different group types
CREATE TABLE
  `user_group_limits` (
    `user_id` smallint (5) unsigned NOT NULL,
    `group_type` varchar(3) NOT NULL COMMENT 'G, GV, P, Z',
    `max_posts` smallint (3) unsigned NOT NULL DEFAULT 15 COMMENT 'Maximální počet příspěvků',
    `time_window_hours` smallint (3) unsigned NOT NULL DEFAULT 24 COMMENT 'Časové okno v hodinách',
    `created` timestamp NULL DEFAULT current_timestamp(),
    `updated` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
    PRIMARY KEY (`user_id`, `group_type`),
    KEY `idx_group_type` (`group_type`),
    CONSTRAINT `user_group_limits_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `fb_users` (`id`) ON DELETE CASCADE
  ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

-- System variables configuration table
-- Stores dynamic system configuration values
CREATE TABLE
  `variables` (
    `name` varchar(24) NOT NULL,
    `value` tinytext NOT NULL,
    `changed` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
    PRIMARY KEY (`name`)
  ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

-- Version tracking table
-- Tracks application versions for deployment management
CREATE TABLE
  `versions` (
    `id` int (10) unsigned NOT NULL AUTO_INCREMENT,
    `code` varchar(7) NOT NULL,
    `source` varchar(64) DEFAULT 'git',
    `hostname` varchar(32) DEFAULT NULL,
    `created` timestamp NULL DEFAULT current_timestamp(),
    PRIMARY KEY (`id`),
    KEY `idx_created` (`created` DESC)
  ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_czech_ci;

-- Action quality monitoring table
-- Tracks success rates and quality metrics for automated actions
CREATE TABLE
  IF NOT EXISTS `action_quality` (
    `id` bigint (20) NOT NULL AUTO_INCREMENT,
    `user_id` int (11) NOT NULL,
    `action_code` varchar(50) NOT NULL,
    `success` tinyint (1) NOT NULL,
    `details` text,
    `verification_used` tinyint (1) DEFAULT 0,
    `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `user_action` (`user_id`, `action_code`),
    KEY `created_at` (`created_at`)
  ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- System performance metrics table
-- Stores JSON-formatted system performance and monitoring data
CREATE TABLE
  IF NOT EXISTS `system_metrics` (
    `id` bigint (20) NOT NULL AUTO_INCREMENT,
    `data` json NOT NULL,
    `timestamp` timestamp DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `timestamp` (`timestamp`)
  ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- Message deduplication hashes table
-- Prevents duplicate message posting using content hashes
CREATE TABLE
  IF NOT EXISTS `message_hashes` (
    `id` bigint (20) NOT NULL AUTO_INCREMENT,
    `group_id` int (11) NOT NULL,
    `hash` varchar(32) NOT NULL,
    `preview` varchar(100),
    `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `group_hash` (`group_id`, `hash`),
    KEY `created_at` (`created_at`)
  ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;


-- Popis: Tabulka pro ukládání detailních error reportů z FB analýzy
-- Používá se při detekci problémů se stránkami a účty
CREATE TABLE
  IF NOT EXISTS fb_error_reports (
    id INT (11) AUTO_INCREMENT PRIMARY KEY,
    -- Časové údaje
    created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- Uživatel - přesný datový typ jako v fb_users
    user_id SMALLINT (5) UNSIGNED NULL,
    user_name TINYTEXT,
    user_surname TINYTEXT,
    -- Skupina - přesný datový typ jako v fb_groups
    group_id SMALLINT (5) UNSIGNED NULL,
    group_fb_id VARCHAR(255) NULL,
    -- Detaily chyby
    error_type VARCHAR(50) NOT NULL,
    error_reason TEXT,
    page_url TEXT NOT NULL,
    page_title VARCHAR(500),
    -- Analýza stránky
    page_elements_summary TEXT,
    detected_buttons TEXT,
    detected_texts TEXT,
    -- Raw analýza data (TEXT pro kompatibilitu)
    full_analysis_data TEXT,
    -- Metadata
    hostname VARCHAR(100),
    user_agent TEXT,
    -- Status sledování
    reviewed TINYINT (1) DEFAULT 0,
    resolved TINYINT (1) DEFAULT 0,
    resolution_notes TEXT,
    -- Indexy pro rychlejší vyhledávání
    KEY idx_created (created),
    KEY idx_user_id (user_id),
    KEY idx_error_type (error_type),
    KEY idx_reviewed (reviewed)
  ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = 'Error reporty z FB analýzy pro autonomní učení systému';

-- Locked accounts view definition table
-- Temporary table structure for the v_locked_accounts view
CREATE TABLE
  `v_locked_accounts` (
    `id` smallint (5) unsigned,
    `name` tinytext,
    `surname` tinytext,
    `host` varchar(15),
    `locked` datetime,
    `lock_reason` varchar(255),
    `lock_type` varchar(50),
    `hours_locked` bigint (21),
    `days_locked` bigint (21),
    `detection_details` longtext,
    `priority_level` varchar(16)
  );

DROP TABLE IF EXISTS `v_locked_accounts`;

CREATE ALGORITHM = UNDEFINED SQL SECURITY DEFINER VIEW `v_locked_accounts` AS
select
  `u`.`id` AS `id`,
  `u`.`name` AS `name`,
  `u`.`surname` AS `surname`,
  `u`.`host` AS `host`,
  `u`.`locked` AS `locked`,
  `u`.`lock_reason` AS `lock_reason`,
  `u`.`lock_type` AS `lock_type`,
  timestampdiff (HOUR, `u`.`locked`, current_timestamp()) AS `hours_locked`,
  timestampdiff (DAY, `u`.`locked`, current_timestamp()) AS `days_locked`,
  `alh`.`detection_details` AS `detection_details`,
  case
    when `u`.`lock_type` = 'VIDEOSELFIE' then 'Vysoká priorita'
    when `u`.`lock_type` = 'ACCOUNT_LOCKED' then 'Střední priorita'
    when `u`.`lock_type` = 'SECURITY_CHECKPOINT' then 'Střední priorita'
    else 'Nízká priorita'
  end AS `priority_level`
from
  (
    `fb_users` `u`
    left join `account_lock_history` `alh` on (
      `u`.`id` = `alh`.`user_id`
      and `alh`.`unlocked_at` is null
    )
  )
where
  `u`.`locked` is not null
order by
  `u`.`locked` desc;
