-- Jednoduchý script pro opravu Facebook skupin typu Z
-- Zobraz problematické skupiny pro manuální kontrolu

-- Zobraz skupiny typu Z s číselným začátkem názvu
SELECT 
  id,
  CONCAT('"', fb_id, '"') as current_fb_id,
  CHAR_LENGTH(fb_id) as fb_id_length,
  LEFT(name, 80) as group_name_sample,
  -- Pokus o extrakci FB ID pomocí SUBSTRING
  SUBSTRING(name FROM 1 FOR 15) as potential_fb_id
FROM fb_groups 
WHERE type = 'Z' 
  AND name REGEXP '^[0-9]'  -- Název začíná číslicí
  AND CHAR_LENGTH(fb_id) <= 10  -- Podezřele krátké fb_id (pravděpodobně binární)
ORDER BY id
LIMIT 20;