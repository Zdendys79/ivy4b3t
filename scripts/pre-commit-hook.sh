#!/bin/bash
set -e

# Generuj git hash
VERSION_CODE=$(git rev-parse --short=7 HEAD)
echo "[PRE-COMMIT] Verze: $VERSION_CODE"

# Aktualizuj package.json
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('ivy/package.json', 'utf8'));
pkg.versionCode = '$VERSION_CODE';
fs.writeFileSync('ivy/package.json', JSON.stringify(pkg, null, 2));
"
echo "[PRE-COMMIT] Verze $VERSION_CODE zapsána do package.json"

# Zápis do databáze do tabulky variables - podle aktuální branch
CURRENT_BRANCH=$(git branch --show-current)
if [[ "$CURRENT_BRANCH" == "main" ]]; then
    TARGET_DB="${MYSQL_DATABASE}_test"
else
    TARGET_DB="$MYSQL_DATABASE"
fi

SQL="INSERT INTO variables (name, value) VALUES ('version', '$VERSION_CODE') ON DUPLICATE KEY UPDATE value = '$VERSION_CODE';"

mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" "$TARGET_DB" -e "$SQL"
echo "[PRE-COMMIT] Verze $VERSION_CODE zapsána do databáze $TARGET_DB"

# Synchronizace scripts složky
mkdir -p "/home/remotes/Sync/scripts"
rsync -av "/home/remotes/ivy4b3t/scripts/" "/home/remotes/Sync/scripts/"
setfacl -R -m u:www-data:rwX "/home/remotes/Sync/scripts"
setfacl -R -d -m u:www-data:rwX "/home/remotes/Sync/scripts"
echo "[PRE-COMMIT] Scripts synchronizovány"

git add ivy/package.json