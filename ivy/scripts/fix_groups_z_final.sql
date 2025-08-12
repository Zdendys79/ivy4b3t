-- Oprava 15 skupin typu Z - extrakce Facebook ID z názvu

-- Ukázka co se bude opravovat (první 5 záznamů)
SELECT 
  id,
  LEFT(name, 60) as current_name,
  fb_id as current_fb_id,
  -- Extrahuj číselnou část ze začátku názvu
  SUBSTRING(name FROM '^([0-9]{10,15})') as extracted_fb_id,
  -- Odstraň ID ze začátku názvu + všechny ne-písmena do prvního písmena
  TRIM(REGEXP_REPLACE(name, '^[0-9]{10,15}[^a-záčďéěíňóřšťúůýžA-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]*', '')) as clean_name
FROM fb_groups 
WHERE type = 'Z' 
  AND name REGEXP '^[0-9]+' 
  AND CHAR_LENGTH(fb_id) <= 10
LIMIT 5;

-- Aplikace oprav (odkomentuj pro provedení)
/*
UPDATE fb_groups 
SET 
  fb_id = SUBSTRING(name FROM '^([0-9]{10,15})'),
  name = TRIM(REGEXP_REPLACE(name, '^[0-9]{10,15}[^a-záčďéěíňóřšťúůýžA-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]*', ''))
WHERE type = 'Z' 
  AND name REGEXP '^[0-9]+' 
  AND CHAR_LENGTH(fb_id) <= 10
  AND SUBSTRING(name FROM '^([0-9]{10,15})') IS NOT NULL;
*/