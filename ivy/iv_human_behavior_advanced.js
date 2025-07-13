/**
 * Název souboru: iv_human_behavior_advanced.js
 * Umístění: ~/ivy/iv_human_behavior_advanced.js
 *
 * Popis: Pokročilá simulace lidského chování s databázovými profily
 * Implementuje realistické psaní, váhání, emoce a adaptivní učení
 */

import * as wait from './iv_wait.js';
import { db } from './iv_sql.js';
import { Log } from './iv_log.class.js';

/**
 * Hlavní třída pro pokročilé lidské chování
 */
export class AdvancedHumanBehavior {
  constructor(userId) {
    this.userId = userId;
    this.profile = null;
    this.currentEmotion = null;
    this.sessionStartTime = Date.now();
    this.currentTypingSession = null;
    this.frustratedMistakeCount = 0;
  }

  /**
   * Inicializuje behavioral profil z databáze
   */
  async initialize() {
    try {
      // Načti profil z databáze
      this.profile = await db.safeQueryFirst('behavioral_profiles.getUserProfile', [this.userId]);
      
      if (!this.profile) {
        Log.info(`[${this.userId}]`, '🧠 Vytvářím nový behavioral profil');
        await db.safeExecute('behavioral_profiles.createDefaultProfile', [this.userId]);
        this.profile = await db.safeQueryFirst('behavioral_profiles.getUserProfile', [this.userId]);
      }
      
      // Fallback pokud databáze stále nevrátí profil
      if (!this.profile) {
        Log.warning(`[${this.userId}]`, '⚠️  Používám výchozí behavioral profil (databáze nedostupná)');
        this.profile = this._createDefaultProfile();
      }

      // Načti aktuální emocionální stav
      this.currentEmotion = await db.safeQueryFirst('behavioral_profiles.getCurrentEmotion', [this.userId]);
      
      Log.debug(`[${this.userId}]`, `🎭 Behavioral profil načten: ${this.profile.base_mood}, energy: ${this.profile.energy_level}`);
      
      return true;
    } catch (error) {
      await Log.error(`[${this.userId}] AdvancedHumanBehavior.initialize`, error);
      Log.warning(`[${this.userId}]`, '⚠️  Chyba při načítání behavioral profilu, používám výchozí hodnoty');
      this.profile = this._createDefaultProfile();
      return false;
    }
  }

  /**
   * Pokročilé lidské psaní s databázovým profilem
   */
  async typeLikeHuman(page, text, context = 'neutral') {
    if (!this.profile) await this.initialize();
    
    try {
      Log.debug(`[${this.userId}]`, `⌨️ Začínám pokročilé psaní: "${text.substring(0, 30)}..."`);
      
      // Aplikuj emocionální úpravy na profil
      const adjustedProfile = this.applyEmotionalAdjustments();
      
      const words = text.split(' ');
      let totalErrors = 0;
      
      for (let wordIndex = 0; wordIndex < words.length; wordIndex++) {
        const word = words[wordIndex];
        
        // Občasné váhání uprostřed textu
        if (Math.random() < adjustedProfile.hesitation_chance && wordIndex > 2) {
          await this.performHesitation(context);
        }
        
        // Psaní jednotlivého slova
        const wordErrors = await this.typeWord(page, word, adjustedProfile, context);
        totalErrors += wordErrors;
        
        // Pauza mezi slovy (s mezerou)
        if (wordIndex < words.length - 1) {
          await this.interWordPause(page, adjustedProfile, context);
        }
        
        // Zkontroluj prokrastinaci
        if (Math.random() < adjustedProfile.procrastination_level * 0.1) {
          const distractionResult = await this.simulateDistraction(context);
          if (distractionResult === 'abandon') {
            throw new Error('User abandoned typing due to distraction');
          }
        }
      }
      
      // Uložit pattern do cache
      await this.saveBehaviorPattern('typing', context, {
        text_length: text.length,
        words: words.length,
        errors: totalErrors,
        completion_time: Date.now() - this.sessionStartTime,
        emotional_state: this.currentEmotion?.emotion_type || 'neutral'
      });
      
      Log.success(`[${this.userId}]`, `✅ Psaní dokončeno s ${totalErrors} chybami`);
      
    } catch (error) {
      await Log.error(`[${this.userId}] typeLikeHuman`, error);
      await this.updateEmotionalState('frustrated', 0.7, 'typing_failed');
      throw error;
    }
  }

