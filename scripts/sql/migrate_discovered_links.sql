-- Migrace dat z discovered_group_links do fb_groups

-- 1. Převod user_counter na member_count v existujících záznamech
UPDATE fb_groups 
SET member_count = COALESCE(member_count, user_counter)
WHERE member_count IS NULL AND user_counter IS NOT NULL;

-- 2. Aktualizace existujících skupin z discovered_group_links
UPDATE fb_groups fg
JOIN discovered_group_links dgl ON fg.fb_id = SUBSTRING_INDEX(SUBSTRING_INDEX(dgl.url, '/', -1), '?', 1)
SET 
  fg.discovery_url = dgl.url,
  fg.discovered_by_user_id = COALESCE(fg.discovered_by_user_id, dgl.discovered_by_user_id),
  fg.discovered_at = COALESCE(fg.discovered_at, dgl.discovered_at),
  fg.discovery_processed = dgl.processed,
  fg.discovery_notes = CASE 
    WHEN dgl.processed = 1 THEN 'Zpracováno z discovered_group_links'
    ELSE 'Čeká na zpracování'
  END;

-- 3. Vložení nových skupin z discovered_group_links které nejsou v fb_groups
INSERT INTO fb_groups (
  fb_id, discovery_url, discovered_by_user_id, discovered_at, 
  discovery_processed, discovery_notes, status, type, priority
)
SELECT 
  SUBSTRING_INDEX(SUBSTRING_INDEX(dgl.url, '/', -1), '?', 1) as fb_id,
  dgl.url,
  dgl.discovered_by_user_id,
  dgl.discovered_at,
  dgl.processed,
  CASE 
    WHEN dgl.processed = 1 THEN 'Zpracováno z discovered_group_links'
    ELSE 'Čeká na zpracování'
  END,
  'discovered',
  'G',
  3
FROM discovered_group_links dgl
WHERE NOT EXISTS (
  SELECT 1 FROM fb_groups fg 
  WHERE fg.fb_id = SUBSTRING_INDEX(SUBSTRING_INDEX(dgl.url, '/', -1), '?', 1)
);

-- 4. Zobrazení statistik migrace
SELECT 'Převedeno user_counter na member_count:' as info, 
       COUNT(*) as count
FROM fb_groups 
WHERE member_count IS NOT NULL AND user_counter IS NOT NULL
UNION ALL
SELECT 'Aktualizováno z discovered_group_links:', 
       COUNT(*)
FROM fb_groups fg
JOIN discovered_group_links dgl ON fg.fb_id = SUBSTRING_INDEX(SUBSTRING_INDEX(dgl.url, '/', -1), '?', 1)
UNION ALL
SELECT 'Vloženo nových skupin z discovered_group_links:', 
       COUNT(*)
FROM discovered_group_links dgl
WHERE NOT EXISTS (
  SELECT 1 FROM fb_groups fg 
  WHERE fg.fb_id = SUBSTRING_INDEX(SUBSTRING_INDEX(dgl.url, '/', -1), '?', 1)
);