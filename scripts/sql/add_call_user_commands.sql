-- UI příkazy call_user pro všechny zablokované uživatele na Ubuntu* hostitelích
-- Spuštěno: 2025-08-02 pro ruční kontrolu zablokovaných účtů

INSERT INTO ui_commands (host, command, data) VALUES 
-- Ubuntu-2D (2 uživatelé)
('Ubuntu-2D', 'call_user', '{"user_id": 25, "name": "Dana Kopečná", "reason": "Facebook checkpoint detected - cache size: 0", "type": "CHECKPOINT"}'),
('Ubuntu-2D', 'call_user', '{"user_id": 9, "name": "Sašenka Juneková", "reason": "Facebook checkpoint detected - cache size: 0", "type": "CHECKPOINT"}'),

-- Ubuntu-5D (6 uživatelů) 
('Ubuntu-5D', 'call_user', '{"user_id": 11, "name": "Nikola Synková", "reason": "Facebook checkpoint detected - cache size: 1", "type": "CHECKPOINT"}'),
('Ubuntu-5D', 'call_user', '{"user_id": 35, "name": "Pavla Pokorná", "reason": "Facebook checkpoint detected - cache size: 1", "type": "CHECKPOINT"}'),
('Ubuntu-5D', 'call_user', '{"user_id": 43, "name": "Amálka Hornová", "reason": "Facebook checkpoint detected - cache size: 1", "type": "CHECKPOINT"}'),
('Ubuntu-5D', 'call_user', '{"user_id": 7, "name": "Verča Hostešová", "reason": "Facebook checkpoint detected - cache size: 1", "type": "CHECKPOINT"}'),
('Ubuntu-5D', 'call_user', '{"user_id": 75, "name": "Karina Šulcová", "reason": "Selhání FB inicializace", "type": "FB_FAILURE"}'),
('Ubuntu-5D', 'call_user', '{"user_id": 72, "name": "Patrície Holá", "reason": "Opakované selhání FB přihlášení", "type": "LOGIN_FAILURE"}'),

-- Ubuntu-2A (5 uživatelů)
('Ubuntu-2A', 'call_user', '{"user_id": 30, "name": "Helča Kusová", "reason": "Potvrďte svou totožnost pomocí videoselfie", "type": "VIDEOSELFIE"}'),
('Ubuntu-2A', 'call_user', '{"user_id": 80, "name": "Ivona Baumruková", "reason": "Facebook checkpoint detected - cache size: 1", "type": "CHECKPOINT"}'),
('Ubuntu-2A', 'call_user', '{"user_id": 57, "name": "Kamila Řehořková", "reason": "Facebook checkpoint detected - cache size: 1", "type": "CHECKPOINT"}'),
('Ubuntu-2A', 'call_user', '{"user_id": 50, "name": "Marcela Šrámková", "reason": "Facebook checkpoint detected - cache size: 1", "type": "CHECKPOINT"}'),
('Ubuntu-2A', 'call_user', '{"user_id": 33, "name": "Marcel Voborka", "reason": "Facebook checkpoint detected - cache size: 1", "type": "CHECKPOINT"}'),

-- Ubuntu-6B (1 uživatel)
('Ubuntu-6B', 'call_user', '{"user_id": 21, "name": "Karolína Bubáková", "reason": "unknown", "type": "UNKNOWN"}');

-- CELKEM: 14 UI příkazů pro všechny zablokované uživatele