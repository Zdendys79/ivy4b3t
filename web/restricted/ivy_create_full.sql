/*M!999999\- enable the sandbox mode */ 
-- MariaDB dump 10.19  Distrib 10.11.13-MariaDB, for debian-linux-gnu (x86_64)
--
-- Host: localhost    Database: ivy
-- ------------------------------------------------------
-- Server version	10.11.13-MariaDB-0ubuntu0.24.04.1

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;


--
-- Table structure for table `action_definitions`
--

DROP TABLE IF EXISTS `action_definitions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `action_definitions` (
  `action_code` varchar(30) NOT NULL,
  `label` varchar(64) NOT NULL,
  `description` text DEFAULT NULL,
  `weight` int(10) unsigned DEFAULT 1,
  `min_minutes` int(10) unsigned NOT NULL,
  `max_minutes` int(10) unsigned NOT NULL,
  `repeatable` tinyint(1) DEFAULT 1,
  `invasive` tinyint(1) NOT NULL DEFAULT 0,
  `active` tinyint(1) DEFAULT 1,
  PRIMARY KEY (`action_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `action_log`
--

DROP TABLE IF EXISTS `action_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `action_log` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `timestamp` datetime NOT NULL DEFAULT current_timestamp(),
  `account_id` smallint(5) unsigned NOT NULL,
  `action_code` varchar(30) NOT NULL,
  `reference_id` varchar(64) DEFAULT NULL,
  `text` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `account_id` (`account_id`),
  CONSTRAINT `action_log_ibfk_1` FOREIGN KEY (`account_id`) REFERENCES `fb_users` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=292 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `action_quality`
--

DROP TABLE IF EXISTS `action_quality`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `action_quality` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `action_code` varchar(50) NOT NULL,
  `success` tinyint(1) NOT NULL,
  `details` text DEFAULT NULL,
  `verification_used` tinyint(1) DEFAULT 0,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `user_action` (`user_id`,`action_code`),
  KEY `created_at` (`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=124 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `c_districts`
--