  /**
   * Psaní jednotlivého slova s chybami a opravami
   */
  async typeWord(page, word, profile, context) {
    const chars = word.split('');
    let errors = 0;
    
    for (let i = 0; i < chars.length; i++) {
      const char = chars[i];
      
      // Výpočet pravděpodobnosti chyby
      let mistakeChance = profile.mistake_rate;
      
      // Úprava podle únav a stresu
      if (profile.energy_level < 0.4) mistakeChance *= 1.5;
      if (this.currentEmotion?.emotion_type === 'frustrated') mistakeChance *= 2.0;
      
      // Implementace chyby
      if (Math.random() < mistakeChance && /[a-zá-ž]/i.test(char)) {
        errors++;
        await this.performTypingMistake(page, char, profile);
      } else {
        // Normální znak
        await page.keyboard.type(char);
      }
      
      // Pauza mezi znaky
      const charDelay = this.calculateCharDelay(profile, context);
      await wait.delay(charDelay, false);
      
      // Občasný dvojitý stisk
      if (Math.random() < profile.double_key_chance) {
        await page.keyboard.type(char);
        await wait.delay(profile.backspace_delay || 200, false);
        await page.keyboard.press('Backspace');
      }
    }
    
    return errors;
  }

  /**
   * Provede typing mistake s realistickou opravou
   */
  async performTypingMistake(page, correctChar, profile) {
    // Různé typy chyb
    const mistakeTypes = [
      'adjacent_key',    // Vedlejší klávesa
      'double_press',    // Dvojitý stisk
      'missing_key',     // Vynechání
      'case_error',      // Špatná velikost
      'transposition'    // Prohození znaků
    ];
    
    const mistakeType = mistakeTypes[Math.floor(Math.random() * mistakeTypes.length)];
    
    switch (mistakeType) {
      case 'adjacent_key':
        const adjacentChar = this.getAdjacentKey(correctChar);
        await page.keyboard.type(adjacentChar);
        
        // Rozhodnutí o opravě podle correction_style
        if (this.shouldCorrectMistake(profile.correction_style)) {
          const backspaceDelay = profile.backspace_delay || 200;
          await wait.delay(backspaceDelay * (0.8 + Math.random() * 0.4), false);
          await page.keyboard.press('Backspace');
          await wait.delay(50 + Math.random() * 100, false);
          await page.keyboard.type(correctChar);
        }
        break;
        
      case 'double_press':
        await page.keyboard.type(correctChar);
        await page.keyboard.type(correctChar);
        if (this.shouldCorrectMistake(profile.correction_style)) {
          const backspaceDelay = profile.backspace_delay || 200;
          await wait.delay(backspaceDelay, false);
          await page.keyboard.press('Backspace');
        }
        break;
        
      case 'missing_key':
        // Prostě nepíše znak - uživatel to možná zpětně opraví
        if (Math.random() < 0.7 && profile.correction_style === 'perfectionist') {
          await wait.delay(200 + Math.random() * 300, false);
          await page.keyboard.type(correctChar);
        }
        break;
        
      case 'case_error':
        if (/[a-zA-Z]/.test(correctChar)) {
          const wrongCase = correctChar === correctChar.toLowerCase() 
            ? correctChar.toUpperCase() 
            : correctChar.toLowerCase();
          await page.keyboard.type(wrongCase);
          
          if (this.shouldCorrectMistake(profile.correction_style)) {
            await wait.delay(profile.backspace_delay, false);
            await page.keyboard.press('Backspace');
            await page.keyboard.type(correctChar);
          }
        } else {
          await page.keyboard.type(correctChar);
        }
        break;
        
      default:
        await page.keyboard.type(correctChar);
    }
  }

