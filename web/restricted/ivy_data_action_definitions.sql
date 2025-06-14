-- ivy_data_action_definitions.sql
-- Umístění: /web/restricted/ivy_data_action_definitions.sql
--
-- Popis: Definice všech typů akcí, které může robot nebo uživatel provést
USE ivy;
-- Data pro jednotlivé druhy akcí
INSERT INTO action_definitions (action_code, label, description, weight, min_minutes, max_minutes, repeatable, active)
VALUES
-- Plánované akce (zatím neaktivní)
('group_post',        'Příspěvek do skupiny',     'Příspěvek získaný z UTIO typu G/GV.',                 30, 3, 5, TRUE, FALSE),
('timeline_post',     'Příspěvek na Timeline',    'Osobní status na timeline uživatele.',                1, 1080, 4320, TRUE, FALSE),
('comment',           'Komentář',                 'Komentář pod cizím příspěvkem.',                      10, 240, 600, TRUE, FALSE),
('react',             'Reakce (like)',            'Like nebo jiná emoce na příspěvek.',                  20, 60, 180, TRUE, FALSE),
('messenger_check',   'Prohlédnout Messenger',    'Načíst a projít všechny zprávy v Messengeru.',        20, 120, 240, TRUE, FALSE),
('messenger_reply',   'Zpráva známému',           'Napsat příteli.',                                     50, 60, 960, TRUE, FALSE),
('share_post_gv',     'Sdílení do skupin GV',     'Sdílení příspěvku do vlastních skupin (GV)',          15, 240, 720, TRUE, FALSE),
('share_post_p',      'Sdílení do skupin P',      'Sdílení příspěvku do prodejních skupin (P)',          25, 180, 600, TRUE, FALSE),
('share_post_z',      'Sdílení do skupin Z',      'Sdílení příspěvku do zájmových skupin (Z)',           10, 360, 1440, TRUE, FALSE),
-- Funkční akce (aktivní)
('share_post_g',      'Sdílení do skupin G',      'Sdílení příspěvku do běžných skupin (G)',             20, 120, 480, TRUE, TRUE),
('quote_post',        'Citát na Timeline',        'Publikace citátu na timeline uživatele.',            50, 4320, 10080, TRUE, TRUE),
-- Uspávací akce (aktivní)
('account_delay',     'Denní odpočinek',          'Krátký odpočinek dle denní doby (noc/dopo).',         25, 180, 720, TRUE, TRUE),
('account_sleep',     'Uspání účtu',              'Odpočinek účtu na 24-72h.',                           1, 10080, 17280, FALSE, TRUE);
