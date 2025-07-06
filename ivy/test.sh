#!/bin/bash

# test.sh
# Umístění: ~/ivy/test.sh
#
# Popis: Spuštění testovacího skriptu pro debug_incidents a logování.
#        Zkopírováno z start.sh a upraveno pro spuštění testu.

clear

# ===========================================
# 📂 KONFIGURACE A INICIALIZACE
# ===========================================

# Import společného Git modulu
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GIT_COMMON_PATH="$SCRIPT_DIR/git-common.sh"

# Zkus najít git-common.sh v aktuálním adresáři
if [[ -f "$GIT_COMMON_PATH" ]]; then
    source "$GIT_COMMON_PATH"
else
    echo "[START] VAROVÁNÍ: git-common.sh nenalezen v $SCRIPT_DIR, používám základní Git operace"
    USE_BASIC_GIT=true
fi

# Výchozí konfigurace (použije se pokud git-common.sh není dostupný)
REPO_DIR=${REPO_DIR:-~/git/ivy4b3t}
SOURCE_SUBFOLDER=${SOURCE_SUBFOLDER:-ivy}
TARGET_DIR=${TARGET_DIR:-~/ivy}

# Načti branch z config.json pokud existuje
if [[ -f "$TARGET_DIR/config.json" ]]; then
    BRANCH=${BRANCH:-$(jq -r .branch "$TARGET_DIR/config.json" 2>/dev/null || echo "main")}
else
    BRANCH=${BRANCH:-main}
fi

# Limity pro pokusy (pro testování je můžeme nastavit na 1)
MAX_RETRIES=1
TIME_WINDOW=60

# Pole pro uchovávání časů pokusů
declare -a attempt_times=()

# ===========================================
# 🔧 FALLBACK FUNKCE (pokud git-common.sh není dostupný)
# ===========================================

basic_update_git() {
    echo "[START] Aktualizuji Git repozitář..."
    if [[ ! -d "$REPO_DIR/.git" ]]; then
        echo "[START] CHYBA: $REPO_DIR není git repozitář!"
        return 1
    }

    cd "$REPO_DIR" || return 1
    git fetch origin "$BRANCH" || return 1
    git checkout "$BRANCH" || return 1
    git pull origin "$BRANCH" || return 1
    return 0
}

basic_sync_files() {
    echo "[START] Kopíruji $SOURCE_SUBFOLDER do $TARGET_DIR..."
    rsync -av --delete \
        --exclude node_modules \
        --exclude sql/sql_config.json \
        "$REPO_DIR/$SOURCE_SUBFOLDER/" "$TARGET_DIR/" || return 1
    return 0
}

