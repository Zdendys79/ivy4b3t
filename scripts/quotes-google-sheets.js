/**
 * Google Apps Script pro připojení k IVY4B3T citátové databázi
 * Správně rozděluje české překlady a originální texty
 */

function connectToDatabase() {
  // Databázové připojení
  const connectionUrl = 'jdbc:mysql://83.167.224.200:3306/ivy_test';
  const user = 'google_sheets';
  const password = 'HESLO_PRO_GOOGLE_SHEETS_UZIVATELE'; // Potřebuješ heslo
  
  const conn = Jdbc.getConnection(connectionUrl, user, password);
  return conn;
}

function loadQuotes(startId = 831, endId = 5016) {
    const conn = connectToDatabase();

    const stmt = conn.createStatement();
    const results = stmt.executeQuery(`
      SELECT 
        q.id,
        q.translated_text as czech_text,
        q.original_text,
        l.name_cs as language_name,
        q.language_code,
        q.author,
        q.next_seen,
        CASE 
          WHEN q.next_seen IS NULL OR q.next_seen <= NOW() THEN 'Dostupný'
          ELSE 'Na cooldownu'
        END as status
      FROM quotes q
      LEFT JOIN c_languages l ON q.language_code COLLATE utf8mb4_unicode_ci = l.code
      WHERE q.id BETWEEN ${startId} AND ${endId}
      ORDER BY q.id DESC
    `);
  
  // Získat data do pole
  const data = [];
    data.push(['ID', 'Český text', 'Originální text', 'Jazyk', 'Kód jazyka', 'Autor', 'Další použití', 'Status']);
  
    while (results.next()) {
      data.push([
        results.getInt('id'),
        results.getString('czech_text'),
        results.getString('original_text') || '',
        results.getString('language_name') || '',
        results.getString('language_code'),
        results.getString('author') || '',
        results.getString('next_seen') || '',
        results.getString('status')
      ]);
    }
  
  stmt.close();
  conn.close();
  
  // Zapsat data do sheetu
  const sheet = SpreadsheetApp.getActiveSheet();
  sheet.clear();
  sheet.getRange(1, 1, data.length, data[0].length).setValues(data);
  
  // Formátování
  const headerRange = sheet.getRange(1, 1, 1, data[0].length);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#4285f4');
  headerRange.setFontColor('white');
  
  // Zvýraznit řádky potřebující překlad
  const dataRange = sheet.getRange(2, 1, data.length - 1, data[0].length);
  const conditionalFormatRule = SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('ANO')
    .setBackground('#fff2cc')
    .setRanges([sheet.getRange(2, 9, data.length - 1, 1)])
    .build();
  
  const rules = sheet.getConditionalFormatRules();
  rules.push(conditionalFormatRule);
  sheet.setConditionalFormatRules(rules);
  
  // Auto-resize sloupců
  sheet.autoResizeColumns(1, data[0].length);
  
  // Zmrazit první řádek
  sheet.setFrozenRows(1);
  
  Logger.log(`Načteno ${data.length - 1} citátů (ID ${startId}-${endId})`);
  SpreadsheetApp.getUi().alert(`Úspěšně načteno ${data.length - 1} citátů z rozsahu ID ${startId}-${endId}!`);
}

/**
 * Dynamicky zjistí rozsah ID a rozdělí na 4 rovnoměrné části
 */
function calculateDynamicRanges() {
  const conn = connectToDatabase();
  const stmt = conn.createStatement();
  const results = stmt.executeQuery(`
    SELECT MIN(id) as min_id, MAX(id) as max_id, COUNT(*) as total_count 
    FROM quotes
  `);
  
  results.next();
  const minId = results.getInt('min_id');
  const maxId = results.getInt('max_id');
  const totalCount = results.getInt('total_count');
  
  stmt.close();
  conn.close();
  
  // Výpočet rovnoměrného rozdělení rozsahu ID na 4 části
  const rangeSize = Math.floor((maxId - minId + 1) / 4);
  
  const ranges = [
    { start: minId, end: minId + rangeSize - 1 },
    { start: minId + rangeSize, end: minId + (2 * rangeSize) - 1 },
    { start: minId + (2 * rangeSize), end: minId + (3 * rangeSize) - 1 },
    { start: minId + (3 * rangeSize), end: maxId } // Poslední část až do konce
  ];
  
  Logger.log(`Dynamické rozsahy pro celkem ${totalCount} citátů (ID ${minId}-${maxId}):`);
  ranges.forEach((range, index) => {
    Logger.log(`Část ${index + 1}: ID ${range.start}-${range.end}`);
  });
  
  return ranges;
}

// ČÁST 1: Dynamicky vypočítaná první část
function loadQuotesPart1() {
  const ranges = calculateDynamicRanges();
  loadQuotes(ranges[0].start, ranges[0].end);
}

// ČÁST 2: Dynamicky vypočítaná druhá část
function loadQuotesPart2() {
  const ranges = calculateDynamicRanges();
  loadQuotes(ranges[1].start, ranges[1].end);
}

// ČÁST 3: Dynamicky vypočítaná třetí část
function loadQuotesPart3() {
  const ranges = calculateDynamicRanges();
  loadQuotes(ranges[2].start, ranges[2].end);
}

// ČÁST 4: Dynamicky vypočítaná čtvrtá část
function loadQuotesPart4() {
  const ranges = calculateDynamicRanges();
  loadQuotes(ranges[3].start, ranges[3].end);
}

// Funkce pro načtení od specifického ID výš
function loadQuotesFromId(fromId) {
  loadQuotes(fromId, 5016);
}

// Například od ID 800 výš (statické)
function loadQuotesFrom800() {
  loadQuotes(800, 5016);
}

// Zobrazí aktuální dynamické rozsahy bez načítání dat
function showCurrentRanges() {
  const ranges = calculateDynamicRanges();
  
  let message = `Aktuální dynamické rozdělení na 4 části:\n\n`;
  ranges.forEach((range, index) => {
    message += `Část ${index + 1}: ID ${range.start}-${range.end}\n`;
  });
  
  SpreadsheetApp.getUi().alert(message);
}