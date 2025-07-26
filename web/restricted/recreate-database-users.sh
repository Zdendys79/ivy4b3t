#!/bin/bash

# =============================================================================
# REKREACE VŠECH DATABÁZOVÝCH UŽIVATELŮ S NOVÝMI HESLY
# =============================================================================
# Tento script odstraní všechny MariaDB uživatele (kromě root) a vytvoří nové
# s bezpečnými hesly vygenerovanými pomocí enhanced-password-generator.js
#
# POUŽITÍ:
# sudo ./recreate-database-users.sh
#
# POŽADAVKY:
# - MariaDB/MySQL server
# - Node.js (pro generátor hesel)
# - Root přístup k databázi
# =============================================================================

set -e  # Exit při jakékoliv chybě

# === KONFIGURACE ===
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
PASSWORD_GENERATOR="$PROJECT_ROOT/scripts/enhanced-password-generator.js"
LOG_FILE="$SCRIPT_DIR/user_recreation_$(date +%Y%m%d_%H%M%S).log"

# Barvy pro výstup
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# === FUNKCE ===

log_message() {
    local message="$1"
    echo -e "${BLUE}$(date '+%Y-%m-%d %H:%M:%S')${NC} $message"
    echo "$(date '+%Y-%m-%d %H:%M:%S') $message" >> "$LOG_FILE"
}

log_success() {
    local message="$1"
    echo -e "${GREEN}✅ $message${NC}"
    echo "SUCCESS: $message" >> "$LOG_FILE"
}

log_warning() {
    local message="$1"
    echo -e "${YELLOW}⚠️  $message${NC}"
    echo "WARNING: $message" >> "$LOG_FILE"
}

log_error() {
    local message="$1"
    echo -e "${RED}❌ $message${NC}" >&2
    echo "ERROR: $message" >> "$LOG_FILE"
}

generate_password() {
    if [ ! -f "$PASSWORD_GENERATOR" ]; then
        log_error "Generátor hesel nenalezen: $PASSWORD_GENERATOR"
        exit 1
    fi
    
    node "$PASSWORD_GENERATOR" 32 4
}

# === KONTROLY ===

log_message "🚀 Začíná rekreace databázových uživatelů"
log_message "📝 Log soubor: $LOG_FILE"

# Kontrola Node.js
if ! command -v node >/dev/null 2>&1; then
    log_error "Node.js není nainstalován!"
    exit 1
fi

# Kontrola MariaDB/MySQL
if ! command -v mysql >/dev/null 2>&1; then
    log_error "MySQL/MariaDB klient není nainstalován!"
    exit 1
fi

# Kontrola generátoru hesel
if [ ! -f "$PASSWORD_GENERATOR" ]; then
    log_error "Generátor hesel nenalezen: $PASSWORD_GENERATOR"
    exit 1
fi

log_success "Všechny požadované nástroje jsou dostupné"

# === PŘÍSTUPOVÉ ÚDAJE ===

echo -e "\n${YELLOW}🔐 NASTAVENÍ PŘÍSTUPU K DATABÁZI${NC}"
echo "=================================="

read -rp "MariaDB root uživatel [root]: " DB_ROOT_USER
DB_ROOT_USER=${DB_ROOT_USER:-root}

read -rsp "Heslo pro $DB_ROOT_USER: " DB_ROOT_PASS
echo

# Test připojení
if ! mysql -u "$DB_ROOT_USER" -p"$DB_ROOT_PASS" -e "SELECT 1;" >/dev/null 2>&1; then
    log_error "Nepodařilo se připojit k databázi s poskytnutými údaji!"
    exit 1
fi

log_success "Připojení k databázi úspěšné"

# === GENEROVÁNÍ HESEL ===

log_message "\n🔑 Generuji nová bezpečná hesla..."

CLAUDE_PASS=$(generate_password)
PHP_PASS=$(generate_password)
REMOTES_PASS=$(generate_password)
GOOGLE_SHEETS_PASS=$(generate_password)

log_success "Vygenerována 4 nová hesla (32 znaků, min. 4 speciální znaky)"


# === SMAZÁNÍ STÁVAJÍCÍCH UŽIVATELŮ ===

log_message "\n🗑️  Mažu všechny uživatele (kromě systémových)..."

