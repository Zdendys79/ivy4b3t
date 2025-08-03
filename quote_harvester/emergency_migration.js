#!/usr/bin/env node

/**
 * EMERGENCY MIGRATION - Oprava špatně uložených citátů
 */

import { DatabaseManager } from './src/database_manager.class.js';

const db = new DatabaseManager();

async function emergencyMigration() {
  console.log('🚨 EMERGENCY MIGRATION - Oprava harvester chyby');
  console.log('═══════════════════════════════════════════════\n');

  try {
    const conn = await db.connect();
    
    // 1. Najít problematické citáty
    const [problemQuotes] = await conn.execute(`
      SELECT id, text, original_text, language_code, author
      FROM quotes 
      WHERE language_code NOT IN ('ces', 'svk')
        AND (original_text IS NULL OR original_text = '')
        AND text IS NOT NULL 
        AND text != ''
      LIMIT 200
    `);
    
    console.log(`🔍 Nalezeno ${problemQuotes.length} problematických citátů k migraci...\n`);
    
    if (problemQuotes.length === 0) {
      console.log('✅ Žádné citáty k migraci!');
      return;
    }
    
    // 2. Migrace po jednom
    let migrated = 0;
    let errors = 0;
    
    for (const quote of problemQuotes) {
      try {
        // Přesunout text → original_text, vymazat text
        await conn.execute(`
          UPDATE quotes 
          SET original_text = ?, text = NULL 
          WHERE id = ?
        `, [quote.text, quote.id]);
        
        migrated++;
        
        if (migrated % 10 === 0) {
          console.log(`✅ Migrováno ${migrated}/${problemQuotes.length} citátů...`);
        }
        
      } catch (error) {
        console.error(`❌ Chyba při migraci ID ${quote.id}: ${error.message}`);
        errors++;
      }
    }
    
    console.log(`\n🎯 VÝSLEDKY MIGRACE:`);
    console.log(`✅ Úspěšně migrováno: ${migrated}`);
    console.log(`❌ Chyby: ${errors}`);
    
    // 3. Kontrola po migraci
    const [afterCheck] = await conn.execute(`
      SELECT 
        language_code,
        COUNT(*) as total,
        COUNT(CASE WHEN original_text IS NOT NULL AND original_text != '' THEN 1 END) as has_original,
        COUNT(CASE WHEN text IS NOT NULL AND text != '' THEN 1 END) as has_text,
        COUNT(CASE WHEN text IS NOT NULL AND text != '' AND (original_text IS NULL OR original_text = '') THEN 1 END) as still_problematic
      FROM quotes 
      GROUP BY language_code 
      ORDER BY total DESC
    `);
    
    console.log(`\n📊 STAV PO MIGRACI:`);
    console.table(afterCheck);
    
    const totalProblematic = afterCheck.reduce((sum, row) => sum + row.still_problematic, 0);
    console.log(`\n${totalProblematic > 0 ? '⚠️' : '✅'} Zbývá problematických citátů: ${totalProblematic}`);
    
    if (totalProblematic > 0) {
      console.log('\n🔄 Pro dokončení migrace spusť script znovu!');
    } else {
      console.log('\n🎉 Migrace KOMPLETNÍ!');
    }
    
  } catch (error) {
    console.error('❌ Kritická chyba migrace:', error.message);
    throw error;
  }
}

// Spustit pouze pokud je soubor spuštěn přímo
if (import.meta.url === `file://${process.argv[1]}`) {
  emergencyMigration().catch(console.error);
}