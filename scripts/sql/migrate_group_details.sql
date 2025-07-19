-- Migrace dat z group_details do fb_groups

-- 1. Aktualizace existujících záznamů
UPDATE fb_groups fg
JOIN group_details gd ON fg.fb_id = gd.fb_group_id
SET 
  fg.name = COALESCE(fg.name, gd.name),
  fg.member_count = gd.member_count,
  fg.description = gd.description,
  fg.category = gd.category,
  fg.privacy_type = gd.privacy_type,
  fg.discovered_by_user_id = COALESCE(fg.discovered_by_user_id, gd.discovered_by_user_id),
  fg.is_relevant = gd.is_relevant,
  fg.posting_allowed = gd.posting_allowed,
  fg.language = gd.language,
  fg.activity_level = gd.activity_level,
  fg.discovered_at = COALESCE(fg.discovered_at, gd.discovered_at),
  fg.last_updated = gd.last_updated,
  fg.last_analysis = gd.last_updated,
  fg.analysis_notes = gd.notes,
  fg.analysis_count = 1,
  fg.status = CASE 
    WHEN gd.is_relevant = 1 THEN 'active'
    WHEN gd.is_relevant = 0 THEN 'inactive' 
    ELSE 'analyzed' 
  END;

-- 2. Vložení nových skupin z group_details které nejsou v fb_groups
INSERT INTO fb_groups (
  fb_id, name, member_count, description, category, privacy_type,
  discovered_by_user_id, is_relevant, posting_allowed, language,
  activity_level, discovered_at, last_updated, last_analysis,
  analysis_notes, analysis_count, status, type, priority
)
SELECT 
  gd.fb_group_id, gd.name, gd.member_count, gd.description, gd.category,
  gd.privacy_type, gd.discovered_by_user_id, gd.is_relevant, gd.posting_allowed,
  gd.language, gd.activity_level, gd.discovered_at, gd.last_updated, gd.last_updated,
  gd.notes, 1,
  CASE 
    WHEN gd.is_relevant = 1 THEN 'active'
    WHEN gd.is_relevant = 0 THEN 'inactive' 
    ELSE 'analyzed' 
  END,
  'G', -- defaultní typ
  3 -- defaultní priorita
FROM group_details gd
WHERE NOT EXISTS (SELECT 1 FROM fb_groups fg WHERE fg.fb_id = gd.fb_group_id);

-- 3. Zobrazení statistik migrace
SELECT 'Aktualizováno existujících skupin:' as info, COUNT(*) as count
FROM fb_groups fg
JOIN group_details gd ON fg.fb_id = gd.fb_group_id
UNION ALL
SELECT 'Vloženo nových skupin:', COUNT(*)
FROM group_details gd
WHERE NOT EXISTS (SELECT 1 FROM fb_groups fg WHERE fg.fb_id = gd.fb_group_id);