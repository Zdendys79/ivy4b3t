/**
 * INTERAKTIVNÍ Facebook debugging - zůstává otevřený
 * - Spustí browser a čeká na pokyny
 * - Umožňuje ruční zásahy uživateli
 * - Reaguje na simple příkazy přes console
 */

import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer';
import readline from 'readline';

import { db } from './iv_sql.js';
import { FBBot } from './libs/iv_fb.class.js';
import { Log } from './libs/iv_log.class.js';
import { Wait } from './libs/iv_wait.class.js';

const isLinux = process.platform === 'linux';
const DEBUG_USER_ID = 997;
let browser;
let fbBot;
let page;

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🔴 Ukončuji interaktivní session...');
  if (browser) {
    console.log('📋 Browser zůstává otevřený pro další experimenty Nyary');
    // NEUKONČOVAT browser - Nyara ho potřebuje pro učení!
  }
  process.exit(0);
});

(async () => {
  try {
    Log.info('[INTERACTIVE]', '🚀 Spouštím interaktivní FB debugging session...');
    
    // Setup
    const user = await db.getUserById(DEBUG_USER_ID);
    if (!user) {
      throw new Error(`Debug user ${DEBUG_USER_ID} neexistuje`);
    }
    
    // Spustit browser
    browser = await launchInteractiveBrowser(user);
    const context = browser.defaultBrowserContext();
    fbBot = new FBBot(context, DEBUG_USER_ID, false);
    
    if (!await fbBot.init()) {
      throw new Error('FBBot init failed');
    }
    
    page = fbBot.page;
    
    Log.success('[INTERACTIVE]', '✅ Browser spuštěn a připraven');
    Log.info('[INTERACTIVE]', '🌐 Navigace na Facebook...');
    
    // Navigace na FB
    await page.goto('https://www.facebook.com/', { waitUntil: 'networkidle2' });
    await Wait.toSeconds(3, 'Načtení FB stránky');
    
    // Screenshot úvodní stav
    await page.screenshot({ path: '/tmp/interactive_start.png' });
    Log.info('[INTERACTIVE]', '📷 Úvodní screenshot: /tmp/interactive_start.png');
    
    // Analýza úvodního stavu
    await analyzeCurrentState();
    
    Log.success('[INTERACTIVE]', '🎮 INTERAKTIVNÍ REŽIM AKTIVNÍ');
    console.log('\n' + '='.repeat(50));
    console.log('🎮 INTERAKTIVNÍ FB DEBUGGING');
    console.log('='.repeat(50));
    console.log('📋 Browser je otevřený - Nyara se učí FB ovládat');
    console.log('⌨️  Dostupné příkazy pro Nyara:');
    console.log('  - cookies       : Analyzuj cookies modal');
    console.log('  - click-cookies : Klikni "Decline optional cookies"');  
    console.log('  - registration  : Analyzuj registrační tlačítko');
    console.log('  - click-register: Klikni na "Create new account"');
    console.log('  - screenshot    : Udělej screenshot');
    console.log('  - analyze       : Analyzuj současný stav');
    console.log('  - help          : Zobraz nápovědu');
    console.log('  - exit          : Ukončit (browser zůstane otevřený)');
    console.log('='.repeat(50));
    
    // Interaktivní command loop
    await commandLoop();
    
  } catch (err) {
    Log.error('[INTERACTIVE]', `Chyba: ${err.message}`);
    console.error(err);
  } finally {
    console.log('\n🔴 Session ukončena, browser zůstává otevřený pro ruční kontrolu');
  }
})();

/**
 * Hlavní command loop pro interaktivní ovládání
 */
async function commandLoop() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '🎮 FB-Debug> '
  });
  
  rl.prompt();
  
  rl.on('line', async (input) => {
    const command = input.trim().toLowerCase();
    
    try {
      switch (command) {
        case 'cookies':
          await analyzeCookies();
          break;
          
        case 'click-cookies':
          await clickCookies();
          break;
          
        case 'registration':
          await analyzeRegistration();
          break;
          
        case 'click-register':
          await clickRegistration();
          break;
          
        case 'screenshot':
          await takeScreenshot();
          break;
          
        case 'analyze':
          await analyzeCurrentState();
          break;
          
        case 'help':
          showHelp();
          break;
          
        case 'exit':
          console.log('👋 Ukončuji session, browser zůstává otevřený');
          rl.close();
          return;
          
        default:
          if (command) {
            console.log(`❌ Neznámý příkaz: "${command}". Zadej "help" pro nápovědu.`);
          }
      }
    } catch (err) {
      console.log(`❌ Chyba při vykonávání příkazu: ${err.message}`);
    }
    
    rl.prompt();
  });
  
  rl.on('close', () => {
    console.log('\n👋 Command loop ukončen');
    process.exit(0);
  });
}

