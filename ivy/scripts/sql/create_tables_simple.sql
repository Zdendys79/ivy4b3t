-- Jednoduché vytvoření tabulek pro blocking systémy

-- 1. Hostname protection table
CREATE TABLE `hostname_protection` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `hostname` varchar(100) NOT NULL,
  `blocked_until` datetime NOT NULL,
  `blocked_reason` varchar(255) NOT NULL,
  `blocked_user_id` smallint(5) unsigned NOT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `hostname_unique` (`hostname`),
  KEY `idx_blocked_until` (`blocked_until`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Rozšíření user_groups tabulky
ALTER TABLE `user_groups` 
ADD COLUMN `blocked_until` datetime NULL DEFAULT NULL,
ADD COLUMN `block_count` tinyint unsigned NOT NULL DEFAULT 0,
ADD COLUMN `last_block_reason` varchar(255) NULL DEFAULT NULL,
ADD COLUMN `last_block_date` datetime NULL DEFAULT NULL,
ADD INDEX `idx_blocked_until` (`blocked_until`),
ADD INDEX `idx_user_blocked` (`user_id`, `blocked_until`);