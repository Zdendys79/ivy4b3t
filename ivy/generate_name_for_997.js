/**
 * GENEROVÁNÍ NOVÉHO JMÉNA PRO ID 997
 * Vytvoří unikátní jméno přímo pro existující uživatele
 */

import mysql from 'mysql2/promise';

async function generateNameFor997() {
  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE
  });

  try {
    console.log('👤 === GENEROVÁNÍ NOVÉHO JMÉNA PRO ID 997 ===');
    
    // Náhodně vyber pohlaví
    const gender = Math.random() < 0.5 ? 'M' : 'F';
    
    // Získej existující jména pro snížení pravděpodobnosti
    const [existingNames] = await connection.execute(
      'SELECT name, COUNT(*) as count FROM fb_users GROUP BY name'
    );
    const [existingSurnames] = await connection.execute(
      'SELECT surname, COUNT(*) as count FROM fb_users GROUP BY surname'
    );
    
    const nameFrequency = {};
    const surnameFrequency = {};
    
    existingNames.forEach(row => {
      nameFrequency[row.name] = row.count;
    });
    
    existingSurnames.forEach(row => {
      surnameFrequency[row.surname] = row.count;
    });
    
    // Váhový výběr křestního jména
    const [firstNameCandidates] = await connection.execute(
      'SELECT name FROM c_first_names WHERE gender = ? ORDER BY RAND() LIMIT 20',
      [gender]
    );
    
    let firstName;
    let attempts = 0;
    do {
      const candidate = firstNameCandidates[Math.floor(Math.random() * firstNameCandidates.length)];
      const existingCount = nameFrequency[candidate.name] || 0;
      
      const acceptProbability = 1 / (1 + existingCount * 0.5);
      
      if (Math.random() < acceptProbability) {
        firstName = candidate.name;
        break;
      }
      attempts++;
    } while (attempts < 10);
    
    if (!firstName) {
      firstName = firstNameCandidates[0].name;
    }
    
    // Váhový výběr příjmení
    let targetGender = gender;
    if (gender === 'F' && Math.random() < 0.10) {
      targetGender = 'M'; // 10% žen použije nepřechýlené příjmení
    }
    
    const [lastNameCandidates] = await connection.execute(
      'SELECT name FROM c_last_names WHERE gender = ? ORDER BY RAND() LIMIT 20',
      [targetGender]
    );
    
    let lastName;
    attempts = 0;
    do {
      const candidate = lastNameCandidates[Math.floor(Math.random() * lastNameCandidates.length)];
      const existingCount = surnameFrequency[candidate.name] || 0;
      
      const acceptProbability = 1 / (1 + existingCount * 0.3);
      
      if (Math.random() < acceptProbability) {
        lastName = candidate.name;
        break;
      }
      attempts++;
    } while (attempts < 10);
    
    if (!lastName) {
      lastName = lastNameCandidates[0].name;
    }
    
    // Vygeneruj věk podle progresivního rozložení (18-35 let)
    const ageWeights = [];
    for (let age = 18; age <= 35; age++) {
      let weight;
      if (age <= 20) {
        weight = 8 + (age - 18) * 2 / 2; // 8, 9, 10
      } else {
        weight = 10 - (age - 20) * 9 / 15;
      }
      for (let i = 0; i < Math.round(weight); i++) {
        ageWeights.push(age);
      }
    }
    const selectedAge = ageWeights[Math.floor(Math.random() * ageWeights.length)];
    
    // Váhový výběr data podle číselníku
    const [birthDates] = await connection.execute(
      'SELECT month, day, relative_frequency FROM c_birth_distribution ORDER BY RAND() * relative_frequency DESC LIMIT 20'
    );
    
    let birthMonth, birthDay;
    let birthAttempts = 0;
    do {
      const candidate = birthDates[Math.floor(Math.random() * birthDates.length)];
      const frequency = candidate.relative_frequency;
      
      if (Math.random() < frequency) {
        birthMonth = candidate.month;
        birthDay = candidate.day;
        break;
      }
      birthAttempts++;
    } while (birthAttempts < 10);
    
    if (!birthMonth || !birthDay) {
      birthMonth = birthDates[0].month;
      birthDay = birthDates[0].day;
    }
    
    const currentYear = new Date().getFullYear();
    const birthYear = currentYear - selectedAge;
    const birthDate = new Date(birthYear, birthMonth - 1, birthDay);
    
    // Aktualizuj uživatele ID 997
    await connection.execute(
      'UPDATE fb_users SET name = ?, surname = ?, gender = ?, birth_date = ? WHERE id = 997',
      [firstName, lastName, gender, birthDate]
    );
    
    console.log('✅ === DOKONČENO ===');
    console.log(`👤 Jméno: ${firstName} ${lastName}`);
    console.log(`⚥ Pohlaví: ${gender === 'M' ? 'Muž' : 'Žena'}`);
    console.log(`🎂 Datum narození: ${birthDay}.${birthMonth}.${birthYear} (věk: ${selectedAge})`);
    console.log(`💾 Aktualizován uživatel ID 997`);
    
    if (gender === 'F' && targetGender === 'M') {
      console.log(`📝 Poznámka: Žena s nepřechýleným příjmením`);
    }
    
  } catch (error) {
    console.log(`❌ Chyba: ${error.message}`);
    throw error;
  } finally {
    await connection.end();
  }
}

// Spuštění
generateNameFor997();