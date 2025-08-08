-- ===============================================
-- SYNCHRONIZACE STRUKTURY DATABÁZÍ ivy_test ←→ ivy
-- ===============================================
-- 
-- Tento skript sjednocuje strukturu mezi vývojovou (ivy_test) 
-- a produkční (ivy) databází
--
-- VAROVÁNÍ: PROVÁDĚT POUZE PO ZÁLOHOVÁNÍ!
-- ===============================================

-- 1. CHYBĚJÍCÍ TABULKY V PRODUKCI
-- ===============================================

-- Vytvoření tabulek které jsou pouze v ivy_test
CREATE TABLE IF NOT EXISTS ivy.group_keywords LIKE ivy_test.group_keywords;
CREATE TABLE IF NOT EXISTS ivy.group_word_associations LIKE ivy_test.group_word_associations;
CREATE TABLE IF NOT EXISTS ivy.login_timeouts LIKE ivy_test.login_timeouts;

-- 2. CHYBĚJÍCÍ SLOUPCE V ivy_test.fb_groups
-- ===============================================

-- Přidání sloupců které má produkce navíc
ALTER TABLE ivy_test.fb_groups 
ADD COLUMN IF NOT EXISTS discovery_url varchar(2048) NULL AFTER is_buy_sell_group,
ADD COLUMN IF NOT EXISTS discovered_by_user_id smallint(5) unsigned NULL AFTER member_count,
ADD COLUMN IF NOT EXISTS status varchar(20) NULL DEFAULT 'active' AFTER discovered_by_user_id,
ADD COLUMN IF NOT EXISTS privacy_type varchar(50) NULL AFTER category,
ADD COLUMN IF NOT EXISTS language varchar(10) NULL DEFAULT 'cs' AFTER privacy_type,
ADD COLUMN IF NOT EXISTS activity_level varchar(50) NULL AFTER language,
ADD COLUMN IF NOT EXISTS is_relevant tinyint(1) NULL AFTER activity_level,
ADD COLUMN IF NOT EXISTS posting_allowed tinyint(1) NULL AFTER is_relevant,
ADD COLUMN IF NOT EXISTS analysis_notes text NULL AFTER posting_allowed,
ADD COLUMN IF NOT EXISTS analysis_count int(11) NULL DEFAULT 0 AFTER analysis_notes,
ADD COLUMN IF NOT EXISTS last_analysis timestamp NULL AFTER analysis_count;

-- 3. ODSTRANĚNÍ VÝVOJOVÝCH TABULEK Z PRODUKCE
-- ===============================================

-- Tyto tabulky by v produkci být neměly
DROP TABLE IF EXISTS ivy.translation_issues;
DROP TABLE IF EXISTS ivy.debug_incidents;
DROP TABLE IF EXISTS ivy.scheme;

-- 4. OVĚŘENÍ STRUKTURY
-- ===============================================

-- Kontrolní dotazy pro ověření struktury
SELECT 'ivy_test.fb_groups' as tabulka, COUNT(*) as sloupcu FROM information_schema.columns WHERE table_schema='ivy_test' AND table_name='fb_groups'
UNION
SELECT 'ivy.fb_groups', COUNT(*) FROM information_schema.columns WHERE table_schema='ivy' AND table_name='fb_groups';

-- Kontrola existence klíčových tabulek
SELECT 
  CASE 
    WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='ivy_test' AND table_name='group_keywords') 
    THEN 'OK' ELSE 'CHYBÍ' 
  END as ivy_test_group_keywords,
  CASE 
    WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='ivy' AND table_name='group_keywords') 
    THEN 'OK' ELSE 'CHYBÍ' 
  END as ivy_group_keywords;

-- ===============================================
-- POZNÁMKY PRO SPUŠTĚNÍ:
-- ===============================================
-- 
-- 1. Nejprve záloha obou databází:
--    mysqldump -h $MYSQL_HOST -u $MYSQL_USER -p$MYSQL_PASSWORD ivy > ivy_backup.sql
--    mysqldump -h $MYSQL_HOST -u $MYSQL_USER -p$MYSQL_PASSWORD ivy_test > ivy_test_backup.sql
--
-- 2. Spuštění skriptu:
--    mysql -h $MYSQL_HOST -u $MYSQL_USER -p$MYSQL_PASSWORD < structure_sync.sql
--
-- 3. Ověření výsledků pomocí kontrolních dotazů na konci
-- ===============================================