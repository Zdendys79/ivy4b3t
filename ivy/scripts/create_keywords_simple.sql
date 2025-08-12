-- Jednoduché tabulky pro klíčová slova bez cizích klíčů

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
  INDEX idx_category (category)
);

CREATE TABLE IF NOT EXISTS group_word_associations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  group_id SMALLINT(5) UNSIGNED NOT NULL,
  keyword_id INT NOT NULL,
  position_in_name TINYINT UNSIGNED,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE KEY unique_group_keyword (group_id, keyword_id),
  INDEX idx_group (group_id),
  INDEX idx_keyword (keyword_id)
);

-- Základní stopwords
INSERT IGNORE INTO group_keywords (word, is_stopword) VALUES
('skupina', TRUE),
('group', TRUE),
('komunita', TRUE),
('fans', TRUE),
('club', TRUE),
('czech', TRUE),
('cz', TRUE);