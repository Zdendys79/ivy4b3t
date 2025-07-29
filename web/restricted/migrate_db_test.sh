#!/bin/bash

# Migrace databáze pro test prostředí s oprávněními
# Vytvoří ivy_test databázi s aktuální strukturou z ivy a udělí oprávnění

echo "=== Migrace databáze pro test prostředí ==="
echo "Datum: $(date '+%Y-%m-%d %H:%M:%S')"
echo "==========================================="

# Kontrola DB proměnných
if [[ -z "$DB_HOST" || -z "$DB_USER" || -z "$DB_PASS" ]]; then
    echo "[ERROR] Chybí DB proměnné. Načti je pomocí: source ~/.bashrc"
    exit 1
fi

echo "[1/6] Exportuji strukturu z produkční databáze..."
mysqldump -h $DB_HOST -u $DB_USER -p$DB_PASS --no-data --single-transaction ivy > /tmp/ivy_structure.sql

if [[ $? -ne 0 ]]; then
    echo "[ERROR] Export struktury selhal"
    exit 1
fi

echo "[2/6] Vytvářím test databázi..."
mysql -h $DB_HOST -u $DB_USER -p$DB_PASS -e "CREATE DATABASE IF NOT EXISTS ivy_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

if [[ $? -ne 0 ]]; then
    echo "[ERROR] Vytvoření databáze selhalo"
    exit 1
fi

echo "[3/6] Importuji strukturu do test databáze..."
mysql -h $DB_HOST -u $DB_USER -p$DB_PASS ivy_test < /tmp/ivy_structure.sql

if [[ $? -ne 0 ]]; then
    echo "[ERROR] Import struktury selhal"
    exit 1
fi

echo "[4/6] Kopíruji referenční data..."
# Kopírovat jen vybrané tabulky s referenčními daty
REFERENCE_TABLES="action_definitions variables"

for table in $REFERENCE_TABLES; do
    echo "   - Kopíruji tabulku: $table"
    mysqldump -h $DB_HOST -u $DB_USER -p$DB_PASS ivy $table | mysql -h $DB_HOST -u $DB_USER -p$DB_PASS ivy_test
done

echo "[5/6] Načítám seznam všech uživatelů..."
DB_USERS=$(mysql -h $DB_HOST -u $DB_USER -p$DB_PASS -e "SELECT CONCAT(User, '@', Host) FROM mysql.user WHERE User != 'root' AND User != '' AND User != 'mysql.sys' AND User != 'mysql.session' AND User != 'mysql.infoschema';" --skip-column-names 2>/dev/null)

if [[ -z "$DB_USERS" ]]; then
    echo "[ERROR] Nepodařilo se načíst seznam uživatelů"
    exit 1
fi

echo "[5/6] Uděluju oprávnění všem uživatelům pro ivy_test..."
while IFS= read -r user_host; do
    if [[ -n "$user_host" ]]; then
        echo "   - Uděluju oprávnění pro: $user_host"
        mysql -h $DB_HOST -u $DB_USER -p$DB_PASS -e "GRANT ALL PRIVILEGES ON ivy_test.* TO $user_host;" 2>/dev/null || echo "     [WARNING] Nepodařilo se udělit oprávnění pro $user_host"
    fi
done <<< "$DB_USERS"

if [[ $? -ne 0 ]]; then
    echo "[ERROR] Udělení oprávnění selhalo"
    exit 1
fi

mysql -h $DB_HOST -u $DB_USER -p$DB_PASS -e "FLUSH PRIVILEGES;"

if [[ $? -ne 0 ]]; then
    echo "[ERROR] Flush privileges selhal"
    exit 1
fi

echo "[6/6] Čistím dočasné soubory..."
rm -f /tmp/ivy_structure.sql

echo ""
echo "✅ Migrace dokončena!"
echo "   Databáze: ivy_test"
echo "   Struktura: zkopírována z ivy"
echo "   Data: pouze referenční tabulky"
echo "   Oprávnění: udělena pro všechny non-root uživatele"
echo ""
echo "Pro spuštění test prostředí použij:"
echo "   ./test_start.sh"
echo ""