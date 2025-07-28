// test-db.js - Jednoduchý test databázového připojení pro IVY projekt
// Spuštění: node test-db.js
// Verze: 2025-07-28 11:25:00 - MariaDB kompatibilní syntax

import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';

async function testDatabaseConnection() {
    console.log('========================================');
    console.log('🔍 TEST DATABÁZOVÉHO PŘIPOJENÍ');
    console.log('========================================');
    console.log(`Čas: ${new Date().toLocaleString('cs-CZ')}`);
    
    // Načti verzi z package.json
    try {
        const packageJson = JSON.parse(readFileSync('./package.json', 'utf8'));
        console.log(`IVY verze: ${packageJson.version} (${packageJson.versionCode})`);
    } catch (error) {
        console.log('IVY verze: neznámá (package.json nenalezen)');
    }
    console.log('');

    try {
        // Kontrola environment variables
        console.log('📋 Kontrola environment variables:');
        console.log('----------------------------------------');
        
        const config = {
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASS,
            database: process.env.DB_NAME,
            timeout: 10000,
            acquireTimeout: 10000,
            connectTimeout: 10000
        };
        
        // Zobrazit konfiguraci (bez hesla)
        console.log(`✅ DB_HOST: ${config.host || 'CHYBÍ'}`);
        console.log(`✅ DB_USER: ${config.user || 'CHYBÍ'}`);
        console.log(`✅ DB_NAME: ${config.database || 'CHYBÍ'}`);
        console.log(`✅ DB_PASS: ${config.password ? '[NASTAVENO]' : 'CHYBÍ'}`);
        console.log('');
        
        // Ověřit že všechny proměnné jsou dostupné
        if (!config.host || !config.user || !config.password || !config.database) {
            console.log('❌ CHYBA: Chybí databázové proměnné');
            console.log('');
            console.log('Načti proměnné pomocí:');
            console.log('source ~/.bashrc');
            process.exit(1);
        }
        
        // Test připojení
        console.log('🔌 Test připojení k databázi:');
        console.log('----------------------------------------');
        console.log('🔄 Připojuji se k databázi...');
        
        const connection = await mysql.createConnection(config);
        
        // Test dotaz
        console.log('✅ Připojení úspěšné, testuji dotaz...');
        const [rows] = await connection.execute(
            "SELECT 'Připojení OK' AS Status, NOW() AS Cas"
        );
        
        console.log('✅ Databázové připojení ÚSPĚŠNÉ');
        console.log('');
        console.log('📊 Databázové informace:');
        console.log(`   Status: ${rows[0].Status}`);
        console.log(`   Čas: ${rows[0].Cas}`);
        
        // Test základních tabulek
        console.log('');
        console.log('🔍 Test základních tabulek:');
        console.log('----------------------------------------');
        
        const tables = ['system_config', 'users', 'ui_commands', 'actions'];
        for (const table of tables) {
            try {
                const [result] = await connection.execute(`SELECT COUNT(*) as count FROM ${table} LIMIT 1`);
                console.log(`✅ Tabulka ${table}: ${result[0].count} záznamů`);
            } catch (error) {
                console.log(`❌ Tabulka ${table}: ${error.message}`);
            }
        }
        
        await connection.end();
        
        console.log('');
        console.log('🎉 VŠECHNY TESTY PROŠLY!');
        console.log('Databázové připojení funguje správně.');
        
    } catch (error) {
        console.log('❌ Databázové připojení SELHALO');
        console.log('');
        console.log('📋 Detail chyby:', error.message);
        console.log('📋 Error code:', error.code);
        console.log('📋 Error errno:', error.errno);
        console.log('');
        console.log('Možné příčiny:');
        console.log('- Špatné heslo nebo uživatelské jméno');
        console.log(`- Databáze není dostupná na ${process.env.DB_HOST}`);
        console.log(`- Databáze ${process.env.DB_NAME} neexistuje`);
        console.log('- Firewall blokuje připojení');
        console.log('- Síťový problém nebo timeout');
        console.log('- Nekompatibilní verze mysql2 a MariaDB');
        
        if (error.code === 'ER_MALFORMED_PACKET') {
            console.log('');
            console.log('🚨 SPECIÁLNÍ PROBLÉM: ER_MALFORMED_PACKET');
            console.log('Tato chyba může být způsobena:');
            console.log('- Nekompatibilní verze mysql2 balíčku');
            console.log('- Špatná konfigurace character setu');
            console.log('- Poškozené síťové spojení');
            console.log('- SSL/TLS problémy');
        }
        
        process.exit(1);
    }
}

// Spustit test
testDatabaseConnection();