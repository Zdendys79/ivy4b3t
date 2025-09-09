/**
 * PERSISTENTNÍ FB SESSION - NEZAVÍRÁ SE!
 * - Browser zůstává otevřený dokud ho neuživatel neukončí
 * - Umožňuje postupné kroky registrace
 * - Ukládá si stav mezi příkazy
 */

import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer';

import { db } from './iv_sql.js';
import { FBBot } from './libs/iv_fb.class.js';
import { Log } from './libs/iv_log.class.js';
import { Wait } from './libs/iv_wait.class.js';

const DEBUG_USER_ID = 997;
let browser;
let page;
let currentStep = 'start';

// Graceful shutdown - ale NEUZAVŘÍT browser!
process.on('SIGINT', async () => {
  console.log('\n🔴 Session ukončena, ale BROWSER ZŮSTÁVÁ OTEVŘENÝ!');
  console.log('🌐 Facebook page je stále k dispozici na Chrome Remote Desktop');
  console.log('🔄 Můžeš spustit další příkazy nebo pokračovat ručně');
  
  // NEZAVÍRÁME browser!
  process.exit(0);
});

(async () => {
  try {
    const command = process.argv[2] || 'init';
    
    Log.info('[PERSISTENT]', `🚀 PERSISTENT FB Session - příkaz: ${command}`);
    
    // Startup a inicializace
    if (command === 'init' || command === 'start') {
      await initializeSession();
    }
    
    // Spustit požadovaný příkaz
    await executeCommand(command);
    
    // NEUKONČOVAT - čekat nekonečně
    console.log('\n🎮 === SESSION AKTIVNÍ ===');
    console.log('🌐 Browser zůstává otevřený');  
    console.log('🔄 Spusť další příkazy v novém terminálu:');
    console.log('   node persistent_fb_session.js decline-cookies');
    console.log('   node persistent_fb_session.js open-registration');
    console.log('   node persistent_fb_session.js analyze');
    console.log('⏹️  Pro ukončení: Ctrl+C');
    
    // Nekonečné čekání
    await new Promise(() => {});
    
  } catch (err) {
    Log.error('[PERSISTENT]', `Chyba: ${err.message}`);
    console.log('\n❌ Chyba v session, ale browser může stále běžet');
    console.log('🔄 Zkus spustit: node persistent_fb_session.js analyze');
  }
})();

/**
 * Inicializace session - spustí browser a naviguje na FB
 */
async function initializeSession() {
  Log.info('[PERSISTENT]', '🔧 Inicializuji persistent session...');
  
  const user = await db.getUserById(DEBUG_USER_ID);
  if (!user) {
    throw new Error(`Debug user ${DEBUG_USER_ID} neexistuje`);
  }
  
  // Spustit browser
  browser = await launchPersistentBrowser(user);
  const context = browser.defaultBrowserContext();
  const fbBot = new FBBot(context, DEBUG_USER_ID, false);
  
  if (!await fbBot.init()) {
    throw new Error('FBBot init failed');
  }
  
  page = fbBot.page;
  
  Log.info('[PERSISTENT]', '🌐 Navigace na Facebook...');
  
  // Zkontroluj jestli Chrome zobrazuje "Restore pages?" dialog
  await Wait.toSeconds(1, 'Kontrola Chrome dialogs');
  
  try {
    // Pokud je restore dialog, odmítni ho
    await page.evaluate(() => {
      const restoreButton = document.querySelector('button');
      if (restoreButton && restoreButton.textContent.includes('Restore')) {
        // Klikni na "No" nebo "Cancel" 
        const noButton = Array.from(document.querySelectorAll('button')).find(btn => 
          btn.textContent.includes('No') || btn.textContent.includes('Cancel')
        );
        if (noButton) noButton.click();
      }
    });
  } catch (err) {
    // Ignore - možná dialog není přítomen
  }
  
  await page.goto('https://www.facebook.com/', { waitUntil: 'networkidle2' });
  await Wait.toSeconds(3, 'Načtení FB stránky');
  
  // Initial screenshot
  await page.screenshot({ path: '/tmp/persistent_init.png' });
  Log.info('[PERSISTENT]', '📷 Init screenshot: /tmp/persistent_init.png');
  
  currentStep = 'cookies_visible';
  
  Log.success('[PERSISTENT]', '✅ Persistent session inicializována');
  console.log('🍪 Cookies modal by měl být viditelný');
  console.log('➡️  Další krok: node persistent_fb_session.js decline-cookies');
}

/**
 * Připojí se k běžícímu browser procesu
 */
