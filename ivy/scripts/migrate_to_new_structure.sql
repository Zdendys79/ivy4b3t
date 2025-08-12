-- MIGRACE NA NOVOU STRUKTURU: 
-- original_text = vždy originální text (všechny jazyky)
-- translated_text = pouze překlady do češtiny

-- 1. Pro české citáty: translated_text → NULL, přesunout do original_text
UPDATE quotes 
SET 
    original_text = COALESCE(original_text, translated_text),
    translated_text = NULL
WHERE language_code IN ('ces', 'svk');

-- 2. Pro cizí jazyky: translated_text zůstává jako překlad
-- (už je správně)

-- 3. Kontrola výsledků
SELECT 
    'Po migraci na novou strukturu' as status,
    language_code,
    COUNT(*) as total,
    COUNT(CASE WHEN original_text IS NOT NULL AND original_text != '' THEN 1 END) as has_original,
    COUNT(CASE WHEN translated_text IS NOT NULL AND translated_text != '' THEN 1 END) as has_translation
FROM quotes 
GROUP BY language_code 
ORDER BY total DESC;