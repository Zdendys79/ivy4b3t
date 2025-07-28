/**
 * Název souboru: behavioral_profiles.js
 * Umístění: ~/ivy/sql/queries/behavioral_profiles.js
 * 
 * Popis: SQL dotazy pro správu behavioral profiles a human behavior simulation
 * POZOR: Tato data jsou citlivá a nesmí být nikdy commitnuta do Gitu
 */

export const BEHAVIORAL_PROFILES = {
  // ===== CRUD OPERACE PRO BEHAVIORAL PROFILES =====
  // POUZE definice chování virtuálních uživatelů - ŽÁDNÉ učení nebo adaptace!

  getUserProfile: `
    SELECT 
      user_id,
      avg_typing_speed, typing_variance,
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
      // ODSTRANĚNO: learning_rate, pattern_memory, behavior_confidence - žádné učení
      last_mood_update,
      created,
      updated
    FROM user_behavioral_profiles
    WHERE user_id = ?
  `,

  createDefaultProfile: `
    INSERT INTO user_behavioral_profiles (
      user_id,
      avg_typing_speed, typing_variance,
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
      avg_typing_speed = ?, typing_variance = ?,
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

  // ODSTRANĚNO: updateLearningData - robot se neučí, prostě plní profil
  // ODSTRANĚNO: všechny CACHE operace - zbytečné ukládání vlastních rozhodnutí
  // ODSTRANĚNO: všechny EMOTIONAL LOG operace - emoce jsou v profilu, ne v historii
  // ODSTRANĚNO: všechny ADAPTIVE LEARNING operace - žádná adaptace podle úspěchů

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
      base_mood,
      COUNT(*) as mood_count
    FROM user_behavioral_profiles
    GROUP BY base_mood
    ORDER BY mood_count DESC
  `,

  getBehaviorProfile: `
    SELECT 
      ubp.user_id,
      fu.name,
      fu.surname,
      ubp.base_mood,
      ubp.energy_level,
      ubp.avg_typing_speed,
      ubp.mistake_rate,
      ubp.correction_style
    FROM user_behavioral_profiles ubp
    JOIN fb_users fu ON ubp.user_id = fu.id
    WHERE ubp.user_id = ?
  `
};