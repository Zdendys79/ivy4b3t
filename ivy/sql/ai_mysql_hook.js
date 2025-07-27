/**
 * Název souboru: gemini_mysql_hook.js
 * Umístění: ~/ivy/sql/gemini_mysql_hook.js
 *
 * Popis: Tento skript slouží jako "hák" pro provádění jednorázových SQL příkazů
 * zadaných v souboru temp_gemini.sql. Umožňuje snadno a rychle interagovat
 * s databází bez nutnosti psát specializované skripty.
 *
 * Použití:
 * 1. Vložte požadované SQL příkazy do souboru `temp_gemini.sql` v tomto adresáři.
 * 2. Spusťte tento skript: `node ivy/sql/gemini_mysql_hook.js`
 */

import fs from 'fs/promises';
import path from 'path';
import mysql from 'mysql2/promise';
import { fileURLToPath } from 'url';

// --- Konfigurace ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SQL_FILE_PATH = path.join(__dirname, 'temp_gemini.sql');
const CONFIG_FILE_PATH = path.join(__dirname, 'sql_config.json');

// --- Hlavní funkce ---
async function main() {
    let connection;
    try {
        // 1. Načtení SQL příkazů
        console.log(`[HOOK] Načítám SQL příkazy z: ${SQL_FILE_PATH}`);
        const sqlCommands = await fs.readFile(SQL_FILE_PATH, 'utf-8');

        if (!sqlCommands.trim()) {
            console.log('[HOOK] Soubor temp_gemini.sql je prázdný. Není co provádět.');
            return;
        }

        // 2. Načtení DB konfigurace z proměnných prostředí (primární) nebo souboru (záložní)
        let dbConfig;
        if (process.env.DB_USER && process.env.DB_PASS) {
            console.log('[HOOK] Používám konfiguraci z proměnných prostředí.');
            dbConfig = {
                host: process.env.DB_HOST || 'localhost',
                user: process.env.DB_USER,
                password: process.env.DB_PASS,
                database: process.env.DB_NAME || 'ivy'
            };
        } else {
            console.log('[HOOK] Proměnné prostředí nenalezeny, zkouším soubor sql_config.json.');
            const configRaw = await fs.readFile(CONFIG_FILE_PATH, 'utf-8');
            dbConfig = JSON.parse(configRaw);
        }

        // 3. Připojení k databázi
        console.log(`[HOOK] Připojuji se k databázi: ${dbConfig.host}/${dbConfig.database}`);
        connection = await mysql.createConnection({
            host: dbConfig.host,
            user: dbConfig.user,
            password: dbConfig.password,
            database: dbConfig.database,
            multipleStatements: true // Povolení více příkazů najednou
        });
        console.log('[HOOK] Připojení úspěšné.');

        // 4. Provedení SQL příkazů
        console.log('[HOOK] Provádím SQL příkazy...');
        const [results] = await connection.query(sqlCommands);

        // 5. Zobrazení výsledků
        console.log('[HOOK] Výsledky provedených příkazů:');
        if (Array.isArray(results)) {
            results.forEach((result, index) => {
                console.log(`\n--- Výsledek příkazu #${index + 1} ---`);
                if (result.affectedRows !== undefined) {
                    console.log(`  Affected rows: ${result.affectedRows}`);
                    console.log(`  Changed rows: ${result.changedRows}`);
                } else {
                    console.log(result);
                }
            });
        } else {
            console.log(results);
        }

        console.log('\n[HOOK] Všechny příkazy byly úspěšně provedeny.');

    } catch (error) {
        console.error('\n[HOOK] ❌ Došlo k chybě:');
        console.error(`  Zpráva: ${error.message}`);
        if (error.code) {
            console.error(`  Kód chyby: ${error.code}`);
        }
        if (error.sqlState) {
            console.error(`  SQL State: ${error.sqlState}`);
        }
        process.exit(1);
    } finally {
        // 6. Uzavření připojení
        if (connection) {
            await connection.end();
            console.log('\n[HOOK] Připojení k databázi bylo uzavřeno.');
        }
    }
}

// Spuštění hlavní funkce
main();