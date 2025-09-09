/**
 * GENERÁTOR NÁHODNÝCH ČESKÝCH UŽIVATELSKÝCH DAT
 * - Generuje jméno, příjmení, pohlaví a datum narození
 * - Vybírá z číselníků c_first_names a c_last_names
 * 
 * 📖 Dokumentace: /docs/generate_user_data.md
 */

import mysql from 'mysql2/promise';

/**
 * Vygeneruje náhodná uživatelská data pro Facebook registraci
 */
async function generateRandomUserData() {
  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE
  });

  try {
    // Náhodně vyber pohlaví
    const gender = Math.random() < 0.5 ? 'M' : 'F';
    
    // Získej existující jména a příjmení pro snížení pravděpodobnosti
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
    
    // Váhový výběr křestního jména (snížit pravděpodobnost častých jmen)
    const [firstNameCandidates] = await connection.execute(
      'SELECT name FROM c_first_names WHERE gender = ? ORDER BY RAND() LIMIT 20',
      [gender]
    );
    
    let firstName;
    let attempts = 0;
    do {
      const candidate = firstNameCandidates[Math.floor(Math.random() * firstNameCandidates.length)];
      const existingCount = nameFrequency[candidate.name] || 0;
      
      // Čím více existuje, tím menší pravděpodobnost (inverzní váha)
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
    
    // Váhový výběr příjmení s rozložením přechýlených/nepřechýlených
    let targetGender = gender;
    if (gender === 'F' && Math.random() < 0.10) {
      // 10% žen použije nepřechýlené příjmení
      targetGender = 'M';
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
      
      // Čím více existuje, tím menší pravděpodobnost
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
    
    // Vygeneruj datum narození (18-35 let) s váženým rozložením
    const currentYear = new Date().getFullYear();
    const birthYear = currentYear - Math.floor(Math.random() * (35 - 18 + 1)) - 18;
    
    // Váhový výběr data podle číselníku rozložení narození
    const [birthDates] = await connection.execute(
      'SELECT month, day, relative_frequency FROM c_birth_distribution ORDER BY RAND() * relative_frequency DESC LIMIT 20'
    );
    
    let birthMonth, birthDay;
    let birthAttempts = 0;
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
      birthAttempts++;
    } while (birthAttempts < 10);
    
    if (!birthMonth || !birthDay) {
      // Fallback na první kandidát
      birthMonth = birthDates[0].month;
      birthDay = birthDates[0].day;
    }
    
    const birthDate = new Date(birthYear, birthMonth - 1, birthDay);
    
    // Najdi volné ID nižší než 999
    const [usedIdsResult] = await connection.execute(
      'SELECT id FROM fb_users WHERE id < 999 ORDER BY id'
    );
    
    const usedIds = new Set(usedIdsResult.map(row => row.id));
    let newId = 1;
    
    while (usedIds.has(newId) && newId < 999) {
      newId++;
    }
    
    if (newId >= 999) {
      throw new Error('Žádné volné ID pod 999 není dostupné');
    }
    
    // Vložit nového uživatele do databáze
    await connection.execute(
      `INSERT INTO fb_users (id, name, surname, gender, birth_date, next_statement, e_mail, fb_login, u_login) 
       VALUES (?, ?, ?, ?, ?, NOW(), '', '', '')`,
      [newId, firstName, lastName, gender, birthDate]
    );
    
    const userData = {
      id: newId,
      firstName,
      lastName,
      gender,
      birthDate,
      birthYear,
      birthMonth,
      birthDay,
      // Pro Facebook formulář
      facebookGender: gender === 'M' ? 'Male' : 'Female'
    };
    
    console.log('🎲 === VYGENEROVANÁ UŽIVATELSKÁ DATA ===');
    console.log(`🆔 ID: ${newId}`);
    console.log(`👤 Jméno: ${firstName} ${lastName}`);
    console.log(`⚥ Pohlaví: ${gender === 'M' ? 'Muž' : 'Žena'} (Facebook: ${userData.facebookGender})`);
    if (gender === 'F' && targetGender === 'M') {
      console.log(`📝 Poznámka: Žena s nepřechýleným příjmením (10% pravděpodobnost)`);
    }
    console.log(`🎂 Datum narození: ${birthDay}. ${birthMonth}. ${birthYear}`);
    console.log(`📅 Věk: ${currentYear - birthYear} let`);
    console.log(`💾 Uloženo do databáze jako uživatel ID ${newId}`);
    
    // Debug informace o váhách
    const nameCount = nameFrequency[firstName] || 0;
    const surnameCount = surnameFrequency[lastName] || 0;
    if (nameCount > 0 || surnameCount > 0) {
      console.log(`🔍 Četnost v DB: ${firstName} (${nameCount}x), ${lastName} (${surnameCount}x)`);
    }
    
    return userData;
    
  } catch (error) {
    console.log(`❌ Chyba při generování dat: ${error.message}`);
    throw error;
  } finally {
    await connection.end();
  }
}

// Spuštění při import
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    const userData = await generateRandomUserData();
    process.exit(0);
  })();
}

export { generateRandomUserData };