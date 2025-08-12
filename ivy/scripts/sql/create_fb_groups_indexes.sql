-- Vytvoření indexů pro konsolidovanou fb_groups tabulku

-- Hlavní indexy pro vyhledávání
CREATE INDEX IF NOT EXISTS idx_fb_groups_fb_id ON fb_groups(fb_id);
CREATE INDEX IF NOT EXISTS idx_fb_groups_status ON fb_groups(status);
CREATE INDEX IF NOT EXISTS idx_fb_groups_priority ON fb_groups(priority);
CREATE INDEX IF NOT EXISTS idx_fb_groups_type ON fb_groups(type);
CREATE INDEX IF NOT EXISTS idx_fb_groups_is_relevant ON fb_groups(is_relevant);

-- Indexy pro discovery
CREATE INDEX IF NOT EXISTS idx_fb_groups_discovered_by ON fb_groups(discovered_by_user_id);
CREATE INDEX IF NOT EXISTS idx_fb_groups_discovered_at ON fb_groups(discovered_at);
CREATE INDEX IF NOT EXISTS idx_fb_groups_discovery_processed ON fb_groups(discovery_processed);

-- Indexy pro analýzu
CREATE INDEX IF NOT EXISTS idx_fb_groups_last_analysis ON fb_groups(last_analysis);
CREATE INDEX IF NOT EXISTS idx_fb_groups_analysis_count ON fb_groups(analysis_count);
CREATE INDEX IF NOT EXISTS idx_fb_groups_posting_allowed ON fb_groups(posting_allowed);

-- Indexy pro výkon
CREATE INDEX IF NOT EXISTS idx_fb_groups_member_count ON fb_groups(member_count);
CREATE INDEX IF NOT EXISTS idx_fb_groups_activity_level ON fb_groups(activity_level);
CREATE INDEX IF NOT EXISTS idx_fb_groups_last_updated ON fb_groups(last_updated);

-- Kompozitní indexy pro častá vyhledávání
CREATE INDEX IF NOT EXISTS idx_fb_groups_type_priority ON fb_groups(type, priority);
CREATE INDEX IF NOT EXISTS idx_fb_groups_status_relevant ON fb_groups(status, is_relevant);
CREATE INDEX IF NOT EXISTS idx_fb_groups_exploration ON fb_groups(is_relevant, last_analysis, status);
CREATE INDEX IF NOT EXISTS idx_fb_groups_discovery_queue ON fb_groups(discovery_processed, discovered_at);

-- Index pro blocking
CREATE INDEX IF NOT EXISTS idx_fb_groups_next_seen ON fb_groups(next_seen);
CREATE INDEX IF NOT EXISTS idx_fb_groups_last_seen ON fb_groups(last_seen);

-- Index pro názvy skupin
CREATE INDEX IF NOT EXISTS idx_fb_groups_name ON fb_groups(name(100));

-- Zobrazení statistik indexů
SHOW INDEX FROM fb_groups;