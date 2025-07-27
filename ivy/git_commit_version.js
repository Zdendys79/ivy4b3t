#!/usr/bin/env node
// Script pro aktualizaci versionCode v package.json podle git commit hash

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

try {
    // Získat krátký commit hash (7 znaků)
    const commitHash = execSync('git rev-parse --short=7 HEAD', { encoding: 'utf8' }).trim();
    
    // Načíst package.json
    const packagePath = join(__dirname, 'package.json');
    const packageData = JSON.parse(readFileSync(packagePath, 'utf8'));
    
    // Aktualizovat versionCode
    packageData.versionCode = commitHash;
    
    // Zapsat zpět
    writeFileSync(packagePath, JSON.stringify(packageData, null, 2) + '\n');
    
    console.log(`[VERSION] Updated package.json versionCode to: ${commitHash}`);
    
} catch (error) {
    console.error('[VERSION] Failed to update versionCode:', error.message);
    process.exit(1);
}