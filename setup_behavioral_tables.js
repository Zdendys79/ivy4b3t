#!/usr/bin/env node

/**
 * Setup script pro vytvoření behavioral profiles tabulek
 * Používá environment variables pro přístup do databáze
 */

import fs from 'fs/promises';
import { execSync } from 'child_process';
import { Log } from './ivy/iv_log.class.js';

async function setupBehavioralTables() {
  try {
    Log.info('[SETUP]', '🗄️ Začínám setup behavioral profiles tabulek');
    
    // Kontrola environment variables
    const dbUser = process.env.CLAUDE_DB_USER;
    const dbPass = process.env.CLAUDE_DB_PASS;
    
    if (!dbUser || !dbPass) {
      throw new Error('Chybí databázové přístupové údaje v environment variables');
    }
    
    // Načti SQL schema
    const schemaPath = './behavioral_profiles_schema.sql';
    const schemaSql = await fs.readFile(schemaPath, 'utf8');
    
    Log.info('[SETUP]', '📋 SQL schema načtena, vytvářím tabulky...');
    
    // Vytvoř tabulky pomocí mysql CLI
    const tempFile = '/tmp/behavioral_setup.sql';
    await fs.writeFile(tempFile, schemaSql);
    
    const mysqlCmd = `mysql -u ${dbUser} -p${dbPass} ivy < ${tempFile}`;
    execSync(mysqlCmd, { stdio: 'pipe' });
    
    // Cleanup
    await fs.unlink(tempFile);
    
    Log.success('[SETUP]', '✅ Behavioral profiles tabulky úspěšně vytvořeny');
    
    // Inicializuj základní profily pro existující uživatele
    Log.info('[SETUP]', '👤 Inicializuji profily pro existující uživatele...');
    
    const initSql = `
      INSERT IGNORE INTO ivy.user_behavioral_profiles (user_id)
      SELECT id FROM ivy.fb_users
      WHERE id NOT IN (SELECT user_id FROM ivy.user_behavioral_profiles);
    `;
    
    const initCmd = `mysql -u ${dbUser} -p${dbPass} -e "${initSql}"`;
    execSync(initCmd, { stdio: 'pipe' });
    
    // Spočítej počet vytvořených profilů
    const countSql = 'SELECT COUNT(*) as profile_count FROM ivy.user_behavioral_profiles;';
    const countCmd = `mysql -u ${dbUser} -p${dbPass} -e "${countSql}" --skip-column-names`;
    const profileCount = execSync(countCmd, { encoding: 'utf8' }).trim();
    
    Log.success('[SETUP]', `✅ Inicializováno ${profileCount} behavioral profilů`);
    
    // Zobraz statistiky
    const statsSql = `
      SELECT 
        COUNT(*) as total_users,
        (SELECT COUNT(*) FROM ivy.user_behavioral_profiles) as users_with_profiles,
        ROUND((SELECT COUNT(*) FROM ivy.user_behavioral_profiles) / COUNT(*) * 100, 1) as coverage_percent
      FROM ivy.fb_users;
    `;
    
    const statsCmd = `mysql -u ${dbUser} -p${dbPass} -e "${statsSql}"`;
    execSync(statsCmd, { stdio: 'inherit' });
    
    Log.success('[SETUP]', '🎉 Behavioral profiles system je připraven k použití!');
    
    // Bezpečnostní upozornění
    Log.warn('[SECURITY]', '⚠️ DŮLEŽITÉ: Nikdy necommituj behavioral_profiles_schema.sql do Gitu!');
    Log.warn('[SECURITY]', '⚠️ Obsahuje strukturu citlivých dat o uživatelích');
    
  } catch (error) {
    Log.error('[SETUP]', `❌ Chyba během setup: ${error.message}`);
    process.exit(1);
  }
}

// Spusť setup pokud je skript volán přímo
if (import.meta.url === `file://${process.argv[1]}`) {
  setupBehavioralTables();
}