async function connectToExistingBrowser() {
  Log.info('[PERSISTENT]', '🔗 Připojuji se k běžícímu browser...');
  
  try {
    // Pokus o připojení k běžící instanci
    browser = await puppeteer.connect({ 
      browserURL: 'http://127.0.0.1:9222' 
    });
    
    const pages = await browser.pages();
    if (pages.length > 0) {
      page = pages[pages.length - 1]; // Poslední aktivní page
      Log.success('[PERSISTENT]', '✅ Připojen k existujícímu browser');
      return true;
    }
  } catch (err) {
    Log.warn('[PERSISTENT]', 'Nepodařilo se připojit k existujícímu browser');
    return false;
  }
  
  return false;
}

/**
 * Spustit požadovaný příkaz
 */
async function executeCommand(command) {
  // Pokud browser není inicialiovaný, zkus se připojit
  if (!browser || !page) {
    const connected = await connectToExistingBrowser();
    if (!connected) {
      Log.info('[PERSISTENT]', 'Browser neběží, spouštím inicializaci...');
      await initializeSession();
      return;
    }
  }
  
  switch (command) {
    case 'init':
    case 'start':
      // Už proběhla inicializace
      break;
      
    case 'decline-cookies':
      await declineCookies();
      break;
      
    case 'open-registration':
      await openRegistration();
      break;
      
    case 'analyze':
      await analyzeCurrentPage();
      break;
      
    case 'screenshot':
      await takeScreenshot();
      break;
      
    case 'status':
      await showStatus();
      break;
      
    default:
      console.log(`❌ Neznámý příkaz: ${command}`);
      console.log('✅ Dostupné příkazy: init, decline-cookies, open-registration, analyze, screenshot, status');
  }
}

/**
 * Decline cookies krok
 */
async function declineCookies() {
  console.log('\n🍪 === DECLINE COOKIES ===');
  
  try {
    // Najdi PŘESNÝ text "Decline optional cookies" tlačítko
    const declineButton = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('div[role="button"], button'));
      return buttons.find(btn => 
        btn.textContent && 
        btn.textContent.trim() === 'Decline optional cookies' &&
        btn.offsetParent !== null
      );
    });
    
    if (declineButton) {
      console.log('✅ Nalezeno "Decline optional cookies" tlačítko');
      
      // Klik na nalezené tlačítko
      await page.evaluate((button) => button.click(), declineButton);
      console.log('🖱️ Kliknuto na "Decline optional cookies"');
      
      await Wait.toSeconds(3, 'Čekání na zmizení cookies modal');
      
      // Screenshot po decline
      await page.screenshot({ path: '/tmp/after_decline_cookies.png' });
      console.log('📷 Screenshot: /tmp/after_decline_cookies.png');
      
      currentStep = 'cookies_declined';
      console.log('✅ Cookies odmítnuto');
      console.log('➡️  Další krok: node persistent_fb_session.js open-registration');
      
    } else {
      console.log('❌ "Decline optional cookies" tlačítko nenalezeno');
      console.log('🔍 Spusť: node persistent_fb_session.js analyze');
    }
    
  } catch (err) {
    console.log(`❌ Chyba při decline cookies: ${err.message}`);
  }
}

/**
 * Otevřít registrační formulář
 */
async function openRegistration() {
  console.log('\n📝 === OPEN REGISTRATION ===');
  
  try {
    // Najdi "Create new account" tlačítko
    const regButton = await page.$('[data-testid="open-registration-form-button"]');
    
    if (regButton) {
      const buttonText = await regButton.evaluate(el => el.textContent);
      console.log(`✅ Nalezeno registrační tlačítko: "${buttonText}"`);
      
      await regButton.click();
      console.log('🖱️ Kliknuto na Create new account');
      
      await Wait.toSeconds(5, 'Čekání na otevření registračního formuláře');
      
      // Screenshot registračního formuláře
      await page.screenshot({ path: '/tmp/registration_form_opened.png' });
      console.log('📷 Screenshot: /tmp/registration_form_opened.png');
      
      // Zkontroluj jestli se formulář otevřel
      const formInputs = await page.$$('input[name="firstname"], input[name="lastname"]');
      if (formInputs.length > 0) {
        console.log('🎉 Registrační formulář se otevřel!');
        currentStep = 'registration_open';
        
        // Analyzuj formulář
        const inputs = await page.$$eval('input', inputs => 
          inputs
            .filter(input => input.offsetParent !== null)
            .map(input => ({
              name: input.name,
              type: input.type,
              placeholder: input.placeholder,
              required: input.required
            }))
        );
        
        console.log('📋 Formulář obsahuje:');
        inputs.forEach((input, i) => {
          console.log(`  ${i+1}. ${input.name} (${input.type}): "${input.placeholder}"`);
        });
        
        console.log('➡️  Nyní můžeš formulář vyplnit ručně na Chrome Remote Desktop');
        
      } else {
        console.log('❓ Registrační formulář se možná neotevřel');
        console.log('🔍 Spusť analýzu: node persistent_fb_session.js analyze');
      }
      
    } else {
      console.log('❌ Registrační tlačítko nenalezeno');
      console.log('🔍 Možná cookies modal stále blokuje - spusť: node persistent_fb_session.js analyze');
    }
    
  } catch (err) {
    console.log(`❌ Chyba při otevírání registrace: ${err.message}`);
  }
}

