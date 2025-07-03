// ~/Sync/git_commit_version.js
// Tento skript slouží pro správu verze projektu. Spouští se z git hooku.
// V režimu 'pre' vygeneruje versionCode a zapíše do package.json.
// V režimu 'post' přečte versionCode z package.json a zapíše do databáze `ivy.versions`.

import fs from 'fs/promises';
import path from 'path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mode = process.argv[2];
const projectRoot = '/home/remotes/ivy4b3t';

if (!mode) {
  console.error('[GIT-COMMIT-VERSION] Nebyl zadán režim spuštění (pre/post).');
  process.exit(1);
}

const packagePath = path.join(projectRoot, 'ivy', 'package.json');

const generateVersionCode = () => {
  const hash = execSync('git rev-parse --short=7 HEAD', { cwd: projectRoot }).toString().trim();
  return hash;
};

if (mode === 'pre') {
  try {
    const versionCode = generateVersionCode();
    const packageRaw = await fs.readFile(packagePath, 'utf8');
    const packageData = JSON.parse(packageRaw);

    packageData.versionCode = versionCode;

    await fs.writeFile(packagePath, JSON.stringify(packageData, null, 2));
    console.log(`[PRE-COMMIT] Zapsána verze ${versionCode} do package.json.`);
  } catch (err) {
    console.error('[PRE-COMMIT] Chyba při generování verze:', err.message);
    process.exit(1);
  }
} else if (mode === 'post') {
  try {
    const packageRaw = await fs.readFile(packagePath, 'utf8');
    const packageData = JSON.parse(packageRaw);
    const versionCode = packageData.versionCode;

    if (!versionCode) {
      console.error('[POST-COMMIT] Nebyl nalezen versionCode v package.json.');
      process.exit(1);
    }

    // Use environment variables for database access
    const dbUser = process.env.CLAUDE_DB_USER;
    const dbPass = process.env.CLAUDE_DB_PASS;
    
    if (!dbUser || !dbPass) {
      console.error('[POST-COMMIT] Chybí databázové přístupové údaje v environment variables.');
      process.exit(1);
    }

    const hostname = os.hostname();
    const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const gitHash = execSync('git rev-parse HEAD', { cwd: projectRoot }).toString().trim();

    // Use mysql CLI instead of mysql2 library
    const sql = `INSERT INTO ivy.versions (code, hash, source, hostname, created) VALUES ('${versionCode}', '${gitHash}', 'git', '${hostname}', '${timestamp}');`;
    const mysqlCmd = `mysql -u ${dbUser} -p${dbPass} -e "${sql}"`;

    execSync(mysqlCmd, { stdio: 'pipe' });

    console.log(`[POST-COMMIT] Verze ${versionCode} (${gitHash.slice(0,7)}) zapsána do databáze.`);
  } catch (err) {
    console.error('[POST-COMMIT] Chyba při zápisu do databáze:', err.message);
    process.exit(1);
  }
} else {
  console.error(`[GIT-COMMIT-VERSION] Neznámý režim spuštění: ${mode}`);
  process.exit(1);
}