# Získat seznam všech ne-systémových uživatelů
USER_LIST=$(mysql -u "$DB_ROOT_USER" -p"$DB_ROOT_PASS" -N -e "
SELECT CONCAT('''', user, '''@''', host, '''') 
FROM mysql.user 
WHERE user NOT IN ('root', '', 'mysql.sys', 'mysql.session', 'mysql.infoschema', 'mariadb.sys')
ORDER BY user, host;
")

if [ -n "$USER_LIST" ]; then
    while IFS= read -r user_host; do
        log_message "Mažu uživatele: $user_host"
        mysql -u "$DB_ROOT_USER" -p"$DB_ROOT_PASS" -e "DROP USER IF EXISTS $user_host;" || log_warning "Nepodařilo se smazat: $user_host"
    done <<< "$USER_LIST"
    log_success "Všichni uživatelé smazáni"
else
    log_warning "Žádní uživatelé k smazání nenalezeni"
fi

# === VYTVOŘENÍ NOVÝCH UŽIVATELŮ ===

log_message "\n👥 Vytvářím nové uživatele s vygenerovanými hesly..."

# SQL příkazy pro vytvoření uživatelů
mysql -u "$DB_ROOT_USER" -p"$DB_ROOT_PASS" <<EOF

-- =============================================
-- VYTVOŘENÍ NOVÝCH UŽIVATELŮ
-- =============================================

-- CLAUDE - lokální plný přístup
CREATE USER 'claude'@'localhost' IDENTIFIED BY '$CLAUDE_PASS';

-- PHP - lokální plný přístup
CREATE USER 'php'@'localhost' IDENTIFIED BY '$PHP_PASS';

-- REMOTES - vzdálený omezený přístup
CREATE USER 'remotes'@'%' IDENTIFIED BY '$REMOTES_PASS';

-- GOOGLE_SHEETS - vzdálený přístup k ivy databázím  
CREATE USER 'google_sheets'@'%' IDENTIFIED BY '$GOOGLE_SHEETS_PASS';

-- =============================================
-- NASTAVENÍ OPRÁVNĚNÍ
-- =============================================

-- CLAUDE - plný přístup ke všem databázím (kromě systémových)
GRANT ALL PRIVILEGES ON *.* TO 'claude'@'localhost' WITH GRANT OPTION;

-- PHP - plný přístup ke všem databázím (kromě systémových)  
GRANT ALL PRIVILEGES ON *.* TO 'php'@'localhost';

-- REMOTES - pouze ivy databáze
GRANT ALL PRIVILEGES ON ivy.* TO 'remotes'@'%';
GRANT ALL PRIVILEGES ON ivy_main.* TO 'remotes'@'%';

-- GOOGLE_SHEETS - pouze ivy databáze (stejná oprávnění jako remotes)
GRANT ALL PRIVILEGES ON ivy.* TO 'google_sheets'@'%';
GRANT ALL PRIVILEGES ON ivy_main.* TO 'google_sheets'@'%';

-- Aplikování změn
FLUSH PRIVILEGES;

EOF

log_success "Noví uživatelé vytvořeni a oprávnění nastavena"

# === OVĚŘENÍ ===

log_message "\n🔍 Ověřuji vytvořené uživatele..."

mysql -u "$DB_ROOT_USER" -p"$DB_ROOT_PASS" -e "
SELECT user, host, 
       CASE WHEN authentication_string = '' THEN 'NO PASSWORD' ELSE 'PASSWORD SET' END as Password_Status
FROM mysql.user 
WHERE user IN ('claude', 'php', 'remotes', 'google_sheets') 
ORDER BY user, host;
"

# === ZOBRAZENÍ HESEL (JEDNOU) ===

echo -e "\n${GREEN}🎉 REKREACE DOKONČENA ÚSPĚŠNĚ!${NC}"
echo "================================"

echo -e "\n${RED}🔐 ZOBRAZENÍ HESEL - JEDNOU A NAPOSLEDY!${NC}"
echo "========================================"
echo -e "${YELLOW}⚠️  HESLA SE ZOBRAZÍ POUZE NYNÍ - ULOŽTE SI JE MIMO PROJEKT!${NC}"
echo ""

echo -e "${YELLOW}📋 NOVÁ HESLA:${NC}"
echo "claude@localhost:      $CLAUDE_PASS"
echo "php@localhost:         $PHP_PASS"  
echo "remotes@%:             $REMOTES_PASS"
echo "google_sheets@%:       $GOOGLE_SHEETS_PASS"

echo -e "\n${YELLOW}🔧 ENVIRONMENT VARIABLES PRO VZDÁLENÉ STANICE:${NC}"
echo "export DB_USER=\"remotes\""
echo "export DB_PASS=\"$REMOTES_PASS\""

echo -e "\n${RED}⚠️  KRITICKÉ UPOZORNĚNÍ:${NC}"
echo "1. Hesla se NEUKLÁDAJÍ do žádných souborů"
echo "2. Po stisku klávesy se obrazovka SMAŽE"
echo "3. Hesla už se NIKDE nezobrazí"
echo "4. ULOŽTE SI JE NYNÍ do externí dokumentace!"

echo -e "\n${BLUE}Stiskni libovolnou klávesu pro pokračování...${NC}"
read -n 1 -s

# Smazání obrazovky
clear

# === VÝSLEDKY BEZ HESEL ===

echo -e "\n${GREEN}🎉 DATABÁZOVÍ UŽIVATELÉ ÚSPĚŠNĚ REKREOVÁNI${NC}"
echo "========================================"

echo -e "\n${BLUE}👥 VYTVOŘENÍ UŽIVATELÉ:${NC}"
echo "✅ claude@localhost      - Lokální plný přístup"
echo "✅ php@localhost         - Lokální plný přístup"  
echo "✅ remotes@%             - Vzdálený omezený přístup (pouze ivy databáze)"
echo "✅ google_sheets@%       - Vzdálený omezený přístup (pouze ivy databáze)"

echo -e "\n${BLUE}📁 SOUBORY:${NC}"
echo "Log:           $LOG_FILE"

echo -e "\n${YELLOW}🔧 DALŠÍ KROKY:${NC}"
echo "1. Aktualizujte environment variables na vzdálených stanicích"
echo "2. Otestujte připojení všech aplikací"
echo "3. Odstraňte staré přístupové údaje z konfigurací"

log_success "Script dokončen úspěšně - hesla zobrazena a smazána z obrazovky"