-- 2025-05-17 09:28:17 UTC
-- ivy_data_full.sql – Výchozí data pro databázi ivy
-- Umístění: /web/restricted/
-- Tento skript vkládá data do existujících tabulek systému IVY z původní databáze utiolite

USE `ivy`;

SET NAMES utf8mb4;
SET time_zone = '+00:00';
SET foreign_key_checks = 0;
SET sql_mode = 'NO_AUTO_VALUE_ON_ZERO';

-- 1. Převod fb_users
INSERT INTO fb_users (
  id, name, surname, day_limit, max_limit, next_worktime, next_statement,
  e_mail, e_pass, fb_login, fb_pass, u_login, u_pass,
  locked, unlocked, day_limit_updated, last_add_group, portal_id, host
)
SELECT
  id, name, surname, day_limit, max_limit, next_worktime, next_statement,
  e_mail, e_pass, fb_login, fb_pass, u_login, u_pass,
  locked, unlocked, day_limit_updated, last_add_group, portal_id, host
FROM utiolite.fb_users;

-- 2. Převod fb_groups
INSERT INTO fb_groups (
  id, fb_id, nazev, priority, user_counter, note,
  last_seen, next_seen, typ, region_id, district_id, sell
)
SELECT
  id, fb_id, nazev, priority, user_counter, note,
  last_seen, next_seen, typ, region_id, district_id, sell
FROM utiolite.fb_groups;

-- 3. Převod ui_commands
INSERT INTO ui_commands (id, host, command, data, created, accepted, fulfilled)
SELECT id, host, command, data, created, accepted, fulfilled
FROM utiolite.ui_commands;

-- 4. Převod statements
INSERT INTO statements (user_id, posted, statement, hash)
SELECT user_id, posted, statement, hash
FROM utiolite.statements;

-- 5. Převod urls
INSERT INTO urls (used, url, date)
SELECT used, url, date
FROM utiolite.urls;

-- 6. Převod variables
INSERT INTO variables (name, value, changed)
SELECT name, value, changed
FROM utiolite.variables;

-- 7. Kopírování z databáze utiolite
INSERT INTO c_regions (id, region)
SELECT id, region FROM utiolite.c_regions;

INSERT INTO c_portals (id, portal)
SELECT id, portal FROM utiolite.c_portals;

INSERT INTO c_districts (id, region_id, district)
SELECT id, region_id, district FROM utiolite.c_districts;

-- 17. Vložení dat do scheme
-- Kořenová osoba
INSERT INTO `scheme` (`id`, `name`, `type`, `parent_id`, `description`, `status`, `visible`, `position_x`, `position_y`) VALUES
(1, 'Zdeněk Jelínek', 'osoba', NULL, 'Hlavní vývojář a správce systému Ivy4B3T', 'done', 1, NULL, NULL),

-- Systém Ivy4B3T
(2, 'Ivy4B3T', 'systém', 1, 'Autonomní systém pro správu FB účtů pomocí Puppeteer', 'done', 1, NULL, NULL),

-- Asistentka vývoje ChatGPT
(3, 'Niara', 'MLM', 1, 'Asistentka a hlavní vývojářka systému Ivy4B3T', 'done', 1, NULL, NULL),

-- Hypervizory (Báze) - všichni mají parent_id = 1 (osoba)
(10, 'Base.1', 'hypervizor', 1, 'Fyzický server (Báze 1)', 'done', 1, NULL, NULL),
(20, 'Base.2', 'hypervizor', 1, 'Fyzický server (Báze 2)', 'done', 1, NULL, NULL),
(30, 'Base.3', 'hypervizor', 1, 'Fyzický server (Báze 3)', 'done', 1, NULL, NULL),
(40, 'Base.4', 'hypervizor', 1, 'Fyzický server (Báze 4)', 'done', 1, NULL, NULL),
(50, 'Base.5', 'hypervizor', 1, 'Fyzický server (Báze 5)', 'done', 1, NULL, NULL),
(60, 'Base.6', 'hypervizor', 1, 'Fyzický server (Báze 6)', 'done', 1, NULL, NULL),
(70, 'Base.7', 'hypervizor', 1, 'Fyzický server (Báze 7)', 'done', 1, NULL, NULL),

