/**
 * REGISTRACE NA ČESKÝCH E-MAILOVÝCH SLUŽBÁCH
 * - Seznam.cz, Email.cz, Centrum.cz
 * - Nejprv oprava browser profilu na češtinu
 * - Pak registrace e-mailu s vygenerovanými údaji
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import puppeteer from 'puppeteer';
import { db } from './iv_sql.js';
import { Wait } from './libs/iv_wait.class.js';

const USER_ID = process.argv[2] || 81;

(async () => {
  try {
    console.log(`🇨🇿 === REGISTRACE ČESKÉHO E-MAILU PRO ID ${USER_ID} ===`);
    
    const user = await db.getUserById(USER_ID);
    if (!user) {
      throw new Error(`Uživatel ${USER_ID} nenalezen`);
    }
    
    console.log(`👤 Uživatel: ${user.name} ${user.surname}`);
    
    // Funkce pro odstranění diakritiky
    const removeDiacritics = (text) => {
      return text.toLowerCase()
        .replace(/[áàâäãå]/g, 'a')
        .replace(/[éèêë]/g, 'e') 
        .replace(/[íìîï]/g, 'i')
        .replace(/[óòôöõ]/g, 'o')
        .replace(/[úùûüů]/g, 'u')
        .replace(/[ýÿ]/g, 'y')
        .replace(/[ň]/g, 'n')
        .replace(/[š]/g, 's')
        .replace(/[č]/g, 'c')
        .replace(/[ř]/g, 'r')
        .replace(/[ž]/g, 'z')
        .replace(/[ť]/g, 't')
        .replace(/[ď]/g, 'd');
    };
    
    // Vytvoř e-mail varianty
    const birthDate = new Date(user.birth_date);
    const year = birthDate.getFullYear().toString().slice(-2);
    const day = birthDate.getDate().toString().padStart(2, '0');
    
    const dateString = birthDate.getFullYear().toString() + 
                      (birthDate.getMonth() + 1).toString().padStart(2, '0') + 
                      birthDate.getDate().toString().padStart(2, '0');
    const numerology = dateString.split('').reduce((sum, digit) => sum + parseInt(digit), 0);
    
    const baseName = `${removeDiacritics(user.name)}.${removeDiacritics(user.surname)}`;
    const password = execSync('./scripts/enhanced-password-generator.js 12', { encoding: 'utf8' }).trim();
    
    console.log(`📧 E-mail základ: ${baseName}`);
    console.log(`🔢 Varianty: ${year} (rok), ${day} (den), ${numerology} (numerologie)`);
    console.log(`🔐 Heslo: ${password}`);
    
    // Spuštění browseru
    const profileDir = `Profile${USER_ID}`;
    const userDataDir = '/home/remotes/Chromium';
    const lockFile = path.join(userDataDir, profileDir, 'SingletonLock');
    
    try { fs.unlinkSync(lockFile); } catch {}
    
    console.log(`\\n🚀 Spouštím browser Profile${USER_ID} s českým nastavením...`);
    const browser = await puppeteer.launch({
      headless: false,
      defaultViewport: null,
      args: [
        '--suppress-message-center-popups',
        '--disable-notifications', 
        '--start-maximized',
        '--no-sandbox',
        '--lang=cs-CZ',
        '--accept-lang=cs-CZ,cs;q=0.9,en;q=0.8',
        `--user-data-dir=${userDataDir}`,
        `--profile-directory=${profileDir}`,
        '--display=' + (process.env.DISPLAY || ':0')
      ]
    });
    
    const page = await browser.newPage();
    
    // Krok 1: Oprav jazykové nastavení browseru
    console.log(`\\n⚙️ === OPRAVA JAZYKOVÉHO NASTAVENÍ ===`);
    await page.goto('chrome://settings/languages', { waitUntil: 'networkidle0' });
    await Wait.toSeconds(2, 'Načtení jazykového nastavení');
    
    // Přidej češtinu jako primární jazyk
    try {
      await page.evaluate(() => {
        // Najdi tlačítko pro přidání jazyka
        const addButton = Array.from(document.querySelectorAll('cr-button')).find(btn => 
          btn.textContent && btn.textContent.includes('Add languages')
        );
        if (addButton) {
          addButton.click();
        }
      });
      
      await Wait.toSeconds(2, 'Čekání na dialog přidání jazyka');
      
      // Vyhledej češtinu
      const searchInput = await page.$('cr-search-field input');
      if (searchInput) {
        await searchInput.type('Czech');
        await Wait.toSeconds(1, 'Hledání češtiny');
        
        // Klikni na češtinu
        await page.evaluate(() => {
          const czechOption = Array.from(document.querySelectorAll('*')).find(el => 
            el.textContent && el.textContent.includes('Czech')
          );
          if (czechOption) {
            czechOption.click();
          }
        });
      }
      
      console.log('✅ Čeština přidána do jazyků');
    } catch (err) {
      console.log('⚠️ Přidání češtiny selhalo, pokračuji...');
    }
    
    await page.screenshot({ path: `/tmp/language_setup_${USER_ID}.png` });
    
    // Krok 2: Zkus registraci na Seznam.cz
    console.log(`\\n📧 === REGISTRACE NA SEZNAM.CZ ===`);
    await page.goto('https://registrace.seznam.cz/', { waitUntil: 'networkidle0' });
    await Wait.toSeconds(2, 'Načtení Seznam.cz');
    
    await page.screenshot({ path: `/tmp/seznam_start_${USER_ID}.png` });
    console.log(`📷 Seznam start: /tmp/seznam_start_${USER_ID}.png`);
    
    // Klikni na "Create @seznam.cz address"
    try {
      const clicked = await page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('*'));
        const createBtn = elements.find(el => 
          el.textContent && 
          (el.textContent.includes('Vytvořit adresu @seznam.cz') ||
           el.textContent.includes('Create @seznam.cz address')) &&
          el.offsetParent !== null
        );
        
        if (createBtn) {
          createBtn.click();
          return true;
        }
        return false;
      });
      
      if (clicked) {
        console.log('✅ Kliknuto na "Vytvořit adresu @seznam.cz"');
        await Wait.toSeconds(3, 'Čekání na formulář');
        
        await page.screenshot({ path: `/tmp/seznam_form_${USER_ID}.png` });
        console.log(`📷 Seznam formulář: /tmp/seznam_form_${USER_ID}.png`);
        
        // Podle .md postupu - vyplň formulář
        console.log('✏️ Vyplňuji formulář podle postupu...');
        
        // Jméno
        try {
          await page.waitForSelector('input[name="firstName"]', { timeout: 3000 });
          await page.type('input[name="firstName"]', user.name);
          console.log(`✅ Jméno: ${user.name}`);
        } catch {
          console.log('⚠️ Pole firstName nenalezeno');
        }
        
        // Příjmení  
        try {
          await page.type('input[name="lastName"]', user.surname);
          console.log(`✅ Příjmení: ${user.surname}`);
        } catch {
          console.log('⚠️ Pole lastName nenalezeno');
        }
        
        // E-mail - první varianta (rok)
        const emailUsername = `${baseName}${year}`;
        try {
          const emailInput = await page.$('input[name="email"], input[name="username"]');
          if (emailInput) {
            await emailInput.type(emailUsername);
            console.log(`✅ E-mail: ${emailUsername}@seznam.cz`);
          }
        } catch {
          console.log('⚠️ E-mail pole nenalezeno');
        }
        
        // Heslo
        try {
          const passwordInput = await page.$('input[type="password"]');
          if (passwordInput) {
            await passwordInput.type(password);
            console.log('✅ Heslo zadáno');
          }
        } catch {
          console.log('⚠️ Password pole nenalezeno');
        }
        
        await page.screenshot({ path: `/tmp/seznam_filled_${USER_ID}.png` });
        console.log(`📷 Vyplněný formulář: /tmp/seznam_filled_${USER_ID}.png`);
        
        // Analyzuj a vyplň formulář
        const inputs = await page.$$eval('input', inputs => 
          inputs
            .filter(input => input.offsetParent !== null)
            .map(input => ({
              name: input.name,
              id: input.id,
              type: input.type,
              placeholder: input.placeholder
            }))
        );
        
        console.log('📋 Formulář obsahuje:');
        inputs.forEach((input, i) => {
          console.log(`  ${i+1}. ${input.name || input.id} (${input.type}): "${input.placeholder}"`);
        });
        
        console.log(`\\n💾 ÚDAJE PRO REGISTRACI:`);
        console.log(`👤 Jméno: ${user.name}`);
        console.log(`👤 Příjmení: ${user.surname}`);
        console.log(`🎂 Datum: ${birthDate.getDate()}.${birthDate.getMonth() + 1}.${birthDate.getFullYear()}`);
        console.log(`📧 E-mail varianty:`);
        console.log(`   ${baseName}${year}@seznam.cz`);
        console.log(`   ${baseName}${day}@seznam.cz`);
        console.log(`   ${baseName}${numerology}@seznam.cz`);
        console.log(`🔐 Heslo: ${password}`);
        
        console.log(`\\n⚠️ RUČNÍ VYPLNĚNÍ POTŘEBNÉ:`);
        console.log(`   1. Vyplň jméno a příjmení`);
        console.log(`   2. Zkus e-mail varianty dokud nenajdeš volnou`);
        console.log(`   3. Nastav heslo`);
        console.log(`   4. Vyplň datum narození`);
        console.log(`   5. Vyřeš CAPTCHA`);
        console.log(`   6. Odešli formulář`);
        
      } else {
        console.log('❌ "Create @seznam.cz address" nenalezeno');
      }
    } catch (err) {
      console.log(`⚠️ Chyba při kliku: ${err.message}`);
    }
    
    console.log(`\\n🎯 Browser zůstává otevřený pro ruční dokončení`);
    console.log(`📱 Pokud Seznam.cz nevyjde, zkus později Email.cz nebo Centrum.cz`);
    
  } catch (err) {
    console.error(`❌ Chyba: ${err.message}`);
  }
})();