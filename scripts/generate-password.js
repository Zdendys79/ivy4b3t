#!/usr/bin/env node

/**
 * Název souboru: generate-password.js
 * Umístění: ~/scripts/generate-password.js
 *
 * Popis: Generuje náhodné heslo zadané délky s volitelným speciálním znakem.
 *        Tento skript je založen na logice ze třídy IvChar.
 *
 * Použití:
 *   node scripts/generate-password.js [délka] [--no-special]
 *
 * Příklady:
 *   node scripts/generate-password.js 12
 *   node scripts/generate-password.js 16 --no-special
 */

const CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const SIGNS = "/+*-$,;:#&";

/**
 * Generuje náhodné heslo.
 *
 * @param {number} length - Délka hesla (výchozí: 12).
 * @param {boolean} includeSpecial - Zda vložit speciální znak (výchozí: true).
 * @returns {string} Vygenerované heslo.
 */
function generatePassword(length = 12, includeSpecial = true) {
    let password = "";
    for (let i = 0; i < length; i++) {
        password += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
    }

    if (includeSpecial && length >= 3) {
        const signPosition = Math.floor(Math.random() * (length - 2)) + 1;
        const sign = SIGNS.charAt(Math.floor(Math.random() * SIGNS.length));
        password = password.substring(0, signPosition) + sign + password.substring(signPosition + 1);
    }

    return password;
}

// Zpracování argumentů z příkazové řádky
const args = process.argv.slice(2);
const length = parseInt(args[0], 10) || 12;
const includeSpecial = !args.includes('--no-special');

// Vygenerování a výpis hesla
const newPassword = generatePassword(length, includeSpecial);
console.log(newPassword);

// Export pro případné použití v jiných skriptech
module.exports = { generatePassword };
