-- Tabulka pro ukládání klíčových slov/frází z názvů Facebook skupin
-- Pro pozdější kategorizaci pomocí AI

CREATE TABLE IF NOT EXISTS group_keywords (
  id INT AUTO_INCREMENT PRIMARY KEY,
  word VARCHAR(100) NOT NULL,
  frequency INT DEFAULT 1,
  category VARCHAR(50) NULL,
  is_stopword BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  UNIQUE KEY unique_word (word),
  INDEX idx_frequency (frequency DESC),
  INDEX idx_category (category),
  INDEX idx_stopword (is_stopword)
);

-- Tabulka pro asociace mezi skupinami a jejich klíčovými slovy
CREATE TABLE IF NOT EXISTS group_word_associations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  group_id SMALLINT(5) UNSIGNED NOT NULL,
  keyword_id INT NOT NULL,
  position_in_name TINYINT UNSIGNED,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (group_id) REFERENCES fb_groups(id) ON DELETE CASCADE,
  FOREIGN KEY (keyword_id) REFERENCES group_keywords(id) ON DELETE CASCADE,
  UNIQUE KEY unique_group_keyword (group_id, keyword_id),
  INDEX idx_group (group_id),
  INDEX idx_keyword (keyword_id)
);

-- Přidej několik základních stopwords (slova k ignorování)
INSERT IGNORE INTO group_keywords (word, is_stopword) VALUES
('skupina', TRUE),
('group', TRUE),
('komunita', TRUE),
('community', TRUE),
('fanoušci', TRUE),
('fans', TRUE),
('klub', TRUE),
('club', TRUE),
('czech', TRUE),
('česká', TRUE),
('český', TRUE),
('české', TRUE),
('cz', TRUE),
('sk', TRUE),
('slovenská', TRUE),
('slovenské', TRUE);