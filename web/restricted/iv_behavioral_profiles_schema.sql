-- Behavioral Profiles Schema for IVY4B3T
-- Stores personality and behavioral patterns for each user account
-- This data must NEVER be committed to Git for security reasons

CREATE TABLE IF NOT EXISTS `user_behavioral_profiles` (
  `user_id` smallint(5) unsigned NOT NULL,

  -- Typing Characteristics
  `avg_typing_speed` decimal(5,2) DEFAULT 180.00 COMMENT 'Average WPM (words per minute)',
  `typing_variance` decimal(4,3) DEFAULT 0.300 COMMENT 'Speed variance factor (0.1-0.5)',
  `mistake_rate` decimal(4,3) DEFAULT 0.050 COMMENT 'Typo rate (0.01-0.15)',
  `correction_style` enum('perfectionist','casual','sloppy') DEFAULT 'casual',
  `double_key_chance` decimal(4,3) DEFAULT 0.100 COMMENT 'Chance of double keypresses',
  `backspace_delay` smallint(4) DEFAULT 200 COMMENT 'Avg delay before backspace (ms)',

  -- Personality Traits
  `impatience_level` decimal(3,2) DEFAULT 0.50 COMMENT 'Impatience 0=patient 1=impatient',
  `multitasking_tendency` decimal(3,2) DEFAULT 0.50 COMMENT 'Tendency to multitask',
  `attention_span` smallint(4) DEFAULT 90 COMMENT 'Attention span in seconds',
  `decision_speed` decimal(3,2) DEFAULT 0.50 COMMENT 'Speed of decision making',
  `perfectionism` decimal(3,2) DEFAULT 0.50 COMMENT 'Perfectionist tendency',

  -- Emotional Patterns
  `base_mood` enum('energetic','tired','focused','distracted','happy','serious','neutral') DEFAULT 'neutral',
  `mood_volatility` decimal(3,2) DEFAULT 0.30 COMMENT 'How much mood changes',
  `frustration_threshold` tinyint(3) DEFAULT 3 COMMENT 'Mistakes before frustration',
  `energy_level` decimal(3,2) DEFAULT 0.80 COMMENT 'Current energy level',

  -- Browsing Behavior
  `scroll_intensity` enum('light','medium','heavy') DEFAULT 'medium',
  `reading_speed` decimal(4,2) DEFAULT 250.00 COMMENT 'Words per minute reading',
  `distraction_chance` decimal(4,3) DEFAULT 0.150 COMMENT 'Chance of getting distracted',
  `procrastination_level` decimal(3,2) DEFAULT 0.40 COMMENT 'Tendency to procrastinate',

  -- Interaction Patterns
  `like_frequency` decimal(4,3) DEFAULT 0.100 COMMENT 'Chance to like posts while browsing',
  `comment_tendency` decimal(4,3) DEFAULT 0.050 COMMENT 'Tendency to comment',
  `hover_behavior` enum('minimal','normal','excessive') DEFAULT 'normal',
  `click_pattern` enum('precise','hasty','hesitant') DEFAULT 'normal',

  -- Adaptive Learning Data
  `learning_rate` decimal(3,2) DEFAULT 0.10 COMMENT 'How fast behavior adapts',
  `pattern_memory` text COMMENT 'JSON data for learned patterns',
  `last_mood_update` timestamp DEFAULT CURRENT_TIMESTAMP,
  `behavior_confidence` decimal(3,2) DEFAULT 0.50 COMMENT 'Confidence in current behavior',

  -- Timestamps
  `created` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`user_id`),
  FOREIGN KEY (`user_id`) REFERENCES `fb_users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Behavioral profiles for realistic human simulation - NEVER commit to Git';

-- Adaptive Behavior Cache Table
CREATE TABLE IF NOT EXISTS `user_behavior_cache` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` smallint(5) unsigned NOT NULL,
  `context_type` enum('typing','browsing','posting','reading','decision') NOT NULL,
  `pattern_name` varchar(50) NOT NULL,
  `pattern_data` json NOT NULL COMMENT 'Cached behavior patterns',
  `frequency` int(10) unsigned DEFAULT 1 COMMENT 'How often this pattern was used',
  `success_rate` decimal(3,2) DEFAULT 1.00 COMMENT 'Success rate of this pattern',
  `last_used` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created` timestamp DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  UNIQUE KEY `user_context_pattern` (`user_id`, `context_type`, `pattern_name`),
  FOREIGN KEY (`user_id`) REFERENCES `fb_users`(`id`) ON DELETE CASCADE,
  INDEX `idx_user_context` (`user_id`, `context_type`),
  INDEX `idx_last_used` (`last_used`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Cached behavioral patterns for learning - NEVER commit to Git';

-- Emotional State Log (for mood tracking)
CREATE TABLE IF NOT EXISTS `user_emotional_log` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` smallint(5) unsigned NOT NULL,
  `emotion_type` enum('frustrated','happy','tired','energetic','focused','distracted','neutral') NOT NULL,
  `intensity` decimal(3,2) DEFAULT 0.50 COMMENT 'Intensity of emotion 0-1',
  `trigger_event` varchar(100) COMMENT 'What caused this emotion',
  `duration_minutes` smallint(5) DEFAULT 30 COMMENT 'Expected duration',
  `timestamp` timestamp DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  FOREIGN KEY (`user_id`) REFERENCES `fb_users`(`id`) ON DELETE CASCADE,
  INDEX `idx_user_time` (`user_id`, `timestamp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Emotional state tracking for realistic behavior';
