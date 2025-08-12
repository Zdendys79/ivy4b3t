-- Oprava sloupců text a original_text v tabulce quotes
-- Problém: citáty v cizích jazycích jsou v sloupci "text" místo "original_text"

-- Krok 1: Pro všechny nečeské citáty přesunout text do original_text
UPDATE quotes 
SET 
    original_text = text,
    text = NULL
WHERE language_code != 'ces' 
  AND (original_text IS NULL OR original_text = '');

-- Krok 2: Pro české a slovenské citáty zkopírovat text do original_text a vymazat text
UPDATE quotes 
SET original_text = text, text = NULL
WHERE language_code IN ('ces', 'svk') 
  AND (original_text IS NULL OR original_text = '');

-- Krok 3: Zkontrolovat výsledky
SELECT 
    language_code,
    COUNT(*) as count,
    COUNT(CASE WHEN original_text IS NOT NULL AND original_text != '' THEN 1 END) as with_original,
    COUNT(CASE WHEN text LIKE '[POTŘEBUJE PŘEKLAD]%' THEN 1 END) as needs_translation
FROM quotes 
GROUP BY language_code 
ORDER BY language_code;