-- Rozšíření fb_groups o všechny potřebné sloupce
ALTER TABLE fb_groups 
-- Discovery info z discovered_group_links
ADD COLUMN discovery_url varchar(2048) DEFAULT NULL COMMENT 'URL kde byla skupina objevena',
ADD COLUMN discovered_by_user_id smallint(5) unsigned DEFAULT NULL,
ADD COLUMN discovered_at timestamp DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN discovery_processed boolean DEFAULT FALSE COMMENT 'Zda byla discovery zpracována',

-- Group details
ADD COLUMN member_count int(11) DEFAULT NULL,
ADD COLUMN description text DEFAULT NULL,
ADD COLUMN category varchar(255) DEFAULT NULL,
ADD COLUMN privacy_type varchar(50) DEFAULT NULL COMMENT 'public, private, secret',
ADD COLUMN language varchar(10) DEFAULT 'cs',
ADD COLUMN activity_level varchar(50) DEFAULT NULL COMMENT 'high, medium, low',
ADD COLUMN posting_allowed boolean DEFAULT NULL,
ADD COLUMN is_relevant tinyint(1) DEFAULT NULL COMMENT '1=relevant, 0=irrelevant, NULL=unknown',

-- Tracking a timing
ADD COLUMN last_updated timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
ADD COLUMN last_analysis timestamp DEFAULT NULL COMMENT 'Kdy byla naposledy analyzována',

-- Statistiky
ADD COLUMN post_count int(11) DEFAULT 0 COMMENT 'Počet našich příspěvků',
ADD COLUMN success_rate decimal(5,2) DEFAULT NULL COMMENT 'Úspěšnost postování %',
ADD COLUMN analysis_count int(11) DEFAULT 0 COMMENT 'Kolikrát byla analyzována',

-- Poznámky
ADD COLUMN discovery_notes text DEFAULT NULL COMMENT 'Poznámky z objevení',
ADD COLUMN analysis_notes text DEFAULT NULL COMMENT 'Poznámky z analýzy',

-- Status
ADD COLUMN status varchar(20) DEFAULT 'discovered' COMMENT 'discovered, analyzed, active, inactive, banned',
ADD COLUMN needs_review boolean DEFAULT FALSE COMMENT 'Potřebuje manuální revizi';