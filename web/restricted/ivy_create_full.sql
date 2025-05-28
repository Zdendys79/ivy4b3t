-- ivy_create_full.sql
-- Kompletní skript pro vytvoření databáze `ivy` a souvisejících tabulek a dat

-- 1. Vytvoření databáze
CREATE DATABASE IF NOT EXISTS ivy CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
USE ivy;

-- 2. Tabulka verzí systému
CREATE TABLE `versions` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `code` varchar(7) NOT NULL,
  `hash` char(40) NOT NULL,
  `source` varchar(64) DEFAULT 'git',
  `hostname` varchar(32) DEFAULT NULL,
  `created` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_hash` (`hash`),
  KEY `idx_created` (`created` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_czech_ci;

-- 3. Tabulka schématu systému
CREATE TABLE `scheme` (
  `id` varchar(8) NOT NULL,
  `name` varchar(128) NOT NULL,
  `type` varchar(64) NOT NULL,
  `description` text DEFAULT NULL,
  `status` enum('todo','partial','done','deprecated') DEFAULT 'todo',
  `visible` tinyint(1) DEFAULT 1,
  `position_x` float DEFAULT NULL,
  `position_y` float DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_czech_ci;

-- 4. Tabulka heartbeat
CREATE TABLE `heartbeat` (
  `host` varchar(15) NOT NULL,
  `up` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `version` varchar(7) DEFAULT NULL,
  `user_id` smallint(5) unsigned NOT NULL DEFAULT 0,
  `user_loged` datetime DEFAULT NULL,
  `group_id` smallint(5) unsigned NOT NULL DEFAULT 0,
  `data` varchar(32) NOT NULL DEFAULT '',
  `remote_url` varchar(48) NOT NULL DEFAULT '',
  UNIQUE KEY `host` (`host`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 5. Tabulka fb_users (pouze používané sloupce)
CREATE TABLE `fb_users` (
  `id` smallint(5) unsigned NOT NULL,
  `name` tinytext NOT NULL,
  `surname` tinytext NOT NULL,
  `day_limit` smallint(5) unsigned DEFAULT 10,
  `max_limit` smallint(5) unsigned DEFAULT NULL,
  `next_worktime` datetime DEFAULT NULL,
  `next_statement` datetime NOT NULL,
  `e_mail` tinytext NOT NULL,
  `e_pass` tinytext DEFAULT NULL,
  `fb_login` tinytext NOT NULL,
  `fb_pass` tinytext DEFAULT NULL,
  `u_login` tinytext NOT NULL,
  `u_pass` tinytext DEFAULT NULL,
  `locked` datetime DEFAULT NULL,
  `unlocked` date DEFAULT NULL,
  `day_limit_updated` date DEFAULT NULL,
  `last_add_group` date DEFAULT NULL,
  `portal_id` tinyint(3) unsigned DEFAULT 1,
  `host` varchar(15) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 6. Tabulka fb_groups (pouze používané sloupce)
CREATE TABLE `fb_groups` (
  `id` smallint(5) unsigned NOT NULL AUTO_INCREMENT,
  `fb_id` varchar(255) DEFAULT NULL,
  `nazev` tinytext DEFAULT NULL,
  `priority` tinyint(1) unsigned NOT NULL DEFAULT 3,
  `user_counter` int(11) DEFAULT NULL,
  `note` tinytext DEFAULT NULL,
  `last_seen` datetime DEFAULT NULL,
  `next_seen` datetime DEFAULT NULL,
  `typ` varchar(2) DEFAULT NULL,
  `region_id` tinyint(3) unsigned NOT NULL DEFAULT 0,
  `district_id` tinyint(3) unsigned NOT NULL DEFAULT 0,
  `sell` tinyint(1) DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 7. Tabulka ui_commands (všechny sloupce jsou používány)
CREATE TABLE `ui_commands` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `host` varchar(15) NOT NULL,
  `command` varchar(15) NOT NULL,
  `data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `accepted` timestamp NULL DEFAULT NULL,
  `fulfilled` varchar(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 📂 Tabulka quotes (nahrazuje statements)
CREATE TABLE `quotes` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `user_id` SMALLINT(5) UNSIGNED DEFAULT 0,          -- Původní user_id, pro referenci
  `posted` DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,  -- Původní posted
  `text` TEXT NOT NULL,                               -- Text citátu
  `author` VARCHAR(255) DEFAULT NULL,                 -- Autor citátu (doplňujeme později)
  `hash` VARCHAR(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,  -- Původní hash
  `next_seen` DATETIME DEFAULT NULL,                  -- Ochranná lhůta pro znovupoužití
  UNIQUE KEY (`hash`),                                -- Zachování unikátnosti na základě hash
  KEY `user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 9. Tabulka urls
CREATE TABLE `urls` (
  `used` smallint(5) unsigned NOT NULL DEFAULT 0,
  `url` varchar(255) NOT NULL,
  `date` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`url`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 10. Tabulka variables
CREATE TABLE `variables` (
  `name` varchar(24) NOT NULL,
  `value` tinytext NOT NULL,
  `changed` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 11. Tabulka referers
CREATE TABLE IF NOT EXISTS `referers` (
  id SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  url VARCHAR(255) NOT NULL UNIQUE
);

-- 12. Tabulka user_groups
CREATE TABLE IF NOT EXISTS `user_groups` (
  `user_id` smallint(5) unsigned NOT NULL,
  `group_id` smallint(5) unsigned NOT NULL,
  `type` tinyint(3) unsigned NOT NULL DEFAULT 0,
  `note` tinytext DEFAULT NULL,
  `time` datetime DEFAULT NULL,
  UNIQUE KEY `user_group` (`user_id`,`group_id`) USING BTREE,
  KEY `group_id` (`group_id`),
  CONSTRAINT `user_groups_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `fb_users` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `user_groups_ibfk_2` FOREIGN KEY (`group_id`) REFERENCES `fb_groups` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `c_portals` (
  `id` tinyint(3) unsigned NOT NULL,
  `portal` tinytext DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `c_regions` (
  `id` tinyint(3) unsigned NOT NULL,
  `region` tinytext DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `c_districts` (
  `id` tinyint(3) unsigned NOT NULL,
  `region_id` tinyint(3) unsigned DEFAULT NULL,
  `district` tinytext DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `RegionKey` (`region_id`),
  CONSTRAINT `c_districts_FK` FOREIGN KEY (`region_id`) REFERENCES `c_regions` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `log_u` (
  `time` datetime DEFAULT NULL,
  `user_id` smallint(5) unsigned DEFAULT NULL,
  `type` tinyint(3) unsigned DEFAULT 0,
  `data` varchar(24) DEFAULT '',
  `text` tinytext DEFAULT NULL,
  KEY `log_u_FK_user` (`user_id`),
  CONSTRAINT `log_u_FK_user` FOREIGN KEY (`user_id`) REFERENCES `fb_users` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 📂 Tabulka action_log (sjednocený log všech akcí)
CREATE TABLE `action_log` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `timestamp` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,  -- Čas provedení akce
  `account_id` SMALLINT(5) UNSIGNED NOT NULL,               -- FB uživatel (cizí klíč na fb_users.id)
  `action_code` VARCHAR(30) NOT NULL,                       -- Kód akce (viz action_definitions)
  `reference_id` VARCHAR(64) DEFAULT NULL,                  -- Např. citat_id, group_id, post_id (podle akce)
  `text` TEXT DEFAULT NULL,                                 -- Doplňkový text (např. vložený komentář, text postu)
  FOREIGN KEY (`account_id`) REFERENCES fb_users (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- 13. Tabulka log
CREATE TABLE `log` (
  `inserted` datetime NOT NULL,
  `user_id` smallint(5) unsigned NOT NULL,
  `group_id` smallint(5) unsigned NOT NULL,
  `region_id` tinyint(3) unsigned NOT NULL,
  `district_id` tinyint(3) unsigned NOT NULL,
  `portal_id` tinyint(3) unsigned NOT NULL,
  `hostname` tinytext DEFAULT NULL,
  `posted_data` text DEFAULT NULL,
  `md5` tinytext DEFAULT NULL,
  KEY `log_FK` (`district_id`),
  KEY `log_FK_1` (`portal_id`),
  KEY `log_FK_2` (`region_id`),
  KEY `log_FK_3` (`group_id`),
  KEY `log_FK_user` (`user_id`),
  KEY `inserted` (`inserted`),
  CONSTRAINT `log_FK` FOREIGN KEY (`district_id`) REFERENCES `c_districts` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `log_FK_1` FOREIGN KEY (`portal_id`) REFERENCES `c_portals` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `log_FK_2` FOREIGN KEY (`region_id`) REFERENCES `c_regions` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `log_FK_user` FOREIGN KEY (`user_id`) REFERENCES `fb_users` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `log_ibfk_1` FOREIGN KEY (`group_id`) REFERENCES `fb_groups` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE action_definitions (
    action_code VARCHAR(30) PRIMARY KEY,     -- Např. 'group_post', 'comment', 'account_sleep'
    label VARCHAR(64) NOT NULL,              -- Popis (např. 'Příspěvek do skupiny')
    description TEXT,                        -- Detailní popis
    weight INT UNSIGNED DEFAULT 1,           -- Pravděpodobnost (síla v kole štěstí)
    min_minutes INT UNSIGNED NOT NULL,       -- Minimální interval v minutách
    max_minutes INT UNSIGNED NOT NULL,       -- Maximální interval v minutách
    repeatable BOOLEAN DEFAULT TRUE,         -- TRUE = akce se může spouštět vícekrát denně
    active BOOLEAN DEFAULT TRUE             -- FALSE = akce dočasně zakázána (bez mazání definice)
);

CREATE TABLE user_action_plan (
    user_id SMALLINT(5) UNSIGNED NOT NULL,
    action_code VARCHAR(30) NOT NULL,
    next_time DATETIME NOT NULL,
    PRIMARY KEY (user_id, action_code),
    FOREIGN KEY (user_id) REFERENCES fb_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Konec skriptu
-- ivy_create_full.sql
