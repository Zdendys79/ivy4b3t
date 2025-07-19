-- SQL skript pro vytvoření tabulek pro blocking systémy
-- Spusťte tento skript v databázi ivy

USE ivy;

-- 1. Tabulka pro hostname ochranu proti lavině banů
CREATE TABLE IF NOT EXISTS `hostname_protection` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `hostname` varchar(100) NOT NULL,
  `blocked_until` datetime NOT NULL,
  `blocked_reason` varchar(255) NOT NULL,
  `blocked_user_id` smallint(5) unsigned NOT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `hostname_unique` (`hostname`),
  KEY `idx_blocked_until` (`blocked_until`),
  KEY `idx_hostname_time` (`hostname`, `blocked_until`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
COMMENT='Ochrana proti lavině banů - blokování hostname';

-- 2. Rozšíření user_groups tabulky pro per-user group blocking
-- Nejprve zkontroluj, zda sloupce už neexistují
SET @sql = '';
SELECT COUNT(*) INTO @exists FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'ivy' AND TABLE_NAME = 'user_groups' AND COLUMN_NAME = 'blocked_until';

-- Přidej sloupce pouze pokud neexistují
SET @sql = IF(@exists = 0, 
  'ALTER TABLE `user_groups` 
   ADD COLUMN `blocked_until` datetime NULL DEFAULT NULL COMMENT "Kdy bude skupina opět dostupná pro tohoto uživatele",
   ADD COLUMN `block_count` tinyint unsigned NOT NULL DEFAULT 0 COMMENT "Počet opakovaných problémů s touto skupinou",
   ADD COLUMN `last_block_reason` varchar(255) NULL DEFAULT NULL COMMENT "Důvod posledního zablokování",
   ADD COLUMN `last_block_date` datetime NULL DEFAULT NULL COMMENT "Datum posledního zablokování",
   ADD INDEX `idx_blocked_until` (`blocked_until`),
   ADD INDEX `idx_user_blocked` (`user_id`, `blocked_until`);',
  'SELECT "user_groups columns already exist" as message;'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3. Ověř vytvoření tabulek
SELECT 'hostname_protection table check:' as info;
SELECT TABLE_NAME, TABLE_COMMENT 
FROM INFORMATION_SCHEMA.TABLES 
WHERE TABLE_SCHEMA = 'ivy' AND TABLE_NAME = 'hostname_protection';

SELECT 'user_groups new columns check:' as info;
SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_COMMENT 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'ivy' AND TABLE_NAME = 'user_groups' 
AND COLUMN_NAME IN ('blocked_until', 'block_count', 'last_block_reason', 'last_block_date');

-- Zobraz počet řádků pro ověření
SELECT COUNT(*) as hostname_protection_rows FROM hostname_protection;
SELECT COUNT(*) as user_groups_rows FROM user_groups;

SELECT 'Blocking tables successfully created/updated!' as result;