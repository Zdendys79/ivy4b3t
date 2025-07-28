#!/bin/bash

# test-db-connection.sh
# Umístění: scripts/test-db-connection.sh
# Verze: 2025-07-28 11:15:00 - Node.js test s mysql2 auto-install
# 
# Popis: Jednoduchý test databázových proměnných a připojení

echo "========================================"
echo "🔍 TEST DATABÁZOVÉHO PŘIPOJENÍ"
echo "========================================"
echo "Čas: $(date '+%Y-%m-%d %H:%M:%S')"
echo "Host: $(hostname)"
echo "Uživatel: $(whoami)"
echo "Script verze: $(stat -c '%y' "$0" 2>/dev/null | cut -d'.' -f1 || echo 'neznámé')"
echo ""

# === 1. KONTROLA PROMĚNNÝCH ===
echo "📋 Kontrola environment variables:"
echo "----------------------------------------"

# Kontrola jednotlivých proměnných
if [ -n "$DB_HOST" ]; then
    echo "✅ DB_HOST: $DB_HOST"
else
    echo "❌ DB_HOST: CHYBÍ"
    MISSING_VARS=1
fi

if [ -n "$DB_USER" ]; then
    echo "✅ DB_USER: $DB_USER"
else
    echo "❌ DB_USER: CHYBÍ"
    MISSING_VARS=1
fi

if [ -n "$DB_NAME" ]; then
    echo "✅ DB_NAME: $DB_NAME"
else
    echo "❌ DB_NAME: CHYBÍ"
    MISSING_VARS=1
fi

if [ -n "$DB_PASS" ]; then
    echo "✅ DB_PASS: [NASTAVENO]"
else
    echo "❌ DB_PASS: CHYBÍ"
    MISSING_VARS=1
fi

echo ""

# === 2. POKUD CHYBÍ PROMĚNNÉ - ZKUS NAČÍST ===
if [ "$MISSING_VARS" = "1" ]; then
    echo "⚠️  CHYBÍ DATABÁZOVÉ PROMĚNNÉ!"
    echo ""
    echo "🔄 Zkouším načíst proměnné z ~/.bashrc..."
    
    # Zkus načíst proměnné
    if [ -f ~/.bashrc ]; then
        source ~/.bashrc
        echo "✅ Proměnné načteny z ~/.bashrc"
        
        # Znovu zkontroluj proměnné
        echo ""
        echo "📋 Nová kontrola proměnných:"
        echo "----------------------------------------"
        
        MISSING_VARS=""
        if [ -n "$DB_HOST" ]; then
            echo "✅ DB_HOST: $DB_HOST"
        else
            echo "❌ DB_HOST: STÁLE CHYBÍ"
            MISSING_VARS=1
        fi

        if [ -n "$DB_USER" ]; then
            echo "✅ DB_USER: $DB_USER"
        else
            echo "❌ DB_USER: STÁLE CHYBÍ"
            MISSING_VARS=1
        fi

        if [ -n "$DB_NAME" ]; then
            echo "✅ DB_NAME: $DB_NAME"
        else
            echo "❌ DB_NAME: STÁLE CHYBÍ"
            MISSING_VARS=1
        fi

        if [ -n "$DB_PASS" ]; then
            echo "✅ DB_PASS: [NASTAVENO]"
        else
            echo "❌ DB_PASS: STÁLE CHYBÍ"
            MISSING_VARS=1
        fi
        
        echo ""
        
        # Pokud stále chybí
        if [ "$MISSING_VARS" = "1" ]; then
            echo "❌ Proměnné stále chybí v ~/.bashrc"
            echo ""
            echo "Řešení:"
            echo "1) Spusť setup: ./setup-ivy.sh"
            echo "2) Nebo restartuj terminál: exit && ssh znovu"
            exit 1
        else
            echo "✅ Všechny proměnné jsou nyní dostupné, pokračuji..."
        fi
    else
        echo "❌ Soubor ~/.bashrc neexistuje"
        echo ""
        echo "Řešení:"
        echo "1) Spusť setup: ./setup-ivy.sh"
        exit 1
    fi
fi

# === 3. TEST PŘIPOJENÍ ===
echo "🔌 Test připojení k databázi:"
echo "----------------------------------------"

