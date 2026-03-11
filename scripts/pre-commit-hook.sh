#!/bin/bash
set -e

# Pre-commit hook: generuje nový 3-znakový versionCode a zapisuje do package.json + DB
# Instalace: ln -sf ../../scripts/pre-commit-hook.sh .git/hooks/pre-commit

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
fs.writeFileSync('ivy/package.json', JSON.stringify(pkg, null, 2) + '\n');
"
echo "[PRE-COMMIT] Verze $VERSION_CODE zapsána do package.json"

# Zápis do DB (MariaDB na localhost, databáze utiolite)
DB_HOST="127.0.0.1"
DB_USER="B3.remotes"
DB_PASS="e6TksATbS2E3FmQt-xEQgja1mh6mT"
DB_NAME="utiolite"

SQL="INSERT INTO variables (name, value, type, description) VALUES ('version', '$VERSION_CODE', 'string', 'Aktuální versionCode z package.json') ON DUPLICATE KEY UPDATE value = '$VERSION_CODE';"

if mariadb -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "$SQL" 2>/dev/null; then
  echo "[PRE-COMMIT] Verze $VERSION_CODE zapsána do databáze $DB_NAME"
else
  echo "[PRE-COMMIT] VAROVÁNÍ: Nepodařilo se zapsat verzi do DB (commit pokračuje)"
fi

git add ivy/package.json
