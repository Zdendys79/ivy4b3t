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
INSERT INTO `scheme` (`id`, `name`, `type`, `parent_id`, `description`, `status`, `visible`, `position_x`, `position_y`) VALUES
(1,	'Zdeněk Jelínek',	'osoba',	1,	'Hlavní vývojář a správce systému Ivy4B3T',	'done',	0,	NULL,	NULL),
(2,	'Ivy4B3T',	'systém',	1,	'Autonomní systém pro správu FB účtů pomocí Puppeteer',	'done',	1,	NULL,	NULL),
(10,	'Base.7',	'hypervizor',	2,	'Fyzický server s Ubuntu, 4 jádra, 16 GB RAM',	'done',	1,	NULL,	NULL),
(11,	'Ubuntu-7A',	'VM',	10,	'Virtuální stroj pro Ivy klienta',	'done',	1,	NULL,	NULL),
(12,	'Ubuntu-7B',	'VM',	10,	'Virtuální stroj pro Ivy klienta',	'done',	1,	NULL,	NULL),
(101,	'Sdílená CPU',	'vCPU',	11,	'Počet virtuálních jader CPU',	'done',	0,	NULL,	NULL),
(102,	'Alokovaná RAM',	'RAM',	11,	'Velikost RAM paměti alokované pro VM',	'done',	0,	NULL,	NULL),
(103,	'Operační systém',	'OS',	11,	'Operační systém VM',	'done',	0,	NULL,	NULL),
(104,	'Verze OS',	'verze',	11,	'Verze operačního systému VM',	'done',	0,	NULL,	NULL),
(105,	'Verze Ivy',	'verze',	11,	'Verze Ivy běžící na VM',	'done',	0,	NULL,	NULL),
(106,	'Chromium profily',	'složka',	11,	'Lokální profily pro jednotlivé účty – --user-data-dir',	'done',	0,	NULL,	NULL),
(121,	'Sdílená CPU',	'vCPU',	12,	'Počet virtuálních jader CPU',	'done',	0,	NULL,	NULL),
(122,	'Alokovaná RAM',	'RAM',	12,	'Velikost RAM paměti alokované pro VM',	'done',	0,	NULL,	NULL),
(123,	'Operační systém',	'OS',	12,	'Operační systém VM',	'done',	0,	NULL,	NULL),
(124,	'Verze OS',	'verze',	12,	'Verze operačního systému VM',	'done',	0,	NULL,	NULL),
(125,	'Verze Ivy',	'verze',	12,	'Verze Ivy běžící na VM',	'done',	0,	NULL,	NULL),
(126,	'Chromium profily',	'složka',	12,	'Lokální profily pro jednotlivé účty – --user-data-dir',	'done',	0,	NULL,	NULL),
(200,	'start.sh',	'skript',	12,	'Bash skript pro opakované spouštění pupp.js',	'done',	1,	NULL,	NULL),
(201,	'ivy.js',	'program',	12,	'Hlavní řídící program Ivy projektu na VM klientech',	'partial',	1,	NULL,	NULL),
(202,	'loginuser.js',	'utility',	12,	'Skript pro správu FB uživatele ne webu',	'todo',	1,	NULL,	NULL),
(203,	'cycleusers.js',	'utility',	12,	'Cyklické přepínání uživatelů na virtuálu pro vytvoření profilů browseru a přihlášení na Facebook',	'todo',	1,	NULL,	NULL),
(204,	'rss_reader.js',	'utility',	12,	'Skript pro načítání zpráv z RSS a ukládání URL do databáze',	'todo',	1,	NULL,	NULL),
(300,	'iv_fb.js',	'modul',	201,	'Funkce pro interakci s Facebookem',	'todo',	1,	NULL,	NULL),
(301,	'iv_utio.js',	'modul',	201,	'Funkce pro komunikaci s portálem Utio',	'todo',	1,	NULL,	NULL),
(302,	'iv_support.js',	'modul',	201,	'Funkce pro výchovu, kontrolu verze, limity',	'todo',	1,	NULL,	NULL),
(303,	'iv_sql.js',	'modul',	201,	'Funkce pro komunikaci s databází ivy',	'todo',	1,	NULL,	NULL),
(304,	'iv_wait.js',	'modul',	201,	'Funkce pro náhodná zpoždění a čekání',	'todo',	1,	NULL,	NULL),
(400,	'ivy',	'databáze',	2,	'MariaDB databáze pro plánování, logiku a monitoring',	'partial',	1,	NULL,	NULL),
(401,	'fb_users',	'tabulka',	400,	'FB účty – stav, limity, logika použití',	'todo',	1,	NULL,	NULL),
(402,	'groups',	'tabulka',	400,	'Seznam FB skupin a jejich metadata',	'todo',	1,	NULL,	NULL),
(403,	'ui_commands',	'tabulka',	400,	'Manuální příkazy zadávané přes dashboard',	'todo',	1,	NULL,	NULL),
(404,	'statements',	'tabulka',	400,	'Citáty pro výchovu, použitelné na timeline',	'todo',	1,	NULL,	NULL),
(405,	'urls',	'tabulka',	400,	'Zprávy a odkazy pro postování z RSS a jiných zdrojů',	'todo',	1,	NULL,	NULL),
(406,	'variables',	'tabulka',	400,	'Proměnné systému',	'todo',	1,	NULL,	NULL);

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

