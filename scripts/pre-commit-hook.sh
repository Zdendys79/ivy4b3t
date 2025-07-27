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
echo "[PRE-COMMIT] ✅ Verze $VERSION_CODE zapsána do package.json"

# Zápis do databáze do tabulky variables
SQL="INSERT INTO variables (name, value) VALUES ('version', '$VERSION_CODE') ON DUPLICATE KEY UPDATE value = '$VERSION_CODE';"

mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "$SQL"
echo "[PRE-COMMIT] ✅ Verze $VERSION_CODE zapsána do databáze"

# Synchronizace scripts složky
mkdir -p "/home/remotes/Sync/scripts"
rsync -av "/home/remotes/ivy4b3t/scripts/" "/home/remotes/Sync/scripts/"
chown -R remotes:remotes "/home/remotes/Sync/scripts"
setfacl -R -m u:www-data:rwX "/home/remotes/Sync/scripts"
setfacl -R -d -m u:www-data:rwX "/home/remotes/Sync/scripts"
echo "[PRE-COMMIT] ✅ Scripts synchronizovány"

git add ivy/package.json