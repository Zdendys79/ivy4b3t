#!/usr/bin/env node

/**
 * Test script pro TextNormalizer
 * Zobrazí všechny nealfanumerické znaky z existujících citátů
 */

import { TextNormalizer } from './src/text_normalizer.class.js';
import { DatabaseManager } from './src/database_manager.class.js';

const normalizer = new TextNormalizer();
const db = new DatabaseManager();

async function analyzeExistingQuotes() {
  console.log('🔍 ANALÝZA SPECIÁLNÍCH ZNAKŮ V CITÁTECH');
  console.log('═══════════════════════════════════════\n');

  try {
    await db.testConnection();
    
    // Získat všechny citáty
    const conn = await db.connect();
    const [rows] = await conn.execute(`
      SELECT id, text, original_text, author 
      FROM quotes 
      WHERE text IS NOT NULL OR original_text IS NOT NULL
      LIMIT 100
    `);
    
    console.log(`📊 Analyzuji ${rows.length} citátů...\n`);
    
    const specialChars = new Map();
    const examples = new Map();
    
    for (const quote of rows) {
      const texts = [quote.text, quote.original_text, quote.author].filter(Boolean);
      
      for (const text of texts) {
        for (let i = 0; i < text.length; i++) {
          const char = text[i];
          
          // Pouze nealfanumerické znaky (bez standardní interpunkce)
          if (!/[a-zA-Z0-9\sáčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ.,!?:;()\-"']/.test(char)) {
            const count = specialChars.get(char) || 0;
            specialChars.set(char, count + 1);
            
            // Uložit příklad pro první výskyt
            if (!examples.has(char)) {
              const context = text.substring(Math.max(0, i-10), i+11);
              examples.set(char, { 
                context, 
                quoteId: quote.id,
                fullText: text.substring(0, 50) + (text.length > 50 ? '...' : '')
              });
            }
          }
        }
      }
    }
    
    // Seřadit podle četnosti
    const sortedChars = Array.from(specialChars.entries())
      .sort((a, b) => b[1] - a[1]);
    
    console.log('🎯 NALEZENÉ SPECIÁLNÍ ZNAKY:\n');
    console.log('Znak | Unicode | Počet | Popis | Příklad kontextu');
    console.log('-----|---------|-------|-------|------------------');
    
    for (const [char, count] of sortedChars) {
      const unicode = 'U+' + char.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0');
      const example = examples.get(char);
      const description = getCharacterDescription(char);
      
      console.log(`'${char}' | ${unicode} | ${count.toString().padStart(5)} | ${description.padEnd(20)} | "${example.context}"`);
      
      if (count > 10) {
        console.log(`     ID ${example.quoteId}: ${example.fullText}`);
      }
    }
    
    console.log(`\n📈 CELKEM: ${specialChars.size} různých speciálních znaků`);
    console.log(`📊 NEJVÍCE: '${sortedChars[0]?.[0]}' (${sortedChars[0]?.[1]}x)`);
    
    // Test normalizace na několika příkladech
    console.log('\n🧪 TEST NORMALIZACE:\n');
    
    for (let i = 0; i < Math.min(5, rows.length); i++) {
      const quote = rows[i];
      const text = quote.text || quote.original_text;
      
      if (normalizer.hasProblematicChars(text)) {
        const normalized = normalizer.normalize(text);
        const stats = normalizer.getNormalizationStats(text, normalized);
        
        console.log(`ID ${quote.id}:`);
        console.log(`  Před: "${text}"`);
        console.log(`  Po:   "${normalized}"`);
        console.log(`  Změn: ${stats.changes} | Délka: ${text.length} → ${normalized.length}`);
        console.log('');
      }
    }
    
  } catch (error) {
    console.error('❌ Chyba:', error.message);
  }
}

function getCharacterDescription(char) {
  const descriptions = {
    '"': 'Left double quote',
    '"': 'Right double quote', 
    '„': 'Double low-9 quote',
    '\u2018': 'Left single quote',
    '\u2019': 'Right single quote',
    '–': 'En dash',
    '—': 'Em dash',
    '…': 'Ellipsis',
    '\u00A0': 'Non-breaking space',
    '©': 'Copyright symbol',
    '®': 'Registered mark',
    '™': 'Trademark',
    '§': 'Section sign',
    '•': 'Bullet point',
    '‰': 'Per mille',
    'ä': 'German a-umlaut',
    'ö': 'German o-umlaut',
    'ü': 'German u-umlaut',
    'ß': 'German sharp s',
    'à': 'French a-grave',
    'é': 'French e-acute',
    'ñ': 'Spanish n-tilde'
  };
  
  return descriptions[char] || 'Unknown special char';
}

// Spustit pouze pokud je soubor spuštěn přímo
if (import.meta.url === `file://${process.argv[1]}`) {
  analyzeExistingQuotes().catch(console.error);
}