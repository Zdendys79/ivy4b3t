-- Přidání sloupce invasive do tabulky action_definitions
-- Datum: 2025-07-11
-- Účel: Označení invazních akcí přímo v databázi místo config.json

ALTER TABLE action_definitions 
ADD COLUMN invasive BOOLEAN NOT NULL DEFAULT FALSE AFTER repeatable;

-- Označení invazních akcí podle původního seznamu z config.json
UPDATE action_definitions 
SET invasive = TRUE 
WHERE action_code IN ('post_utio_g', 'post_utio_gv', 'post_utio_p', 'quote_post', 'comment_post');

-- Ověření výsledku
SELECT action_code, invasive, active FROM action_definitions ORDER BY invasive DESC, action_code;