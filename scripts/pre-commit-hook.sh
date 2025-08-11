#!/bin/bash
set -e

# Generuj 3-znakový kód z malých písmen (nesmí být stejný jako předchozí)
CURRENT_VERSION=$(node -e "
try {
  const pkg = JSON.parse(require('fs').readFileSync('ivy/package.json', 'utf8'));
  console.log(pkg.versionCode || '');
} catch(e) {
  console.log('');
}")

# Generuj nový kód dokud není jiný než současný
while true; do
  VERSION_CODE=$(node -e "
    const chars = 'abcdefghijklmnopqrstuvwxyz';
    let result = '';
    for (let i = 0; i < 3; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    console.log(result);
  ")
  if [ "$VERSION_CODE" != "$CURRENT_VERSION" ]; then
    break
  fi
done

echo "[PRE-COMMIT] Nová verze: $VERSION_CODE (předchozí: $CURRENT_VERSION)"

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
echo "[PRE-COMMIT] Scripts synchronizovány"

git add ivy/package.json