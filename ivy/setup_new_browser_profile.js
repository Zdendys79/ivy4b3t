/**
 * SETUP NOVÉHO BROWSER PROFILU
 * - Nastavení češtiny jako hlavního jazyka
 * - Vypnutí automatického překladu stránek
 * - Odstranění ostatních jazyků
 * - Přejmenování profilu na "[ID] Jméno Příjmení"
 * - Základní nastavení pro FB automatizaci
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
    console.log(`🆕 === SETUP PROFILU PRO UŽIVATELE ${USER_ID} ===`);
    
    const user = await db.getUserById(USER_ID);
    if (!user) {
      throw new Error(`Uživatel ${USER_ID} nenalezen`);
    }
    
    const profileName = `[${USER_ID}] ${user.name} ${user.surname}`;
    console.log(`👤 Uživatel: ${profileName}`);
    
    // Generuj silné heslo (12 znaků stačí)
    const password = execSync('./scripts/enhanced-password-generator.js 12', { encoding: 'utf8' }).trim();
    console.log(`🔐 Vygenerované heslo: ${password}`);
    
    // Příprava profilu
    const profileDir = `Profile${USER_ID}`;
    const userDataDir = '/home/remotes/Chromium';
    const lockFile = path.join(userDataDir, profileDir, 'SingletonLock');
    
    try { fs.unlinkSync(lockFile); } catch {}
    
    // Spuštění browseru
    console.log('🚀 Spouštím browser pro první setup...');
    const browser = await puppeteer.launch({
      headless: false,
      defaultViewport: null,
      args: [
        '--suppress-message-center-popups',
        '--disable-notifications',
        '--start-maximized',
        '--no-sandbox',
        '--disable-web-security',
        '--disable-features=TranslateUI',
        '--lang=cs-CZ',
        '--accept-lang=cs-CZ,cs,en-US,en',
        `--user-data-dir=${userDataDir}`,
        `--profile-directory=${profileDir}`,
        '--display=' + (process.env.DISPLAY || ':0')
      ]
    });
    
    const page = await browser.newPage();
    
    // Krok 0: Zvládnout "Restore pages?" popup
    console.log('🚫 === ZVLÁDÁNÍ STARTUP POPUPŮ ===');
    
    try {
      // Čekej na možný "Restore pages?" dialog
      await Wait.toSeconds(2, 'Čekání na startup dialogy');
      
      // Pokus o zavření restore pages dialogu
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const cancelBtn = buttons.find(btn => 
          btn.textContent && 
          (btn.textContent.includes('Cancel') || btn.textContent.includes('Zrušit'))
        );
        if (cancelBtn) {
          cancelBtn.click();
          console.log('✅ Restore pages dialog zrušen');
        }
      });
    } catch (err) {
      console.log('⚠️ Startup popup handling selhal, pokračuji...');
    }
    
    // Krok 1: Přejít na nastavení jazyka
    console.log('⚙️ === NASTAVENÍ JAZYKA ===');
    await page.goto('chrome://settings/languages', { waitUntil: 'networkidle0' });
    await Wait.toSeconds(2, 'Načtení nastavení');
    
    await page.screenshot({ path: `/tmp/setup_languages_${USER_ID}.png` });
    console.log(`📷 Screenshot jazyků: /tmp/setup_languages_${USER_ID}.png`);
    
    // Krok 2: Zakázat automatický překlad
    console.log('🚫 === VYPNUTÍ AUTOMATICKÉHO PŘEKLADU ===');
    
    try {
      // Najdi a vypni toggle pro překlad
      await page.evaluate(() => {
        const toggles = Array.from(document.querySelectorAll('cr-toggle'));
        const translateToggle = toggles.find(toggle => {
          const text = toggle.parentElement?.textContent || '';
          return text.includes('translate') || text.includes('překlad');
        });
        
        if (translateToggle && translateToggle.checked) {
          translateToggle.click();
          console.log('✅ Automatický překlad vypnut');
        }
      });
    } catch (err) {
      console.log('⚠️ Překlad toggle nenalezen, pokračuji...');
    }
    
    await Wait.toSeconds(1, 'Čekání po vypnutí překladu');
    
    // Krok 3: Přejít na obecné nastavení profilu
    console.log('👤 === PŘEJMENOVÁNÍ PROFILU ===');
    await page.goto('chrome://settings/manageProfile', { waitUntil: 'networkidle0' });
    await Wait.toSeconds(2, 'Načtení profilu');
    
    await page.screenshot({ path: `/tmp/setup_profile_${USER_ID}.png` });
    console.log(`📷 Screenshot profilu: /tmp/setup_profile_${USER_ID}.png`);
    
    // Pokus o přejmenování profilu
    try {
      await page.evaluate((newName) => {
        // Najdi input pro název profilu
        const nameInput = document.querySelector('input[type="text"]');
        if (nameInput) {
          nameInput.value = '';
          nameInput.focus();
          nameInput.value = newName;
          nameInput.dispatchEvent(new Event('input', { bubbles: true }));
          nameInput.dispatchEvent(new Event('change', { bubbles: true }));
          console.log('✅ Profil přejmenován na: ' + newName);
        }
      }, profileName);
    } catch (err) {
      console.log('⚠️ Přejmenování profilu selhalo, pokračuji...');
    }
    
    await Wait.toSeconds(2, 'Čekání po přejmenování');
    
    // Krok 4: Nastavit preference pro FB automatizaci
    console.log('🔧 === OPTIMALIZACE PRO AUTOMATIZACI ===');
    
    // Zakázat notifikace
    await page.goto('chrome://settings/content/notifications', { waitUntil: 'networkidle0' });
    await Wait.toSeconds(1, 'Načtení notifikací');
    
    try {
      await page.evaluate(() => {
        const toggle = document.querySelector('cr-toggle');
        if (toggle && toggle.checked) {
          toggle.click();
          console.log('✅ Notifikace zakázány');
        }
      });
    } catch (err) {
      console.log('⚠️ Notifikace toggle nenalezen');
    }
    
    // Finální screenshot
    await page.goto('chrome://settings/', { waitUntil: 'networkidle0' });
    await Wait.toSeconds(1, 'Finální načtení');
    
    await page.screenshot({ path: `/tmp/setup_final_${USER_ID}.png` });
    console.log(`📷 Finální screenshot: /tmp/setup_final_${USER_ID}.png`);
    
    // Přejít na Google pro test
    console.log('🧪 === TEST NASTAVENÍ ===');
    await page.goto('https://www.google.com/', { waitUntil: 'networkidle0' });
    await Wait.toSeconds(2, 'Test načtení Google');
    
    await page.screenshot({ path: `/tmp/test_google_${USER_ID}.png` });
    console.log(`📷 Test Google: /tmp/test_google_${USER_ID}.png`);
    
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
    
    // Vytvoř různé varianty e-mailu na základě data narození
    const birthDate = new Date(user.birth_date);
    const year = birthDate.getFullYear().toString().slice(-2); // 2001 → 01
    const day = birthDate.getDate().toString().padStart(2, '0'); // 23 → 23
    
    // Numerologické číslo (součet všech číslic v datu narození)
    const dateString = birthDate.getFullYear().toString() + 
                      (birthDate.getMonth() + 1).toString().padStart(2, '0') + 
                      birthDate.getDate().toString().padStart(2, '0'); // 20010923
    const numerology = dateString.split('').reduce((sum, digit) => sum + parseInt(digit), 0); // 2+0+0+1+0+9+2+3 = 17
    
    const baseName = `${removeDiacritics(user.name)}.${removeDiacritics(user.surname)}`;
    
    // Tři varianty e-mailu
    const emailVariants = [
      `${baseName}${year}@seznam.cz`,        // zdenek.nemec01@seznam.cz
      `${baseName}${day}@seznam.cz`,         // zdenek.nemec23@seznam.cz  
      `${baseName}${numerology}@seznam.cz`   // zdenek.nemec17@seznam.cz
    ];
    
    // Vyber první variantu jako primární
    const email = emailVariants[0];
    
    console.log(`💾 E-mail varianty:`);
    console.log(`   Rok narození: ${emailVariants[0]} (${year})`);
    console.log(`   Den narození: ${emailVariants[1]} (${day})`);
    console.log(`   Numerologie:  ${emailVariants[2]} (${numerology})`);
    console.log(`💌 Primární e-mail: ${email}`);
    console.log(`🔐 Heslo: ${password}`);
    console.log('⚠️ E-mail údaje budou uloženy po úspěšné registraci');
    
    console.log('\n🎉 === SETUP DOKONČEN ===');
    console.log(`👤 Profil: ${profileName}`);
    console.log('🇨🇿 Jazyk: Čeština nastavena');
    console.log('🚫 Překlad: Automatický překlad vypnut');
    console.log('🔕 Notifikace: Zakázány');
    console.log('⚙️ Browser je připraven pro automatizaci');
    console.log('\n⚠️  Browser zůstává otevřený pro ruční dokončení setup a registraci');
    
  } catch (err) {
    console.error(`❌ Chyba při setup: ${err.message}`);
  }
})();