/**
 * Analyzuj cookies modal
 */
async function analyzeCookies() {
  console.log('🍪 Analyzuji cookies modal...');
  
  const cookieSelectors = [
    '[data-testid="cookie-policy-banner"]',
    '[data-testid="cookie-policy-dialog"]',
    '[role="dialog"]',
    'div[style*="z-index"]'
  ];
  
  for (const selector of cookieSelectors) {
    const elements = await page.$$(selector);
    if (elements.length > 0) {
      console.log(`✅ Nalezen cookies element: ${selector} (${elements.length} prvků)`);
      
      // Detailní analýza
      for (let i = 0; i < Math.min(2, elements.length); i++) {
        const detail = await elements[i].evaluate(el => ({
          textSnippet: el.textContent?.substring(0, 200),
          isVisible: el.offsetParent !== null,
          zIndex: window.getComputedStyle(el).zIndex
        }));
        
        console.log(`  ${i+1}. Visible: ${detail.isVisible}, z-index: ${detail.zIndex}`);
        console.log(`     Text: "${detail.textSnippet}"`);
      }
    }
  }
  
  // Hledej cookies tlačítka
  const buttonText = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    return buttons
      .filter(btn => btn.offsetParent !== null && 
                    (btn.textContent.toLowerCase().includes('cookie') ||
                     btn.textContent.toLowerCase().includes('decline') ||
                     btn.textContent.toLowerCase().includes('allow')))
      .map(btn => ({
        text: btn.textContent,
        className: btn.className,
        id: btn.id
      }));
  });
  
  console.log(`🔘 Cookies tlačítka nalezena: ${buttonText.length}`);
  buttonText.forEach((btn, i) => {
    console.log(`  ${i+1}. "${btn.text}"`);
  });
}

/**
 * Klikni na decline cookies
 */
async function clickCookies() {
  console.log('🖱️ Zkouším kliknout "Decline optional cookies"...');
  
  // Hledej tlačítko s textem o cookies
  const declineButton = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    return buttons.find(btn => 
      btn.offsetParent !== null && 
      (btn.textContent.toLowerCase().includes('decline') && 
       btn.textContent.toLowerCase().includes('cookie'))
    );
  });
  
  if (declineButton) {
    await page.evaluate((button) => button.click(), declineButton);
    console.log('✅ Kliknuto na decline cookies');
    
    await Wait.toSeconds(2, 'Čekání po decline cookies');
    await page.screenshot({ path: '/tmp/after_cookies.png' });
    console.log('📷 Screenshot po cookies: /tmp/after_cookies.png');
  } else {
    console.log('❌ Decline cookies tlačítko nenalezeno');
    
    // Zkus obecnější přístup
    try {
      await page.click('button[data-testid*="cookie"]');
      console.log('✅ Kliknuto na obecné cookies tlačítko');
    } catch {
      console.log('❌ Žádné cookies tlačítko se nepodařilo najít');
    }
  }
}

/**
 * Analyzuj registrační tlačítko
 */
async function analyzeRegistration() {
  console.log('📝 Analyzuji registrační tlačítko...');
  
  const regButton = await page.$('[data-testid="open-registration-form-button"]');
  if (regButton) {
    const detail = await regButton.evaluate(el => ({
      text: el.textContent,
      isVisible: el.offsetParent !== null,
      href: el.href,
      disabled: el.disabled
    }));
    
    console.log('✅ Registrační tlačítko nalezeno:');
    console.log(`   Text: "${detail.text}"`);
    console.log(`   Visible: ${detail.isVisible}`);
    console.log(`   Disabled: ${detail.disabled}`);
  } else {
    console.log('❌ Registrační tlačítko nenalezeno');
  }
}

