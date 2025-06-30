#!/bin/bash
# install_ivy.sh – Instalační skript pro inicializaci databáze Ivy
# Umístění: /var/www/b3.web/ivy/restricted/
# Spuštění: sudo ./install_ivy.sh

# Načtení přihlašovacích údajů z db_config.json
CONFIG_FILE="db_config.json"
DB_HOST=$(jq -r .host "$CONFIG_FILE")
DB_NAME=$(jq -r .dbname "$CONFIG_FILE")

# Načtení hesla pro MySQL root účet
echo -n "Zadejte heslo pro MySQL uživatele 'root': "
read -s ROOT_PASS
echo

# Přepnutí do adresáře skriptu
cd "$(dirname "$0")"

# Zálohování databáze
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${DB_NAME}_backup_${TIMESTAMP}.sql"
echo "💾 Zálohuji databázi '$DB_NAME' do souboru: $BACKUP_FILE"
mysqldump -u root -p"$ROOT_PASS" -h "$DB_HOST" "$DB_NAME" > "$BACKUP_FILE" 2>/dev/null

if [ ! -s "$BACKUP_FILE" ]; then
  echo "❌ Záloha selhala – soubor '$BACKUP_FILE' je prázdný. Instalace přerušena."
  exit 1
fi

# Kontrola existence databáze
EXISTS=$(mariadb -u root -p"$ROOT_PASS" -h "$DB_HOST" -e "SHOW DATABASES LIKE '$DB_NAME';" | grep "$DB_NAME")
if [ "$EXISTS" ]; then
  echo "🧹 Odstraňuji všechny tabulky z databáze '$DB_NAME'"
  TABLES=$(mariadb -u root -p"$ROOT_PASS" -h "$DB_HOST" -N -B -e "SELECT table_name FROM information_schema.tables WHERE table_schema='$DB_NAME';")
  for table in $TABLES; do
    echo "  - DROP TABLE \`$table\`;"
    mariadb -u root -p"$ROOT_PASS" -h "$DB_HOST" -e "DROP TABLE \`$DB_NAME\`.\`$table\`;"
  done
fi

# Spuštění skriptu pro vytvoření struktury
echo "📦 Vytvářím databázovou strukturu: ivy_create_full.sql"
mariadb -u root -p"$ROOT_PASS" -h "$DB_HOST" < "ivy_create_full.sql"
if [ $? -ne 0 ]; then
  echo "❌ Chyba při vytváření struktury databáze."
  exit 1
fi

# Spuštění skriptu pro import dat
echo "🧩 Importuji výchozí data: ivy_data_full.sql"
mariadb -u root -p"$ROOT_PASS" -h "$DB_HOST" "$DB_NAME" < "ivy_data_full.sql"
if [ $? -ne 0 ]; then
  echo "❌ Chyba při importu dat."
  exit 1
fi

# Přidání oprávnění pro účty
USERS=("B3.remotes" "Zdendys79" "google_sheets" "JakVe" "php_user")
for user in "${USERS[@]}"; do
  echo "👤 Nastavuji oprávnění pro uživatele: $user"
  mariadb -u root -p"$ROOT_PASS" -h "$DB_HOST" -e "CREATE USER IF NOT EXISTS '$user'@'%' IDENTIFIED BY 'tajneheslo';"
  mariadb -u root -p"$ROOT_PASS" -h "$DB_HOST" -e "GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '$user'@'%' WITH GRANT OPTION;"
done

mariadb -u root -p"$ROOT_PASS" -h "$DB_HOST" -e "FLUSH PRIVILEGES;"
echo "✅ Instalace databáze '$DB_NAME' a nastavení práv dokončeno."
exit 0
