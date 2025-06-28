#!/bin/bash
# Soubor: ~/Sync/scripts/db_backup.sh
# Tento skript provádí zálohování databáze projektu Ivy4B3T.
# Vytvoří export struktury a dat databáze `ivy`, označí soubory verzí z tabulky `ivy.versions` (sloupec code),
# zachová poslední 3 zálohy (starší smaže) a porovná aktuální strukturu s referenčním souborem `ivy_create_full.sql`.
# Rozdíly zapíše do log souboru `backup_diff_{versionCode}.log`.
# Přihlašovací údaje k DB jsou načítány z JSON souboru: /var/www/metaboost.tech/ivy/restricted/db_config.json
# Zálohy jsou ukládány do: /var/www/metaboost.tech/ivy/restricted/backups

# Cesty
BACKUP_DIR="/var/www/b3.web/ivy/restricted/backups"
SQL_TEMPLATE="/var/www/b3.web/ivy/restricted/ivy_create_full.sql"
DB_CONFIG="/var/www/b3.web/ivy/restricted/sql_config.json"

mkdir -p "$BACKUP_DIR"

# Načti přihlašovací údaje z db_config.json
if [ ! -f "$DB_CONFIG" ]; then
  echo "[ERROR] Soubor db_config.json nenalezen: $DB_CONFIG"
  exit 1
fi

DB_HOST=$(jq -r '.host' "$DB_CONFIG")
DB_USER=$(jq -r '.user' "$DB_CONFIG")
DB_PASS=$(jq -r '.password' "$DB_CONFIG")
DB_NAME=$(jq -r '.database' "$DB_CONFIG")

if [ -z "$DB_HOST" ] || [ -z "$DB_USER" ] || [ -z "$DB_PASS" ] || [ -z "$DB_NAME" ]; then
  echo "[ERROR] Nepodařilo se načíst přihlašovací údaje z db_config.json."
  exit 1
fi

# Načti versionCode z DB
VERSION_CODE=$(mysql -u"$DB_USER" -p"$DB_PASS" -h"$DB_HOST" -D"$DB_NAME" -N -B -e "SELECT code FROM versions ORDER BY created DESC LIMIT 1;")
if [ -z "$VERSION_CODE" ]; then
  echo "[ERROR] Nepodařilo se načíst versionCode z databáze."
  exit 1
fi

echo "[INFO] Exportuji zálohu verze: $VERSION_CODE"

# Export struktury
STRUCT_FILE="$BACKUP_DIR/backup_structure_${VERSION_CODE}.sql"
mysqldump -u"$DB_USER" -p"$DB_PASS" -h"$DB_HOST" --no-data --skip-comments "$DB_NAME" > "$STRUCT_FILE"

# Export dat
DATA_FILE="$BACKUP_DIR/backup_data_${VERSION_CODE}.sql"
mysqldump -u"$DB_USER" -p"$DB_PASS" -h"$DB_HOST" --no-create-info --skip-comments "$DB_NAME" > "$DATA_FILE"

# Mazání starých záloh (zachovat 3 poslední)
for TYPE in structure data; do
  FILES=($(ls -t $BACKUP_DIR/backup_${TYPE}_*.sql 2>/dev/null))
  if [ ${#FILES[@]} -gt 3 ]; then
    for FILE in "${FILES[@]:3}"; do
      echo "[INFO] Mažu starou zálohu: $FILE"
      rm -f "$FILE"
    done
  fi
done

# Porovnání s ivy_create_full.sql
DIFF_FILE="$BACKUP_DIR/backup_diff_${VERSION_CODE}.log"
echo "[INFO] Kontroluji rozdíly s $SQL_TEMPLATE"
diff -u "$SQL_TEMPLATE" "$STRUCT_FILE" > "$DIFF_FILE"

if [ -s "$DIFF_FILE" ]; then
  echo "[WARNING] Rozdíly nalezeny! Zapsáno do $DIFF_FILE"
else
  echo "[INFO] Žádné rozdíly nebyly nalezeny."
  rm -f "$DIFF_FILE"
fi

echo "[INFO] Záloha dokončena."
