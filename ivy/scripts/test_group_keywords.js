/**
 * Test skript pro ověření ukládání klíčových slov z nových skupin
 */

import { db } from '../iv_sql.js';
import { FBGroupAnalyzer } from '../iv_fb_group_analyzer.js';
import { Log } from '../libs/iv_log.class.js';

async function testGroupKeywordsSaving() {
  try {
    Log.info('[TEST]', 'Testuji ukládání klíčových slov...');
    
    // Vytvoř instanci analyzátoru
    const analyzer = new FBGroupAnalyzer(null);
    
    // Simuluj groupInfo objekt
    const testGroupInfo = {
      fb_id: 'test67890',
      name: 'Test Praha Auto Bazar Inzerce',
      member_count: 1234,
      category: 'test',
      type: 'Z'
    };
    
    // Test uložení do databáze (mělo by spustit saveKeywordsToDatabase)
    await analyzer.saveGroupToDatabase(testGroupInfo, 999);
    
    // Zkontroluj, jestli se klíčová slova uložila
    const [groups] = await db.pool.query('SELECT id FROM fb_groups WHERE fb_id = ?', [testGroupInfo.fb_id]);
    
    if (groups && groups.length > 0) {
      const groupId = groups[0].id;
      
      // Získej asociace
      const [associations] = await db.pool.query(`
        SELECT k.word 
        FROM group_word_associations a 
        JOIN group_keywords k ON a.keyword_id = k.id 
        WHERE a.group_id = ? 
        ORDER BY a.position_in_name
      `, [groupId]);
      
      Log.info('[TEST]', `Klíčová slova pro testovací skupinu: ${associations.map(a => a.word).join(', ')}`);
      
      // Očekávaná slova: test, praha, auto, bazar, inzerce
      const expectedWords = ['test', 'praha', 'auto', 'bazar', 'inzerce'];
      const foundWords = associations.map(a => a.word);
      
      const allFound = expectedWords.every(word => foundWords.includes(word));
      
      if (allFound) {
        Log.info('[TEST]', 'ÚSPĚCH: Všechna očekávaná klíčová slova byla nalezena');
      } else {
        Log.error('[TEST]', `CHYBA: Chybí klíčová slova. Očekáváno: ${expectedWords.join(', ')}, Nalezeno: ${foundWords.join(', ')}`);
      }
    } else {
      Log.error('[TEST]', 'CHYBA: Testovací skupina nebyla nalezena v databázi');
    }
    
  } catch (err) {
    Log.error('[TEST]', `Chyba v testu: ${err.message}`);
  }
}

// Spustit test
testGroupKeywordsSaving().then(() => {
  Log.info('[TEST]', 'Test dokončen');
  process.exit(0);
}).catch(err => {
  Log.error('[TEST]', `Test selhal: ${err.message}`);
  process.exit(1);
});