-- Script pro opravu Facebook skupin typu Z
-- Extrahuje Facebook ID z názvu skupiny a ukládá je do správného sloupce fb_id
-- Čistí názvy skupin od Facebook ID

-- Tabulka pro dočasné uložení parsovaných dat
CREATE TEMPORARY TABLE temp_group_fixes (
  id INT,
  old_fb_id VARCHAR(255),
  old_name TEXT,
  new_fb_id VARCHAR(255),
  new_name TEXT
);

-- Extrahuj Facebook ID z názvů skupin typu Z (začínající číslicemi)
INSERT INTO temp_group_fixes (id, old_fb_id, old_name, new_fb_id, new_name)
SELECT 
  id,
  fb_id as old_fb_id,
  name as old_name,
  -- Extrahuj číselné ID ze začátku názvu (10-15 číslic)
  REGEXP_SUBSTR(name, '^[0-9]{10,15}') as new_fb_id,
  -- Odstraň ID a oddělovače ze začátku názvu
  TRIM(REGEXP_REPLACE(name, '^[0-9]{10,15}[^a-zA-ZÀ-ž]*', '')) as new_name
FROM fb_groups 
WHERE type = 'Z' 
  AND name REGEXP '^[0-9]{10,15}'  -- Název začíná číslicemi
  AND CHAR_LENGTH(fb_id) <= 10      -- Současné fb_id vypadá podezřele (binární data)
;

-- Zobraz náhled změn (pro kontrolu před aplikací)
SELECT 
  id,
  CONCAT('OLD: fb_id="', old_fb_id, '" name="', LEFT(old_name, 50), '..."') as before_fix,
  CONCAT('NEW: fb_id="', new_fb_id, '" name="', LEFT(new_name, 50), '..."') as after_fix
FROM temp_group_fixes
WHERE new_fb_id IS NOT NULL 
  AND new_name IS NOT NULL 
  AND CHAR_LENGTH(new_name) > 3
LIMIT 20;

-- Aplikuj opravy (odkomentuj pro skutečné provedení)
/*
UPDATE fb_groups fg
JOIN temp_group_fixes tgf ON fg.id = tgf.id
SET 
  fg.fb_id = tgf.new_fb_id,
  fg.name = tgf.new_name
WHERE tgf.new_fb_id IS NOT NULL 
  AND tgf.new_name IS NOT NULL 
  AND CHAR_LENGTH(tgf.new_name) > 3;
*/

-- Statistiky oprav
SELECT 
  'Skupiny k opravě' as category,
  COUNT(*) as count
FROM temp_group_fixes
WHERE new_fb_id IS NOT NULL 
  AND new_name IS NOT NULL 
  AND CHAR_LENGTH(new_name) > 3

UNION ALL

SELECT 
  'Skupiny s problematickými názvy' as category,
  COUNT(*) as count  
FROM temp_group_fixes
WHERE new_fb_id IS NULL OR new_name IS NULL OR CHAR_LENGTH(new_name) <= 3;

-- Vyčistí dočasnou tabulku
DROP TEMPORARY TABLE temp_group_fixes;