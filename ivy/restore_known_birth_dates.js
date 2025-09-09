/**
 * OBNOVENÍ PŮVODNÍCH ZNÁMÝCH DAT NAROZENÍ
 * Obnoví reálná data narození pro uživatele ze seznamu
 */

import mysql from 'mysql2/promise';

// Mapování email → datum narození z původního seznamu
const knownBirthDates = {
  'zajani@centrum.cz': '1987-02-23',
  'vercahostesova@seznam.cz': '1991-05-08', 
  'zuzanasvobodna@email.cz': '1993-01-14',
  'milanekprdly@centrum.cz': '1981-03-08',
  'svatasarka@post.cz': '1992-06-05',
  'miluska.cervinkova@seznam.cz': '1992-08-09',
  'zajda55@centrum.cz': '1995-01-23',
  'bubak775@centrum.cz': '1992-08-14',
  'luckamaty1@gmail.com': '1977-03-29',
  'krchynka.streblova@seznam.cz': '1990-11-18',
  'dorota.voprsalkova@seznam.cz': '1986-03-05',
  'd.kopecna2@post.cz': '1991-07-20',
  'evina.karamela@seznam.cz': '1978-03-30',
  'vejakukl@seznam.cz': '2002-02-07',
  'mariesrpova@email.cz': '1989-12-10',
  'lenkakellerova@post.cz': '2000-07-21',
  'helcakusova@seznam.cz': '1984-03-15',
  'mikulova.kristyn@seznam.cz': '1994-07-22',
  'raduleblahova@post.cz': '1989-03-12',
  'marcel.voborka@seznam.cz': '1994-04-11',
  'feroryso@centrum.cz': '1991-10-15',
  'pavla.pokorna80@post.cz': '1980-02-18',
  'liskovamarketa@post.cz': '1982-06-14',
  'ivantrefny.rm@seznam.cz': '1976-09-14',
  'ivankapavliku1993@email.cz': '1993-03-23',
  'miskachlumcova@seznam.cz': '1993-05-18',
  'amalkahornova@seznam.cz': '1992-08-07',
  'novakovalindus@seznam.cz': '1987-04-15',
  'emma.sediva@seznam.cz': '1980-05-09',
  'klaudie.kopeckova@seznam.cz': '1998-05-25',
  'kliny1966@seznam.cz': '1995-04-30',
  'jiriholan89@seznam.cz': '1996-05-17',
  'kamilnovotny87@seznam.cz': '1987-05-17',
  'kamila.novotna89@post.cz': '1989-07-21',
  'anca.krejci186@seznam.cz': '1978-06-18',
  'kralovna.eli834@seznam.cz': '1983-04-26',
  'dennyvoch@seznam.cz': '1998-01-29',
  'frantiskakucerova@email.cz': '1987-03-23',
  'karina.sulcova@seznam.cz': '1996-02-20',
  'karla.perska@seznam.cz': '1972-12-29',
  'emmanovotna2002@seznam.cz': '2002-05-17',
  'jitkanenivesela@seznam.cz': '2001-02-08',
  'brejjin@seznam.cz': '1985-12-11',
  'baumruko@seznam.cz': '1979-03-02',
  'radmilaslezackova@seznam.cz': '1985-03-20',
  'jitkapomahac@seznam.cz': '1962-05-09',
  'anetaticha07@seznam.cz': '1983-04-04',
  'marta.vokata@seznam.cz': '1998-03-10',
  'vaclavsvatopluk@seznam.cz': '1999-04-25',
  'radekmarekkk@seznam.cz': '2000-04-10',
  'potok.jezero@seznam.cz': '2001-06-19',
  'okno.zahrada@seznam.cz': '1998-01-02',
  'grunt.evzen@gmail.com': '1995-07-15',
  'hlavac.ilja@gmail.com': '1999-08-04',
  'markojepan99@seznam.cz': '1996-10-04',
  'martinahrbková3@seznam.cz': '1990-11-20',
  'pavelmusil1234@email.cz': '1990-01-02',
  'erikahumpolcova@seznam.cz': '1996-04-18',
  'hanickasalvova@seznam.cz': '1992-08-28',
  'sarka.bilecova91@gmail.com': '1991-06-05',
  'anezkaholubova93@email.cz': '1993-05-05',
  'klara.poduskova@post.cz': '1979-07-25',
  'martinkanovotna87@seznam.cz': '1987-05-17',
  'pateklindus@post.cz': '1987-07-22',
  'standapotrebujes@post.cz': '1983-12-20',
  'kocigabina@post.cz': '1987-05-18'
};