# Test pomocí Node.js (iv_sql.js)
echo "Testování připojení přes Node.js..."

# Vytvořit dočasný test script v ivy složce
cat > ~/ivy/db_test_temp.js << 'EOF'
// Jednoduchý test databázového připojení
import mysql from 'mysql2/promise';

async function testConnection() {
    try {
        // Získat environment variables
        const config = {
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASS,
            database: process.env.DB_NAME,
            timeout: 10000
        };
        
        // Ověřit že všechny proměnné jsou dostupné
        if (!config.host || !config.user || !config.password || !config.database) {
            console.log('❌ CHYBA: Chybí databázové proměnné');
            process.exit(1);
        }
        
        // Pokus o připojení
        console.log('🔄 Připojuji se k databázi...');
        const connection = await mysql.createConnection(config);
        
        // Test dotaz
        const [rows] = await connection.execute(
            "SELECT 'Připojení OK' AS Status, NOW() AS Cas, CONNECTION_ID() as connection_id, USER() as current_user, DATABASE() as current_db, VERSION() as mysql_version"
        );
        
        console.log('✅ Databázové připojení ÚSPĚŠNÉ');
        console.log('');
        console.log('📊 Databázové informace:');
        console.log(`   Status: ${rows[0].Status}`);
        console.log(`   Čas: ${rows[0].Cas}`);
        console.log(`   Connection ID: ${rows[0].connection_id}`);
        console.log(`   Uživatel: ${rows[0].current_user}`);
        console.log(`   Databáze: ${rows[0].current_db}`);
        console.log(`   MySQL verze: ${rows[0].mysql_version}`);
        
        await connection.end();
        
    } catch (error) {
        console.log('❌ Databázové připojení SELHALO');
        console.log('');
        console.log('📋 Detail chyby:', error.message);
        console.log('');
        console.log('Možné příčiny:');
        console.log('- Špatné heslo nebo uživatelské jméno');
        console.log(`- Databáze není dostupná na ${process.env.DB_HOST}`);
        console.log(`- Databáze ${process.env.DB_NAME} neexistuje`);
        console.log('- Firewall blokuje připojení');
        console.log('- Chybí Node.js mysql2 balíček');
        process.exit(1);
    }
}

testConnection();
EOF

# Spustit test z ~/ivy složky (kde jsou node_modules)
echo "🔍 Kontroluji ~/ivy složku..."
if [ -d ~/ivy ]; then
    echo "✅ ~/ivy složka existuje"
    cd ~/ivy
    echo "📂 Současná složka: $(pwd)"
    
    if [ -f package.json ] && [ -d node_modules ]; then
        echo "✅ package.json a node_modules nalezeny"
        
        # Zkontrolovat že mysql2 je nainstalován
        echo "🔍 Kontroluji mysql2 balíček..."
        if [ ! -d node_modules/mysql2 ]; then
            echo "❌ MySQL2 balíček není nainstalován"
            echo "🔄 Instaluji mysql2..."
            npm install mysql2
            if [ $? -ne 0 ]; then
                echo "❌ Instalace mysql2 selhala"
                rm -f /tmp/db_test.js
                exit 1
            fi
            echo "✅ MySQL2 úspěšně nainstalován"
        else
            echo "✅ MySQL2 balíček je k dispozici"
        fi
        
        echo "🚀 Spouštím databázový test..."
        node db_test_temp.js
        TEST_RESULT=$?
        cd - > /dev/null
        
        # Smazat dočasný soubor
        rm -f ~/ivy/db_test_temp.js
        
        if [ $TEST_RESULT -ne 0 ]; then
            exit 1
        fi
    else
        echo "❌ ~/ivy složka neobsahuje node_modules nebo package.json"
        echo "📋 Obsah ~/ivy:"
        ls -la ~/ivy
        echo "Spusť nejprve: ./setup-ivy.sh"
        rm -f ~/ivy/db_test_temp.js
        exit 1
    fi
else
    echo "❌ ~/ivy složka neexistuje"
    echo "Spusť nejprve: ./setup-ivy.sh"
    rm -f ~/ivy/db_test_temp.js
    exit 1
fi

echo ""
echo "🎉 VŠECHNY TESTY PROŠLY!"
echo "Robot by měl být schopen se připojit k databázi."
echo ""