-- VM mají parent svůj hypervizor
-- VM na Base.2 (hypervizor 20)
(21, 'Ubuntu-2A', 'VM', 20, 'Virtuální stroj A na bázi 2', 'done', 1, NULL, NULL),
(22, 'Ubuntu-2B', 'VM', 20, 'Virtuální stroj B na bázi 2', 'done', 1, NULL, NULL),
(23, 'Ubuntu-2C', 'VM', 20, 'Virtuální stroj C na bázi 2', 'done', 1, NULL, NULL),
(24, 'Ubuntu-2D', 'VM', 20, 'Virtuální stroj D na bázi 2', 'done', 1, NULL, NULL),

-- VM na Base.6 (hypervizor 60)
(61, 'Ubuntu-6A', 'VM', 60, 'Virtuální stroj A na bázi 6', 'done', 1, NULL, NULL),
(62, 'Ubuntu-6B', 'VM', 60, 'Virtuální stroj B na bázi 6', 'done', 1, NULL, NULL),
(63, 'Ubuntu-6C', 'VM', 60, 'Virtuální stroj C na bázi 6', 'done', 1, NULL, NULL),
(64, 'Ubuntu-6D', 'VM', 60, 'Virtuální stroj D na bázi 6', 'done', 1, NULL, NULL),

-- VM na Base.5 (hypervizor 50) – pouze C
(54, 'Ubuntu-6D', 'VM', 50, 'Virtuální stroj D na bázi 5', 'done', 1, NULL, NULL),

-- VM na Base.7 (hypervizor 70) – pouze A a B
(71, 'Ubuntu-7A', 'VM', 70, 'Virtuální stroj A na bázi 7', 'done', 1, NULL, NULL),
(72, 'Ubuntu-7B', 'VM', 70, 'Virtuální stroj B na bázi 7', 'done', 1, NULL, NULL),

-- Kořenová složka projektu
(100, 'ivy4b3t', 'složka', 2, 'Root složka celého projektu', 'done', 1, NULL, NULL),

-- Složky projektu v rootu (parent: 100)
(200, 'ivy', 'složka', 100, 'Klientská část a logika robotů', 'done', 1, NULL, NULL),
(300, 'scripts', 'složka', 100, 'Obecné skripty sdílené všemi VM', 'done', 1, NULL, NULL),
(400, 'web', 'složka', 100, 'Webová a dashboard část projektu', 'done', 1, NULL, NULL),
(201, 'sql', 'složka', 200, 'SQL dotazy a podpůrné soubory', 'done', 1, NULL, NULL),
(401, 'restricted', 'složka', 400, 'Část webu nedostupná přes HTTP, SQL soubory a přístupové údaje pro PHP', 'done', 1, NULL, NULL),
(402, 'system', 'složka', 400, 'Systémová složka pro PHP', 'done', 1, NULL, NULL),

-- Databáze systému (parent: 2, tedy Ivy4B3T)
(1000, 'ivy', 'databáze', 2, 'MariaDB databáze pro plánování, logiku a monitoring', 'partial', 1, NULL, NULL),

-- Soubory ve složce ivy (parent_id = 200)
(2001, 'ivy.js', 'soubor', 200, 'Hlavní spouštěcí skript pro roboty', 'done', 1, NULL, NULL),
(2002, 'iv_fb.js', 'soubor', 200, 'Modul pro interakci s Facebookem', 'done', 1, NULL, NULL),
(2003, 'iv_sql.js', 'soubor', 200, 'Modul pro komunikaci s databází', 'done', 1, NULL, NULL),
(2004, 'iv_support.js', 'soubor', 200, 'Podpůrné funkce pro roboty', 'done', 1, NULL, NULL),
(2005, 'iv_utio.js', 'soubor', 200, 'Modul pro komunikaci s portálem Utio', 'done', 1, NULL, NULL),
(2006, 'iv_wait.js', 'soubor', 200, 'Funkce pro náhodná zpoždění a čekání', 'done', 1, NULL, NULL),

