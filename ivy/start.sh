#!/bin/bash

# start.sh
# Umístění: ~/ivy/start.sh
# Účel: Spuštění Ivy klienta s limitem maximálně 3 restartů během 60 sekund.

# Cesty a konfigurace
REPO_DIR=~/git/ivy4b3t         # Git repozitář
SOURCE_SUBFOLDER=ivy           # Podsložka v repozitáři
TARGET_DIR=~/ivy               # Kam kopírovat ivy
BRANCH=main                    # Větev

# Limity pro pokusy
MAX_RETRIES=3
TIME_WINDOW=60

# Pole pro uchovávání časů pokusů
declare -a attempt_times=()

while true
do
    # Aktuální čas (sekundy od epochy)
    current_time=$(date +%s)

    # Odstraň pokusy starší než TIME_WINDOW
    attempt_times=("${attempt_times[@]/#/$current_time }")
    attempt_times=($(for t in "${attempt_times[@]}"; do
        if (( current_time - t < TIME_WINDOW )); then
            echo "$t"
        fi
    done))

    # Přidej nový pokus
    attempt_times+=("$current_time")

    # Zkontroluj limit
    if (( ${#attempt_times[@]} > MAX_RETRIES )); then
        echo "[START] Překročen limit pokusů ($MAX_RETRIES za $TIME_WINDOW sekund). Ukončuji skript."
        exit 1
    fi

    echo "[START] Aktualizuji Git repozitář..."
    if [ ! -d "$REPO_DIR/.git" ]; then
        echo "Chyba: $REPO_DIR není git repozitář!"
        exit 1
    fi

    cd "$REPO_DIR" || exit 1
    git fetch origin "$BRANCH"
    git checkout "$BRANCH"
    git pull origin "$BRANCH"

    echo "[START] Kopíruji $SOURCE_SUBFOLDER do $TARGET_DIR..."
    rsync -av --delete \
        --exclude node_modules \
        --exclude sql/sql_config.json \
        "$REPO_DIR/$SOURCE_SUBFOLDER/" "$TARGET_DIR/"

    echo "[START] Spouštím robota..."
    cd "$TARGET_DIR" || exit 1
    # export DEBUG="puppeteer:*" # pouze pro rozsáhlý debuging
    node ivy.js

    sleep 5
done
