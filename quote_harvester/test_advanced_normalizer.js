#!/usr/bin/env node

/**
 * Test pokročilé normalizace podle Zdendysovy specifikace
 */

import { TextNormalizer } from './src/text_normalizer.class.js';

const normalizer = new TextNormalizer();

// Test případy podle požadavků
const testCases = [
  // 1. Uvozovky kolem celého textu - odstranit
  {
    input: '„Hledali jsme štěstí a našli jsme sebe."',
    expected: 'Hledali jsme štěstí a našli jsme sebe.',
    description: 'Odstranění uvozovek kolem celého textu'
  },
  
  // 2. Uvozovky kolem jednotlivých slov - nahradit
  {
    input: 'Život je „cesta" plná překvapení.',
    expected: 'Život je ⟨cesta⟩ plná překvapení.',
    description: 'Nahrazení uvozovek kolem jednotlivých slov'
  },
  
  // 3. Dlouhé pomlčky → ASCII pomlčka
  {
    input: 'Dítě není malý dospělý – učme ho žít.',
    expected: 'Dítě není malý dospělý - učme ho žít.',
    description: 'Nahrazení dlouhé pomlčky'
  },
  
  // 4. Trojtečka → tři tečky
  {
    input: 'Život je krásný… někdy.',
    expected: 'Život je krásný... někdy.',
    description: 'Nahrazení trojtečky'
  },
  
  // 5. Extrakce autora v hranatých závorkách
  {
    input: '„Být nebo nebýt, to je otázka." [William Shakespeare]',
    expected: { text: 'Být nebo nebýt, to je otázka.', author: 'William Shakespeare' },
    description: 'Extrakce autora z hranatých závorek'
  },
  
  // 6. Extrakce autora s pomlčkou
  {
    input: 'Život je to, co se ti stane, zatímco plánovíš něco jiného. – John Lennon',
    expected: { text: 'Život je to, co se ti stane, zatímco plánovíš něco jiného.', author: 'John Lennon' },
    description: 'Extrakce autora s pomlčkou'
  },
  
  // 7. Extrakce autora v kulatých závorkách
  {
    input: 'Buď změnou, kterou chceš vidět ve světě. (Mahatma Gandhi)',
    expected: { text: 'Buď změnou, kterou chceš vidět ve světě.', author: 'Mahatma Gandhi' },
    description: 'Extrakce autora z kulatých závorek'
  },
  
  // 8. Kombinace problémů
  {
    input: '„Život je „cesta" plná… překvapení" – Jan Werich',
    expected: { text: 'Život je ⟨cesta⟩ plná... překvapení', author: 'Jan Werich' },
    description: 'Kombinace všech problémů'
  }
];

console.log('🧪 TEST POKROČILÉ NORMALIZACE');
console.log('═══════════════════════════════════════\n');

let passed = 0;
let failed = 0;

for (const [index, testCase] of testCases.entries()) {
  console.log(`Test ${index + 1}: ${testCase.description}`);
  console.log(`Vstup:    "${testCase.input}"`);
  
  if (typeof testCase.expected === 'string') {
    // Jednoduchý test normalizace textu
    const result = normalizer.normalize(testCase.input);
    console.log(`Výsledek: "${result}"`);
    console.log(`Očekával: "${testCase.expected}"`);
    
    if (result === testCase.expected) {
      console.log('✅ ÚSPĚCH\n');
      passed++;
    } else {
      console.log('❌ SELHÁNÍ\n');
      failed++;
    }
  } else {
    // Test extrakce autora
    const result = normalizer.extractAuthorFromText(testCase.input);
    const normalizedResult = {
      text: normalizer.normalize(result.text),
      author: result.author
    };
    
    console.log(`Výsledek: text="${normalizedResult.text}", author="${normalizedResult.author}"`);
    console.log(`Očekával: text="${testCase.expected.text}", author="${testCase.expected.author}"`);
    
    const textMatch = normalizedResult.text === testCase.expected.text;
    const authorMatch = normalizedResult.author === testCase.expected.author;
    
    if (textMatch && authorMatch) {
      console.log('✅ ÚSPĚCH\n');
      passed++;
    } else {
      console.log(`❌ SELHÁNÍ (text: ${textMatch ? '✓' : '✗'}, autor: ${authorMatch ? '✓' : '✗'})\n`);
      failed++;
    }
  }
}

console.log('📊 VÝSLEDKY:');
console.log(`✅ Úspěšné: ${passed}`);
console.log(`❌ Neúspěšné: ${failed}`);
console.log(`📈 Úspěšnost: ${Math.round((passed / (passed + failed)) * 100)}%`);

// Test na reálných datech
console.log('\n🔍 TEST NA REÁLNÝCH CITÁTECH:');
console.log('═══════════════════════════════════════\n');

const realExamples = [
  '„Hledali jsme štěstí a našli jsme sebe."',
  'Dítě není malý dospělý – učme ho žít, ne jen vědět.',
  '„Jediná cesta, které budete litovat, je ta, kterou nepodniknete."',
  'í košilí. [Jan Werich]'
];

for (const example of realExamples) {
  console.log(`Originál: "${example}"`);
  
  const authorResult = normalizer.extractAuthorFromText(example);
  const normalizedText = normalizer.normalize(authorResult.text);
  
  console.log(`Text:     "${normalizedText}"`);
  if (authorResult.author) {
    console.log(`Autor:    "${authorResult.author}"`);
  }
  console.log('');
}