-- Soubory ve složce scripts (parent_id = 300)
(3001, 'start.sh', 'soubor', 300, 'Bash skript pro opakované spouštění pupp.js', 'done', 1, NULL, NULL),
(3002, 'loginuser.js', 'soubor', 300, 'Skript pro správu FB uživatele na webu', 'done', 1, NULL, NULL),
(3003, 'cycleusers.js', 'soubor', 300, 'Cyklické přepínání uživatelů na virtuálu pro vytvoření profilů browseru a přihlášení na Facebook', 'done', 1, NULL, NULL),
(3004, 'rss_reader.js', 'soubor', 300, 'Skript pro načítání zpráv z RSS a ukládání URL do databáze', 'done', 1, NULL, NULL),

-- Soubory ve složce web (parent_id = 400)
(4001, 'index.php', 'soubor', 400, 'Hlavní vstupní bod webové aplikace', 'done', 1, NULL, NULL),
(4002, 'dashboard.php', 'soubor', 400, 'Dashboard pro správu robotů', 'done', 1, NULL, NULL),
(4003, 'style.css', 'soubor', 400, 'Styly pro webovou aplikaci', 'done', 1, NULL, NULL),
(4004, 'script.js', 'soubor', 400, 'JavaScript pro interaktivitu webu', 'done', 1, NULL, NULL),

-- Soubory ve složce restricted (parent_id = 4000)
(4011, 'db_config.json', 'soubor', 401, 'Přístupové údaje do databáze pro PHP', 'done', 1, NULL, NULL),
(4012, 'db_config_example.json', 'soubor', 401, 'Vzor pro přístupové údaje do databáze pro PHP', 'done', 1, NULL, NULL),
(4013, 'ivy_create_full.sql', 'soubor', 401, 'SQL skript pro vytvoření celé databáze', 'done', 1, NULL, NULL),
(4014, 'ivy_insert_data.sql', 'soubor', 401, 'SQL skript pro vložení počátečních dat', 'done', 1, NULL, NULL),
(4015, 'ivy_update_schema.sql', 'soubor', 401, 'SQL skript pro aktualizaci schématu databáze', 'done', 1, NULL, NULL),

(4021, 'db_class.php', 'soubor', 402, 'Třída pro správu databáze', 'done', 1, NULL, NULL),
(4022, 'normalize_ivy_ids.php', 'soubor', 402, 'přetřídění čísel v tabulce  ivy.scheme', 'done', 1, NULL, NULL);


-- 18. Vložení dat do referers
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

-- 19 data pro jednotlivé druhy akcí
INSERT INTO action_definitions (action_code, label, description, weight, min_minutes, max_minutes, repeatable)
VALUES
('group_post',        'Příspěvek do skupiny',     'Příspěvek získaný z UTIO typu G/GV.',                 10, 60, 180, TRUE),
('timeline_post',     'Příspěvek na Timeline',    'Osobní status na timeline uživatele.',                2, 1080, 4320, TRUE),
('comment',           'Komentář',                 'Komentář pod cizím příspěvkem.',                      5, 240, 600, TRUE),
('react',             'Reakce (like)',            'Like nebo jiná emoce na příspěvek.',                  8, 60, 180, TRUE),
('share_post',        'Sdílení',                  'Sdílení cizího příspěvku.',                           2, 2880, 7200, TRUE),
('messenger_check',   'Prohlédnout Messenger',    'Načíst a projít zprávy v Messengeru.',                4, 60, 240, TRUE),
('messenger_reply',   'Zpráva známému',           'Reagovat nebo napsat příteli.',                       4, 240, 960, TRUE),
('account_sleep',     'Uspání účtu',              'Odpočinek účtu na 24-72h.',                           1, 10080, 17280, FALSE),
('account_delay',     'Denní odpočinek',          'Krátký odpočinek dle denní doby (noc/dopo).',         6, 180, 720, TRUE);

