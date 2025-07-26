-- Vytvoření behavioral profiles tabulek
-- Tato tabulka ukládá behavioral profily uživatelů pro human behavior simulation

USE ivy;

-- Vytvoření tabulky user_behavioral_profiles
CREATE TABLE IF NOT EXISTS user_behavioral_profiles (
    user_id SMALLINT(5) UNSIGNED PRIMARY KEY,
    avg_typing_speed DECIMAL(5,2) DEFAULT 150.00,
    typing_variance DECIMAL(3,2) DEFAULT 0.30,
    mistake_rate DECIMAL(4,3) DEFAULT 0.050,
    correction_style VARCHAR(20) DEFAULT 'casual',
    double_key_chance DECIMAL(4,3) DEFAULT 0.100,
    backspace_delay INT DEFAULT 200,
    impatience_level DECIMAL(3,2) DEFAULT 0.50,
    multitasking_tendency DECIMAL(3,2) DEFAULT 0.50,
    attention_span INT DEFAULT 90,
    decision_speed DECIMAL(3,2) DEFAULT 0.50,
    perfectionism DECIMAL(3,2) DEFAULT 0.50,
    base_mood VARCHAR(20) DEFAULT 'neutral',
    mood_volatility DECIMAL(3,2) DEFAULT 0.30,
    frustration_threshold DECIMAL(3,2) DEFAULT 0.70,
    energy_level DECIMAL(3,2) DEFAULT 0.80,
    scroll_intensity VARCHAR(10) DEFAULT 'medium',
    reading_speed DECIMAL(5,2) DEFAULT 240.00,
    distraction_chance DECIMAL(3,2) DEFAULT 0.20,
    procrastination_level DECIMAL(3,2) DEFAULT 0.40,
    like_frequency DECIMAL(4,3) DEFAULT 0.100,
    comment_tendency DECIMAL(4,3) DEFAULT 0.050,
    hover_behavior VARCHAR(20) DEFAULT 'normal',
    click_pattern VARCHAR(20) DEFAULT 'normal',
    learning_rate DECIMAL(3,2) DEFAULT 0.10,
    pattern_memory DECIMAL(3,2) DEFAULT 0.70,
    behavior_confidence DECIMAL(3,2) DEFAULT 0.50,
    last_mood_update TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES fb_users(id) ON DELETE CASCADE
);

-- Vytvoření tabulky user_behavior_cache
CREATE TABLE IF NOT EXISTS user_behavior_cache (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id SMALLINT(5) UNSIGNED NOT NULL,
    context_type VARCHAR(50) NOT NULL,
    pattern_name VARCHAR(100) NOT NULL,
    pattern_data TEXT,
    frequency INT DEFAULT 1,
    success_rate DECIMAL(3,2) DEFAULT 0.50,
    last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_pattern (user_id, context_type, pattern_name),
    FOREIGN KEY (user_id) REFERENCES fb_users(id) ON DELETE CASCADE
);

-- Vytvoření tabulky user_emotional_log
CREATE TABLE IF NOT EXISTS user_emotional_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id SMALLINT(5) UNSIGNED NOT NULL,
    emotion_type VARCHAR(30) NOT NULL,
    intensity DECIMAL(3,2) DEFAULT 0.50,
    trigger_event VARCHAR(255),
    duration_minutes INT DEFAULT 30,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES fb_users(id) ON DELETE CASCADE
);

-- Vytvoření výchozích profilů pro existující uživatele
INSERT IGNORE INTO user_behavioral_profiles (user_id)
SELECT id FROM fb_users;

-- Aktualizace s náhodnými hodnotami pro rozmanitost
UPDATE user_behavioral_profiles 
SET 
    avg_typing_speed = 120 + RAND() * 120,
    typing_variance = 0.2 + RAND() * 0.3,
    mistake_rate = 0.02 + RAND() * 0.08,
    correction_style = CASE FLOOR(RAND() * 3) 
        WHEN 0 THEN 'perfectionist'
        WHEN 1 THEN 'casual'
        ELSE 'sloppy'
    END,
    double_key_chance = 0.05 + RAND() * 0.15,
    impatience_level = RAND(),
    multitasking_tendency = RAND(),
    attention_span = 45 + RAND() * 120,
    decision_speed = RAND(),
    perfectionism = RAND(),
    base_mood = CASE FLOOR(RAND() * 7)
        WHEN 0 THEN 'energetic'
        WHEN 1 THEN 'tired'
        WHEN 2 THEN 'focused'
        WHEN 3 THEN 'distracted'
        WHEN 4 THEN 'happy'
        WHEN 5 THEN 'serious'
        ELSE 'neutral'
    END,
    energy_level = 0.6 + RAND() * 0.4,
    scroll_intensity = CASE FLOOR(RAND() * 3)
        WHEN 0 THEN 'light'
        WHEN 1 THEN 'medium'
        ELSE 'heavy'
    END,
    reading_speed = 180 + RAND() * 120,
    distraction_chance = 0.1 + RAND() * 0.2,
    procrastination_level = 0.2 + RAND() * 0.4,
    like_frequency = 0.05 + RAND() * 0.15,
    comment_tendency = 0.02 + RAND() * 0.08
WHERE created = updated;

SELECT COUNT(*) as 'Behavioral profiles created' FROM user_behavioral_profiles;