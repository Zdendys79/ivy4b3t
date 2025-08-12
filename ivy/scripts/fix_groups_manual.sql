-- Ruční oprava 15 skupin typu Z
-- ID a názvy extrahovány z předchozích výsledků

UPDATE fb_groups SET fb_id = '759769235462', name = 'Prostějov bazar a inzerce' WHERE id = 1120;
UPDATE fb_groups SET fb_id = '673627474633', name = 'Rumburk Byty Pronájem Nemovitosti Prodej' WHERE id = 1121;
UPDATE fb_groups SET fb_id = '587853900215', name = 'Bazárek Elektroniky Frýdek-Místek a oko' WHERE id = 1122;
UPDATE fb_groups SET fb_id = '41190476231', name = 'PBazar-Obytných přívěsů(automobi' WHERE id = 1123;
UPDATE fb_groups SET fb_id = '638876517494', name = 'INZERÁTY JIHLAVA  A OKOLÍ' WHERE id = 1124;

-- Zjistit zbývající záznamy pro další úpravu
SELECT id, LEFT(name, 80) as name_sample 
FROM fb_groups 
WHERE type = 'Z' 
  AND name REGEXP '^[0-9]+' 
  AND CHAR_LENGTH(fb_id) <= 10 
  AND id > 1124;