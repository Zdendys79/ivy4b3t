-- Přidání sloupce translation_approved do tabulky quotes
-- Účel: Řízení zobrazování překladů v IVY aplikaci

-- Přidat sloupec translation_approved (boolean, default false)
ALTER TABLE quotes 
ADD COLUMN translation_approved TINYINT(1) NOT NULL DEFAULT 0 
AFTER text;

-- Aktualizovat existující české citáty - ty jsou automaticky schválené
UPDATE quotes 
SET translation_approved = 1 
WHERE language_code IN ('ces', 'svk');

-- Zobrazit výsledky
SELECT 
    language_code,
    COUNT(*) as total_quotes,
    COUNT(CASE WHEN translation_approved = 1 THEN 1 END) as approved_translations,
    COUNT(CASE WHEN text IS NOT NULL AND text != '' THEN 1 END) as with_translation,
    COUNT(CASE WHEN text IS NOT NULL AND text != '' AND translation_approved = 0 THEN 1 END) as pending_approval
FROM quotes 
GROUP BY language_code 
ORDER BY total_quotes DESC;