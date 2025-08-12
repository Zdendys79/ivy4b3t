#!/bin/bash
# Soubor: ~/ivy4b3t/scripts/db_backup.sh
# Tento skript provádí zálohování databáze projektu Ivy4B3T.
# Vytvoří export struktury a dat databáze `ivy`, označí soubory verzí z tabulky `variables` (hodnota 'version'),
# zachová poslední 3 zálohy (starší smaže) a porovná aktuální strukturu s referenčním souborem `ivy_create_full.sql`.
# Rozdíly zapíše do log souboru `backup_diff_{versionCode}.log`.
# Přihlašovací údaje k DB jsou načítány ze systémových proměnných DB_USER a DB_PASS
# Zálohy jsou ukládány do: ~/ivy4b3t/web/restricted/backups

# Dynamické určení cest na základě umístění skriptu
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$PROJECT_ROOT/web/restricted/backups"
SQL_TEMPLATE="$PROJECT_ROOT/web/restricted/ivy_create_full.sql"

mkdir -p "$BACKUP_DIR"

# Použij systémové proměnné pro databázové připojení (localhost only)
DB_HOST="localhost"
DB_USER="$DB_USER"
DB_PASS="$DB_PASS"
DB_NAME="ivy"

if [ -z "$DB_USER" ] || [ -z "$DB_PASS" ]; then
  echo "[ERROR] Systémové proměnné DB_USER nebo DB_PASS nejsou nastaveny."
  echo "[INFO] Tyto proměnné jsou potřeba pro přístup k databázi."
  exit 1
fi

# Načti versionCode z DB
VERSION_CODE=$(mysql -u"$DB_USER" -p"$DB_PASS" -h"$DB_HOST" -D"$DB_NAME" -N -B -e "SELECT value FROM variables WHERE name = 'version';")
if [ -z "$VERSION_CODE" ]; then
  echo "[ERROR] Nepodařilo se načíst versionCode z databáze."
  exit 1
fi

echo "[INFO] Exportuji zálohu verze: $VERSION_CODE"
echo "[INFO] Backup dir: $BACKUP_DIR"
echo "[INFO] SQL template: $SQL_TEMPLATE"
echo "[INFO] Database: $DB_USER@$DB_HOST/$DB_NAME"

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
