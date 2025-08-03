-- KRITICKÁ MIGRACE: Oprava špatně uložených citátů
-- Problém: Harvester ukládal cizí texty do 'text' místo 'original_text'

-- 1. Migrace cizích jazyků: text → original_text (kde je original_text prázdný)
UPDATE quotes 
SET 
    original_text = text,
    text = NULL 
WHERE 
    language_code NOT IN ('ces', 'svk')
    AND (original_text IS NULL OR original_text = '')
    AND text IS NOT NULL 
    AND text != '';

-- 2. Výsledky migrace
SELECT 
    'Po migraci' as status,
    language_code,
    COUNT(*) as total,
    COUNT(CASE WHEN original_text IS NOT NULL AND original_text != '' THEN 1 END) as has_original,
    COUNT(CASE WHEN text IS NOT NULL AND text != '' THEN 1 END) as has_text,
    COUNT(CASE WHEN text IS NOT NULL AND text != '' AND (original_text IS NULL OR original_text = '') THEN 1 END) as problematic
FROM quotes 
GROUP BY language_code 
ORDER BY total DESC;