# Migration Plan: Sjednocení FB skupin do jedné tabulky

## Cíl
Sjednotit 3 tabulky (fb_groups, group_details, discovered_group_links) do jedné rozšířené `fb_groups`.

## Nová struktura fb_groups

### Současné sloupce (zachovat)
- `id` - Primary key
- `fb_id` - Facebook group ID (unique)
- `nazev` - Název skupiny  
- `priority` - Priorita pro posting
- `user_counter` - Počet uživatelů
- `note` - Poznámky
- `last_seen` - Poslední návštěva
- `next_seen` - Další plánovaná návštěva
- `typ` - Typ skupiny (G/GV/P)
- `region_id` - Region
- `district_id` - Okres
- `is_buy_sell_group` - Prodejní skupina

### Nové sloupce (z group_details)
- `member_count` INT - Počet členů
- `description` TEXT - Popis skupiny
- `category` VARCHAR(255) - Kategorie
- `privacy_type` VARCHAR(50) - Typ soukromí (public/private/closed)
- `discovered_by_user_id` SMALLINT - Kdo objevil
- `analysis_notes` TEXT - Poznámky z analýzy
- `is_relevant` TINYINT(1) - Je relevantní pro posting
- `posting_allowed` TINYINT(1) - Povoleno postování
- `language` VARCHAR(10) - Jazyk skupiny
- `activity_level` VARCHAR(50) - Úroveň aktivity
- `discovered_at` TIMESTAMP - Kdy objeveno
- `last_analyzed` TIMESTAMP - Poslední analýza
- `exploration_priority` TINYINT(1) DEFAULT 1 - Priorita pro exploration

### Status sloupce
- `status` ENUM('active', 'blocked', 'private', 'deleted', 'pending_analysis') DEFAULT 'active'
- `analysis_status` ENUM('not_analyzed', 'analyzing', 'analyzed', 'failed') DEFAULT 'not_analyzed'

## Migration kroky

### 1. Rozšíření fb_groups tabulky
```sql
ALTER TABLE fb_groups ADD COLUMN member_count INT NULL;
ALTER TABLE fb_groups ADD COLUMN description TEXT NULL;
ALTER TABLE fb_groups ADD COLUMN category VARCHAR(255) NULL;
ALTER TABLE fb_groups ADD COLUMN privacy_type VARCHAR(50) NULL;
ALTER TABLE fb_groups ADD COLUMN discovered_by_user_id SMALLINT UNSIGNED NULL;
ALTER TABLE fb_groups ADD COLUMN analysis_notes TEXT NULL;
ALTER TABLE fb_groups ADD COLUMN is_relevant TINYINT(1) NULL;
ALTER TABLE fb_groups ADD COLUMN posting_allowed TINYINT(1) NULL;
ALTER TABLE fb_groups ADD COLUMN language VARCHAR(10) NULL;
ALTER TABLE fb_groups ADD COLUMN activity_level VARCHAR(50) NULL;
ALTER TABLE fb_groups ADD COLUMN discovered_at TIMESTAMP NULL;
ALTER TABLE fb_groups ADD COLUMN last_analyzed TIMESTAMP NULL;
ALTER TABLE fb_groups ADD COLUMN exploration_priority TINYINT(1) DEFAULT 1;
ALTER TABLE fb_groups ADD COLUMN status ENUM('active', 'blocked', 'private', 'deleted', 'pending_analysis') DEFAULT 'active';
ALTER TABLE fb_groups ADD COLUMN analysis_status ENUM('not_analyzed', 'analyzing', 'analyzed', 'failed') DEFAULT 'not_analyzed';
```

### 2. Migrace dat z group_details
```sql
UPDATE fb_groups fg 
JOIN group_details gd ON fg.fb_id = gd.fb_group_id 
SET 
  fg.member_count = gd.member_count,
  fg.description = gd.description,
  fg.category = gd.category,
  fg.privacy_type = gd.privacy_type,
  fg.discovered_by_user_id = gd.discovered_by_user_id,
  fg.analysis_notes = gd.notes,
  fg.is_relevant = gd.is_relevant,
  fg.posting_allowed = gd.posting_allowed,
  fg.language = gd.language,
  fg.activity_level = gd.activity_level,
  fg.discovered_at = gd.discovered_at,
  fg.last_analyzed = gd.last_updated,
  fg.analysis_status = 'analyzed';
```

### 3. Přidání nových skupin z discovered_group_links  
```sql
INSERT INTO fb_groups (fb_id, nazev, discovered_by_user_id, discovered_at, analysis_status, exploration_priority)
SELECT 
  REGEXP_REPLACE(url, '^.*\/groups\/([^\/\?#]+).*$', '\\1') as fb_id,
  NULL as nazev,
  discovered_by_user_id,
  discovered_at,
  'not_analyzed',
  2  -- Vyšší priorita pro nové skupiny
FROM discovered_group_links 
WHERE processed = 0;
```

### 4. Update kódu
- Změnit všechny query na `fb_groups`
- Smazat reference na `group_details` a `discovered_group_links`
- Update exploration logic

### 5. Cleanup
```sql
DROP TABLE group_details;
DROP TABLE discovered_group_links;
```

## Výhody sjednocení

1. **Jednodušší databáze** - jedna tabulka místo tří
2. **Lepší performance** - žádné JOINy mezi tabulkami
3. **Konzistentnější data** - vše na jednom místě
4. **Snazší maintenance** - jeden source of truth
5. **Flexibilnější filtering** - můžeme kombinovat všechna kritéria

## Query změny

### Původní
```sql
-- Exploration: group_details.getGroupsForExploration
-- Posting: groups.getSingleAvailableGroup  
-- Discovery: discovered_links.insertLink
```

### Nové
```sql
-- Exploration
SELECT * FROM fb_groups 
WHERE analysis_status = 'not_analyzed' 
   OR (last_analyzed < DATE_SUB(NOW(), INTERVAL 7 DAY) AND exploration_priority > 0)
ORDER BY exploration_priority DESC, RAND()

-- Posting (beze změny)
SELECT * FROM fb_groups WHERE typ = ? AND status = 'active'

-- Discovery  
INSERT INTO fb_groups (fb_id, discovered_by_user_id, analysis_status) 
VALUES (?, ?, 'not_analyzed')
```