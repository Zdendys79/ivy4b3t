-- Rozšíření user_groups tabulky pro per-user group blocking
-- Řeší problém s vyřizováním žádostí o členství

-- Přidání sloupců pro per-user group blocking
ALTER TABLE `user_groups` 
ADD COLUMN `blocked_until` datetime NULL DEFAULT NULL COMMENT 'Kdy bude skupina opět dostupná pro tohoto uživatele',
ADD COLUMN `block_count` tinyint unsigned NOT NULL DEFAULT 0 COMMENT 'Počet opakovaných problémů s touto skupinou',
ADD COLUMN `last_block_reason` varchar(255) NULL DEFAULT NULL COMMENT 'Důvod posledního zablokování',
ADD COLUMN `last_block_date` datetime NULL DEFAULT NULL COMMENT 'Datum posledního zablokování',
ADD INDEX `idx_blocked_until` (`blocked_until`),
ADD INDEX `idx_user_blocked` (`user_id`, `blocked_until`);

-- Poznámka: Sloupec 'available' už existuje pro základní dostupnost skupiny
-- Nové sloupce řeší per-user dočasné blokování s eskalací