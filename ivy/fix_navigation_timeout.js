#!/usr/bin/env node

/**
 * Oprava problému se zasekáváním při načítání FB stránek
 * 
 * PROBLÉM:
 * - waitUntil: 'networkidle2' může čekat nekonečně dlouho pokud FB stále něco načítá
 * - Některé timeouty chybí nebo jsou moc krátké
 * 
 * ŘEŠENÍ:
 * 1. Změnit networkidle2 na domcontentloaded nebo load
 * 2. Vždy nastavit rozumný timeout (60s)
 * 3. Přidat fallback mechanismus
 */

import { readFileSync, writeFileSync } from 'fs';

// Soubory k opravě
const files = [
  {
    path: '/home/remotes/ivy4b3t/ivy/libs/base_utio_post_action.class.js',
    find: `    const pageReady = await fbBot.navigateToPage(groupUrl, {
      waitUntil: 'networkidle2',
      timeout: 30 * 1000 // 30s
    });`,
    replace: `    const pageReady = await fbBot.navigateToPage(groupUrl, {
      waitUntil: 'domcontentloaded', // Změna z networkidle2 - rychlejší a spolehlivější
      timeout: 60 * 1000 // 60s místo 30s pro pomalé skupiny
    });`
  },
  {
    path: '/home/remotes/ivy4b3t/ivy/libs/iv_fb.class.js',
    find: `  async navigateToPage(url, options = {}) {
    try {
      // a) Navigace na stránku
      await this.page.goto(url, options);`,
    replace: `  async navigateToPage(url, options = {}) {
    try {
      // Výchozí nastavení pro bezpečnou navigaci
      const safeOptions = {
        waitUntil: options.waitUntil || 'domcontentloaded',
        timeout: options.timeout || 60000 // Výchozí 60s timeout
      };
      
      // a) Navigace na stránku s timeoutem
      await this.page.goto(url, safeOptions);`
  }
];

console.log('=== OPRAVA NAVIGATION TIMEOUT PROBLÉMU ===\n');

for (const file of files) {
  console.log(`Opravuji soubor: ${file.path}`);
  
  try {
    const content = readFileSync(file.path, 'utf8');
    
    if (content.includes(file.find)) {
      const newContent = content.replace(file.find, file.replace);
      writeFileSync(file.path, newContent);
      console.log('✅ Soubor opraven\n');
    } else {
      console.log('⚠️ Vzor nenalezen - možná už je opraven\n');
    }
  } catch (err) {
    console.error(`❌ Chyba: ${err.message}\n`);
  }
}

console.log('=== DOPORUČENÍ ===');
console.log('1. Změnit všechna waitUntil: "networkidle2" na "domcontentloaded"');
console.log('2. Vždy nastavit timeout (doporučeno 60s)');
console.log('3. Pro kritické operace použít try/catch s retry logikou');
console.log('\nPříklad správné navigace:');
console.log(`
await page.goto(url, {
  waitUntil: 'domcontentloaded', // nebo 'load' 
  timeout: 60000 // 60 sekund
});
`);