/**
 * Jednorázový skript pro zpracování existujících skupin a naplnění klíčových slov
 * Spustit: node scripts/backfill_group_keywords.js
 */

import { db } from '../iv_sql.js';
import { Log } from '../libs/iv_log.class.js';
import { FBGroupAnalyzer } from '../iv_fb_group_analyzer.js';

async function backfillGroupKeywords() {
  try {
    Log.info('[BACKFILL]', 'Spouštím zpracování existujících skupin...');
    
    // Získej všechny skupiny s názvy  
    const [groups] = await db.pool.query(`
      SELECT id, name 
      FROM fb_groups 
      WHERE name IS NOT NULL 
        AND name != ''
        AND LENGTH(TRIM(name)) > 3
      ORDER BY id
    `);
    
    if (!groups || groups.length === 0) {
      Log.warn('[BACKFILL]', 'Žádné skupiny k zpracování');
      return;
    }
    
    Log.info('[BACKFILL]', `Nalezeno ${groups.length} skupin k zpracování`);
    
    // Vytvoř instanci analyzátoru jen pro extrakci klíčových slov
    const analyzer = new FBGroupAnalyzer(null);
    
    let processed = 0;
    let successful = 0;
    
    for (const group of groups) {
      try {
        // Extrahuj klíčová slova z názvu
        const keywords = analyzer.extractKeywords(group.name);
        
        if (keywords && keywords.length > 0) {
          // Ulož klíčová slova
          await analyzer.saveKeywordsToDatabase(group.id, keywords);
          successful++;
          Log.debug('[BACKFILL]', `Skupina ${group.id} (${group.name}): ${keywords.length} klíčových slov`);
        }
        
        processed++;
        
        // Progress info každých 100 skupin
        if (processed % 100 === 0) {
          Log.info('[BACKFILL]', `Zpracováno ${processed}/${groups.length} skupin`);
        }
        
      } catch (err) {
        Log.error('[BACKFILL]', `Chyba při zpracování skupiny ${group.id}: ${err.message}`);
      }
    }
    
    Log.info('[BACKFILL]', `DOKONČENO: Zpracováno ${processed} skupin, úspěšně ${successful}`);
    
    // Statistiky
    const [keywordStats] = await db.pool.query('SELECT COUNT(*) as total_keywords FROM group_keywords');
    const [associationStats] = await db.pool.query('SELECT COUNT(*) as total_associations FROM group_word_associations');
    
    Log.info('[BACKFILL]', `Celkem klíčových slov: ${keywordStats?.total_keywords || 0}`);
    Log.info('[BACKFILL]', `Celkem asociací: ${associationStats?.total_associations || 0}`);
    
  } catch (err) {
    Log.error('[BACKFILL]', `Fatální chyba: ${err.message}`);
  }
}

// Spustit pouze pokud je volaný přímo
if (import.meta.url === `file://${process.argv[1]}`) {
  backfillGroupKeywords().then(() => {
    Log.info('[BACKFILL]', 'Skript dokončen');
    process.exit(0);
  }).catch(err => {
    Log.error('[BACKFILL]', `Skript selhal: ${err.message}`);
    process.exit(1);
  });
}

export { backfillGroupKeywords };