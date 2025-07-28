#!/bin/bash

# test-db-connection.sh
# Umístění: scripts/test-db-connection.sh
# 
# Popis: Jednoduchý test databázových proměnných a připojení

echo "========================================"
echo "🔍 TEST DATABÁZOVÉHO PŘIPOJENÍ"
echo "========================================"
echo "Čas: $(date '+%Y-%m-%d %H:%M:%S')"
echo "Host: $(hostname)"
echo "Uživatel: $(whoami)"
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

# === 2. POKUD CHYBÍ PROMĚNNÉ ===
if [ "$MISSING_VARS" = "1" ]; then
    echo "⚠️  CHYBÍ DATABÁZOVÉ PROMĚNNÉ!"
    echo ""
    echo "Řešení:"
    echo "1) Restartuj terminál: exit && ssh znovu"
    echo "2) Nebo načti proměnné: source ~/.bashrc"
    echo "3) Nebo spusť setup: ./scripts/setup-ivy.sh"
    echo ""
    exit 1
fi

# === 3. TEST PŘIPOJENÍ ===
echo "🔌 Test připojení k databázi:"
echo "----------------------------------------"

# Test pomocí mysql klienta
echo "Testování připojení..."
if command -v mysql >/dev/null 2>&1; then
    if mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "SELECT 'Připojení OK' AS Status, NOW() AS Cas;" 2>/dev/null; then
        echo "✅ Databázové připojení ÚSPĚŠNÉ"
        
        # Dodatečné informace
        echo ""
        echo "📊 Databázové informace:"
        mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "
            SELECT 
                CONNECTION_ID() as connection_id,
                USER() as current_user,
                DATABASE() as current_db,
                VERSION() as mysql_version;
        " 2>/dev/null
        
    else
        echo "❌ Databázové připojení SELHALO"
        echo ""
        echo "Možné příčiny:"
        echo "- Špatné heslo nebo uživatelské jméno"
        echo "- Databáze není dostupná na $DB_HOST"
        echo "- Databáze $DB_NAME neexistuje"
        echo "- Firewall blokuje připojení"
        exit 1
    fi
else
    echo "⚠️  MySQL klient není nainstalován - nemohu testovat připojení"
    echo "Pro instalaci: sudo apt install mysql-client"
    exit 1
fi

echo ""
echo "🎉 VŠECHNY TESTY PROŠLY!"
echo "Robot by měl být schopen se připojit k databázi."
echo ""