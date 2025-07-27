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

-- Převod dat z utiolite.statements do ivy.quotes
INSERT INTO ivy.quotes (user_id, posted, text, hash)
SELECT user_id, posted, statement, hash FROM utiolite.statements;


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
  ('410000', 'Base.1', 'hypervizor', 'Fyzický server s Windows', 'done', 1, NULL, NULL),
    ('411000', 'Ubuntu-1A', 'VM', 'Virtuální stroj A na bázi 1', 'deprecated', 1, NULL, NULL),
    ('412000', 'Ubuntu-1B', 'VM', 'Virtuální stroj B na bázi 1', 'deprecated', 1, NULL, NULL),
    ('413000', 'Ubuntu-1C', 'VM', 'Virtuální stroj C na bázi 1', 'deprecated', 1, NULL, NULL),
    ('414000', 'Ubuntu-1D', 'VM', 'Virtuální stroj D na bázi 1', 'deprecated', 1, NULL, NULL),
  ('420000', 'Base.2', 'hypervizor', 'Fyzický server s Ubuntu, VirtualBox', 'done', 1, NULL, NULL),
    ('421000', 'Ubuntu-2A', 'VM', 'Virtuální stroj A na bázi 2', 'done', 1, NULL, NULL),
    ('422000', 'Ubuntu-2B', 'VM', 'Virtuální stroj B na bázi 2', 'done', 1, NULL, NULL),
    ('423000', 'Ubuntu-2C', 'VM', 'Virtuální stroj C na bázi 2', 'done', 1, NULL, NULL),
    ('424000', 'Ubuntu-2D', 'VM', 'Virtuální stroj D na bázi 2', 'done', 1, NULL, NULL),
  ('430000', 'Base.3', 'hypervizor', 'Fyzický server s Windows, VirtualBox', 'done', 1, NULL, NULL),
  ('440000', 'Base.4', 'hypervizor', 'Fyzický server s Windows, VirtualBox', 'done', 1, NULL, NULL),
  ('450000', 'Base.5', 'hypervizor', 'Fyzický server s Windows, VirtualBox', 'done', 1, NULL, NULL),
    ('454000', 'Ubuntu-5D', 'VM', 'Virtuální stroj D na bázi 5', 'done', 1, NULL, NULL),
  ('460000', 'Base.6', 'hypervizor', 'Fyzický server s Windows, VirtualBox', 'done', 1, NULL, NULL),
    ('461000', 'Ubuntu-6A', 'VM', 'Virtuální stroj A na bázi 6', 'done', 1, NULL, NULL),
    ('462000', 'Ubuntu-6B', 'VM', 'Virtuální stroj B na bázi 6', 'done', 1, NULL, NULL),
    ('463000', 'Ubuntu-6C', 'VM', 'Virtuální stroj C na bázi 6', 'done', 1, NULL, NULL),
    ('464000', 'Ubuntu-6D', 'VM', 'Virtuální stroj D na bázi 6', 'done', 1, NULL, NULL),
  ('470000', 'Base.7', 'hypervizor', 'Fyzický server s Windows, VirtualBox', 'done', 1, NULL, NULL),
    ('471000', 'Ubuntu-7A', 'VM', 'Virtuální stroj A na bázi 7', 'done', 1, NULL, NULL),
    ('472000', 'Ubuntu-7B', 'VM', 'Virtuální stroj B na bázi 7', 'done', 1, NULL, NULL),
  ('4A0000', 'VPSservice', 'service', 'Externí dodavatel VPS', 'done', 1, NULL, NULL),
    ('4A1000', 'VPS00', 'VM', 'Externí VM s MariaDB a Apache', 'done', 1, NULL, NULL),

