-- =====================================================
-- Tabulka: group_details
-- Popis: Detaily o prozkoumávaných FB skupinách
-- Autor: IVY4B3T System
-- =====================================================

CREATE TABLE IF NOT EXISTS group_details (
  id INT AUTO_INCREMENT PRIMARY KEY,
  fb_group_id VARCHAR(50) NOT NULL COMMENT 'FB ID skupiny pro přímou navigaci',
  name VARCHAR(255) NOT NULL COMMENT 'Název skupiny',
  member_count INT DEFAULT NULL COMMENT 'Počet členů skupiny',
  description TEXT COMMENT 'Popis skupiny nebo pravidla',
  category VARCHAR(100) COMMENT 'Kategorie/téma skupiny',
  privacy_type ENUM('public', 'private', 'closed') DEFAULT 'public' COMMENT 'Typ soukromí skupiny',
  discovered_by_user_id INT COMMENT 'ID uživatele, který skupinu objevil',
  discovered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Kdy byla skupina objevena',
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Poslední aktualizace údajů',
  notes TEXT COMMENT 'Poznámky o skupině',
  is_relevant BOOLEAN DEFAULT NULL COMMENT 'Zda je skupina relevantní pro naše účely',
  posting_allowed BOOLEAN DEFAULT NULL COMMENT 'Zda skupina umožňuje postování',
  language VARCHAR(10) DEFAULT 'cs' COMMENT 'Jazyk skupiny',
  activity_level ENUM('low', 'medium', 'high') DEFAULT NULL COMMENT 'Úroveň aktivity skupiny',
  
  UNIQUE KEY unique_fb_group (fb_group_id),
  INDEX idx_discovered_by (discovered_by_user_id),
  INDEX idx_member_count (member_count),
  INDEX idx_relevant (is_relevant),
  INDEX idx_posting_allowed (posting_allowed),
  INDEX idx_discovered_at (discovered_at),
  
  FOREIGN KEY (discovered_by_user_id) REFERENCES fb_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Detaily o prozkoumávaných FB skupinách';