/**
 * Analyzuj současnou stránku
 */
async function analyzeCurrentPage() {
  console.log('\n🔍 === CURRENT PAGE ANALYSIS ===');
  
  try {
    const pageInfo = {
      url: page.url(),
      title: await page.title()
    };
    
    console.log(`📄 URL: ${pageInfo.url}`);
    console.log(`📄 Title: ${pageInfo.title}`);
    
    // Počet elementů
    const elements = await page.evaluate(() => ({
      totalElements: document.querySelectorAll('*').length,
      visibleElements: Array.from(document.querySelectorAll('*')).filter(el => el.offsetParent !== null).length,
      buttons: Array.from(document.querySelectorAll('button')).filter(el => el.offsetParent !== null).length,
      inputs: Array.from(document.querySelectorAll('input')).filter(el => el.offsetParent !== null).length,
      cookiesModal: document.querySelector('[data-testid="cookie-policy-manage-dialog"]') ? 'VISIBLE' : 'HIDDEN',
      regButton: document.querySelector('[data-testid="open-registration-form-button"]') ? 'VISIBLE' : 'HIDDEN'
    }));
    
    console.log(`📊 Visible elements: ${elements.visibleElements}/${elements.totalElements}`);
    console.log(`🔘 Buttons: ${elements.buttons}`);
    console.log(`💻 Inputs: ${elements.inputs}`);
    console.log(`🍪 Cookies modal: ${elements.cookiesModal}`);
    console.log(`📝 Registration button: ${elements.regButton}`);
    console.log(`📍 Current step: ${currentStep}`);
    
    // Screenshot
    await takeScreenshot();
    
  } catch (err) {
    console.log(`❌ Chyba při analýze: ${err.message}`);
  }
}

/**
 * Screenshot
 */
async function takeScreenshot() {
  const filename = `/tmp/persistent_${Date.now()}.png`;
  await page.screenshot({ path: filename });
  console.log(`📷 Screenshot: ${filename}`);
}

/**
 * Zobraz status
 */
async function showStatus() {
  console.log('\n📋 === SESSION STATUS ===');
  console.log(`🎯 Current step: ${currentStep}`);
  console.log(`🌐 Browser running: ${browser ? '✅ YES' : '❌ NO'}`);
  console.log(`📄 Page ready: ${page ? '✅ YES' : '❌ NO'}`);
  
  if (page) {
    console.log(`🔗 URL: ${page.url()}`);
  }
  
  console.log('\n🔄 Dostupné příkazy:');
  console.log('  decline-cookies  - Odmítnout cookies');
  console.log('  open-registration - Otevřít registrační formulář');
  console.log('  analyze          - Analyzovat současný stav');  
  console.log('  screenshot       - Udělat screenshot');
  console.log('  status           - Zobrazit tento status');
}

/**
 * Spustit persistent browser
 */
async function launchPersistentBrowser(user) {
  const profileDir = `Profile${user.id}`;
  const userDataDir = '/home/remotes/Chromium';
  
  const lockFile = path.join(userDataDir, profileDir, 'SingletonLock');
  try { fs.unlinkSync(lockFile); } catch {}
  
  Log.info('[PERSISTENT]', `🚀 Spouštím persistent browser: ${profileDir}`);
  
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: [
      '--suppress-message-center-popups',
      '--disable-notifications',
      '--start-maximized',
      '--no-sandbox',
      `--user-data-dir=${userDataDir}`,
      `--profile-directory=${profileDir}`,
      '--remote-debugging-port=9222' // Pro připojení z dalších příkazů
    ]
  });
  
  const context = browser.defaultBrowserContext();
  await context.overridePermissions('https://www.facebook.com', []);
  
  return browser;
}