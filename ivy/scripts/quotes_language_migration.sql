-- =============================================================================
-- ROZŠÍŘENÍ SYSTÉMU CITÁTŮ O PODPORU VÍCE JAZYKŮ
-- =============================================================================
-- Vytvoří číselník jazyků a rozšíří tabulku quotes o originální texty
--
-- Změny:
-- 1. Nová tabulka c_languages (číselník jazyků ISO 639-2/T)
-- 2. Rozšíření quotes o original_text a language_code
-- 3. Nastavení výchozích hodnot pro stávající data
-- =============================================================================

-- 1. VYTVOŘENÍ ČÍSELNÍKU JAZYKŮ
-- -----------------------------------------------------------------------------
CREATE TABLE c_languages (
    code VARCHAR(3) NOT NULL PRIMARY KEY COMMENT 'ISO 639-2/T třípísmenný kód jazyka',
    name_cs VARCHAR(50) NOT NULL COMMENT 'Název jazyka v češtině',
    name_en VARCHAR(50) NOT NULL COMMENT 'Název jazyka v angličtině',
    name_native VARCHAR(50) NOT NULL COMMENT 'Název jazyka v původním jazyce',
    is_active TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Aktivní jazyk pro harvesting',
    sort_order INT NOT NULL DEFAULT 100 COMMENT 'Pořadí řazení',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Číselník jazyků podle ISO 639-2/T standardu';

-- 2. NAPLNĚNÍ ZÁKLADNÍCH JAZYKŮ
-- -----------------------------------------------------------------------------
INSERT INTO c_languages (code, name_cs, name_en, name_native, is_active, sort_order) VALUES
-- Prioritní jazyky (aktivní pro harvesting)
('ces', 'Čeština', 'Czech', 'Čeština', 1, 10),
('slk', 'Slovenština', 'Slovak', 'Slovenčina', 1, 20),
('eng', 'Angličtina', 'English', 'English', 1, 30),
('fra', 'Francouzština', 'French', 'Français', 1, 40),
('deu', 'Němčina', 'German', 'Deutsch', 1, 50),
('ita', 'Italština', 'Italian', 'Italiano', 1, 60),
('spa', 'Španělština', 'Spanish', 'Español', 1, 70),
('rus', 'Ruština', 'Russian', 'Русский', 1, 80),

-- Klasické jazyky
('lat', 'Latina', 'Latin', 'Latina', 1, 100),
('grc', 'Starověká řečtina', 'Ancient Greek', 'Ἀρχαία ἑλληνικὴ', 1, 110),

-- Další evropské jazyky (neaktivní, lze aktivovat později)
('pol', 'Polština', 'Polish', 'Polski', 0, 200),
('hun', 'Maďarština', 'Hungarian', 'Magyar', 0, 210),
('nld', 'Nizozemština', 'Dutch', 'Nederlands', 0, 220),
('por', 'Portugalština', 'Portuguese', 'Português', 0, 230),
('ron', 'Rumunština', 'Romanian', 'Română', 0, 240),
('bul', 'Bulharština', 'Bulgarian', 'Български', 0, 250),
('hrv', 'Chorvatština', 'Croatian', 'Hrvatski', 0, 260),
('srp', 'Srbština', 'Serbian', 'Српски', 0, 270),

-- Asijské jazyky (pro budoucí rozšíření)
('jpn', 'Japonština', 'Japanese', '日本語', 0, 300),
('kor', 'Korejština', 'Korean', '한국어', 0, 310),
('cmn', 'Mandarínská čínština', 'Mandarin Chinese', '普通话', 0, 320),
('hin', 'Hindština', 'Hindi', 'हिन्दी', 0, 330),
('ara', 'Arabština', 'Arabic', 'العربية', 0, 340),

-- Univerzální kategorie
('mul', 'Více jazyků', 'Multiple languages', 'Multiple', 0, 900),
('und', 'Neznámý jazyk', 'Unknown language', 'Unknown', 0, 999);

-- 3. ROZŠÍŘENÍ TABULKY QUOTES
-- -----------------------------------------------------------------------------
ALTER TABLE quotes 
ADD COLUMN original_text TEXT NULL 
    COMMENT 'Originální text citátu v původním jazyce' 
    AFTER text,
ADD COLUMN language_code VARCHAR(3) NOT NULL DEFAULT 'ces' 
    COMMENT 'Kód jazyka originálního textu (FK na c_languages.code)' 
    AFTER original_text;

-- 4. VYTVOŘENÍ INDEXŮ A VAZEB
-- -----------------------------------------------------------------------------
-- Index pro efektivní vyhledávání podle jazyka
CREATE INDEX idx_quotes_language ON quotes(language_code);

-- Kombinovaný index pro vyhledávání podle jazyka a dostupnosti
CREATE INDEX idx_quotes_lang_available ON quotes(language_code, next_seen);

-- Foreign key vazba na číselník jazyků
ALTER TABLE quotes 
ADD CONSTRAINT fk_quotes_language 
FOREIGN KEY (language_code) REFERENCES c_languages(code) 
ON UPDATE CASCADE ON DELETE RESTRICT;

-- 5. AKTUALIZACE HASH KALKULACE
-- -----------------------------------------------------------------------------
-- Poznámka: Hash bude nyní počítán z original_text (pokud existuje) nebo z text
-- Toto zajistí lepší detekci duplicit mezi jazyky
--
-- Příklad nové logiky:
-- hash = MD5(original_text IS NOT NULL ? original_text : text)

-- 6. VYTVOŘENÍ POHLEDU PRO SNADNÉ DOTAZOVÁNÍ
-- -----------------------------------------------------------------------------
CREATE VIEW v_quotes_with_languages AS
SELECT 
    q.id,
    q.text,
    q.original_text,
    q.author,
    q.hash,
    q.next_seen,
    q.language_code,
    l.name_cs as language_name_cs,
    l.name_en as language_name_en,
    l.name_native as language_name_native,
    CASE 
        WHEN q.original_text IS NOT NULL THEN q.original_text 
        ELSE q.text 
    END as display_text,
    CASE 
        WHEN q.original_text IS NOT NULL THEN CONCAT(q.original_text, ' (', q.text, ')') 
        ELSE q.text 
    END as full_text
FROM quotes q
LEFT JOIN c_languages l ON q.language_code = l.code;

-- =============================================================================
-- POZNÁMKY K POUŽITÍ:
-- =============================================================================
--
-- 1. STÁVAJÍCÍ DATA:
--    - Všechny současné citáty budou označeny jako 'ces' (čeština)
--    - original_text bude NULL (znamená že text IS originál)
--
-- 2. NOVÉ CITÁTY:
--    - Pokud je citát v češtině: original_text = NULL, language_code = 'ces'
--    - Pokud je překlad: original_text = originál, text = překlad, language_code = jazyk originálu
--
-- 3. HARVESTING STRATEGIE:
--    - Prioritní jazyky (is_active = 1) budou harvestovány automaticky
--    - Ostatní jazyky lze aktivovat podle potřeby
--
-- 4. DUPLICATE DETECTION:
--    - Hash se bude počítat z original_text (nebo text pokud je original_text NULL)
--    - Umožní detekovat duplicity i mezi různými jazyky
--
-- =============================================================================