#!/bin/bash

# db_ivy_create.sh
# Umístění: ~/scripts/db_ivy_create.sh
#
# Popis: Kompletní skript pro vytvoření databáze Ivy4B3T včetně všech tabulek a dat.
#        Spouští postupně všechny potřebné SQL skripty pro nastavení databáze.

set -e # Ukončit při jakékoliv chybě

# Cesty k souborům
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
WEB_RESTRICTED="$PROJECT_ROOT/web/restricted"
IVY_SQL="$PROJECT_ROOT/ivy/sql"

# Kontrola existence důležitých souborů
REQUIRED_FILES=(
    "$WEB_RESTRICTED/ivy_create_full.sql"
    "$WEB_RESTRICTED/ivy_data_import.sql"
    "$WEB_RESTRICTED/ivy_data_scheme.sql"
    "$WEB_RESTRICTED/ivy_data_referers.sql"
    "$WEB_RESTRICTED/ivy_data_action_definitions.sql"
    "$IVY_SQL/sql_config.json"
)

echo "Kontrola existence potřebných souborů..."
for file in "${REQUIRED_FILES[@]}"; do
    if [[ ! -f "$file" ]]; then
        echo "CHYBA: Soubor neexistuje: $file"
        exit 1
    fi
done
echo "Všechny potřebné soubory nalezeny."

# Načtení databázové konfigurace
CONFIG_FILE="$IVY_SQL/sql_config.json"
if [[ ! -f "$CONFIG_FILE" ]]; then
    echo "CHYBA: Konfigurační soubor nenalezen: $CONFIG_FILE"
    echo "Vytvořte soubor podle vzoru sql_config_example.json"
    exit 1
fi

# Parsování JSON konfigurace pomocí jq
if ! command -v jq &>/dev/null; then
    echo "CHYBA: Balíček 'jq' není nainstalován."
    echo "Nainstalujte jej příkazem: sudo apt install jq"
    exit 1
fi

DB_HOST=$(jq -r '.host' "$CONFIG_FILE")
DB_USER=$(jq -r '.user' "$CONFIG_FILE")
DB_PASS=$(jq -r '.password' "$CONFIG_FILE")
DB_NAME=$(jq -r '.database' "$CONFIG_FILE")

# Validace konfigurace
if [[ -z "$DB_HOST" || -z "$DB_USER" || -z "$DB_PASS" || -z "$DB_NAME" ]]; then
    echo "CHYBA: Neplatná databázová konfigurace v $CONFIG_FILE"
    echo "Zkontrolujte hodnoty host, user, password a database"
    exit 1
fi

echo "Databázová konfigurace:"
echo "   Host: $DB_HOST"
echo "   User: $DB_USER"
echo "   Database: $DB_NAME"
echo ""

# Funkce pro spuštění SQL skriptu
run_sql_file() {
    local file_path="$1"
    local description="$2"

    echo "Spouštím: $description..."
    echo "   Soubor: $(basename "$file_path")"

    if mysql -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASS" <"$file_path"; then
        echo "Dokončeno: $description"
    else
        echo "CHYBA: $description selhalo!"
        exit 1
    fi
    echo ""
}

