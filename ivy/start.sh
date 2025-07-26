#!/bin/bash

# start.sh
# Umístění: ~/ivy/start.sh
#
# Popis: Spuštění Ivy klienta s limitem maximálně 3 restartů během 60 sekund.
#        Aktualizováno pro použití společného modulu git-common.sh.

# spuštění na Ubuntu pomocí:
# cd ~/ivy && chmod +x start.sh && ./start.sh

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

# Vždy použij branch "production"
BRANCH="production"

# Limity pro pokusy
MAX_RETRIES=3
TIME_WINDOW=60

# Pole pro uchovávání časů pokusů
declare -a attempt_times=()

# ===========================================
# FUNKCE PRO SPRÁVU RESTARTŮ
# ===========================================

# Přidá nový pokus do seznamu a zkontroluje limit
check_restart_limit() {
    local current_time=$(date +%s)

    # Odstraň pokusy starší než TIME_WINDOW
    local filtered_times=()
    for time in "${attempt_times[@]}"; do
        if (( current_time - time < TIME_WINDOW )); then
            filtered_times+=("$time")
        fi
    done
    attempt_times=("${filtered_times[@]}")

    # Přidej nový pokus
    attempt_times+=("$current_time")

    # Zkontroluj limit
    if (( ${#attempt_times[@]} > MAX_RETRIES )); then
        echo "[START] Překročen limit pokusů ($MAX_RETRIES za $TIME_WINDOW sekund)"
        echo "[START] Posledních ${#attempt_times[@]} pokusů:"
        for i in "${!attempt_times[@]}"; do
            local time_str=$(date -d "@${attempt_times[i]}" '+%H:%M:%S')
            echo "[START]   $((i + 1)). $time_str"
        done
        echo "[START] Ukončuji skript z bezpečnostních důvodů"
        exit 1
    fi

    local remaining=$((MAX_RETRIES - ${#attempt_times[@]} + 1))
    if (( remaining <= 1 )); then
        echo "[START] VAROVÁNÍ: Zbývá pouze $remaining pokus před dosažením limitu!"
    else
        echo "[START] Pokus ${#attempt_times[@]}/$MAX_RETRIES (zbývá $remaining pokusů)"
    fi
}

# ===========================================
# HLAVNÍ SMYČKA
# ===========================================

main_loop() {
    while true; do
        # Kontrola limitu restartů
        check_restart_limit

        echo ""
        echo "[START] ===== NOVÝ CYKLUS ===== $(date '+%Y-%m-%d %H:%M:%S') ====="

        # ===========================================
        # SELF-UPDATE MECHANISMUS
        # ===========================================
        
        # Kontrola, zda už proběhl restart
        if [[ "$SCRIPT_RESTARTED" == "1" ]]; then
            echo "[START] Skript již byl restartován, pokračuji bez další aktualizace"
            # Pouze synchronizace souborů bez self-update kontroly
            if ! update_and_sync "$REPO_DIR" "$SOURCE_SUBFOLDER" "$TARGET_DIR" "$BRANCH"; then
                echo "[START] Aktualizace souborů selhala!"
                sleep 5
                continue
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
                sleep 5
                continue
            fi
            
            # Obnov execute permissions na skripty
            chmod +x "$TARGET_DIR"/*.sh 2>/dev/null || true
            
            # Po git pull - porovná hash
            NEW_HASH=$(sha256sum "$0" | cut -d' ' -f1)
            
            # Pokud se změnil → restart s označením
            if [[ "$CURRENT_HASH" != "$NEW_HASH" ]]; then
                echo "[START] Skript byl aktualizován (nový hash: ${NEW_HASH:0:8}...), restartuji..."
                export SCRIPT_RESTARTED=1
                exec "$TARGET_DIR/start.sh" "$@"  # Restart z cílového adresáře
            else
                echo "[START] Skript je aktuální, pokračuji..."
            fi
        fi

        # Přejdi do cílového adresáře
        cd "$TARGET_DIR" || {
            echo "[START] Nepodařilo se přejít do $TARGET_DIR"
            sleep 5
            continue
        }

        # Zobraz informace o verzi
        echo "[START] Informace o verzi:"
        get_git_info "$REPO_DIR" | sed 's/^/[START]   /'

        # Kontrola hlavního souboru
        if [[ ! -f "ivy.js" ]]; then
            echo "[START] Hlavní soubor ivy.js nenalezen v $TARGET_DIR"
            sleep 5
            continue
        fi

        echo "[START] Spouštím robota..."
        echo "[START] Pracovní adresář: $(pwd)"
        echo ""

        # Systémový log pro restart (pokud to není první pokus)
        current_attempt=${#attempt_times[@]}
        if [ $current_attempt -gt 1 ]; then
            node -e "
                import { QueryBuilder } from './iv_querybuilder.class.js';
                import { get as getVersion } from './iv_version.js';
                const db = new QueryBuilder();
                const version = getVersion();
                db.logSystemEvent(
                    'RESTART',
                    'WARN',
                    'Ivy client restarted by start.sh',
                    { 
                        attempt: $current_attempt, 
                        max_attempts: $MAX_RETRIES,
                        version: version,
                        git_pull: true,
                        restart_reason: 'automatic'
                    }
                ).catch(err => console.error('System log error:', err.message));
            " 2>/dev/null || true
        fi

        # Spuštění aplikace
        # export DEBUG="puppeteer:*"  # pouze pro rozsáhlý debugging
        export IVY_GIT_BRANCH="production"
        node --trace-warnings ivy.js

        local exit_code=$?
        echo ""
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

        echo "[START] Čekám 15 sekund před dalším pokusem..."
        sleep 15
    done
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
echo "IVY START SCRIPT"
echo "======================================================"
echo "Datum: $(date '+%Y-%m-%d %H:%M:%S')"
echo "Hostitel: $(hostname)"
echo "Uživatel: $(whoami)"
echo "Repozitář: $REPO_DIR"
echo "Cíl: $TARGET_DIR"
echo "Větev: $BRANCH"
echo "Limit restartů: $MAX_RETRIES za $TIME_WINDOW sekund"
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
echo ""

# Zkontroluj funkce z git-common.sh
if ! command -v update_and_sync &>/dev/null; then
    echo "[START] CHYBA: Funkce update_and_sync není dostupná z git-common.sh!"
    exit 1
fi

if ! command -v get_git_info &>/dev/null; then
    echo "[START] CHYBA: Funkce get_git_info není dostupná z git-common.sh!"
    exit 1
fi

echo "[START] Git modul načten úspěšně"
echo "[START] Pro ukončení použijte Ctrl+C"
echo ""

# Spuštění hlavní smyčky
main_loop
