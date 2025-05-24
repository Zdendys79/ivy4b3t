#!/bin/bash

# Cesty a konfigurace
REPO_DIR=~/git/ivy4b3t         # Git repozitář
SOURCE_SUBFOLDER=ivy           # Podsložka v repozitáři
TARGET_DIR=~/ivy               # Kam kopírovat ivy
BRANCH=main                    # Větev

while true
do
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
        --exclude sql/_sql.json \
        "$REPO_DIR/$SOURCE_SUBFOLDER/" "$TARGET_DIR/"

    echo "[START] Spouštím robota..."
    cd "$TARGET_DIR" || exit 1
    node ivy.js

    sleep 5
done
