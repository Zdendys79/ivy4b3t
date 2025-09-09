/**
 * OPRAVA VĚKOVÉHO ROZLOŽENÍ S PROGRESIVNÍM KLESÁNÍM
 * 20 let = maximum (váha 10), 35 let = minimum (váha 1)
 */

import mysql from 'mysql2/promise';

function calculateAgeWeight(age) {
  // 20 let = váha 10, 35 let = váha 1
  // Lineární klesání: weight = 10 - (age - 20) * 9/15
  if (age < 18 || age > 35) return 0;
  
  if (age <= 20) {
    // 18-20 let: mírný nárůst k maximu
    return 8 + (age - 18) * 2 / 2; // 8, 9, 10
  } else {
    // 20-35 let: lineární pokles z 10 na 1
    return 10 - (age - 20) * 9 / 15;
  }
}

async function fixAgeDistribution() {
  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE
  });

  try {
    console.log('📊 === OPRAVA VĚKOVÉHO ROZLOŽENÍ ===');
    console.log('🎯 Cíl: Progresivní klesání 20let(10x) → 35let(1x)');
    
    // Získej všechny uživatele
    const [users] = await connection.execute(
      'SELECT id, name, surname, birth_date FROM fb_users WHERE id != 0 ORDER BY id'
    );
    
    console.log(`👥 Celkem uživatelů: ${users.length}`);
    
    let updatedCount = 0;
    const currentYear = new Date().getFullYear();
    
    for (const user of users) {
      try {
        // Váhový výběr věku podle progresivního klesání
        const ageWeights = [];
        
        for (let age = 18; age <= 35; age++) {
          const weight = calculateAgeWeight(age);
          // Přidej věk tolikrát, kolik je jeho váha
          for (let i = 0; i < Math.round(weight); i++) {
            ageWeights.push(age);
          }
        }
        
        // Náhodný výběr z váhového pole
        const selectedAge = ageWeights[Math.floor(Math.random() * ageWeights.length)];
        const birthYear = currentYear - selectedAge;
        
        // Zachovej měsíc a den z původního data narození
        const originalDate = new Date(user.birth_date);
        const month = originalDate.getMonth() + 1;
        const day = originalDate.getDate();
        
        const newBirthDate = new Date(birthYear, month - 1, day);
        
        // Aktualizuj pouze rok narození
        await connection.execute(
          'UPDATE fb_users SET birth_date = ? WHERE id = ?',
          [newBirthDate, user.id]
        );
        
        updatedCount++;
        
        const oldAge = currentYear - originalDate.getFullYear();
        const newAge = selectedAge;
        const weight = calculateAgeWeight(newAge);
        
        console.log(`✅ ID ${user.id}: ${oldAge}→${newAge} let (váha: ${weight.toFixed(1)}) - ${day}.${month}.${birthYear}`);
        
      } catch (userError) {
        console.log(`❌ Chyba u uživatele ID ${user.id}: ${userError.message}`);
      }
    }
    
    console.log(`\n🎯 === DOKONČENO ===`);
    console.log(`✅ Aktualizováno: ${updatedCount} uživatelů`);
    
    // Statistiky věkového rozložení
    const [ageStats] = await connection.execute(`
      SELECT 
        (YEAR(CURDATE()) - YEAR(birth_date)) as age,
        COUNT(*) as count
      FROM fb_users 
      WHERE id != 0 AND birth_date IS NOT NULL
      GROUP BY age
      ORDER BY age
    `);
    
    console.log(`\n📊 VĚKOVÉ ROZLOŽENÍ:`);
    ageStats.forEach(stat => {
      const expectedWeight = calculateAgeWeight(stat.age);
      console.log(`${stat.age} let: ${stat.count} uživatelů (váha: ${expectedWeight.toFixed(1)})`);
    });
    
  } catch (error) {
    console.log(`❌ Chyba při opravě věkového rozložení: ${error.message}`);
    throw error;
  } finally {
    await connection.end();
  }
}

// Spuštění
fixAgeDistribution();