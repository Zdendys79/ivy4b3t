#!/usr/bin/env node

/**
 * Enhanced Password Generator pro databázové uživatele
 * Generuje hesla délky 32 znaků s minimálně 4 speciálními znaky
 */

const CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const SPECIAL_CHARS = "!@#$%^&*()_+-=[]{}|,.<>?/~";

/**
 * Generuje bezpečné heslo s garantovaným počtem speciálních znaků
 * @param {number} length - Celková délka hesla
 * @param {number} minSpecialChars - Minimální počet speciálních znaků
 * @returns {string} Vygenerované heslo
 */
function generateSecurePassword(length = 32, minSpecialChars = 4) {
    if (minSpecialChars > length) {
        throw new Error("Počet speciálních znaků nemůže být větší než délka hesla");
    }

    let password = [];
    
    // 1. Nejprve vygeneruj požadovaný počet speciálních znaků
    for (let i = 0; i < minSpecialChars; i++) {
        const randomSpecial = SPECIAL_CHARS.charAt(Math.floor(Math.random() * SPECIAL_CHARS.length));
        password.push(randomSpecial);
    }
    
    // 2. Doplň zbytek obyčejnými znaky
    for (let i = minSpecialChars; i < length; i++) {
        const randomChar = CHARS.charAt(Math.floor(Math.random() * CHARS.length));
        password.push(randomChar);
    }
    
    // 3. Zamíchej pole pro náhodné rozložení speciálních znaků
    for (let i = password.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [password[i], password[j]] = [password[j], password[i]];
    }
    
    return password.join('');
}

// Zpracování argumentů
const args = process.argv.slice(2);
const length = args[0] ? parseInt(args[0], 10) : 32;
const minSpecialChars = args[1] !== undefined ? parseInt(args[1], 10) : Math.ceil(length / 12);

// Generování hesla
try {
    const password = generateSecurePassword(length, minSpecialChars);
    console.log(password);
} catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
}

export { generateSecurePassword };