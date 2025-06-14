-- ivy_create_full.sql
-- Kompletní skript pro vytvoření databáze `ivy` a souvisejících tabulek a dat
-- Opraveno podle aktuální struktury databáze (2025-06-14)

-- 1. Vytvoření databáze
CREATE DATABASE IF NOT EXISTS ivy CHARACTER
SET
  utf8mb4 COLLATE utf8mb4_general_ci;

USE ivy;

-- 2. Tabulka verzí systému
CREATE TABLE
  versions (
    id int (10) unsigned NOT NULL AUTO_INCREMENT,
    code varchar(7) NOT NULL,
    hash char(40) NOT NULL,
    source varchar(64) DEFAULT 'git',
    hostname varchar(32) DEFAULT NULL,
    created timestamp NULL DEFAULT current_timestamp(),
    PRIMARY KEY (id),
    UNIQUE KEY uniq_hash (hash),
    KEY idx_created (created DESC)
  ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_czech_ci;

-- 3. Tabulka schématu systému (OPRAVENO: varchar(6) místo varchar(8))
CREATE TABLE
  scheme (
    id varchar(6) NOT NULL,
    name varchar(128) NOT NULL,
    type varchar(64) NOT NULL,
    description text DEFAULT NULL,
    status enum ('todo', 'partial', 'done', 'deprecated') DEFAULT 'todo',
    visible tinyint (1) DEFAULT 1,
    position_x float DEFAULT NULL,
    position_y float DEFAULT NULL,
    PRIMARY KEY (id)
  ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_czech_ci;

-- 4. Tabulka heartbeat
CREATE TABLE
  heartbeat (
    host varchar(15) NOT NULL,
    up datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    version varchar(7) DEFAULT NULL,
    user_id smallint (5) unsigned NOT NULL DEFAULT 0,
    user_loged datetime DEFAULT NULL,
    group_id smallint (5) unsigned NOT NULL DEFAULT 0,
    data varchar(32) NOT NULL DEFAULT '',
    remote_url varchar(48) NOT NULL DEFAULT '',
    UNIQUE KEY host (host)
  ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

-- 5. Tabulka fb_users
CREATE TABLE
  fb_users (
    id smallint (5) unsigned NOT NULL,
    name tinytext NOT NULL,
    surname tinytext NOT NULL,
    day_limit smallint (5) unsigned DEFAULT 10,
    max_limit smallint (5) unsigned DEFAULT NULL,
    next_worktime datetime DEFAULT NULL,
    next_statement datetime NOT NULL,
    e_mail tinytext NOT NULL,
    e_pass tinytext DEFAULT NULL,
    fb_login tinytext NOT NULL,
    fb_pass tinytext DEFAULT NULL,
    u_login tinytext NOT NULL,
    u_pass tinytext DEFAULT NULL,
    locked datetime DEFAULT NULL,
    unlocked date DEFAULT NULL,
    day_limit_updated date DEFAULT NULL,
    last_add_group date DEFAULT NULL,
    portal_id tinyint (3) unsigned DEFAULT 1,
    host varchar(15) DEFAULT NULL,
    PRIMARY KEY (id)
  ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

-- 6. Tabulka fb_groups
CREATE TABLE
  fb_groups (
    id smallint (5) unsigned NOT NULL AUTO_INCREMENT,
    fb_id varchar(255) DEFAULT NULL,
    nazev tinytext DEFAULT NULL,
    priority tinyint (1) unsigned NOT NULL DEFAULT 3,
    user_counter int (11) DEFAULT NULL,
    note tinytext DEFAULT NULL,
    last_seen datetime DEFAULT NULL,
    next_seen datetime DEFAULT NULL,
    typ varchar(2) DEFAULT NULL,
    region_id tinyint (3) unsigned NOT NULL DEFAULT 0,
    district_id tinyint (3) unsigned NOT NULL DEFAULT 0,
    sell tinyint (1) DEFAULT 0,
    PRIMARY KEY (id)
  ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

-- 7. Tabulka ui_commands
CREATE TABLE
  ui_commands (
    id bigint (20) unsigned NOT NULL AUTO_INCREMENT,
    host varchar(15) NOT NULL,
    command varchar(15) NOT NULL,
    data longtext CHARACTER
    SET
      utf8mb4 COLLATE utf8mb4_bin NOT NULL,
      created timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      accepted timestamp NULL DEFAULT NULL,
      fulfilled varchar(1) NOT NULL DEFAULT '0',
      PRIMARY KEY (id)
  ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

-- 8. Tabulka quotes s triggery
CREATE TABLE
  quotes (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id SMALLINT (5) UNSIGNED DEFAULT 0,
    text TEXT NOT NULL,
    author VARCHAR(255) DEFAULT NULL,
    hash VARCHAR(32) CHARACTER
    SET
      utf8mb4 COLLATE utf8mb4_bin NOT NULL,
      next_seen DATETIME DEFAULT NULL,
      UNIQUE KEY (hash),
      KEY user_id (user_id)
  ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

-- NOVÉ: Triggery pro automatické generování hash
DELIMITER;

;

CREATE TRIGGER quotes_before_insert BEFORE INSERT ON quotes FOR EACH ROW BEGIN
SET
  NEW.hash = MD5 (NEW.text);

END;

;

CREATE TRIGGER quotes_before_update BEFORE
UPDATE ON quotes FOR EACH ROW BEGIN
SET
  NEW.hash = MD5 (NEW.text);

END;

;

DELIMITER;

-- 9. Tabulka urls
CREATE TABLE
  urls (
    used smallint (5) unsigned NOT NULL DEFAULT 0,
    url varchar(255) NOT NULL,
    date timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (url)
  ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

-- 10. Tabulka variables
CREATE TABLE
  variables (
    name varchar(24) NOT NULL,
    value tinytext NOT NULL,
    changed datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (name)
  ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

-- 11. Tabulka referers
CREATE TABLE
  referers (
    id smallint (5) unsigned NOT NULL AUTO_INCREMENT,
    url varchar(255) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY url (url)
  ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

-- 12. Tabulka user_groups
CREATE TABLE
  user_groups (
    user_id smallint (5) unsigned NOT NULL,
    group_id smallint (5) unsigned NOT NULL,
    type tinyint (3) unsigned NOT NULL DEFAULT 0,
    note tinytext DEFAULT NULL,
    time datetime DEFAULT NULL,
    UNIQUE KEY user_group (user_id, group_id) USING BTREE,
    KEY group_id (group_id),
    CONSTRAINT user_groups_ibfk_1 FOREIGN KEY (user_id) REFERENCES fb_users (id) ON UPDATE CASCADE,
    CONSTRAINT user_groups_ibfk_2 FOREIGN KEY (group_id) REFERENCES fb_groups (id) ON UPDATE CASCADE
  ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

-- 13. Codebook tabulky
CREATE TABLE
  c_portals (
    id tinyint (3) unsigned NOT NULL,
    portal tinytext DEFAULT NULL,
    PRIMARY KEY (id)
  ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

CREATE TABLE
  c_regions (
    id tinyint (3) unsigned NOT NULL,
    region tinytext DEFAULT NULL,
    PRIMARY KEY (id)
  ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

CREATE TABLE
  c_districts (
    id tinyint (3) unsigned NOT NULL,
    region_id tinyint (3) unsigned DEFAULT NULL,
    district tinytext DEFAULT NULL,
    PRIMARY KEY (id),
    KEY RegionKey (region_id),
    CONSTRAINT c_districts_FK FOREIGN KEY (region_id) REFERENCES c_regions (id) ON UPDATE CASCADE
  ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

-- 14. Tabulka action_log
CREATE TABLE
  action_log (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    account_id SMALLINT (5) UNSIGNED NOT NULL,
    action_code VARCHAR(30) NOT NULL,
    reference_id VARCHAR(64) DEFAULT NULL,
    text TEXT DEFAULT NULL,
    FOREIGN KEY (account_id) REFERENCES fb_users (id) ON UPDATE CASCADE
  ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

-- 15. Tabulka log
CREATE TABLE
  log (
    inserted datetime NOT NULL,
    user_id smallint (5) unsigned NOT NULL,
    group_id smallint (5) unsigned NOT NULL,
    region_id tinyint (3) unsigned NOT NULL,
    district_id tinyint (3) unsigned NOT NULL,
    portal_id tinyint (3) unsigned NOT NULL,
    hostname tinytext DEFAULT NULL,
    posted_data text DEFAULT NULL,
    md5 tinytext DEFAULT NULL,
    KEY log_FK (district_id),
    KEY log_FK_1 (portal_id),
    KEY log_FK_2 (region_id),
    KEY log_FK_3 (group_id),
    KEY log_FK_user (user_id),
    KEY inserted (inserted),
    CONSTRAINT log_FK FOREIGN KEY (district_id) REFERENCES c_districts (id) ON UPDATE CASCADE,
    CONSTRAINT log_FK_1 FOREIGN KEY (portal_id) REFERENCES c_portals (id) ON UPDATE CASCADE,
    CONSTRAINT log_FK_2 FOREIGN KEY (region_id) REFERENCES c_regions (id) ON UPDATE CASCADE,
    CONSTRAINT log_FK_user FOREIGN KEY (user_id) REFERENCES fb_users (id) ON UPDATE CASCADE,
    CONSTRAINT log_ibfk_1 FOREIGN KEY (group_id) REFERENCES fb_groups (id)
  ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

-- 16. Systémový log
CREATE TABLE
  log_s (
    id int (11) NOT NULL AUTO_INCREMENT,
    time datetime DEFAULT current_timestamp(),
    hostname varchar(64) DEFAULT NULL,
    title varchar(255) DEFAULT NULL,
    text text DEFAULT NULL,
    data text DEFAULT NULL,
    PRIMARY KEY (id)
  ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

-- 17. Action system tabulky
CREATE TABLE
  action_definitions (
    action_code varchar(30) NOT NULL,
    label varchar(64) NOT NULL,
    description text DEFAULT NULL,
    weight int (10) unsigned DEFAULT 1,
    min_minutes int (10) unsigned NOT NULL,
    max_minutes int (10) unsigned NOT NULL,
    repeatable tinyint (1) DEFAULT 1,
    active tinyint (1) DEFAULT 1,
    PRIMARY KEY (action_code)
  ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

CREATE TABLE
  user_action_plan (
    user_id smallint (5) unsigned NOT NULL,
    action_code varchar(30) NOT NULL,
    next_time datetime NOT NULL,
    PRIMARY KEY (user_id, action_code),
    CONSTRAINT user_action_plan_ibfk_1 FOREIGN KEY (user_id) REFERENCES fb_users (id) ON DELETE CASCADE
  ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

-- 18. Tabulka limitů pro skupiny (OPRAVENO: komentář)
CREATE TABLE
  user_group_limits (
    user_id SMALLINT (5) UNSIGNED NOT NULL,
    group_type VARCHAR(3) NOT NULL COMMENT 'G, GV, P, Z',
    max_posts SMALLINT (3) UNSIGNED NOT NULL DEFAULT 15 COMMENT 'Maximální počet příspěvků',
    time_window_hours SMALLINT (3) UNSIGNED NOT NULL DEFAULT 24 COMMENT 'Časové okno v hodinách',
    created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, group_type),
    FOREIGN KEY (user_id) REFERENCES fb_users (id) ON DELETE CASCADE,
    INDEX idx_group_type (group_type)
  ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

-- Konec skriptu
-- ivy_create_full.sql
