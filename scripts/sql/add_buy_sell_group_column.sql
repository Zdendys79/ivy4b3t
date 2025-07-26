-- Přidání sloupce is_buy_sell_group do tabulky fb_groups
-- Umístění: /add_buy_sell_group_column.sql
--
-- Popis: Přidává boolean sloupec pro označení prodejních skupin,
--        které podporují přímý přístup k diskuzi přes /buy_sell_discuss
--
-- Použití: mysql -u $DB_USER -p$DB_PASS ivy < add_buy_sell_group_column.sql

-- Přidání sloupce is_buy_sell_group (pokud neexistuje)
ALTER TABLE fb_groups 
ADD COLUMN IF NOT EXISTS is_buy_sell_group BOOLEAN NOT NULL DEFAULT FALSE 
COMMENT 'Označuje zda je skupina prodejní (buy/sell) pro přímý přístup k diskuzi přes /buy_sell_discuss';

-- Vytvoření indexu pro rychlejší vyhledávání (pokud neexistuje)
CREATE INDEX IF NOT EXISTS idx_is_buy_sell_group ON fb_groups(is_buy_sell_group);

-- Zobrazení aktuální struktury tabulky
DESCRIBE fb_groups;