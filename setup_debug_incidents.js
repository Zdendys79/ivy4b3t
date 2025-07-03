#!/usr/bin/env node

/**
 * Setup script pro vytvoření debug_incidents tabulky
 * Používá environment variables pro přístup do databáze
 */

import fs from 'fs/promises';
import { execSync } from 'child_process';
import { Log } from './ivy/iv_log.class.js';

async function setupDebugIncidentsTable() {
  try {
    Log.info('[SETUP]', '🗄️ Začínám setup debug_incidents tabulky');
    
    // Kontrola environment variables
    const dbUser = process.env.CLAUDE_DB_USER;
    const dbPass = process.env.CLAUDE_DB_PASS;
    
    if (!dbUser || !dbPass) {
      throw new Error('Chybí databázové přístupové údaje v environment variables');
    }
    
    // Načti SQL schema
    const schemaPath = './debug_incidents_schema.sql';
    const schemaSql = await fs.readFile(schemaPath, 'utf8');
    
    Log.info('[SETUP]', '📋 SQL schema načtena, vytvářím tabulku...');
    
    // Vytvoř tabulku pomocí mysql CLI
    const tempFile = '/tmp/debug_incidents_setup.sql';
    await fs.writeFile(tempFile, schemaSql);
    
    const mysqlCmd = `mysql -u ${dbUser} -p${dbPass} ivy < ${tempFile}`;
    execSync(mysqlCmd, { stdio: 'pipe' });
    
    // Cleanup
    await fs.unlink(tempFile);
    
    Log.success('[SETUP]', '✅ Debug incidents tabulka úspěšně vytvořena');
    
    // Zobraz informace o tabulce
    const infoSql = `
      SELECT 
        TABLE_NAME,
        TABLE_ROWS,
        DATA_LENGTH,
        INDEX_LENGTH,
        CREATE_TIME
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = 'ivy' AND TABLE_NAME = 'debug_incidents';
    `;
    
    const infoCmd = `mysql -u ${dbUser} -p${dbPass} -e "${infoSql}"`;
    execSync(infoCmd, { stdio: 'inherit' });
    
    // Test dotaz
    const testSql = 'SELECT COUNT(*) as incidents_count FROM ivy.debug_incidents;';
    const testCmd = `mysql -u ${dbUser} -p${dbPass} -e "${testSql}"`;
    execSync(testCmd, { stdio: 'inherit' });
    
    Log.success('[SETUP]', '🎉 Debug incidents system je připraven k použití!');
    
    // Ukázkové použití
    Log.info('[USAGE]', '📋 Použití:');
    Log.info('[USAGE]', '  INTERACTIVE_DEBUG=true ./start.sh');
    Log.info('[USAGE]', '  Při chybě: [s] - data se uloží do databáze');
    Log.info('[USAGE]', '  Analýza: SELECT * FROM debug_incidents_summary;');
    
  } catch (error) {
    Log.error('[SETUP]', `❌ Chyba během setup: ${error.message}`);
    process.exit(1);
  }
}

// Spusť setup pokud je skript volán přímo
if (import.meta.url === `file://${process.argv[1]}`) {
  setupDebugIncidentsTable();
}