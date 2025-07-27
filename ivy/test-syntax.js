#!/usr/bin/env node

/**
 * Test script pro kontrolu syntaxe všech JS souborů
 * Umístění: ~/ivy/test-syntax.js
 * Spustí: node test-syntax.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Funkce pro rekurzivní hledání JS souborů
function findJSFiles(dir, files = []) {
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      // Přeskočit node_modules a .git
      if (item !== 'node_modules' && item !== '.git' && item !== '.syncthing') {
        findJSFiles(fullPath, files);
      }
    } else if (item.endsWith('.js') && !item.startsWith('.')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

// Funkce pro testování syntaxe souboru
async function testSyntax(filePath) {
  try {
    // Načti obsah souboru
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Zkus parsovat jako modul
    const { pathToFileURL } = await import('url');
    const fileUrl = pathToFileURL(filePath).href;
    
    // Použij dynamický import pro kontrolu syntaxe
    await import(fileUrl);
    
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Hlavní funkce
async function main() {
  console.log('=== SYNTAX CHECK FOR JS FILES ===\n');
  
  const startDir = __dirname;
  console.log(`Hledám JS soubory v: ${startDir}`);
  
  const jsFiles = findJSFiles(startDir);
  console.log(`Nalezeno ${jsFiles.length} JS souborů\n`);
  
  let passCount = 0;
  let failCount = 0;
  const failures = [];
  
  for (const filePath of jsFiles) {
    const relativePath = path.relative(startDir, filePath);
    
    process.stdout.write(`Kontroluji: ${relativePath}... `);
    
    const result = await testSyntax(filePath);
    
    if (result.success) {
      console.log('OK');
      passCount++;
    } else {
      console.log('CHYBA');
      failCount++;
      failures.push({
        file: relativePath,
        error: result.error
      });
    }
  }
  
  console.log('\n=== VÝSLEDKY ===');
  console.log(`Úspěšné: ${passCount}`);
  console.log(`Chybné: ${failCount}`);
  
  if (failures.length > 0) {
    console.log('\n=== DETAILY CHYB ===');
    for (const failure of failures) {
      console.log(`\n${failure.file}:`);
      console.log(`  ${failure.error}`);
    }
    
    console.log('\n[ERROR] Byly nalezeny chyby syntaxe!');
    process.exit(1);
  } else {
    console.log('\n[SUCCESS] Všechny soubory mají správnou syntaxi!');
    process.exit(0);
  }
}

// Spusť test
main().catch(error => {
  console.error('\n[FATAL] Chyba při spouštění testu:', error.message);
  process.exit(1);
});