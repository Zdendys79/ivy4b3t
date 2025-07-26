#!/bin/bash

# update_blocking_tables.sh
# Umístění: ~/scripts/update_blocking_tables.sh
#
# Popis: Aktualizační skript pro přidání blocking tabulek do existující databáze
#        Přidává hostname_protection tabulku a rozšiřuje user_groups

set -e # Ukončit při jakékoliv chybě

echo "=== 🔧 Aktualizace Blocking Tabulek ==="

# Získej adresář skriptu
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Databázové údaje
if [ -f "$PROJECT_ROOT/web/restricted/sql_config.json" ]; then
    CONFIG_FILE="$PROJECT_ROOT/web/restricted/sql_config.json"
elif [ -f "$PROJECT_ROOT/ivy/sql/sql_config.json" ]; then
    CONFIG_FILE="$PROJECT_ROOT/ivy/sql/sql_config.json"
else
    echo "❌ Nenalezen sql_config.json"
    exit 1
fi

echo "📁 Používám konfiguraci: $CONFIG_FILE"

# Načti databázové údaje pomocí jq (pokud je dostupné)
if command -v jq >/dev/null 2>&1; then
    DB_HOST=$(jq -r '.host' "$CONFIG_FILE")
    DB_USER=$(jq -r '.user' "$CONFIG_FILE")
    DB_PASS=$(jq -r '.password' "$CONFIG_FILE")
    DB_NAME=$(jq -r '.database' "$CONFIG_FILE")
else
    echo "⚠️  jq není dostupné, používám výchozí hodnoty"
    DB_HOST="localhost"
    DB_USER="claude"
    DB_PASS="$DB_PASS"
    DB_NAME="ivy"
fi

echo "📊 Databáze: $DB_NAME na $DB_HOST"

# Vytvoř dočasný SQL soubor
TEMP_SQL=$(mktemp)
cat > "$TEMP_SQL" << 'EOF'
-- Aktualizace pro blocking systémy

-- 1. Hostname protection tabulka
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
COMMENT='Hostname protection against account ban cascades';

-- 2. Rozšíření user_groups tabulky
-- Zkontroluj, zda sloupce už neexistují
SELECT 'Checking user_groups table structure...' as status;

SET @sql = '';
SELECT COUNT(*) INTO @exists FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_groups' AND COLUMN_NAME = 'blocked_until';

-- Přidej sloupce pouze pokud neexistují
SET @sql = IF(@exists = 0, 
  'ALTER TABLE `user_groups` 
   ADD COLUMN `blocked_until` datetime NULL DEFAULT NULL COMMENT "Kdy bude skupina opět dostupná pro tohoto uživatele",
   ADD COLUMN `block_count` tinyint unsigned NOT NULL DEFAULT 0 COMMENT "Počet opakovaných problémů s touto skupinou",
   ADD COLUMN `last_block_reason` varchar(255) NULL DEFAULT NULL COMMENT "Důvod posledního zablokování",
   ADD COLUMN `last_block_date` datetime NULL DEFAULT NULL COMMENT "Datum posledního zablokování";',
  'SELECT "user_groups columns already exist" as message;'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3. Přidej indexy
SET @sql = '';
SELECT COUNT(*) INTO @idx_exists FROM INFORMATION_SCHEMA.STATISTICS 
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_groups' AND INDEX_NAME = 'idx_ug_blocked_until';

SET @sql = IF(@idx_exists = 0, 
  'ALTER TABLE `user_groups` 
   ADD INDEX `idx_ug_blocked_until` (`blocked_until`),
   ADD INDEX `idx_ug_user_blocked` (`user_id`, `blocked_until`);',
  'SELECT "user_groups indexes already exist" as message;'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 4. Ověření
SELECT 'Hostname protection table:' as info;
SELECT COUNT(*) as table_exists FROM INFORMATION_SCHEMA.TABLES 
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'hostname_protection';

SELECT 'User groups new columns:' as info;
SELECT COLUMN_NAME, COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_groups' 
AND COLUMN_NAME IN ('blocked_until', 'block_count', 'last_block_reason', 'last_block_date');

SELECT 'Update completed successfully!' as result;
EOF

echo "🔄 Spouštím aktualizaci databáze..."

# Spusť SQL
if mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" < "$TEMP_SQL"; then
    echo "✅ Aktualizace úspěšně dokončena"
else
    echo "❌ Chyba při aktualizaci databáze"
    rm -f "$TEMP_SQL"
    exit 1
fi

# Cleanup
rm -f "$TEMP_SQL"

echo "🎯 Blocking systémy jsou připraveny k použití!"
echo "   - hostname_protection: Ochrana proti lavině banů"
echo "   - user_groups extensions: Per-user group blocking s escalací"