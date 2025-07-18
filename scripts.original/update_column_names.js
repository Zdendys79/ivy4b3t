#!/usr/bin/env node

/**
 * Script pro aktualizaci všech výskytů nazev->name a typ->type v JS souborech
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cesty k prohledání
const searchPaths = [
  '../ivy',
  '../web'
];

// Patterns pro náhradu
const replacements = [
  // SQL column references
  { from: /\.nazev\b/g, to: '.name' },
  { from: /\.typ\b/g, to: '.type' },
  { from: /\bnazev\s*=/g, to: 'name =' },
  { from: /\btyp\s*=/g, to: 'type =' },
  { from: /\bnazev\s*,/g, to: 'name,' },
  { from: /\btyp\s*,/g, to: 'type,' },
  { from: /\bnazev\s*\)/g, to: 'name)' },
  { from: /\btyp\s*\)/g, to: 'type)' },
  
  // Object property access  
  { from: /group\.nazev/g, to: 'group.name' },
  { from: /group\.typ/g, to: 'group.type' },
  { from: /item\.nazev/g, to: 'item.name' },
  { from: /item\.typ/g, to: 'item.type' },
  { from: /row\.nazev/g, to: 'row.name' },
  { from: /row\.typ/g, to: 'row.type' },
  
  // SQL WHERE clauses
  { from: /WHERE\s+nazev\s*/gi, to: 'WHERE name ' },
  { from: /WHERE\s+typ\s*/gi, to: 'WHERE type ' },
  { from: /AND\s+nazev\s*/gi, to: 'AND name ' },
  { from: /AND\s+typ\s*/gi, to: 'AND type ' },
  { from: /OR\s+nazev\s*/gi, to: 'OR name ' },
  { from: /OR\s+typ\s*/gi, to: 'OR type ' },
  
  // SQL SELECT
  { from: /SELECT\s+nazev/gi, to: 'SELECT name' },
  { from: /SELECT\s+typ/gi, to: 'SELECT type' },
  { from: /,\s*nazev/g, to: ', name' },
  { from: /,\s*typ/g, to: ', type' },
  
  // SQL ORDER BY
  { from: /ORDER\s+BY\s+nazev/gi, to: 'ORDER BY name' },
  { from: /ORDER\s+BY\s+typ/gi, to: 'ORDER BY type' },
];

function processFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;
    
    replacements.forEach(replacement => {
      const newContent = content.replace(replacement.from, replacement.to);
      if (newContent !== content) {
        content = newContent;
        changed = true;
      }
    });
    
    if (changed) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Updated: ${filePath}`);
      return true;
    }
    
    return false;
  } catch (err) {
    console.error(`❌ Error processing ${filePath}: ${err.message}`);
    return false;
  }
}

function processDirectory(dirPath) {
  const fullPath = path.resolve(__dirname, dirPath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️ Directory not found: ${fullPath}`);
    return;
  }
  
  const files = fs.readdirSync(fullPath, { withFileTypes: true });
  
  files.forEach(file => {
    const filePath = path.join(fullPath, file.name);
    
    if (file.isDirectory()) {
      processDirectory(path.relative(__dirname, filePath));
    } else if (file.name.endsWith('.js')) {
      processFile(filePath);
    }
  });
}

console.log('🔄 Starting column name update...');

searchPaths.forEach(searchPath => {
  console.log(`\n📁 Processing ${searchPath}...`);
  processDirectory(searchPath);
});

console.log('\n✅ Column name update completed!');