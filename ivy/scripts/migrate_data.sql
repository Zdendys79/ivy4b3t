-- Migrační skript: ivy_test → ivy
-- Přenos všech dat z vývojové do produkční databáze

SET FOREIGN_KEY_CHECKS = 0;

-- Číselníky a systémové tabulky
INSERT INTO ivy.c_districts SELECT * FROM ivy_test.c_districts;
INSERT INTO ivy.c_languages SELECT * FROM ivy_test.c_languages;
INSERT INTO ivy.c_portals SELECT * FROM ivy_test.c_portals;
INSERT INTO ivy.c_regions SELECT * FROM ivy_test.c_regions;
INSERT INTO ivy.variables SELECT * FROM ivy_test.variables;

-- Definice akcí
INSERT INTO ivy.action_definitions SELECT * FROM ivy_test.action_definitions;

-- Uživatelé a skupiny
INSERT INTO ivy.fb_users SELECT * FROM ivy_test.fb_users;
INSERT INTO ivy.fb_groups SELECT * FROM ivy_test.fb_groups;
INSERT INTO ivy.user_groups SELECT * FROM ivy_test.user_groups;
INSERT INTO ivy.user_group_limits SELECT * FROM ivy_test.user_group_limits;
INSERT INTO ivy.user_behavioral_profiles SELECT * FROM ivy_test.user_behavioral_profiles;
INSERT INTO ivy.user_action_plan SELECT * FROM ivy_test.user_action_plan;

-- Logy a statistiky
INSERT INTO ivy.action_log SELECT * FROM ivy_test.action_log;
INSERT INTO ivy.heartbeat SELECT * FROM ivy_test.heartbeat;
INSERT INTO ivy.log_system SELECT * FROM ivy_test.log_system;
INSERT INTO ivy.referers SELECT * FROM ivy_test.referers;

-- Obsahové tabulky
INSERT INTO ivy.quotes SELECT * FROM ivy_test.quotes;
INSERT INTO ivy.rss_channels SELECT * FROM ivy_test.rss_channels;
INSERT INTO ivy.rss_urls SELECT * FROM ivy_test.rss_urls;

-- Nové tabulky
INSERT INTO ivy.group_keywords SELECT * FROM ivy_test.group_keywords;
INSERT INTO ivy.group_word_associations SELECT * FROM ivy_test.group_word_associations;

-- UI příkazy
INSERT INTO ivy.ui_commands SELECT * FROM ivy_test.ui_commands;

-- Vývojové tabulky (pokud existují v produkci)
INSERT IGNORE INTO ivy.action_quality SELECT * FROM ivy_test.action_quality;
INSERT IGNORE INTO ivy.debug_incidents SELECT * FROM ivy_test.debug_incidents;
INSERT IGNORE INTO ivy.scheme SELECT * FROM ivy_test.scheme;

SET FOREIGN_KEY_CHECKS = 1;