DROP TABLE IF EXISTS `c_districts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `c_districts` (
  `id` tinyint(3) unsigned NOT NULL,
  `region_id` tinyint(3) unsigned DEFAULT NULL,
  `district` tinytext DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `RegionKey` (`region_id`),
  CONSTRAINT `c_districts_FK` FOREIGN KEY (`region_id`) REFERENCES `c_regions` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `c_portals`
--

DROP TABLE IF EXISTS `c_portals`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `c_portals` (
  `id` tinyint(3) unsigned NOT NULL,
  `portal` tinytext DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `c_regions`
--

DROP TABLE IF EXISTS `c_regions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `c_regions` (
  `id` tinyint(3) unsigned NOT NULL,
  `region` tinytext DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `debug_incidents`
--

DROP TABLE IF EXISTS `debug_incidents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `debug_incidents` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `incident_id` varchar(100) NOT NULL,
  `timestamp` timestamp NULL DEFAULT current_timestamp(),
  `user_id` varchar(50) DEFAULT NULL,
  `error_level` enum('ERROR','WARNING','CRITICAL','INFO') DEFAULT 'ERROR',
  `error_message` text NOT NULL,
  `error_context` longtext DEFAULT NULL,
  `page_url` varchar(500) DEFAULT NULL,
  `page_title` varchar(200) DEFAULT NULL,
  `user_agent` varchar(300) DEFAULT NULL,
  `screenshot_data` longblob DEFAULT NULL,
  `dom_html` longtext DEFAULT NULL,
  `console_logs` longtext DEFAULT NULL,
  `user_comment` text DEFAULT NULL,
  `user_analysis_request` text DEFAULT NULL,
  `system_info` text DEFAULT NULL,
  `stack_trace` text DEFAULT NULL,
  `status` enum('NEW','ANALYZING','RESOLVED','ARCHIVED') DEFAULT 'NEW',
  `analyzed_by` varchar(50) DEFAULT NULL,
  `analysis_notes` text DEFAULT NULL,
  `resolution_notes` text DEFAULT NULL,
  `resolved_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `incident_id` (`incident_id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;


--
-- Table structure for table `fb_groups`
--

DROP TABLE IF EXISTS `fb_groups`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `fb_groups` (
  `id` smallint(5) unsigned NOT NULL AUTO_INCREMENT,
  `fb_id` varchar(255) DEFAULT NULL,
  `name` tinytext DEFAULT NULL,
  `priority` tinyint(1) unsigned NOT NULL DEFAULT 3,
  `user_counter` int(11) DEFAULT NULL,
  `note` tinytext DEFAULT NULL,
  `last_seen` datetime DEFAULT NULL,
  `next_seen` datetime DEFAULT NULL,
  `type` varchar(2) DEFAULT NULL,
  `region_id` tinyint(3) unsigned NOT NULL DEFAULT 0,
  `district_id` tinyint(3) unsigned NOT NULL DEFAULT 0,
  `is_buy_sell_group` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'Označuje zda je skupina prodejní (buy/sell) pro přímý přístup k diskuzi',
  `discovery_url` varchar(2048) DEFAULT NULL COMMENT 'URL kde byla skupina objevena',
  `member_count` int(11) DEFAULT NULL,
  `discovered_by_user_id` smallint(5) unsigned DEFAULT NULL,
  `status` varchar(20) DEFAULT 'active' COMMENT 'discovered, analyzed, active, inactive, banned',
  `description` text DEFAULT NULL,
  `category` varchar(255) DEFAULT NULL,
  `privacy_type` varchar(50) DEFAULT NULL,
  `language` varchar(10) DEFAULT 'cs',
  `activity_level` varchar(50) DEFAULT NULL,
  `is_relevant` tinyint(1) DEFAULT NULL,
  `posting_allowed` tinyint(1) DEFAULT NULL,
  `analysis_notes` text DEFAULT NULL,
  `analysis_count` int(11) DEFAULT 0,
  `last_analysis` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_is_buy_sell_group` (`is_buy_sell_group`)
) ENGINE=InnoDB AUTO_INCREMENT=1120 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `fb_users`
--

DROP TABLE IF EXISTS `fb_users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
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
  `locked` datetime DEFAULT NULL COMMENT 'Datum a čas zablokování účtu',
  `lock_reason` varchar(255) DEFAULT NULL COMMENT 'Důvod zablokování účtu',
  `lock_type` varchar(50) DEFAULT NULL COMMENT 'Typ problému (VIDEOSELFIE, CHECKPOINT, atd.)',
  `unlocked` date DEFAULT NULL,
  `day_limit_updated` date DEFAULT NULL,
  `last_add_group` date DEFAULT NULL,
  `portal_id` tinyint(3) unsigned DEFAULT 1,
  `host` varchar(15) DEFAULT NULL,
  `day_count` int(11) DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_locked_type` (`locked`,`lock_type`),
  KEY `idx_lock_reason` (`lock_reason`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `heartbeat`
--

DROP TABLE IF EXISTS `heartbeat`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `heartbeat` (
  `host` varchar(15) NOT NULL,
  `up` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `version` varchar(7) DEFAULT NULL,
  `user_id` smallint(5) unsigned DEFAULT NULL,
  `group_id` smallint(5) unsigned NOT NULL DEFAULT 0,
  `action_name` varchar(32) DEFAULT NULL,
  `action_started_at` datetime DEFAULT NULL,
  UNIQUE KEY `host` (`host`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;


/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `log_system`
--

DROP TABLE IF EXISTS `log_system`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `log_system` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `hostname` varchar(100) NOT NULL,
  `event_type` varchar(50) NOT NULL,
  `event_level` varchar(20) NOT NULL DEFAULT 'INFO',
  `message` text NOT NULL,
  `details` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`details`)),
  `user_id` smallint(5) unsigned DEFAULT NULL,
  `process_id` varchar(50) DEFAULT NULL,
  `timestamp` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_hostname_timestamp` (`hostname`,`timestamp`),
  KEY `idx_event_type_timestamp` (`event_type`,`timestamp`),
  KEY `idx_event_level` (`event_level`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `log_system_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `fb_users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=96 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `quotes`
--

DROP TABLE IF EXISTS `quotes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `quotes` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `text` text NOT NULL,
  `author` varchar(255) DEFAULT NULL,
  `hash` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `next_seen` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `hash` (`hash`)
) ENGINE=InnoDB AUTO_INCREMENT=405 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `referers`
--

DROP TABLE IF EXISTS `referers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `referers` (
  `id` smallint(5) unsigned NOT NULL AUTO_INCREMENT,
  `url` varchar(255) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `url` (`url`)
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `scheme`
--

DROP TABLE IF EXISTS `scheme`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `scheme` (
  `id` varchar(6) NOT NULL,
  `name` varchar(128) NOT NULL,
  `type` varchar(64) NOT NULL,
  `description` text DEFAULT NULL,
  `status` enum('todo','partial','done','deprecated') DEFAULT 'todo',
  `visible` tinyint(1) DEFAULT 1,
  `position_x` float DEFAULT NULL,
  `position_y` float DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_czech_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ui_commands`
--

DROP TABLE IF EXISTS `ui_commands`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `ui_commands` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `host` varchar(15) NOT NULL,
  `command` varchar(15) NOT NULL,
  `data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `created` timestamp NOT NULL DEFAULT current_timestamp(),
  `accepted` timestamp NULL DEFAULT NULL,
  `fulfilled` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;


--
-- Table structure for table `user_action_plan`
--

DROP TABLE IF EXISTS `user_action_plan`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_action_plan` (
  `user_id` smallint(5) unsigned NOT NULL,
  `action_code` varchar(30) NOT NULL,
  `next_time` datetime DEFAULT NULL,
  PRIMARY KEY (`user_id`,`action_code`),
  CONSTRAINT `user_action_plan_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `fb_users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_behavioral_profiles`
--

DROP TABLE IF EXISTS `user_behavioral_profiles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_behavioral_profiles` (
  `user_id` smallint(5) unsigned NOT NULL,
  `avg_typing_speed` decimal(5,2) DEFAULT 150.00,
  `typing_variance` decimal(3,2) DEFAULT 0.30,
  `mistake_rate` decimal(4,3) DEFAULT 0.050,
  `correction_style` varchar(20) DEFAULT 'casual',
  `double_key_chance` decimal(4,3) DEFAULT 0.100,
  `backspace_delay` int(11) DEFAULT 200,
  `impatience_level` decimal(3,2) DEFAULT 0.50,
  `multitasking_tendency` decimal(3,2) DEFAULT 0.50,
  `attention_span` int(11) DEFAULT 90,
  `decision_speed` decimal(3,2) DEFAULT 0.50,
  `perfectionism` decimal(3,2) DEFAULT 0.50,
  `base_mood` varchar(20) DEFAULT 'neutral',
  `mood_volatility` decimal(3,2) DEFAULT 0.30,
  `frustration_threshold` decimal(3,2) DEFAULT 0.70,
  `energy_level` decimal(3,2) DEFAULT 0.80,
  `scroll_intensity` varchar(10) DEFAULT 'medium',
  `reading_speed` decimal(5,2) DEFAULT 240.00,
  `distraction_chance` decimal(3,2) DEFAULT 0.20,
  `procrastination_level` decimal(3,2) DEFAULT 0.40,
  `like_frequency` decimal(4,3) DEFAULT 0.100,
  `comment_tendency` decimal(4,3) DEFAULT 0.050,
  `hover_behavior` varchar(20) DEFAULT 'normal',
  `click_pattern` varchar(20) DEFAULT 'normal',
  `learning_rate` decimal(3,2) DEFAULT 0.10,
  `pattern_memory` decimal(3,2) DEFAULT 0.70,
  `behavior_confidence` decimal(3,2) DEFAULT 0.50,
  `last_mood_update` timestamp NULL DEFAULT current_timestamp(),
  `created` timestamp NULL DEFAULT current_timestamp(),
  `updated` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`user_id`),
  CONSTRAINT `user_behavioral_profiles_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `fb_users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_group_limits`
--

DROP TABLE IF EXISTS `user_group_limits`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_group_limits` (
  `user_id` smallint(5) unsigned NOT NULL,
  `group_type` varchar(3) NOT NULL COMMENT 'G, GV, P, Z',
  `max_posts` smallint(3) unsigned NOT NULL DEFAULT 15 COMMENT 'Maximální počet příspěvků',
  `time_window_hours` smallint(3) unsigned NOT NULL DEFAULT 24 COMMENT 'Časové okno v hodinách',
  `created` timestamp NULL DEFAULT current_timestamp(),
  `updated` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`user_id`,`group_type`),
  KEY `idx_group_type` (`group_type`),
  CONSTRAINT `user_group_limits_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `fb_users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_groups`
--

DROP TABLE IF EXISTS `user_groups`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_groups` (
  `user_id` smallint(5) unsigned NOT NULL,
  `group_id` smallint(5) unsigned NOT NULL,
  `type` tinyint(3) unsigned NOT NULL DEFAULT 0,
  `note` tinytext DEFAULT NULL,
  `time` datetime DEFAULT NULL,
  `blocked_until` datetime DEFAULT NULL,
  `block_count` tinyint(3) unsigned NOT NULL DEFAULT 0,
  `last_block_reason` varchar(255) DEFAULT NULL,
  `last_block_date` datetime DEFAULT NULL,
  UNIQUE KEY `user_group` (`user_id`,`group_id`) USING BTREE,
  KEY `group_id` (`group_id`),
  CONSTRAINT `user_groups_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `fb_users` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `user_groups_ibfk_2` FOREIGN KEY (`group_id`) REFERENCES `fb_groups` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `variables`
--

DROP TABLE IF EXISTS `variables`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `variables` (
  `name` varchar(24) NOT NULL,
  `value` tinytext NOT NULL,
  `type` varchar(20) DEFAULT 'string',
  `changed` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;


/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-07-25 19:19:00
