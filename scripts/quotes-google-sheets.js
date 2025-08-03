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

function loadQuotes() {
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
  
  Logger.log(`Načteno ${data.length - 1} citátů`);
  SpreadsheetApp.getUi().alert(`Úspěšně načteno ${data.length - 1} citátů z databáze!`);
}