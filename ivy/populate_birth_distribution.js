/**
 * NAPLNĚNÍ ČÍSELNÍKU ROZLOŽENÍ NAROZENÍ
 * Na základě obecných vzorů a existujících dat
 */

import mysql from 'mysql2/promise';

async function populateBirthDistribution() {
  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE
  });

  try {
    console.log('🗓️ === NAPLNĚNÍ ČÍSELNÍKU ROZLOŽENÍ NAROZENÍ ===');
    
    // Základní vzory:
    // - Září/říjen nejčastější (1.2-1.3x)
    // - Léto méně časté (0.8-0.9x) 
    // - Prosinec/leden méně časté (0.7-0.9x)
    // - Víkendy méně časté (0.8x)
    
    const monthFactors = {
      1: 0.85,  // Leden
      2: 0.90,  // Únor
      3: 0.95,  // Březen
      4: 1.00,  // Duben
      5: 1.05,  // Květen
      6: 1.00,  // Červen
      7: 0.85,  // Červenec
      8: 0.80,  // Srpen
      9: 1.25,  // Září (peak)
      10: 1.20, // Říjen (peak)
      11: 1.10, // Listopad
      12: 0.75  // Prosinec
    };
    
    const daysInMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    
    for (let month = 1; month <= 12; month++) {
      for (let day = 1; day <= daysInMonth[month - 1]; day++) {
        // Základní faktor podle měsíce
        let frequency = monthFactors[month];
        
        // Týdenní vzor (neděle = 1, sobota = 7)
        const date = new Date(2024, month - 1, day);
        const dayOfWeek = date.getDay();
        
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          // Víkendy méně časté
          frequency *= 0.8;
        }
        
        // Speciální dny
        if (month === 12 && (day === 24 || day === 25 || day === 26)) {
          // Vánoce
          frequency *= 0.5;
        }
        if (month === 1 && day === 1) {
          // Nový rok
          frequency *= 0.3;
        }
        if (month === 12 && day === 31) {
          // Silvestr
          frequency *= 0.4;
        }
        
        // Vložit do databáze
        await connection.execute(
          'INSERT INTO c_birth_distribution (month, day, relative_frequency) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE relative_frequency = VALUES(relative_frequency)',
          [month, day, frequency]
        );
      }
    }
    
    // Statistiky
    const [stats] = await connection.execute(`
      SELECT 
        COUNT(*) as total_days,
        MIN(relative_frequency) as min_freq,
        MAX(relative_frequency) as max_freq,
        AVG(relative_frequency) as avg_freq
      FROM c_birth_distribution
    `);
    
    console.log(`✅ Naplněno ${stats[0].total_days} dnů`);
    console.log(`📊 Četnost: ${Number(stats[0].min_freq).toFixed(3)} - ${Number(stats[0].max_freq).toFixed(3)} (průměr: ${Number(stats[0].avg_freq).toFixed(3)})`);
    
    // Top 10 nejčastějších dnů
    const [topDays] = await connection.execute(`
      SELECT month, day, relative_frequency
      FROM c_birth_distribution 
      ORDER BY relative_frequency DESC 
      LIMIT 10
    `);
    
    console.log('\n🔝 TOP 10 NEJČASTĚJŠÍCH DNŮ:');
    topDays.forEach((row, i) => {
      console.log(`${i+1}. ${row.day}.${row.month}. (${Number(row.relative_frequency).toFixed(3)}x)`);
    });
    
  } finally {
    await connection.end();
  }
}

// Spuštění
populateBirthDistribution();