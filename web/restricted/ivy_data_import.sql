-- ivy_data_import.sql
-- Umístění: /web/restricted/ivy_data_import.sql
--
-- Popis: Import aktuálních dat z původní databáze utiolite do nové struktury ivy
USE ivy;

SET
    NAMES utf8mb4;

SET
    time_zone = '+00:00';

SET
    foreign_key_checks = 0;

SET
    sql_mode = 'NO_AUTO_VALUE_ON_ZERO';

-- 1. Převod fb_users
INSERT INTO
    fb_users (
        id,
        name,
        surname,
        day_limit,
        max_limit,
        next_worktime,
        next_statement,
        e_mail,
        e_pass,
        fb_login,
        fb_pass,
        u_login,
        u_pass,
        locked,
        unlocked,
        day_limit_updated,
        last_add_group,
        portal_id,
        host
    )
SELECT
    id,
    name,
    surname,
    day_limit,
    max_limit,
    next_worktime,
    next_statement,
    e_mail,
    e_pass,
    fb_login,
    fb_pass,
    u_login,
    u_pass,
    locked,
    unlocked,
    day_limit_updated,
    last_add_group,
    portal_id,
    host
FROM
    utiolite.fb_users;

-- 2. Převod fb_groups
INSERT INTO
    fb_groups (
        id,
        fb_id,
        nazev,
        priority,
        user_counter,
        note,
        last_seen,
        next_seen,
        typ,
        region_id,
        district_id,
        sell
    )
SELECT
    id,
    fb_id,
    nazev,
    priority,
    user_counter,
    note,
    last_seen,
    next_seen,
    typ,
    region_id,
    district_id,
    sell
FROM
    utiolite.fb_groups;

-- 3. Převod ui_commands
INSERT INTO
    ui_commands (
        id,
        host,
        command,
        data,
        created,
        accepted,
        fulfilled
    )
SELECT
    id,
    host,
    command,
    data,
    created,
    accepted,
    fulfilled
FROM
    utiolite.ui_commands;

-- 4. Převod z utiolite.statements do ivy.quotes
INSERT INTO
    ivy.quotes (user_id, text, hash)
SELECT
    user_id,
    statement,
    hash
FROM
    utiolite.statements;


-- 6. Převod variables
INSERT INTO
    variables (name, value, changed)
SELECT
    name,
    value,
    changed
FROM
    utiolite.variables;

-- 7. Kopírování codebook tabulek
INSERT INTO
    c_regions (id, region)
SELECT
    id,
    region
FROM
    utiolite.c_regions;

INSERT INTO
    c_portals (id, portal)
SELECT
    id,
    portal
FROM
    utiolite.c_portals;

INSERT INTO
    c_districts (id, region_id, district)
SELECT
    id,
    region_id,
    district
FROM
    utiolite.c_districts;

-- 8. Výchozí limity pro všechny existující uživatele
INSERT INTO
    user_group_limits (user_id, group_type, max_posts, time_window_hours)
SELECT
    id,
    'G' as group_type,
    15 as max_posts,
    24 as time_window_hours
FROM
    fb_users
UNION ALL
SELECT
    id,
    'GV' as group_type,
    1 as max_posts,
    8 as time_window_hours
FROM
    fb_users
UNION ALL
SELECT
    id,
    'P' as group_type,
    2 as max_posts,
    8 as time_window_hours
FROM
    fb_users
UNION ALL
SELECT
    id,
    'Z' as group_type,
    1 as max_posts,
    48 as time_window_hours
FROM
    fb_users;

-- Resetování foreign key kontroly
SET
    foreign_key_checks = 1;
