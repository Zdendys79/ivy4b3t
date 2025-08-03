#!/usr/bin/env node

const testString = 'Život je „cesta" plná překvapení.';

console.log('Debug problematického textu:');
console.log(`Text: "${testString}"`);
console.log('');

for (let i = 0; i < testString.length; i++) {
  const char = testString[i];
  const unicode = 'U+' + char.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0');
  console.log(`${i}: '${char}' = ${unicode}`);
}

// Test na problematické uvozovky
const problemChars = ['„', '"'];
console.log('\nProblematické znaky:');
for (const char of problemChars) {
  const unicode = 'U+' + char.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0');
  console.log(`'${char}' = ${unicode}`);
}