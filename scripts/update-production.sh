#!/bin/bash
# Skript pro aktualizaci production větve z main větve
# Automaticky se přepne na production, provede merge, aktualizuje verzi v DB, push a vrátí se na main

echo "=== Update Production Branch Script ==="

# Uloží aktuální větev
CURRENT_BRANCH=$(git branch --show-current)
echo "[INFO] Aktuální větev: $CURRENT_BRANCH"

# Přepne na production větev
echo "[INFO] Přepínám na production větev..."
git checkout production
if [ $? -ne 0 ]; then
    echo "[ERROR] Nepodařilo se přepnout na production větev!"
    exit 1
fi

# Provede merge z main větve
echo "[INFO] Provádím merge z main větve..."
git merge main --no-edit
if [ $? -ne 0 ]; then
    echo "[ERROR] Merge z main selhál!"
    git checkout $CURRENT_BRANCH
    exit 1
fi

# Aktualizuj verzi v produkční databázi
echo "[INFO] Aktualizuji verzi v produkční databázi..."
cd /home/remotes/ivy4b3t/ivy

# Získej verzi z package.json
VERSION_CODE=$(node -e "console.log(require('./package.json').versionCode || 'unknown')")
echo "[INFO] Verze z package.json: $VERSION_CODE"

# Zápis do produkční databáze
SQL="INSERT INTO variables (name, value) VALUES ('version', '$VERSION_CODE') ON DUPLICATE KEY UPDATE value = '$VERSION_CODE';"
mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" "ivy" -e "$SQL"

if [ $? -eq 0 ]; then
    echo "[SUCCESS] Verze $VERSION_CODE zapsána do produkční databáze ivy"
else
    echo "[WARNING] Nepodařilo se zapsat verzi do databáze"
fi

cd /home/remotes/ivy4b3t

# Push do remote production
echo "[INFO] Pushuju production větev na GitHub..."
git push origin production
if [ $? -ne 0 ]; then
    echo "[ERROR] Push production větve selhal!"
    git checkout $CURRENT_BRANCH
    exit 1
fi

# Vrátí se na původní větev
echo "[INFO] Vracím se na původní větev: $CURRENT_BRANCH"
git checkout $CURRENT_BRANCH
if [ $? -ne 0 ]; then
    echo "[WARNING] Nepodařilo se vrátit na původní větev $CURRENT_BRANCH!"
fi

echo "[SUCCESS] Production větev byla úspěšně aktualizována včetně verze v databázi!"
echo "=== Script completed ==="