  /**
   * Váhání během psaní
   */
  async performHesitation(context) {
    const hesitationTypes = [
      'thinking_pause',
      'word_search',
      'rereading',
      'distraction_check'
    ];
    
    const type = hesitationTypes[Math.floor(Math.random() * hesitationTypes.length)];
    let duration = 1000 + Math.random() * 3000; // 1-4s základní váhání
    
    // Úprava podle kontextu
    if (context === 'selling') duration *= 1.5; // Více váhání u prodeje
    if (context === 'complaint') duration *= 2.0; // Hodně váhání u stížností
    
    // Úprava podle osobnosti
    if (this.profile.perfectionism > 0.7) duration *= 1.3;
    if (this.profile.impatience_level > 0.7) duration *= 0.6;
    
    Log.debug(`[${this.userId}]`, `🤔 Váhání typu ${type} na ${Math.round(duration)}ms`);
    await wait.delay(duration, false);
  }

  /**
   * Simulace rozptylování
   */
  async simulateDistraction(context) {
    const distractionTypes = [
      { type: 'notification_check', chance: 0.15, duration: [2000, 8000] },
      { type: 'second_thoughts', chance: 0.08, duration: [3000, 10000] },
      { type: 'perfectionist_rewrite', chance: 0.12, duration: [5000, 15000] },
      { type: 'external_interruption', chance: 0.05, duration: [10000, 30000] }
    ];
    
    for (const distraction of distractionTypes) {
      if (Math.random() < distraction.chance * this.profile.multitasking_tendency) {
        const [minDur, maxDur] = distraction.duration;
        const duration = minDur + Math.random() * (maxDur - minDur);
        
        Log.debug(`[${this.userId}]`, `🔄 Rozptýlení typu ${distraction.type} na ${Math.round(duration)}ms`);
        await wait.delay(duration, false);
        
        // Někdy uživatel úplně abandone akci
        if (distraction.type === 'external_interruption' && Math.random() < 0.3) {
          return 'abandon';
        }
        
        return 'continue';
      }
    }
    
    return 'continue';
  }

  /**
   * Aplikuje emocionální úpravy na profil
   */
  applyEmotionalAdjustments() {
    const base = { ...this.profile };
    
    if (!this.currentEmotion) return base;
    
    const emotionEffects = {
      'frustrated': {
        mistake_rate: 1.8,
        typing_speed: 0.9,
        hesitation_chance: 1.5,
        impatience_level: 1.3
      },
      'tired': {
        mistake_rate: 1.4,
        typing_speed: 0.7,
        attention_span: 0.6,
        energy_level: 0.5
      },
      'energetic': {
        mistake_rate: 0.8,
        typing_speed: 1.3,
        hesitation_chance: 0.5,
        impatience_level: 0.7
      },
      'focused': {
        mistake_rate: 0.6,
        attention_span: 1.5,
        hesitation_chance: 0.8
      }
    };
    
    const effects = emotionEffects[this.currentEmotion.emotion_type];
    if (effects) {
      Object.keys(effects).forEach(key => {
        if (base[key] !== undefined) {
          base[key] *= effects[key];
        }
      });
      
      // Přidání nových vlastností
      base.hesitation_chance = (effects.hesitation_chance || 1) * 0.3;
    }
    
    return base;
  }

  /**
   * Výpočet zpoždění mezi znaky
   */
  calculateCharDelay(profile, context) {
    // Fallback pro chybějící hodnoty
    const typingSpeed = profile.avg_typing_speed || 150;
    const variance = profile.typing_variance || 0.3;

    const baseWPM = typingSpeed * (0.8 + Math.random() * 0.4);
    const charsPerSecond = (baseWPM * 5) / 60;
    const baseDelay = 1000 / charsPerSecond;
    
    const varianceMultiplier = 1 + (Math.random() - 0.5) * variance;
    
    return Math.max(20, baseDelay * varianceMultiplier);
  }