/**
 * Klikni na registrační tlačítko
 */
async function clickRegistration() {
  console.log('🖱️ Klikám na "Create new account"...');
  
  try {
    const regButton = await page.$('[data-testid="open-registration-form-button"]');
    if (regButton) {
      await regButton.click();
      console.log('✅ Kliknuto na registrační tlačítko');
      
      await Wait.toSeconds(3, 'Čekání na otevření formuláře');
      await page.screenshot({ path: '/tmp/after_register_click.png' });
      console.log('📷 Screenshot po kliku: /tmp/after_register_click.png');
      
      // Zkontroluj jestli se otevřel formulář
      const inputs = await page.$$('input[name="firstname"], input[name="lastname"]');
      if (inputs.length > 0) {
        console.log('🎉 Registrační formulář se otevřel!');
      } else {
        console.log('❓ Formulář se možná neotevřel nebo je skrytý');
      }
      
    } else {
      console.log('❌ Registrační tlačítko nenalezeno');
    }
  } catch (err) {
    console.log(`❌ Chyba při kliku: ${err.message}`);
  }
}

/**
 * Udělaj screenshot
 */
async function takeScreenshot() {
  const filename = `/tmp/interactive_${Date.now()}.png`;
  await page.screenshot({ path: filename });
  console.log(`📷 Screenshot uložen: ${filename}`);
}

/**
 * Analyzuj současný stav
 */
async function analyzeCurrentState() {
  console.log('🔍 Analyzuji současný stav stránky...');
  
  const pageInfo = {
    url: page.url(),
    title: await page.title(),
    visibleInputs: await page.$$eval('input', inputs => 
      inputs.filter(input => input.offsetParent !== null).length
    ),
    visibleButtons: await page.$$eval('button', buttons => 
      buttons.filter(btn => btn.offsetParent !== null).length
    )
  };
  
  console.log(`📄 URL: ${pageInfo.url}`);
  console.log(`📄 Title: ${pageInfo.title}`);
  console.log(`💻 Visible inputs: ${pageInfo.visibleInputs}`);
  console.log(`🔘 Visible buttons: ${pageInfo.visibleButtons}`);
}

/**
 * Zobraz nápovědu
 */
function showHelp() {
  console.log('\n📖 NÁPOVĚDA - Dostupné příkazy:');
  console.log('  cookies        - Analyzuj cookies modal na stránce');
  console.log('  click-cookies  - Automaticky klikni "Decline optional cookies"');
  console.log('  registration   - Zkontroluj registrační tlačítko');
  console.log('  click-register - Klikni na "Create new account"');
  console.log('  screenshot     - Udělej screenshot aktuálního stavu');
  console.log('  analyze        - Základní analýza stránky (URL, title, počet prvků)');
  console.log('  help           - Zobraz tuto nápovědu');
  console.log('  exit           - Ukončit session (browser zůstane otevřený)');
  console.log('\n🧠 UČENÍ: Nyara experimentuje s FB elementy a učí se je ovládat');
}

/**
 * Launch interactive browser
 */
async function launchInteractiveBrowser(user) {
  const profileDir = `Profile${user.id}`;
  const userDataDir = '/home/remotes/Chromium';
  
  // Vyčisti SingletonLock
  const lockFile = path.join(userDataDir, profileDir, 'SingletonLock');
  try {
    fs.unlinkSync(lockFile);
    Log.info('[INTERACTIVE]', `SingletonLock pro ${profileDir} odstraněn`);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      Log.warn('[INTERACTIVE]', `SingletonLock warning: ${err.message}`);
    }
  }
  
  Log.info('[INTERACTIVE]', `Spouštím interaktivní browser: ${profileDir}`);
  
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: [
      '--suppress-message-center-popups',
      '--disable-notifications',
      '--disable-infobars', 
      '--start-maximized',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      `--user-data-dir=${userDataDir}`,
      `--profile-directory=${profileDir}`,
      '--remote-debugging-port=9222' // Pro případné externí připojení
    ]
  });
  
  // Nastav permissions
  const context = browser.defaultBrowserContext();
  await context.overridePermissions('https://www.facebook.com', []);
  await context.overridePermissions('https://m.facebook.com', []);
  
  return browser;
}