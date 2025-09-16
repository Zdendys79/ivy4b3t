-- Přidání diagnostických sloupců do user_groups
-- Umístění: ~/ivy4b3t/sql/migrations/add_diagnostic_columns.sql

-- Přidat sloupce pro diagnostiku
ALTER TABLE user_groups 
ADD COLUMN screenshot MEDIUMBLOB COMMENT 'Base64 screenshot při selhání akce',
ADD COLUMN dom TEXT COMMENT 'Zjednodušený DOM otisk - viditelné elementy s vysokým z-index';

-- Index pro rychlé vyhledávání diagnostických dat
CREATE INDEX idx_user_groups_diagnostic ON user_groups (user_id, group_id, time);

-- Komentář k tabulce
ALTER TABLE user_groups COMMENT = 'Per-user group blocking s diagnostikou chyb';