/**
 * Test opraveného regexu pro lomítko
 */

import { FBGroupAnalyzer } from './iv_fb_group_analyzer.js';

const analyzer = new FBGroupAnalyzer(null);

// Testovací názvy s lomítkem
const testNames = [
  'Služby/prodej/pronájem byty/domy/pozemky/',
  'byty/domy/pozemky',
  'prodej/výměna/bazar',
  'Brno Byty Pronájem Nemovitosti'
];

console.log('TEST opraveného regexu pro lomítko:');

testNames.forEach(name => {
  const keywords = analyzer.extractKeywords(name);
  console.log(`"${name}" → [${keywords.join(', ')}]`);
});

// Specifický test pro problematické názvy
console.log('\n--- Specifické testy ---');
const group2 = analyzer.extractKeywords('Bazárek - prodej, koupě, výměna - Prachaticko, Strakonicko, Praha');
const group54 = analyzer.extractKeywords('Služby/prodej/pronájem byty/domy/pozemky - Brno,Břeclav,Vyškov,Hodonín');

console.log(`Skupina ID 2: [${group2.join(', ')}]`);
console.log(`Skupina ID 54: [${group54.join(', ')}]`);

process.exit(0);