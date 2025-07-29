#!/bin/bash

# Grant permissions script for ivy_test database
# Umístění: ~/ivy4b3t/web/restricted/grant_ivy_test_permissions.sh
#
# Popis: Uděluje oprávnění uživateli pro ivy_test databázi
#        Používá pouze systémové proměnné - žádné hard-kódované údaje

echo "=== Grant ivy_test Database Permissions ==="
echo "Datum: $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================"

# Kontrola DB proměnných
if [[ -z "$DB_HOST" || -z "$DB_USER" || -z "$DB_PASS" ]]; then
    echo "[ERROR] Chybí DB proměnné. Načti je pomocí: source ~/.bashrc"
    exit 1
fi

echo "[1/3] Kontroluji existenci ivy_test databáze..."
DB_EXISTS=$(mysql -h $DB_HOST -u $DB_USER -p$DB_PASS -e "SHOW DATABASES LIKE 'ivy_test';" --skip-column-names 2>/dev/null | wc -l)

if [[ $DB_EXISTS -eq 0 ]]; then
    echo "[ERROR] Databáze ivy_test neexistuje. Spusť nejprve migrate_db_test.sh"
    exit 1
fi

echo "[2/3] Načítám seznam všech uživatelů..."
DB_USERS=$(mysql -h $DB_HOST -u $DB_USER -p$DB_PASS -e "SELECT CONCAT(User, '@', Host) FROM mysql.user WHERE User != 'root' AND User != '' AND User != 'mysql.sys' AND User != 'mysql.session' AND User != 'mysql.infoschema';" --skip-column-names 2>/dev/null)

if [[ -z "$DB_USERS" ]]; then
    echo "[ERROR] Nepodařilo se načíst seznam uživatelů"
    exit 1
fi

echo "[2/3] Uděluju oprávnění všem uživatelům pro ivy_test..."
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

echo "[3/3] Aktualizuji oprávnění..."
mysql -h $DB_HOST -u $DB_USER -p$DB_PASS -e "FLUSH PRIVILEGES;"

if [[ $? -ne 0 ]]; then
    echo "[ERROR] Flush privileges selhal"
    exit 1
fi

echo ""
echo "✅ Oprávnění úspěšně udělena!"
echo "   Uživatelé: všichni non-root uživatelé"
echo "   Databáze: ivy_test"
echo "   Oprávnění: ALL PRIVILEGES"
echo ""
echo "Nyní můžeš spustit main-start.sh pro test větev"
echo ""