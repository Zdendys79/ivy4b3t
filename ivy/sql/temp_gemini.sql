-- Přidání nových akcí pro sledování žádostí o členství
INSERT INTO `action_definitions` (`action_code`, `label`, `description`, `weight`, `min_minutes`, `max_minutes`, `active`, `repeatable`, `invasive`) VALUES
('join_group_g', 'Žádost o členství (G)', 'Automatická žádost o přidání do běžné skupiny.', 0, 1440, 2880, 0, 0, 0),
('join_group_gv', 'Žádost o členství (GV)', 'Automatická žádost o přidání do GV skupiny.', 0, 1440, 2880, 0, 0, 0);
