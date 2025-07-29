#!/bin/bash

# main-start.sh
# Umístění: ~/ivy/main-start.sh
#
# Popis: Spuštění Ivy klienta VŽDY v GIT větvi "main".
#        Ignoruje nastavení branch v config.json a vždy používá main branch.

# spuštění na Ubuntu pomocí:
# cd ~/ivy && chmod +x main-start.sh && ./main-start.sh

clear

# ===========================================
# KONFIGURACE A INICIALIZACE
# ===========================================

# Import společného Git modulu
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GIT_COMMON_PATH="$SCRIPT_DIR/git-common.sh"

# Zkontroluj git-common.sh
if [[ ! -f "$GIT_COMMON_PATH" ]]; then
    echo "[START] CHYBA: git-common.sh nenalezen v $SCRIPT_DIR"
    echo "[START] Tento skript vyžaduje git-common.sh pro správnou funkci."
    exit 1
fi

# Načti git-common.sh
source "$GIT_COMMON_PATH"

# Výchozí konfigurace
REPO_DIR=${REPO_DIR:-~/git/ivy4b3t}
SOURCE_SUBFOLDER=${SOURCE_SUBFOLDER:-ivy}
TARGET_DIR=${TARGET_DIR:-~/ivy}

# Vždy použij branch "main" - ignoruj config.json
BRANCH="main"

# Konfigurace pro časové omezení mezi spuštěními
TIME_WINDOW=60  # sekund
LAST_START_FILE="$TARGET_DIR/.last_start_time"



# ===========================================
# HLAVNÍ FUNKCE
# ===========================================

# Funkce pro kontrolu času posledního spuštění (zabránění častému spouštění)
check_restart_limit() {
    local current_time=$(date +%s)
    
    # Zkontroluj čas posledního spuštění
    if [[ -f "$LAST_START_FILE" ]]; then
        local last_start_time=$(cat "$LAST_START_FILE" 2>/dev/null || echo "0")
        local time_diff=$((current_time - last_start_time))
        
        if (( time_diff < TIME_WINDOW )); then
            local remaining_time=$((TIME_WINDOW - time_diff))
            echo "[START] Od posledního spuštění uplynulo pouze ${time_diff}s"
            echo "[START] Minimální interval je ${TIME_WINDOW}s, zbývá ${remaining_time}s"
            echo "[START] Poslední spuštění: $(date -d "@$last_start_time" '+%Y-%m-%d %H:%M:%S')"
            echo "[START] Čekám ${remaining_time} sekund do dalšího povoleného spuštění..."
            
            # Čekání na přesný zbývající čas
            sleep $remaining_time
            
            # Aktualizuj čas po čekání
            current_time=$(date +%s)
        fi
    fi
    
    # Zapiš čas aktuálního spuštění
    echo "$current_time" > "$LAST_START_FILE"
    
    echo "[START] Časová kontrola OK - spouštím aplikaci"
}

