-- Oprava skupin typu Z - extrakce Facebook ID z názvu do fb_id sloupce

-- Aktualizace skupin, kde název začíná číslicemi (Facebook ID)
UPDATE fb_groups 
SET 
  fb_id = SUBSTRING(name, 1, LOCATE(SUBSTRING(name, 16, 1), name) - 1),
  name = TRIM(SUBSTRING(name, LOCATE(SUBSTRING(name, 16, 1), name) + 1))
WHERE type = 'Z' 
  AND name REGEXP '^[0-9]+'
  AND CHAR_LENGTH(fb_id) < 10;

-- Zobraz výsledky
SELECT COUNT(*) as opraveno FROM fb_groups WHERE type = 'Z' AND CHAR_LENGTH(fb_id) >= 10;