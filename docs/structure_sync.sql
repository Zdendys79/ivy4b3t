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

-- 2. ODSTRANĚNÍ NADBYTEČNÝCH SLOUPCŮ Z ivy.fb_groups
-- ===============================================

-- Směr je pouze ivy_test → ivy, odstraníme sloupce které ivy_test nemá
ALTER TABLE ivy.fb_groups 
DROP COLUMN IF EXISTS discovery_url,
DROP COLUMN IF EXISTS discovered_by_user_id,
DROP COLUMN IF EXISTS status,
DROP COLUMN IF EXISTS privacy_type,
DROP COLUMN IF EXISTS language,
DROP COLUMN IF EXISTS activity_level,
DROP COLUMN IF EXISTS is_relevant,
DROP COLUMN IF EXISTS posting_allowed,
DROP COLUMN IF EXISTS analysis_notes,
DROP COLUMN IF EXISTS analysis_count,
DROP COLUMN IF EXISTS last_analysis;

-- 3. ODSTRANĚNÍ VÝVOJOVÝCH TABULEK Z PRODUKCE
-- ===============================================

-- Tyto tabulky by v produkci být neměly
DROP TABLE IF EXISTS ivy.translation_issues;
DROP TABLE IF EXISTS ivy.debug_incidents;
DROP TABLE IF EXISTS ivy.scheme;

-- 4. ODSTRANĚNÍ NEPOUŽÍVANÝCH TABULEK Z PRODUKCE
-- ===============================================

-- Smazat produkční tabulku která už není potřeba
DROP TABLE IF EXISTS ivy.web_login_timeouts;

-- 5. OVĚŘENÍ STRUKTURY
-- ===============================================

-- Kontrolní dotazy pro ověření struktury - obě by měly mít stejný počet sloupců
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