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
INSERT INTO `scheme` (`id`, `name`, `type`, `description`, `status`, `visible`, `position_x`, `position_y`) VALUES
('100000' , 'Zdeněk Jelínek', 'osoba', 'Hlavní vývojář a správce systému Ivy4B3T', 'done', 1, NULL, NULL),
('200000', 'Niara', 'MLM', 'Asistentka a hlavní vývojářka systému Ivy4B3T', 'done', 1, NULL, NULL),
('300000', 'Ivy4B3T', 'systém', 'Autonomní systém pro správu FB účtů pomocí Puppeteer', 'done', 1, NULL, NULL),
('400000', 'Hypervizory', 'server', 'HW technika potřebná pro běh programové logiky', 'done', 1, NULL, NULL),
('410000', 'Base.1', 'hypervizor', 'Fyzický server (Báze 1)', 'done', 1, NULL, NULL),
('420000', 'Base.2', 'hypervizor', 'Fyzický server (Báze 2)', 'done', 1, NULL, NULL),
('430000', 'Base.3', 'hypervizor', 'Fyzický server (Báze 3)', 'done', 1, NULL, NULL),
('440000', 'Base.4', 'hypervizor', 'Fyzický server (Báze 4)', 'done', 1, NULL, NULL),
('450000', 'Base.5', 'hypervizor', 'Fyzický server (Báze 5)', 'done', 1, NULL, NULL),
('460000', 'Base.6', 'hypervizor', 'Fyzický server (Báze 6)', 'done', 1, NULL, NULL),
('470000', 'Base.7', 'hypervizor', 'Fyzický server (Báze 7)', 'done', 1, NULL, NULL),

-- databázový virtuální stroj
('4A0000', 'VPSservice', 'service', 2, 'Externí dodavatel VPS', 'done', 1, NULL, NULL),
('4A1000', 'VPS00', 'VM', 2, 'Externí VM s MariaDB a Apache', 'done', 1, NULL, NULL),

-- Virtuální stroje na jednotlivých bázích
('411000', 'Ubuntu-1A', 'VM', 'Virtuální stroj A na bázi 1', 'done', 1, NULL, NULL),
('411100', 'Ubuntu-1B', 'VM', 'Virtuální stroj B na bázi 1', 'done', 1, NULL, NULL),
('411200', 'Ubuntu-1C', 'VM', 'Virtuální stroj C na bázi 1', 'done', 1, NULL, NULL),
('411300', 'Ubuntu-1D', 'VM', 'Virtuální stroj D na bázi 1', 'done', 1, NULL, NULL),

('421000', 'Ubuntu-2A', 'VM', 'Virtuální stroj A na bázi 2', 'done', 1, NULL, NULL),
('421100', 'Ubuntu-2B', 'VM', 'Virtuální stroj B na bázi 2', 'done', 1, NULL, NULL),
('421200', 'Ubuntu-2C', 'VM', 'Virtuální stroj C na bázi 2', 'done', 1, NULL, NULL),
('421300', 'Ubuntu-2D', 'VM', 'Virtuální stroj D na bázi 2', 'done', 1, NULL, NULL),

('461000', 'Ubuntu-6A', 'VM', 'Virtuální stroj A na bázi 6', 'done', 1, NULL, NULL),
('461100', 'Ubuntu-6B', 'VM', 'Virtuální stroj B na bázi 6', 'done', 1, NULL, NULL),
('461200', 'Ubuntu-6C', 'VM', 'Virtuální stroj C na bázi 6', 'done', 1, NULL, NULL),
('461300', 'Ubuntu-6D', 'VM', 'Virtuální stroj D na bázi 6', 'done', 1, NULL, NULL),

('471000', 'Ubuntu-7A', 'VM', 'Virtuální stroj A na bázi 7', 'done', 1, NULL, NULL),
('471100', 'Ubuntu-7B', 'VM', 'Virtuální stroj B na bázi 7', 'done', 1, NULL, NULL),

-- Složky projektu
('500000', 'ivy4b3t', 'složka', 'Root složka celého projektu', 'done', 1, NULL, NULL),
('510000', 'ivy', 'složka', 'Klientská část a logika robotů', 'done', 1, NULL, NULL),
('511000', 'sql', 'složka', 'SQL dotazy a podpůrné soubory', 'done', 1, NULL, NULL),  -- sql je správně podsložkou ivy
('520000', 'scripts', 'složka', 'Obecné skripty sdílené všemi VM', 'done', 1, NULL, NULL),
('530000', 'web', 'složka', 'Webová a dashboard část projektu', 'done', 1, NULL, NULL),
('531000', 'restricted', 'složka', 'Část webu nedostupná přes HTTP, SQL soubory a přístupové údaje pro PHP', 'done', 1, NULL, NULL),
('532000', 'system', 'složka', 'Systémová složka pro PHP', 'done', 1, NULL, NULL),