  /**
   * Pauza mezi slovy a napsání mezery
   */
  async interWordPause(page, profile, context) {
    // Nejprv napsat mezeru
    await page.keyboard.type(' ');
    
    const basePause = 100 + Math.random() * 200; // 100-300ms základní
    
    // Úpravy podle kontextu
    let contextMultiplier = 1;
    if (context === 'selling') contextMultiplier = 1.2;
    if (context === 'complaint') contextMultiplier = 1.5;
    if (context === 'casual') contextMultiplier = 0.8;
    
    // Úpravy podle osobnosti s fallbackem
    const impatienceLevel = profile.impatience_level || 0.5;
    const personalityMultiplier = 0.5 + impatienceLevel;
    
    const finalPause = basePause * contextMultiplier * personalityMultiplier;
    await wait.delay(finalPause, false);
  }

  /**
   * Aktualizace emocionálního stavu
   */
  async updateEmotionalState(emotion, intensity, trigger) {
    try {
      await db.safeExecute('behavioral_profiles.logEmotionalState', [
        this.userId,
        emotion,
        intensity,
        trigger,
        30 + Math.random() * 60 // 30-90 minut trvání
      ]);
      
      this.currentEmotion = {
        emotion_type: emotion,
        intensity: intensity,
        trigger_event: trigger
      };
      
      Log.debug(`[${this.userId}]`, `😊 Emocionální stav aktualizován: ${emotion} (${intensity})`);
    } catch (error) {
      await Log.error(`[${this.userId}] updateEmotionalState`, error);
    }
  }

  /**
   * Uložení behavioral pattern do cache
   */
  async saveBehaviorPattern(contextType, patternName, patternData) {
    try {
      await db.safeExecute('behavioral_profiles.saveBehaviorPattern', [
        this.userId,
        contextType,
        patternName,
        JSON.stringify(patternData),
        1, // frequency
        1.0 // success_rate
      ]);
    } catch (error) {
      await Log.error(`[${this.userId}] saveBehaviorPattern`, error);
    }
  }

  /**
   * Pomocné funkce
   */
  getAdjacentKey(char) {
    const keyMap = {
      'a': 's', 's': 'a', 'd': 's', 'f': 'd',
      'q': 'w', 'w': 'q', 'e': 'w', 'r': 'e',
      'u': 'y', 'i': 'u', 'o': 'i', 'p': 'o',
      // Přidej více podle potřeby
    };
    return keyMap[char.toLowerCase()] || char;
  }

  shouldCorrectMistake(correctionStyle) {
    const chances = {
      'perfectionist': 0.95,
      'casual': 0.7,
      'sloppy': 0.3
    };
    return Math.random() < (chances[correctionStyle] || 0.7);
  }

  /**
   * Vytvoří výchozí behavioral profil pro fallback
   */
  _createDefaultProfile() {
    return {
      user_id: this.userId,
      avg_typing_speed: 150.0,
      typing_variance: 0.3,
      mistake_rate: 0.005, // Sníženo z 0.05
      correction_style: 'casual',
      double_key_chance: 0.10,
      backspace_delay: 200,
      impatience_level: 0.5,
      multitasking_tendency: 0.5,
      attention_span: 90,
      decision_speed: 0.5,
      perfectionism: 0.5,
      base_mood: 'neutral',
      mood_volatility: 0.3,
      frustration_threshold: 0.7,
      energy_level: 0.8,
      scroll_intensity: 'medium',
      reading_speed: 240.0,
      distraction_chance: 0.2,
      procrastination_level: 0.4,
      like_frequency: 0.10,
      comment_tendency: 0.05,
      hover_behavior: 'normal',
      click_pattern: 'normal',
      learning_rate: 0.1,
      pattern_memory: 0.7,
      behavior_confidence: 0.5,
      last_mood_update: new Date().toISOString(),
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    };
  }
}

/**
 * Export singleton factory pro snadné použití
 */
const behaviorInstances = new Map();

export async function getHumanBehavior(userId) {
  if (!behaviorInstances.has(userId)) {
    const behavior = new AdvancedHumanBehavior(userId);
    await behavior.initialize();
    behaviorInstances.set(userId, behavior);
  }
  return behaviorInstances.get(userId);
}

/**
 * Cleanup function pro uvolnění paměti
 */
export function cleanupBehaviorInstance(userId) {
  behaviorInstances.delete(userId);
}