/**
 * check-version.js
 * Vypíše JSON s versionCode z DB na stdout. Určeno pro volání z start.sh.
 * Používá mysql2 (stejná závislost jako ivy) — mysql CLI není potřeba.
 *
 * Výstup JSON:
 *   { "ok": true,  "version": "oiv" }
 *   { "ok": false, "error": "popis chyby" }
 */

import mysql from 'mysql2/promise';

const out = (obj) => { console.log(JSON.stringify(obj)); };

const { DB_HOST, DB_USER, DB_PASS, DB_NAME } = process.env;

if (!DB_HOST || !DB_USER || !DB_PASS || !DB_NAME) {
  out({ ok: false, error: 'chybí env proměnné: DB_HOST, DB_USER, DB_PASS, DB_NAME' });
  process.exit(1);
}

try {
  const conn = await mysql.createConnection({
    host: DB_HOST, user: DB_USER, password: DB_PASS, database: DB_NAME,
    connectTimeout: 5000,
  });
  const [rows] = await conn.execute(
    "SELECT value FROM variables WHERE name='version' LIMIT 1"
  );
  await conn.end();
  if (rows.length > 0) {
    out({ ok: true, version: rows[0].value });
  } else {
    out({ ok: false, error: 'version nenalezen v tabulce variables' });
    process.exit(1);
  }
} catch (err) {
  out({ ok: false, error: err.message });
  process.exit(1);
}