// Mapování email → user ID (z databáze)
const emailToUserId = {
  'zajani@centrum.cz': 1,
  'vercahostesova@seznam.cz': 7,
  'zuzanasvobodna@email.cz': 8,
  'milanekprdly@centrum.cz': 17,
  'svatasarka@post.cz': 18,
  'miluska.cervinkova@seznam.cz': 19,
  'zajda55@centrum.cz': 20,
  'bubak775@centrum.cz': 21,
  'luckamaty1@gmail.com': 22,
  'krchynka.streblova@seznam.cz': 23,
  'dorota.voprsalkova@seznam.cz': 24,
  'd.kopecna2@post.cz': 25,
  'evina.karamela@seznam.cz': 26,
  'vejakukl@seznam.cz': 27,
  'mariesrpova@email.cz': 28,
  'lenkakellerova@post.cz': 29,
  'helcakusova@seznam.cz': 30,
  'mikulova.kristyn@seznam.cz': 31,
  'raduleblahova@post.cz': 32,
  'marcel.voborka@seznam.cz': 33,
  'feroryso@centrum.cz': 34,
  'pavla.pokorna80@post.cz': 35,
  'liskovamarketa@post.cz': 38,
  'ivantrefny.rm@seznam.cz': 39,
  'ivankapavliku1993@email.cz': 40,
  'miskachlumcova@seznam.cz': 42,
  'amalkahornova@seznam.cz': 43,
  'novakovalindus@seznam.cz': 45,
  'emma.sediva@seznam.cz': 48,
  'klaudie.kopeckova@seznam.cz': 52,
  'kliny1966@seznam.cz': 53,
  'jiriholan89@seznam.cz': 55,
  'kamilnovotny87@seznam.cz': 56,
  'kamila.novotna89@post.cz': 57,
  'anca.krejci186@seznam.cz': 58,
  'kralovna.eli834@seznam.cz': 59,
  'dennyvoch@seznam.cz': 60,
  'frantiskakucerova@email.cz': 74,
  'karina.sulcova@seznam.cz': 75,
  'karla.perska@seznam.cz': 76,
  'emmanovotna2002@seznam.cz': 77,
  'jitkanenivesela@seznam.cz': 78,
  'brejjin@seznam.cz': 79,
  'baumruko@seznam.cz': 80,
  'radmilaslezackova@seznam.cz': 804,
  'jitkapomahac@seznam.cz': 82,
  'anetaticha07@seznam.cz': 83,
  'marta.vokata@seznam.cz': 84,
  'vaclavsvatopluk@seznam.cz': 85,
  'radekmarekkk@seznam.cz': 86,
  'potok.jezero@seznam.cz': 87,
  'okno.zahrada@seznam.cz': 88,
  'grunt.evzen@gmail.com': 987,
  'hlavac.ilja@gmail.com': 975,
  'markojepan99@seznam.cz': 1000,
  'martinahrbková3@seznam.cz': 801,
  'pavelmusil1234@email.cz': 70,
  'erikahumpolcova@seznam.cz': 802,
  'hanickasalvova@seznam.cz': 803,
  'sarka.bilecova91@gmail.com': 870,
  'anezkaholubova93@email.cz': 71,
  'klara.poduskova@post.cz': 918,
  'martinkanovotna87@seznam.cz': 923,
  'pateklindus@post.cz': 919,
  'standapotrebujes@post.cz': 920,
  'kocigabina@post.cz': 921
};

async function restoreKnownBirthDates() {
  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE
  });

  try {
    console.log('🔄 === OBNOVENÍ PŮVODNÍCH ZNÁMÝCH DAT NAROZENÍ ===');
    
    let restoredCount = 0;
    
    for (const [email, userId] of Object.entries(emailToUserId)) {
      const birthDate = knownBirthDates[email];
      
      if (birthDate) {
        try {
          await connection.execute(
            'UPDATE fb_users SET birth_date = ? WHERE id = ?',
            [birthDate, userId]
          );
          
          const currentYear = new Date().getFullYear();
          const age = currentYear - new Date(birthDate).getFullYear();
          
          console.log(`✅ ID ${userId}: ${birthDate} (věk: ${age}) - ${email}`);
          restoredCount++;
          
        } catch (userError) {
          console.log(`❌ Chyba u uživatele ID ${userId}: ${userError.message}`);
        }
      }
    }
    
    console.log(`\n🎯 === DOKONČENO ===`);
    console.log(`✅ Obnoveno: ${restoredCount} původních dat narození`);
    
    // Statistiky po obnovení
    const [stats] = await connection.execute(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(birth_date) as users_with_birth_date
      FROM fb_users 
      WHERE id != 0
    `);
    
    console.log(`\n📊 STATISTIKY PO OBNOVENÍ:`);
    console.log(`👥 Celkem uživatelů: ${stats[0].total_users}`);
    console.log(`🎂 S datem narození: ${stats[0].users_with_birth_date}`);
    console.log(`🔄 Obnovených původních: ${restoredCount}`);
    console.log(`🆕 Nově vygenerovaných: ${stats[0].users_with_birth_date - restoredCount}`);
    
  } catch (error) {
    console.log(`❌ Chyba při obnovování dat narození: ${error.message}`);
    throw error;
  } finally {
    await connection.end();
  }
}

// Spuštění
restoreKnownBirthDates();