run_ivy() {
    echo "[START] ===== SPUŠTĚNÍ ===== $(date '+%Y-%m-%d %H:%M:%S') ====="
    
    # Kontrola času posledního spuštění (zabránění častému spouštění)
    check_restart_limit

        # ===========================================
        # SELF-UPDATE MECHANISMUS
        # ===========================================
        
        # Kontrola, zda už proběhl restart
        if [[ "$SCRIPT_RESTARTED" == "1" ]]; then
            echo "[START] Skript již byl restartován, pouze synchronizuji soubory"
            # Pouze synchronizace souborů bez Git aktualizace
            if ! sync_files "$REPO_DIR" "$SOURCE_SUBFOLDER" "$TARGET_DIR"; then
                echo "[START] Synchronizace souborů selhala!"
                exit 1
            fi
            
            # Obnov execute permissions na skripty
            chmod +x "$TARGET_DIR"/*.sh 2>/dev/null || true
        else
            # Před git pull - uloží hash aktuálního scriptu
            CURRENT_HASH=$(sha256sum "$0" | cut -d' ' -f1)
            echo "[START] Aktuální hash scriptu: ${CURRENT_HASH:0:8}..."
            
            # Git aktualizace a synchronizace souborů
            if ! update_and_sync "$REPO_DIR" "$SOURCE_SUBFOLDER" "$TARGET_DIR" "$BRANCH"; then
                echo "[START] Aktualizace souborů selhala!"
                exit 1
            fi
            
            # Obnov execute permissions na skripty
            chmod +x "$TARGET_DIR"/*.sh 2>/dev/null || true
            
            # Po git pull - porovná hash
            NEW_HASH=$(sha256sum "$0" | cut -d' ' -f1)
            
            # Pokud se změnil → restart s označením
            if [[ "$CURRENT_HASH" != "$NEW_HASH" ]]; then
                echo "[START] Skript byl aktualizován (nový hash: ${NEW_HASH:0:8}...), restartuji..."
                export SCRIPT_RESTARTED=1
                exec "$TARGET_DIR/main-start.sh" "$@"  # Restart z cílového adresáře
            else
                echo "[START] Skript je aktuální, pokračuji..."
            fi
        fi

        # Přejdi do cílového adresáře
        cd "$TARGET_DIR" || {
            echo "[START] Nepodařilo se přejít do $TARGET_DIR"
            exit 1
        }

        # Zobraz informace o verzi
        echo "[START] Informace o verzi:"
        get_git_info "$REPO_DIR" | sed 's/^/[START]   /'

        # Kontrola hlavního souboru
        if [[ ! -f "ivy.js" ]]; then
            echo "[START] Hlavní soubor ivy.js nenalezen v $TARGET_DIR"
            exit 1
        fi

        echo "[START] Spouštím robota..."
        echo "[START] Pracovní adresář: $(pwd)"


        # Spuštění aplikace
        # export DEBUG="puppeteer:*"  # pouze pro rozsáhlý debugging
        export IVY_GIT_BRANCH="main"
        node --trace-warnings ivy.js

        local exit_code=$?
        echo "[START] Robot ukončen s kódem: $exit_code"

        # Analýza důvodu ukončení
        case $exit_code in
            0)
                echo "[START] Normální ukončení"
                ;;
            1)
                echo "[START] Obecná chyba nebo neočekávané ukončení"
                ;;
            99)
                echo "[START] QUIT požadavek z interactive debuggeru"
                echo "[START] Ukončuji start.sh na požádání uživatele"
                exit 0
                ;;
            130)
                echo "[START] Ukončeno uživatelem (Ctrl+C)"
                echo "[START] Ukončuji start.sh na požádání uživatele"
                exit 0
                ;;
            *)
                echo "[START] Neznámý exit kód: $exit_code"
                ;;
        esac
        
        exit $exit_code
}

# ===========================================
# SIGNAL HANDLING
# ===========================================

# Graceful shutdown při Ctrl+C nebo SIGTERM
cleanup() {
    echo ""
    echo "[START] Zachycen signal pro ukončení"
    echo "[START] Ukončuji start.sh..."
    exit 0
}

trap cleanup SIGINT SIGTERM

# ===========================================
# SPUŠTĚNÍ
# ===========================================

# Úvodní informace
echo "======================================================"
echo "IVY MAIN-START SCRIPT (MAIN BRANCH ONLY)"
echo "======================================================"
echo "Datum: $(date '+%Y-%m-%d %H:%M:%S')"
echo " Hostitel: $(hostname)"
echo "Uživatel: $(whoami)"
echo "Repozitář: $REPO_DIR"
echo "Cíl: $TARGET_DIR"
echo "Větev: $BRANCH"
echo "======================================================"

# Kontrola základních závislostí
for cmd in git node rsync jq; do
    if ! command -v "$cmd" &>/dev/null; then
        echo "[START] CHYBA: Požadovaný příkaz '$cmd' není nainstalován!"
        echo "[START] Pro instalaci použijte:"
        case "$cmd" in
            git) echo "[START]    sudo apt install git" ;;
            node) echo "[START]    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash && nvm install node" ;;
            rsync) echo "[START]    sudo apt install rsync" ;;
            jq) echo "[START]    sudo apt install jq" ;;
        esac
        exit 1
    fi
done

echo "[START] Všechny závislosti jsou k dispozici"

# Zkontroluj funkce z git-common.sh
if ! command -v update_and_sync &>/dev/null; then
    echo "[START] CHYBA: Funkce update_and_sync není dostupná z git-common.sh!"
    exit 1
fi

if ! command -v get_git_info &>/dev/null; then
    echo "[START] CHYBA: Funkce get_git_info není dostupná z git-common.sh!"
    exit 1
fi

# Spuštění aplikace
run_ivy