-- Soubory ve složce ivy
('511000', 'ivy.js', 'soubor', 'Hlavní spouštěcí skript pro roboty', 'done', 1, NULL, NULL),
('512000', 'iv_fb.js', 'soubor', 'Modul pro interakci s Facebookem', 'done', 1, NULL, NULL),
('513000', 'iv_sql.js', 'soubor', 'Modul pro komunikaci s databází', 'done', 1, NULL, NULL),
('514000', 'iv_support.js', 'soubor', 'Podpůrné funkce pro roboty', 'done', 1, NULL, NULL),
('515000', 'iv_utio.js', 'soubor', 'Modul pro komunikaci s portálem Utio', 'done', 1, NULL, NULL),
('516000', 'iv_wait.js', 'soubor', 'Funkce pro náhodná zpoždění a čekání', 'done', 1, NULL, NULL),
('517000', 'start.sh', 'soubor', 'Bash skript pro opakované spouštění pupp.js', 'done', 1, NULL, NULL),
('528000', 'loginuser.js', 'soubor', 'Skript pro správu FB uživatele na webu', 'done', 1, NULL, NULL),
('529000', 'cycleusers.js', 'soubor', 'Cyklické přepínání uživatelů na virtuálu pro vytvoření profilů browseru a přihlášení na Facebook', 'done', 1, NULL, NULL),
('52A000', 'rss_reader.js', 'soubor', 'Skript pro načítání zpráv z RSS a ukládání URL do databáze', 'done', 1, NULL, NULL),

-- Soubory ve složce sql
('51110', 'ivy_create_full.sql', 'soubor', 'SQL skript pro vytvoření celé databáze', 'done', 1, NULL, NULL),
('51120', 'ivy_insert_data.sql', 'soubor', 'SQL skript pro vložení počátečních dat', 'done', 1, NULL, NULL),
('51130', 'ivy_update_schema.sql', 'soubor', 'SQL skript pro aktualizaci schématu databáze', 'done', 1, NULL, NULL),

-- Soubory ve složce scripts
('521000', 'bootstrap-ivy.sh', 'soubor', 'Instalace a bootstrap prostředí pro Ivy. Umístění: scripts/bootstrap-ivy.sh', 'done', 1, NULL, NULL),
('522000', 'create_links.bat', 'soubor', 'Batch script pro tvorbu symlinků ve Windows. Umístění: scripts/create_links.bat', 'done', 1, NULL, NULL),
('523000', 'db_backup.sh', 'soubor', 'Záloha databáze MariaDB. Umístění: scripts/db_backup.sh', 'done', 1, NULL, NULL),
('524000', 'install-ivy-deps.sh', 'soubor', 'Instalace závislostí pro Ivy v Linuxu. Umístění: scripts/install-ivy-deps.sh', 'done', 1, NULL, NULL),
('525000', 'install-latest-node.sh', 'soubor', 'Instalace poslední verze Node.js. Umístění: scripts/install-latest-node.sh', 'done', 1, NULL, NULL),
('526000', 'install_ivy_git.sh', 'soubor', 'Klientské skripty pro klonování/správu repozitáře. Umístění: scripts/install_ivy_git.sh', 'done', 1, NULL, NULL),
('527000', 'manage-git.sh', 'soubor', 'Správa git repozitáře a základní operace. Umístění: scripts/manage-git.sh', 'done', 1, NULL, NULL),
('528000', 'post-commit', 'soubor', 'Git hook – automatizace po commitu. Umístění: scripts/post-commit', 'done', 1, NULL, NULL),
('529000', 'pre-commit', 'soubor', 'Git hook – automatizace před commitem. Umístění: scripts/pre-commit', 'done', 1, NULL, NULL),
('52A000', 'update_node_env.sh', 'soubor', 'Update prostředí Node.js pro Ivy. Umístění: scripts/update_node_env.sh', 'done', 1, NULL, NULL),

-- Soubory ve složce web
('531000', 'index.php', 'soubor', 'Hlavní vstupní bod webové aplikace', 'done', 1, NULL, NULL),
('532000', 'dashboard.php', 'soubor', 'Dashboard pro správu robotů', 'done', 1, NULL, NULL),
('533000', 'style.css', 'soubor', 'Styly pro webovou aplikaci', 'done', 1, NULL, NULL),
('534000', 'script.js', 'soubor', 'JavaScript pro interaktivitu webu', 'done', 1, NULL, NULL),

-- Soubory ve složce restricted
('531100', 'db_config.json', 'soubor', 'Přístupové údaje do databáze pro PHP', 'done', 1, NULL, NULL),
('531200', 'db_config_example.json', 'soubor', 'Vzor pro přístupové údaje do databáze pro PHP', 'done', 1, NULL, NULL),

-- Soubory ve složce system
('532100', 'db_class.php', 'soubor', 'Třída pro správu databáze', 'done', 1, NULL, NULL),
('532200', 'normalize_ivy_ids.php', 'soubor', 'Přetřídění čísel v tabulce ivy.scheme', 'done', 1, NULL, NULL),


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