# ===========================================
# 🔄 FUNKCE PRO SPRÁVU RESTARTŮ
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
        echo "[START] ❌ Překročen limit pokusů ($MAX_RETRIES za $TIME_WINDOW sekund)"
        echo "[START] Posledních ${#attempt_times[@]} pokusů:"
        for i in "${!attempt_times[@]}"; do
            local time_str=$(date -d "@${attempt_times[i]}" '+%H:%M:%S')
            echo "[START]   $((i + 1)). $time_str"
        done
        echo "[START] 🛑 Ukončuji skript z bezpečnostních důvodů"
        exit 1
    fi

    local remaining=$((MAX_RETRIES - ${#attempt_times[@]} + 1))
    if (( remaining <= 1 )); then
        echo "[START] ⚠️  VAROVÁNÍ: Zbývá pouze $remaining pokus před dosažením limitu!"
    else
        echo "[START] 📊 Pokus ${#attempt_times[@]}/$MAX_RETRIES (zbývá $remaining pokusů)"
    fi
}

# ===========================================
# 🔄 HLAVNÍ SMYČKA
# ===========================================

main_loop() {
    while true; do
        # Kontrola limitu restartů
        check_restart_limit

        echo ""
        echo "[START] 🚀 ===== NOVÝ CYKLUS ===== $(date '+%Y-%m-%d %H:%M:%S') ====="

        # Git aktualizace a synchronizace souborů
        if [[ "$USE_BASIC_GIT" == "true" ]]; then
            # Použij základní Git operace
            if ! basic_update_git || ! basic_sync_files; then
                echo "[START] ❌ Aktualizace souborů selhala!"
                sleep 5
                continue
            fi
        else
            # Použij pokročilé Git operace z modulu
            if command -v update_and_sync &>/dev/null; then
                if ! update_and_sync "$REPO_DIR" "$SOURCE_SUBFOLDER" "$TARGET_DIR" "$BRANCH"; then
                    echo "[START] ❌ Aktualizace souborů selhala!"
                    sleep 5
                    continue
                fi
            else
                echo "[START] VAROVÁNÍ: update_and_sync není dostupná, používám základní metodu"
                if ! basic_update_git || ! basic_sync_files; then
                    echo "[START] ❌ Aktualizace souborů selhala!"
                    sleep 5
                    continue
                fi
            fi
        fi

        # Přejdi do cílového adresáře
        cd "$TARGET_DIR" || {
            echo "[START] ❌ Nepodařilo se přejít do $TARGET_DIR"
            sleep 5
            continue
        }

        # Zobraz informace o verzi (pokud jsou dostupné)
        if command -v get_git_info &>/dev/null; then
            echo "[START] 📋 Informace o verzi:"
            get_git_info "$REPO_DIR" | sed 's/^/[START]   /'
        fi

        # Kontrola hlavního souboru
        if [[ ! -f "test.js" ]]; then
            echo "[START] ❌ Hlavní soubor test.js nenalezen v $TARGET_DIR"
            sleep 5
            continue
        fi

        echo "[START] 🎯 Spouštím testovací skript..."
        echo "[START] 📂 Pracovní adresář: $(pwd)"
        echo ""

        # Spuštění testovacího skriptu
        node test.js

        local exit_code=$?
        echo ""
        echo "[START] 🔄 Testovací skript ukončen s kódem: $exit_code"

        # Analýza důvodu ukončení
        case $exit_code in
            0)
                echo "[START] ✅ Normální ukončení testu"
                ;;
            99)
                echo "[START] 🛑 QUIT požadavek z interactive debuggeru"
                echo "[START] 👋 Ukončuji test.sh na požádání uživatele"
                exit 0
                ;;
            130)
                echo "[START] 🛑 Ukončeno uživatelem (Ctrl+C)"
                echo "[START] 👋 Ukončuji test.sh na požádání uživatele"
                exit 0
                ;;
            *)
                echo "[START] ❓ Neznámý exit kód: $exit_code"
                ;;
        esac

        echo "[START] ⏳ Čekám 5 sekund před dalším pokusem... (pro testování se nebude opakovat)"
        sleep 5
        exit 0 # Ukončí smyčku po prvním pokusu pro testování
    done
}

# ===========================================
# 🛡️ SIGNAL HANDLING
# ===========================================

# Graceful shutdown při Ctrl+C nebo SIGTERM
cleanup() {
    echo ""
    echo "[START] 🛑 Zachycen signal pro ukončení"
    echo "[START] 🧹 Ukončuji test.sh..."
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
echo "🔄 Limit pokusů: $MAX_RETRIES za $TIME_WINDOW sekund"
echo "🔧 Git modul: $([ "$USE_BASIC_GIT" == "true" ] && echo "základní" || echo "pokročilý")"
echo ""
echo "💡 Pro ukončení použijte Ctrl+C"
echo "======================================================="

# Kontrola základních závislostí
for cmd in git node rsync jq; do
    if ! command -v "$cmd" &>/dev/null; then
        echo "[START] ❌ CHYBA: Požadovaný příkaz '$cmd' není nainstalován!"
        echo "[START] 💡 Pro instalaci použijte:"
        case "$cmd" in
            git) echo "[START]    sudo apt install git" ;;
            node) echo "[START]    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash && nvm install node" ;;
            rsync) echo "[START]    sudo apt install rsync" ;;
            jq) echo "[START]    sudo apt install jq" ;;
        esac
        exit 1
    fi
done

echo "[START] ✅ Všechny závislosti jsou k dispozici"
echo ""

# Spuštění hlavní smyčky
main_loop