('500000', 'ivy4b3t', 'složka', 'Root složka celého projektu', 'done', 1, NULL, NULL),
  ('510000', 'ivy', 'složka', 'Klientská část a logika robotů', 'done', 1, NULL, NULL),
    ('511000', 'sql', 'složka', 'SQL dotazy a podpůrné soubory', 'done', 1, NULL, NULL),  -- sql je správně podsložkou ivy
    ('512000', 'ivy.js', 'soubor', 'Hlavní spouštěcí skript pro roboty', 'done', 1, NULL, NULL),
    ('513000', 'iv_fb.js', 'soubor', 'Modul pro interakci s FBem', 'done', 1, NULL, NULL),
    ('514000', 'iv_sql.js', 'soubor', 'Modul pro komunikaci s databází', 'done', 1, NULL, NULL),
    ('515000', 'iv_support.js', 'soubor', 'Podpůrné funkce pro roboty', 'done', 1, NULL, NULL),
    ('516000', 'iv_utio.js', 'soubor', 'Modul pro komunikaci s portálem Utio', 'done', 1, NULL, NULL),
    ('517000', 'iv_wait.js', 'soubor', 'Funkce pro náhodná zpoždění a čekání', 'done', 1, NULL, NULL),
    ('518000', 'start.sh', 'soubor', 'Bash skript pro opakované spouštění ivy.js', 'done', 1, NULL, NULL),
    ('519000', 'loginuser.js', 'soubor', 'Skript pro správu FB uživatele na webu', 'done', 1, NULL, NULL),
    ('51A000', 'cycleusers.js', 'soubor', 'Cyklické přepínání uživatelů na virtuálu pro vytvoření profilů browseru a přihlášení na FB', 'done', 1, NULL, NULL),
    ('51B000', 'rss_reader.js', 'soubor', 'Skript pro načítání zpráv z RSS a ukládání URL do databáze', 'done', 1, NULL, NULL),
  ('520000', 'scripts', 'složka', 'Obecné skripty sdílené všemi VM', 'done', 1, NULL, NULL),
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
  ('530000', 'web', 'složka', 'Webová a dashboard část projektu', 'done', 1, NULL, NULL),
    ('531000', 'restricted', 'složka', 'Část webu nedostupná přes HTTP, SQL soubory a přístupové údaje pro PHP', 'done', 1, NULL, NULL),
      ('531100', 'db_config.json', 'soubor', 'Přístupové údaje do databáze pro PHP', 'done', 1, NULL, NULL),
      ('531200', 'db_config_example.json', 'soubor', 'Vzor pro přístupové údaje do databáze pro PHP', 'done', 1, NULL, NULL),
      ('531300', 'ivy_create_full.sql', 'soubor', 'SQL skript pro vytvoření celé databáze', 'done', 1, NULL, NULL),
      ('531400', 'ivy_insert_data.sql', 'soubor', 'SQL skript pro vložení počátečních dat', 'done', 1, NULL, NULL),
    ('532000', 'system', 'složka', 'Systémová složka pro PHP', 'done', 1, NULL, NULL),
      ('532100', 'db_class.php', 'soubor', 'Třída pro správu databáze', 'done', 1, NULL, NULL),
    ('533000', 'index.php', 'soubor', 'Hlavní vstupní bod webové aplikace', 'done', 1, NULL, NULL),
    ('534000', 'dashboard.php', 'soubor', 'Dashboard pro správu robotů', 'done', 1, NULL, NULL),
    ('535000', 'style.css', 'soubor', 'Styly pro webovou aplikaci', 'done', 1, NULL, NULL),
    ('536000', 'script.js', 'soubor', 'JavaScript pro interaktivitu webu', 'done', 1, NULL, NULL),

