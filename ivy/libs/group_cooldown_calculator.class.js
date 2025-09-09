/**
 * Název souboru: group_cooldown_calculator.class.js
 * Umístění: ~/ivy/libs/group_cooldown_calculator.class.js
 * 
 * Popis: Jednotný výpočet cooldown času pro skupiny
 * - Clampovaný počet členů [50, 10000]
 * - Prioritní multiplikátory
 * - Automatická konverze na hodiny pro vyšší hodnoty
 */

export class GroupCooldownCalculator {
  /**
   * Prioritní multiplikátory (vyšší priorita = kratší cooldown)
   */
  static PRIORITY_MULTIPLIERS = {
    1: 2.0,    // dlouhý cooldown
    2: 1.5,    // prodloužený
    3: 1.0,    // normální
    4: 2 / 3,  // kratší
    5: 0.5     // velmi krátký
  };

  /**
   * Vypočítá cooldown v minutách na základě počtu členů a priority
   * 
   * @param {number} memberCount - Počet členů skupiny
   * @param {number} priority - Priorita skupiny (1-5)
   * @returns {number|null} - Počet minut cooldownu, nebo null pokud priority = 0
   */
  static calculateMinutes(memberCount, priority) {
    // Priority 0 znamená neaktivní skupinu
    if (priority === 0) return null;

    // Získej multiplikátor podle priority
    const multiplier = this.PRIORITY_MULTIPLIERS[priority] ?? 1.0;

    // Clampuj počet členů do rozsahu [50, 10000]
    const clamped = Math.min(Math.max(memberCount, 50), 10000);

    // Exponent zvolený tak, že: n=100 → 10000 min, n=10000 → 100 min
    const k = Math.log2(100); // ≈ 6.64385618977

    // Jednotný vzorec s clampovaným n
    const base = 1_000_000 / Math.pow(Math.log10(clamped), k);

    // Zaokrouhli na 2 desetinná místa
    return Math.round(base * multiplier * 100) / 100;
  }

  /**
   * Vygeneruje SQL fragment pro UPDATE next_seen
   * Automaticky převádí minuty na hodiny pokud > 1440 (1 den)
   * 
   * @param {number} minutes - Počet minut
   * @returns {string} - SQL fragment pro INTERVAL
   */
  static generateSQLInterval(minutes) {
    if (!minutes || minutes <= 0) {
      return 'NULL';
    }

    // Pro hodnoty větší než 1 den (1440 minut) použij hodiny
    if (minutes > 1440) {
      const hours = Math.round(minutes / 60);
      return `NOW() + INTERVAL ${hours} HOUR`;
    }

    // Pro kratší intervaly použij minuty
    return `NOW() + INTERVAL ${Math.round(minutes)} MINUTE`;
  }

  /**
   * Kompletní SQL UPDATE příkaz pro nastavení next_seen
   * 
   * @param {number} groupId - ID skupiny
   * @param {number} memberCount - Počet členů
   * @param {number} priority - Priorita skupiny
   * @returns {string} - Kompletní SQL UPDATE příkaz
   */
  static generateUpdateSQL(groupId, memberCount, priority) {
    const minutes = this.calculateMinutes(memberCount, priority);
    const interval = this.generateSQLInterval(minutes);
    
    if (interval === 'NULL') {
      return `UPDATE fb_groups SET next_seen = NULL WHERE id = ${groupId}`;
    }

    return `UPDATE fb_groups SET next_seen = ${interval} WHERE id = ${groupId}`;
  }

  /**
   * Debug informace o cooldownu
   * 
   * @param {number} memberCount - Počet členů
   * @param {number} priority - Priorita skupiny
   * @returns {object} - Debug informace
   */
  static debugInfo(memberCount, priority) {
    const minutes = this.calculateMinutes(memberCount, priority);
    
    if (minutes === null) {
      return {
        memberCount,
        priority,
        status: 'inactive',
        minutes: null,
        human: 'Skupina neaktivní (priority = 0)'
      };
    }

    const hours = minutes / 60;
    const days = hours / 24;

    let human;
    if (days >= 1) {
      human = `${days.toFixed(1)} dní`;
    } else if (hours >= 1) {
      human = `${hours.toFixed(1)} hodin`;
    } else {
      human = `${minutes.toFixed(0)} minut`;
    }

    return {
      memberCount,
      clampedCount: Math.min(Math.max(memberCount, 50), 10000),
      priority,
      multiplier: this.PRIORITY_MULTIPLIERS[priority] ?? 1.0,
      minutes: minutes.toFixed(2),
      hours: hours.toFixed(2),
      days: days.toFixed(2),
      human,
      sqlInterval: this.generateSQLInterval(minutes)
    };
  }

  /**
   * Testovací výpisy pro různé kombinace
   */
  static runTests() {
    console.log('=== GROUP COOLDOWN CALCULATOR TESTS ===\n');

    const testCases = [
      // Malé skupiny
      { members: 10, priority: 3, desc: 'Velmi malá skupina' },
      { members: 50, priority: 3, desc: 'Malá skupina (min clamp)' },
      { members: 100, priority: 3, desc: 'Malá skupina (target: ~10000 min)' },
      
      // Střední skupiny
      { members: 500, priority: 3, desc: 'Střední skupina' },
      { members: 1000, priority: 3, desc: 'Střední-velká skupina' },
      { members: 5000, priority: 3, desc: 'Velká skupina' },
      
      // Velké skupiny
      { members: 10000, priority: 3, desc: 'Velká skupina (target: ~100 min)' },
      { members: 50000, priority: 3, desc: 'Velmi velká skupina (max clamp)' },
      
      // Různé priority
      { members: 1000, priority: 1, desc: 'Priority 1 (2x delší)' },
      { members: 1000, priority: 2, desc: 'Priority 2 (1.5x delší)' },
      { members: 1000, priority: 3, desc: 'Priority 3 (normální)' },
      { members: 1000, priority: 4, desc: 'Priority 4 (kratší)' },
      { members: 1000, priority: 5, desc: 'Priority 5 (0.5x)' },
      
      // Edge cases
      { members: 0, priority: 3, desc: 'Nulový počet členů' },
      { members: 1000, priority: 0, desc: 'Priority 0 (neaktivní)' }
    ];

    testCases.forEach(test => {
      const info = this.debugInfo(test.members, test.priority);
      console.log(`${test.desc}:`);
      console.log(`  Členů: ${test.members}, Priority: ${test.priority}`);
      console.log(`  Cooldown: ${info.human}`);
      console.log(`  SQL: ${info.sqlInterval || 'NULL'}`);
      console.log('');
    });
  }
}

// Pro testování odkomentuj:
// GroupCooldownCalculator.runTests();