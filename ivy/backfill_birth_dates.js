/**
 * DOPLNĚNÍ CHYBĚJÍCÍCH DAT NAROZENÍ
 * Vygeneruje realistická data narození pro uživatele, kteří je nemají
 */

import mysql from 'mysql2/promise';

async function backfillBirthDates() {
  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE
  });

  try {
    console.log('🎂 === DOPLNĚNÍ CHYBĚJÍCÍCH DAT NAROZENÍ ===');
    
    // Získej uživatele bez data narození
    const [usersWithoutBirthDate] = await connection.execute(
      'SELECT id, name, surname, gender FROM fb_users WHERE birth_date IS NULL AND id != 0 ORDER BY id'
    );
    
    console.log(`📊 Nalezeno ${usersWithoutBirthDate.length} uživatelů bez data narození`);
    
    if (usersWithoutBirthDate.length === 0) {
      console.log('✅ Všichni uživatelé již mají vyplněné datum narození');
      return;
    }
    
    let updatedCount = 0;
    
    for (const user of usersWithoutBirthDate) {
      try {
        // Váhový výběr data podle číselníku rozložení narození
        const [birthDates] = await connection.execute(
          'SELECT month, day, relative_frequency FROM c_birth_distribution ORDER BY RAND() * relative_frequency DESC LIMIT 20'
        );
        
        let birthMonth, birthDay;
        let attempts = 0;
        
        do {
          const candidate = birthDates[Math.floor(Math.random() * birthDates.length)];
          const frequency = candidate.relative_frequency;
          
          // Čím vyšší četnost, tím vyšší pravděpodobnost
          const acceptProbability = frequency;
          
          if (Math.random() < acceptProbability) {
            birthMonth = candidate.month;
            birthDay = candidate.day;
            break;
          }
          attempts++;
        } while (attempts < 10);
        
        if (!birthMonth || !birthDay) {
          // Použij první kandidát
          birthMonth = birthDates[0].month;
          birthDay = birthDates[0].day;
        }
        
        // Vygeneruj realistický rok narození (18-35 let) - stejně jako main generátor
        const currentYear = new Date().getFullYear();
        const birthYear = currentYear - Math.floor(Math.random() * (35 - 18 + 1)) - 18;
        
        const birthDate = new Date(birthYear, birthMonth - 1, birthDay);
        
        // Aktualizuj uživatele
        await connection.execute(
          'UPDATE fb_users SET birth_date = ? WHERE id = ?',
          [birthDate, user.id]
        );
        
        updatedCount++;
        
        console.log(`✅ ID ${user.id} (${user.name} ${user.surname}): ${birthDay}.${birthMonth}.${birthYear} (věk: ${currentYear - birthYear})`);
        
      } catch (userError) {
        console.log(`❌ Chyba u uživatele ID ${user.id}: ${userError.message}`);
      }
    }
    
    console.log(`\n🎯 === DOKONČENO ===`);
    console.log(`✅ Aktualizováno: ${updatedCount} uživatelů`);
    console.log(`❌ Chyby: ${usersWithoutBirthDate.length - updatedCount} uživatelů`);
    
    // Statistiky po dokončení
    const [stats] = await connection.execute(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(birth_date) as users_with_birth_date,
        COUNT(*) - COUNT(birth_date) as users_without_birth_date
      FROM fb_users 
      WHERE id != 0
    `);
    
    console.log(`\n📊 FINÁLNÍ STATISTIKY:`);
    console.log(`👥 Celkem uživatelů: ${stats[0].total_users}`);
    console.log(`🎂 S datem narození: ${stats[0].users_with_birth_date}`);
    console.log(`❓ Bez data narození: ${stats[0].users_without_birth_date}`);
    
  } catch (error) {
    console.log(`❌ Chyba při doplňování dat narození: ${error.message}`);
    throw error;
  } finally {
    await connection.end();
  }
}

// Spuštění
backfillBirthDates();