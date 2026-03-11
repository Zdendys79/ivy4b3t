/**
 * check-version.js
 * Vypíše versionCode z DB na stdout. Určeno pro volání z start.sh.
 * Používá mysql2 (stejná závislost jako ivy) — mysql CLI není potřeba.
 *
 * Výstup: řetězec verze (např. "oiv"), nebo prázdný výstup při chybě.
 * Exit 0 = OK, Exit 1 = chyba (chybí env, DB nedostupná).
 */

import mysql from 'mysql2/promise';

const { DB_HOST, DB_USER, DB_PASS, DB_NAME } = process.env;

if (!DB_HOST || !DB_USER || !DB_PASS || !DB_NAME) process.exit(1);

try {
  const conn = await mysql.createConnection({
    host: DB_HOST, user: DB_USER, password: DB_PASS, database: DB_NAME,
    connectTimeout: 5000,
  });
  const [rows] = await conn.execute(
    "SELECT code FROM variables WHERE name='versionCode' LIMIT 1"
  );
  await conn.end();
  if (rows.length > 0) process.stdout.write(rows[0].code);
  process.exit(0);
} catch {
  process.exit(1);
}
