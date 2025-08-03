-- PŘEJMENOVÁNÍ SLOUPCE: text → cz_text
-- Důvod: Jasné rozlišení češtiny vs originálního textu

-- 1. Přejmenovat sloupec text na cz_text
ALTER TABLE quotes 
CHANGE COLUMN text cz_text TEXT;

-- 2. Přejmenovat také v indexech a omezeních (pokud existují)
-- Zobrazit strukturu tabulky
DESCRIBE quotes;

-- 3. Ověřit výsledek
SELECT 
    'Po přejmenování' as status,
    language_code,
    COUNT(*) as total,
    COUNT(CASE WHEN original_text IS NOT NULL AND original_text != '' THEN 1 END) as has_original,
    COUNT(CASE WHEN cz_text IS NOT NULL AND cz_text != '' THEN 1 END) as has_cz_text,
    COUNT(CASE WHEN cz_text IS NOT NULL AND cz_text != '' AND (original_text IS NULL OR original_text = '') THEN 1 END) as cz_only,
    COUNT(CASE WHEN original_text IS NOT NULL AND original_text != '' AND (cz_text IS NULL OR cz_text = '') THEN 1 END) as original_only,
    COUNT(CASE WHEN original_text IS NOT NULL AND original_text != '' AND cz_text IS NOT NULL AND cz_text != '' THEN 1 END) as both
FROM quotes 
GROUP BY language_code 
ORDER BY total DESC;