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

# Zápis do DB přes Node mysql2 (žádný mysql CLI klient není potřeba)
# Spouštíme z ivy/ kde jsou node_modules
DB_RESULT=$(cd ivy && node --input-type=module -e "
import mysql from 'mysql2/promise';
try {
  const conn = await mysql.createConnection({
    host: '127.0.0.1', user: 'B3.remotes',
    password: 'e6TksATbS2E3FmQt-xEQgja1mh6mT', database: 'utiolite',
    connectTimeout: 5000,
  });
  await conn.execute(
    \"INSERT INTO variables (name, value, type, description) VALUES ('version', ?, 'string', 'versionCode z package.json') ON DUPLICATE KEY UPDATE value = ?\",
    ['$VERSION_CODE', '$VERSION_CODE']
  );
  await conn.end();
  console.log('ok');
} catch (e) {
  console.log('error: ' + e.message);
}
" 2>/dev/null) || DB_RESULT="error: node failed"

if [ "$DB_RESULT" = "ok" ]; then
  echo "[PRE-COMMIT] Verze $VERSION_CODE zapsána do databáze utiolite"
else
  echo "[PRE-COMMIT] VAROVÁNÍ: DB zápis selhal ($DB_RESULT) — commit pokračuje"
fi

git add ivy/package.json
