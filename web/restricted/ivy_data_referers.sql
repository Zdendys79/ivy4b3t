-- ivy_data_referers.sql
-- Umístění: /web/restricted/ivy_data_referers.sql
--
-- Popis: Vložení výchozích referer URL pro simulaci reálného provozu
USE ivy;
-- Vložení dat do referers
INSERT IGNORE INTO referers (url) VALUES
('https://www.seznam.cz'),
('https://www.centrum.cz'),
('https://www.instagram.com'),
('https://google.cz'),
('https://www.idnes.cz'),
('https://www.novinky.cz'),
('https://www.aktualne.cz'),
('https://www.blesk.cz'),
('https://www.lidovky.cz'),
('https://www.denik.cz'),
('https://www.irozhlas.cz'),
('https://www.sport.cz'),
('https://www.reflex.cz'),
('https://www.e15.cz');
