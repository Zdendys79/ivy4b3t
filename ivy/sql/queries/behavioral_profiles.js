/**
 * Název souboru: behavioral_profiles.js
 * Umístění: ~/ivy/sql/queries/behavioral_profiles.js
 * 
 * Popis: SQL dotazy pro správu behavioral profiles a human behavior simulation
 * POZOR: Tato data jsou citlivá a nesmí být nikdy commitnuta do Gitu
 */

export const BEHAVIORAL_PROFILES = {
  // ===== CRUD OPERACE PRO BEHAVIORAL PROFILES =====

  getUserProfile: `
    SELECT 
      user_id,
      avg_typing_speed, typeing_variance,
      mistake_rate,
      correction_style,
      double_key_chance,
      backspace_delay,
      impatience_level,
      multitasking_tendency,
      attention_span,
      decision_speed,
      perfectionism,
      base_mood,
      mood_volatility,
      frustration_threshold,
      energy_level,
      scroll_intensity,
      reading_speed,
      distraction_chance,
      procrastination_level,
      like_frequency,
      comment_tendency,
      hover_behavior,
      click_pattern,
      learning_rate,
      pattern_memory,
      behavior_confidence,
      last_mood_update,
      created,
      updated
    FROM user_behavioral_profiles
    WHERE user_id = ?
  `,

  createDefaultProfile: `
    INSERT INTO user_behavioral_profiles (
      user_id,
      avg_typing_speed, typeing_variance,
      mistake_rate,
      correction_style,
      double_key_chance,
      impatience_level,
      multitasking_tendency,
      attention_span,
      decision_speed,
      perfectionism,
      base_mood,
      energy_level,
      scroll_intensity,
      reading_speed,
      distraction_chance,
      procrastination_level,
      like_frequency,
      comment_tendency
    ) VALUES (
      ?,
      120 + RAND() * 120,  -- 120-240 WPM
      0.2 + RAND() * 0.3,  -- 0.2-0.5 variance
      0.02 + RAND() * 0.08, -- 2-10% mistakes
      CASE FLOOR(RAND() * 3) 
        WHEN 0 THEN 'perfectionist'
        WHEN 1 THEN 'casual'
        ELSE 'sloppy'
      END,
      0.05 + RAND() * 0.15, -- 5-20% double keys
      RAND(),               -- random impatience
      RAND(),               -- random multitasking
      45 + RAND() * 120,    -- 45-165s attention
      RAND(),               -- random decision speed
      RAND(),               -- random perfectionism
      CASE FLOOR(RAND() * 7)
        WHEN 0 THEN 'energetic'
        WHEN 1 THEN 'tired'
        WHEN 2 THEN 'focused'
        WHEN 3 THEN 'distracted'
        WHEN 4 THEN 'happy'
        WHEN 5 THEN 'serious'
        ELSE 'neutral'
      END,
      0.6 + RAND() * 0.4,   -- 60-100% energy
      CASE FLOOR(RAND() * 3)
        WHEN 0 THEN 'light'
        WHEN 1 THEN 'medium'
        ELSE 'heavy'
      END,
      180 + RAND() * 120,   -- 180-300 WPM reading
      0.1 + RAND() * 0.2,   -- 10-30% distraction
      0.2 + RAND() * 0.4,   -- 20-60% procrastination
      0.05 + RAND() * 0.15, -- 5-20% like frequency
      0.02 + RAND() * 0.08  -- 2-10% comment tendency
    )
  `,

  updateTypingCharacteristics: `
    UPDATE user_behavioral_profiles
    SET 
      avg_typing_speed = ?, typeing_variance = ?,
      mistake_rate = ?,
      correction_style = ?,
      double_key_chance = ?,
      backspace_delay = ?
    WHERE user_id = ?
  `,

  updateMoodAndEnergy: `
    UPDATE user_behavioral_profiles
    SET 
      base_mood = ?,
      energy_level = ?,
      last_mood_update = CURRENT_TIMESTAMP
    WHERE user_id = ?
  `,

  updateLearningData: `
    UPDATE user_behavioral_profiles
    SET 
      pattern_memory = ?,
      behavior_confidence = ?,
      learning_rate = ?
    WHERE user_id = ?
  `,

  // ===== BEHAVIOR CACHE OPERACE =====

  getCachedPattern: `
    SELECT 
      pattern_data,
      frequency,
      success_rate,
      last_used
    FROM user_behavior_cache
    WHERE user_id = ? AND context_type = ? AND pattern_name = ?
  `,

  saveBehaviorPattern: `
    INSERT INTO user_behavior_cache (
      user_id,
      context_type,
      pattern_name,
      pattern_data,
      frequency,
      success_rate
    ) VALUES (?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      pattern_data = VALUES(pattern_data),
      frequency = frequency + 1,
      success_rate = (success_rate * frequency + VALUES(success_rate)) / (frequency + 1),
      last_used = CURRENT_TIMESTAMP
  `,

  getFrequentPatterns: `
    SELECT 
      pattern_name,
      pattern_data,
      frequency,
      success_rate
    FROM user_behavior_cache
    WHERE user_id = ? AND context_type = ?
    ORDER BY frequency DESC, success_rate DESC
    LIMIT ?
  `,

  cleanOldPatterns: `
    DELETE FROM user_behavior_cache
    WHERE user_id = ? 
      AND last_used < DATE_SUB(NOW(), INTERVAL ? DAY)
      AND frequency < 3
  `,

  // ===== EMOTIONAL STATE OPERACE =====

  logEmotionalState: `
    INSERT INTO user_emotional_log (
      user_id,
      emotion_type,
      intensity,
      trigger_event,
      duration_minutes
    ) VALUES (?, ?, ?, ?, ?)
  `,

  getCurrentEmotion: `
    SELECT 
      emotion_type,
      intensity,
      trigger_event,
      TIMESTAMPDIFF(MINUTE, timestamp, NOW()) as minutes_ago,
      duration_minutes
    FROM user_emotional_log
    WHERE user_id = ?
      AND timestamp >= DATE_SUB(NOW(), INTERVAL duration_minutes MINUTE)
    ORDER BY timestamp DESC
    LIMIT 1
  `,

  getEmotionalHistory: `
    SELECT 
      emotion_type,
      intensity,
      trigger_event,
      timestamp,
      duration_minutes
    FROM user_emotional_log
    WHERE user_id = ?
      AND timestamp >= DATE_SUB(NOW(), INTERVAL ? HOUR)
    ORDER BY timestamp DESC
  `,

  updateEmotionalIntensity: `
    UPDATE user_emotional_log
    SET 
      intensity = GREATEST(0, intensity - ?),
      duration_minutes = GREATEST(0, duration_minutes - TIMESTAMPDIFF(MINUTE, timestamp, NOW()))
    WHERE user_id = ?
      AND timestamp >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
  `,

  // ===== ADAPTIVE LEARNING QUERIES =====

  getSuccessfulPatterns: `
    SELECT 
      context_type,
      pattern_name,
      pattern_data,
      success_rate,
      frequency
    FROM user_behavior_cache
    WHERE user_id = ?
      AND success_rate > 0.7
      AND frequency > 2
    ORDER BY success_rate DESC, frequency DESC
  `,

  adaptProfileBasedOnSuccess: `
    UPDATE user_behavioral_profiles
    SET 
      behavior_confidence = LEAST(1.0, behavior_confidence + ?),
      learning_rate = GREATEST(0.01, learning_rate * 0.95)
    WHERE user_id = ?
  `,

  adaptProfileBasedOnFailure: `
    UPDATE user_behavioral_profiles
    SET 
      behavior_confidence = GREATEST(0.1, behavior_confidence - ?),
      learning_rate = LEAST(0.5, learning_rate * 1.05)
    WHERE user_id = ?
  `,

  // ===== BULK OPERACE =====

  initializeAllProfiles: `
    INSERT IGNORE INTO user_behavioral_profiles (user_id)
    SELECT id FROM fb_users
    WHERE id NOT IN (SELECT user_id FROM user_behavioral_profiles)
  `,

  getProfilesNeedingUpdate: `
    SELECT user_id
    FROM user_behavioral_profiles
    WHERE last_mood_update < DATE_SUB(NOW(), INTERVAL 2 HOUR)
       OR behavior_confidence < 0.3
    ORDER BY last_mood_update ASC
    LIMIT ?
  `,

  // ===== STATISTIKY A REPORTING =====

  getProfileStatistics: `
    SELECT 
      COUNT(*) as total_profiles,
      AVG(avg_typing_speed) as avg_typing_speed,
      AVG(mistake_rate) as avg_mistake_rate,
      AVG(energy_level) as avg_energy,
      AVG(behavior_confidence) as avg_confidence,
      base_mood,
      COUNT(*) as mood_count
    FROM user_behavioral_profiles
    GROUP BY base_mood
    ORDER BY mood_count DESC
  `,

  getBehaviorInsights: `
    SELECT 
      ubp.user_id,
      fu.name,
      fu.surname,
      ubp.base_mood,
      ubp.energy_level,
      ubp.behavior_confidence,
      ubc.pattern_count,
      uel.recent_emotions
    FROM user_behavioral_profiles ubp
    JOIN fb_users fu ON ubp.user_id = fu.id
    LEFT JOIN (
      SELECT user_id, COUNT(*) as pattern_count
      FROM user_behavior_cache
      GROUP BY user_id
    ) ubc ON ubp.user_id = ubc.user_id
    LEFT JOIN (
      SELECT user_id, COUNT(*) as recent_emotions
      FROM user_emotional_log
      WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
      GROUP BY user_id
    ) uel ON ubp.user_id = uel.user_id
    WHERE ubp.user_id = ?
  `
};