('600000', 'Databáze ivy', 'database', 'MariaDB databáze projektu běžící na VPS00', 'done', 1, NULL, NULL),
  ('610000', 'fb_users', 'tabulka', 'Tabulka uživatelských účtů FBu – spravuje virtuální uživatele a jejich parametry (login, limity, stav, host, zamčení, pracovní časy atd.)', 'done', 1, NULL, NULL),
  ('620000', 'fb_groups', 'tabulka', 'Tabulka skupin na FBu – obsahuje metadata o skupinách, stavy, limity, statistiky a související informace.', 'done', 1, NULL, NULL),
  ('630000', 'user_groups', 'tabulka', 'Vazební tabulka uživatel-skupina, obsahuje členství a logiku zapojení účtů do skupin.', 'done', 1, NULL, NULL),
  ('640000', 'log', 'tabulka', 'Log všech akcí vykonávaných uživateli a roboty. Historie aktivit, operací a událostí.', 'done', 1, NULL, NULL),
  ('650000', 'log_s', 'tabulka', 'Systémový log – ukládá klíčové události a stavové informace o systému.', 'done', 1, NULL, NULL),
  ('660000', 'log_u', 'tabulka', 'Uživatelský log – ukládá události a akce spojené s konkrétním uživatelem.', 'done', 1, NULL, NULL),
  ('680000', 'statements', 'tabulka', 'Citáty a texty používané k výchově nebo postování na timeline.', 'done', 1, NULL, NULL),
  ('690000', 'ui_commands', 'tabulka', 'Manuální příkazy zadávané přes dashboard pro ovládání robotů a účtů.', 'done', 1, NULL, NULL),
  ('6A0000', 'variables', 'tabulka', 'Tabulka systémových proměnných a konfigurací – verzování, parametry, limity.', 'done', 1, NULL, NULL),
  ('6C0000', 'referers', 'tabulka', 'Seznam referer URL – využití např. při simulaci reálného provozu.', 'done', 1, NULL, NULL),
  ('6D0000', 'action_definitions', 'tabulka', 'Definice všech typů akcí, které může robot nebo uživatel provést (plánované akce).', 'done', 1, NULL, NULL),
  ('6E0000', 'user_action_plan', 'tabulka', 'Plán akcí pro uživatele – které akce má provést a v jakém čase.', 'done', 1, NULL, NULL),

('700000', 'Web ivy', 'web', 'PHP dashboard projektu běžící na VPS00', 'done', 1, NULL, NULL)

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

-- 19 Data pro jednotlivé druhy akcí
INSERT INTO action_definitions (action_code, label, description, weight, min_minutes, max_minutes, repeatable, active)
VALUES
-- plánované akce
('group_post',        'Příspěvek do skupiny',     'Příspěvek získaný z UTIO typu G/GV.',                 30, 3, 5, TRUE, FALSE),
('timeline_post',     'Příspěvek na Timeline',    'Osobní status na timeline uživatele.',                1, 1080, 4320, TRUE, FALSE),
('comment',           'Komentář',                 'Komentář pod cizím příspěvkem.',                      10, 240, 600, TRUE, FALSE),
('react',             'Reakce (like)',            'Like nebo jiná emoce na příspěvek.',                  20, 60, 180, TRUE, FALSE),
('messenger_check',   'Prohlédnout Messenger',    'Načíst a projít všechny zprávy v Messengeru.',        20, 120, 240, TRUE, FALSE),
('messenger_reply',   'Zpráva známému',           'Napsat příteli.',                                     50, 60, 960, TRUE, FALSE),
('post_utio_gv',      'UTIO post do skupin GV',   'Postování UTIO zprávy do vlastních skupin (GV)',     15, 240, 720, TRUE, FALSE),
('post_utio_p',       'UTIO post do skupin P',    'Postování UTIO zprávy do prodejních skupin (P)',     25, 180, 600, TRUE, FALSE),
('post_utio_z',       'UTIO post do skupin Z',    'Postování UTIO zprávy do zájmových skupin (Z)',      10, 360, 1440, TRUE, FALSE),
-- funkční akce
('post_utio_g',       'UTIO post do skupin G',    'Postování UTIO zprávy do běžných skupin (G)',        20, 120, 480, TRUE, TRUE),
('quote_post',        'Citát na Timeline',        'Publikace citátu na timeline uživatele.',            50, 4320, 10080, TRUE, TRUE),
-- uspávací akce
('account_delay',     'Denní odpočinek',          'Krátký odpočinek dle denní doby (noc/dopo).',         25, 180, 720, TRUE, TRUE),
('account_sleep',     'Uspání účtu',              'Odpočinek účtu na 24-72h.',                           1, 10080, 17280, FALSE, TRUE);

-- Výchozí data pro všechny existující uživatele
INSERT INTO user_group_limits (user_id, group_type, max_posts, time_window_hours)
SELECT
  id,
  'G' as group_type,
  15 as max_posts,
  24 as time_window_hours
FROM fb_users
UNION ALL
SELECT
  id,
  'GV' as group_type,
  1 as max_posts,
  8 as time_window_hours
FROM fb_users
UNION ALL
SELECT
  id,
  'P' as group_type,
  2 as max_posts,
  8 as time_window_hours
FROM fb_users
UNION ALL
SELECT
  id,
  'Z' as group_type,
  1 as max_posts,
  48 as time_window_hours
FROM fb_users;