# Kontrola, zda databáze již existuje
echo "Kontrola existence databáze '$DB_NAME'..."
DB_EXISTS=$(mysql -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASS" -e "SHOW DATABASES LIKE '$DB_NAME';" | grep -c "$DB_NAME" || true)

if [[ "$DB_EXISTS" -gt 0 ]]; then
    echo "VAROVÁNÍ: Databáze '$DB_NAME' již existuje!"
    echo "Chcete ji zálohovat a smazat pro novou instalaci? [y/N]"
    read -r response

    if [[ "$response" =~ ^[yY]$ ]]; then
        # Vytvoření backup složky
        BACKUP_DIR="$WEB_RESTRICTED/backups"
        mkdir -p "$BACKUP_DIR"

        # Získání nejnovějšího version code z databáze
        echo "Získávám nejnovější version code..."
        VERSION_CODE=$(mysql -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASS" -D"$DB_NAME" -N -B -e "SELECT code FROM versions ORDER BY created DESC LIMIT 1;" 2>/dev/null || echo "unknown")

        if [[ -z "$VERSION_CODE" || "$VERSION_CODE" == "NULL" ]]; then
            VERSION_CODE="unknown_$(date +%Y%m%d_%H%M%S)"
        fi

        echo "Version code: $VERSION_CODE"

        # Názvy záložních souborů
        BACKUP_STRUCTURE="$BACKUP_DIR/backup_structure_${VERSION_CODE}.sql"
        BACKUP_DATA="$BACKUP_DIR/backup_data_${VERSION_CODE}.sql"

        echo "Zálohuji strukturu databáze..."
        if mysqldump -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASS" --no-data --skip-comments "$DB_NAME" >"$BACKUP_STRUCTURE"; then
            echo "Struktura zálohována: $(basename "$BACKUP_STRUCTURE")"
        else
            echo "CHYBA: Nepodařilo se zálohovat strukturu databáze!"
            exit 1
        fi

        echo "Zálohuji data databáze..."
        if mysqldump -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASS" --no-create-info --skip-comments "$DB_NAME" >"$BACKUP_DATA"; then
            echo "Data zálohována: $(basename "$BACKUP_DATA")"
        else
            echo "CHYBA: Nepodařilo se zálohovat data databáze!"
            exit 1
        fi

        # Mazání starých záloh (zachovat 3 poslední)
        echo "Odstraňuji staré zálohy (zachovávám 3 nejnovější)..."
        for TYPE in structure data; do
            FILES=($(ls -t "$BACKUP_DIR"/backup_${TYPE}_*.sql 2>/dev/null))
            if [[ ${#FILES[@]} -gt 3 ]]; then
                for FILE in "${FILES[@]:3}"; do
                    echo "Odstraňuji starou zálohu: $(basename "$FILE")"
                    rm -f "$FILE"
                done
            fi
        done

        echo "Mazání existující databáze..."
        mysql -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASS" -e "DROP DATABASE IF EXISTS $DB_NAME;"
        echo "Databáze smazána."
        echo ""
    else
        echo "Operace zrušena uživatelem."
        exit 1
    fi
fi

echo ""
echo "Zahajuji vytváření databáze Ivy4B3T..."
echo "================================================"
echo ""

# 1. Vytvoření databáze a tabulek
run_sql_file "$WEB_RESTRICTED/ivy_create_full.sql" "Vytváření databáze a tabulek"

# 2. Import dat z utiolite (volitelný)
echo "Chcete importovat data z databáze utiolite? [y/N]"
read -r import_response

if [[ "$import_response" =~ ^[yY]$ ]]; then
    # Kontrola existence databáze utiolite
    echo "Kontrola existence databáze 'utiolite'..."
    UTIOLITE_EXISTS=$(mysql -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASS" -e "SHOW DATABASES LIKE 'utiolite';" | grep -c "utiolite" || true)

    if [[ "$UTIOLITE_EXISTS" -gt 0 ]]; then
        run_sql_file "$WEB_RESTRICTED/ivy_data_import.sql" "Import dat z databáze utiolite"
    else
        echo "VAROVÁNÍ: Databáze 'utiolite' neexistuje - přeskakuji import."
        echo ""
    fi
else
    echo "Import dat z utiolite přeskočen."
    echo ""
fi

# 3. Vložení dat do scheme
run_sql_file "$WEB_RESTRICTED/ivy_data_scheme.sql" "Vkládání dat do tabulky scheme"

# 4. Vložení referers
run_sql_file "$WEB_RESTRICTED/ivy_data_referers.sql" "Vkládání výchozích referer URL"

# 5. Vložení definic akcí
run_sql_file "$WEB_RESTRICTED/ivy_data_action_definitions.sql" "Vkládání definic akcí"

# Finální kontrola
echo "Finální kontrola databáze..."
TABLE_COUNT=$(mysql -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASS" -D"$DB_NAME" -e "SHOW TABLES;" | wc -l)
echo "Počet vytvořených tabulek: $((TABLE_COUNT - 1))"

# Zobrazení základních statistik
echo ""
echo "Základní statistiky:"
echo "================================================"

STATS_QUERIES=(
    "SELECT COUNT(*) as 'Uživatelé (fb_users)' FROM fb_users;"
    "SELECT COUNT(*) as 'Skupiny (fb_groups)' FROM fb_groups;"
    "SELECT COUNT(*) as 'Citáty (quotes)' FROM quotes;"
    "SELECT COUNT(*) as 'Akce (action_definitions)' FROM action_definitions;"
    "SELECT COUNT(*) as 'Schéma (scheme)' FROM scheme;"
    "SELECT COUNT(*) as 'Referers' FROM referers;"
)

for query in "${STATS_QUERIES[@]}"; do
    mysql -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASS" -D"$DB_NAME" -e "$query" 2>/dev/null | tail -n +2 || echo "Chyba při dotazu: $query"
done

echo ""
echo "Databáze Ivy4B3T byla úspěšně vytvořena!"
echo "================================================"
echo ""
echo "Další kroky:"
echo "   1. Zkontrolujte připojení v aplikaci"
echo "   2. Spusťte ivy.js pro test funkcionality"
echo "   3. Přistupte k webovému dashboardu"
echo ""
echo "Skript dokončen úspěšně."
