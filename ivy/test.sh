#!/bin/bash

# test.sh
# Umístění: ~/ivy/test.sh
#
# Popis: Spuštění testovacího skriptu pro debug_incidents a logování.
#        Zajišťuje aktualizaci kódu z Git repozitáře před spuštěním testu.

clear

# ===========================================
# 📂 KONFIGURACE A INICIALIZACE
# ===========================================

# Import společného Git modulu
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GIT_COMMON_PATH="$SCRIPT_DIR/git-common.sh"

# Zkontroluj git-common.sh
if [[ ! -f "$GIT_COMMON_PATH" ]]; then
    echo "[TEST] ❌ CHYBA: git-common.sh nenalezen v $SCRIPT_DIR"
    echo "[TEST] Tento skript vyžaduje git-common.sh pro správnou funkci."
    exit 1
fi

# Načti git-common.sh
source "$GIT_COMMON_PATH"

# Výchozí konfigurace
REPO_DIR=${REPO_DIR:-~/git/ivy4b3t}
SOURCE_SUBFOLDER=${SOURCE_SUBFOLDER:-ivy}
TARGET_DIR=${TARGET_DIR:-~/ivy}

# Načti branch z config.json pokud existuje
if [[ -f "$TARGET_DIR/config.json" ]]; then
    BRANCH=${BRANCH:-$(jq -r .branch "$TARGET_DIR/config.json" 2>/dev/null || echo "main")}
else
    BRANCH=${BRANCH:-main}
fi

# ===========================================
# 🛡️ SIGNAL HANDLING
# ===========================================

# Graceful shutdown při Ctrl+C nebo SIGTERM
cleanup() {
    echo ""
    echo "[TEST] 🛑 Zachycen signal pro ukončení"
    echo "[TEST] 🧹 Ukončuji test.sh..."
    exit 0
}

trap cleanup SIGINT SIGTERM

# ===========================================
# 🚀 SPUŠTĚNÍ
# ===========================================

# Úvodní informace
echo "======================================================="
echo "🚀 IVY TEST SCRIPT (DEBUG INCIDENTS & LOGGING)"
echo "======================================================="
echo "📅 Datum: $(date '+%Y-%m-%d %H:%M:%S')"
echo "🖥️  Hostitel: $(hostname)"
echo "👤 Uživatel: $(whoami)"
echo "📂 Repozitář: $REPO_DIR"
echo "🎯 Cíl: $TARGET_DIR"
echo "🌿 Větev: $BRANCH"
echo "======================================================="

# Kontrola základních závislostí
for cmd in git node rsync jq; do
    if ! command -v "$cmd" &>/dev/null; then
        echo "[TEST] ❌ CHYBA: Požadovaný příkaz '$cmd' není nainstalován!"
        echo "[TEST] 💡 Pro instalaci použijte:"
        case "$cmd" in
            git) echo "[TEST]    sudo apt install git" ;;
            node) echo "[TEST]    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash && nvm install node" ;;
            rsync) echo "[TEST]    sudo apt install rsync" ;;
            jq) echo "[TEST]    sudo apt install jq" ;;
        esac
        exit 1
    fi
done

echo "[TEST] ✅ Všechny závislosti jsou k dispozici"
echo ""

# Zkontroluj funkce z git-common.sh
if ! command -v update_and_sync &>/dev/null; then
    echo "[TEST] ❌ CHYBA: Funkce update_and_sync není dostupná z git-common.sh!"
    exit 1
fi

if ! command -v get_git_info &>/dev/null; then
    echo "[TEST] ❌ CHYBA: Funkce get_git_info není dostupná z git-common.sh!"
    exit 1
fi

echo "[TEST] 🚀 Spouštím test..."
echo ""

# ===========================================
# 🔄 SELF-UPDATE MECHANISMUS
# ===========================================

# Kontrola, zda už proběhl restart
if [[ "$SCRIPT_RESTARTED" == "1" ]]; then
    echo "[TEST] ℹ️  Skript již byl restartován, pokračuji bez další aktualizace"
else
    # Před git pull - uloží hash aktuálního scriptu
    CURRENT_HASH=$(sha256sum "$0" | cut -d' ' -f1)
    echo "[TEST] 📊 Aktuální hash scriptu: ${CURRENT_HASH:0:8}..."
    
    # Git aktualizace a synchronizace souborů
    if ! update_and_sync "$REPO_DIR" "$SOURCE_SUBFOLDER" "$TARGET_DIR" "$BRANCH"; then
        echo "[TEST] ❌ Aktualizace souborů selhala!"
        exit 1
    fi
    
    # Po git pull - porovná hash
    NEW_HASH=$(sha256sum "$0" | cut -d' ' -f1)
    
    # Pokud se změnil → restart s označením
    if [[ "$CURRENT_HASH" != "$NEW_HASH" ]]; then
        echo "[TEST] 🔄 Skript byl aktualizován (nový hash: ${NEW_HASH:0:8}...), restartuji..."
        export SCRIPT_RESTARTED=1
        exec "$TARGET_DIR/test.sh" "$@"  # Restart z cílového adresáře
    else
        echo "[TEST] ✅ Skript je aktuální, pokračuji..."
    fi
fi

# Přejdi do cílového adresáře
cd "$TARGET_DIR" || {
    echo "[TEST] ❌ Nepodařilo se přejít do $TARGET_DIR"
    exit 1
}

# Zobraz informace o verzi
echo "[TEST] 📋 Informace o verzi:"
get_git_info "$REPO_DIR" | sed 's/^/[TEST]   /'

# Kontrola hlavního souboru
if [[ ! -f "test.js" ]]; then
    echo "[TEST] ❌ Hlavní soubor test.js nenalezen v $TARGET_DIR"
    exit 1
fi

echo "[TEST] 🎯 Spouštím testovací skript..."
echo "[TEST] 📂 Pracovní adresář: $(pwd)"
echo ""

# Spuštění testovacího skriptu
node test.js

exit_code=$?
echo ""
echo "[TEST] 🔄 Testovací skript ukončen s kódem: $exit_code"

# Analýza důvodu ukončení
case $exit_code in
    0)
        echo "[TEST] ✅ Test dokončen úspěšně"
        ;;
    99)
        echo "[TEST] 🛑 QUIT požadavek z interactive debuggeru"
        ;;
    130)
        echo "[TEST] 🛑 Ukončeno uživatelem (Ctrl+C)"
        ;;
    *)
        echo "[TEST] ❓ Test skončil s kódem: $exit_code"
        ;;
esac

exit $exit_code