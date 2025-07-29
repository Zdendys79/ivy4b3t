#!/bin/bash

# Migrace databáze pro test prostředí
# Vytvoří ivy_test databázi s aktuální strukturou z ivy

echo "=== Migrace databáze pro test prostředí ==="
echo "Datum: $(date '+%Y-%m-%d %H:%M:%S')"
echo "==========================================="

# Kontrola DB proměnných
if [[ -z "$DB_HOST" || -z "$DB_USER" || -z "$DB_PASS" ]]; then
    echo "[ERROR] Chybí DB proměnné. Načti je pomocí: source ~/.bashrc"
    exit 1
fi

echo "[1/5] Exportuji strukturu z produkční databáze..."
mysqldump -h $DB_HOST -u $DB_USER -p$DB_PASS --no-data --single-transaction ivy > /tmp/ivy_structure.sql

if [[ $? -ne 0 ]]; then
    echo "[ERROR] Export struktury selhal"
    exit 1
fi

echo "[2/5] Vytvářím test databázi..."
mysql -h $DB_HOST -u $DB_USER -p$DB_PASS -e "CREATE DATABASE IF NOT EXISTS ivy_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

if [[ $? -ne 0 ]]; then
    echo "[ERROR] Vytvoření databáze selhalo"
    exit 1
fi

echo "[3/5] Importuji strukturu do test databáze..."
mysql -h $DB_HOST -u $DB_USER -p$DB_PASS ivy_test < /tmp/ivy_structure.sql

if [[ $? -ne 0 ]]; then
    echo "[ERROR] Import struktury selhal"
    exit 1
fi

echo "[4/5] Kopíruji referenční data..."
# Kopírovat jen vybrané tabulky s referenčními daty
REFERENCE_TABLES="action_definitions variables"

for table in $REFERENCE_TABLES; do
    echo "   - Kopíruji tabulku: $table"
    mysqldump -h $DB_HOST -u $DB_USER -p$DB_PASS ivy $table | mysql -h $DB_HOST -u $DB_USER -p$DB_PASS ivy_test
done

echo "[5/5] Čistím dočasné soubory..."
rm -f /tmp/ivy_structure.sql

echo ""
echo "✅ Migrace dokončena!"
echo "   Databáze: ivy_test"
echo "   Struktura: zkopírována z ivy"
echo "   Data: pouze referenční tabulky"
echo ""
echo "Pro spuštění test prostředí použij:"
echo "   ./test_start.sh"
echo ""