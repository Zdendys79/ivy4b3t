/**
 * PŘÍMÉ INTERAKTIVNÍ FB OVLÁDÁNÍ
 * - Jeden běžící proces s readline
 * - Žádné komplexní připojování
 * - Přímá komunikace s browser přes console
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

const DEBUG_USER_ID = 997;
let browser;
let page;
let step = 'init';

// File-based communication kanál
const COMMAND_FILE = '/tmp/fb_commands.txt';
const RESPONSE_FILE = '/tmp/fb_responses.txt';

// Inicializace communication files
if (fs.existsSync(COMMAND_FILE)) fs.unlinkSync(COMMAND_FILE);
if (fs.existsSync(RESPONSE_FILE)) fs.unlinkSync(RESPONSE_FILE);

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🔴 Ukončuji session...');
  console.log('⚠️  BROWSER ZŮSTÁVÁ OTEVŘENÝ pro ruční kontrolu');
  
  // Cleanup communication files
  try {
    if (fs.existsSync(COMMAND_FILE)) fs.unlinkSync(COMMAND_FILE);
    if (fs.existsSync(RESPONSE_FILE)) fs.unlinkSync(RESPONSE_FILE);
  } catch {}
  
  process.exit(0);
});

let commandWatcher;

(async () => {
  try {
    console.log('🚀 === INTERAKTIVNÍ FB OVLÁDÁNÍ ===');
    console.log('Inicializuji browser...');
    
    await initializeBrowser();
    
    console.log('\n✅ Browser připraven!');
    console.log('📋 Dostupné příkazy:');
    console.log('  analyze     - Analyzovat současný stav');
    console.log('  cookies     - Decline cookies');  
    console.log('  register    - Otevřít registraci');
    console.log('  screenshot  - Udělat screenshot');
    console.log('  help        - Zobrazit nápovědu');
    console.log('  exit        - Ukončit (browser zůstane)');
    
    // Prvotní analýza
    await analyzePage();
    
    // Spustit file watcher pro komunikaci
    startCommandWatcher();
    
    console.log('\n📡 KOMUNIKAČNÍ KANÁL AKTIVNÍ:');
    console.log(`📝 Pošli příkaz: echo "analyze" > ${COMMAND_FILE}`);
    console.log(`📖 Přečti odpověď: cat ${RESPONSE_FILE}`);
    
    // Nekonečný běh - čeká na file commands
    await new Promise(() => {});
    
  } catch (err) {
    console.log(`❌ Kritická chyba: ${err.message}`);
    process.exit(1);
  }
})();

/**
 * Spuštění file watcher pro komunikační kanál
 */
function startCommandWatcher() {
  console.log('👂 Spouštím command watcher...');
  
  // Kontroluj command file každou sekundu
  commandWatcher = setInterval(async () => {
    if (fs.existsSync(COMMAND_FILE)) {
      try {
        const commandLine = fs.readFileSync(COMMAND_FILE, 'utf8').trim();
        const parts = commandLine.split(' ');
        const command = parts[0].toLowerCase();
        
        if (command) {
          console.log(`📨 Přijat příkaz: "${commandLine}"`);
          
          // Smaž command file
          fs.unlinkSync(COMMAND_FILE);
          
          // Vykonej příkaz a zapíš odpověď
          let response = '';
          
          try {
            switch (command) {
              case 'analyze':
              case 'a':
                response = await executeAnalyze();
                break;
                
              case 'cookies':
              case 'c':
                response = await executeDeclineCookies();
                break;
                
              case 'register':
              case 'r':
                response = await executeOpenRegistration();
                break;
                
              case 'screenshot':
              case 's':
                response = await executeScreenshot();
                break;
                
              case 'help':
              case 'h':
                response = getHelpText();
                break;
                
              case 'status':
                response = getStatus();
                break;
                
              case 'new_tab':
              case 'nt':
                const url = parts[1] || 'https://registrace.seznam.cz/';
                response = await executeNewTab(url);
                break;
                
              case 'facebook':
              case 'fb':
                response = await executeOpenFacebook();
                break;
                
              default:
                response = `❌ Neznámý příkaz: "${command}"\nDostupné: analyze, cookies, register, screenshot, help, status, new_tab, facebook`;
            }
            
          } catch (err) {
            response = `❌ Chyba při vykonávání příkazu: ${err.message}`;
          }
          
          // Zapíš odpověď do response file
          fs.writeFileSync(RESPONSE_FILE, `[${new Date().toLocaleTimeString()}] ${response}\n\n`, 'utf8');
          
          console.log(`📤 Odpověď zapsána do ${RESPONSE_FILE}`);
        }
        
      } catch (err) {
        console.log(`❌ Chyba při čtení command file: ${err.message}`);
      }
    }
  }, 1000); // Každou sekundu
}

/**
 * Execute functions pro file communication
 */
async function executeAnalyze() {
  const pageInfo = {
    url: page.url(),
    title: await page.title()
  };
  
  const cookiesModal = await page.$('[data-testid="cookie-policy-manage-dialog"]');
  const regButton = await page.$('[data-testid="open-registration-form-button"]');
  
  const counts = await page.evaluate(() => ({
    buttons: document.querySelectorAll('button').length,
    inputs: document.querySelectorAll('input').length,
    visibleButtons: Array.from(document.querySelectorAll('button')).filter(b => b.offsetParent !== null).length,
    visibleInputs: Array.from(document.querySelectorAll('input')).filter(i => i.offsetParent !== null).length
  }));
  
  let result = `🔍 ANALÝZA STRÁNKY:\n`;
  result += `📄 URL: ${pageInfo.url}\n`;
  result += `📄 Title: ${pageInfo.title}\n`;
  result += `📍 Step: ${step}\n`;
  result += `🍪 Cookies modal: ${cookiesModal ? '✅ VISIBLE' : '❌ HIDDEN'}\n`;
  result += `📝 Registration button: ${regButton ? '✅ VISIBLE' : '❌ HIDDEN'}\n`;
  result += `🔘 Buttons: ${counts.visibleButtons}/${counts.buttons}\n`;
  result += `💻 Inputs: ${counts.visibleInputs}/${counts.inputs}`;
  
  return result;
}

async function executeDeclineCookies() {
  const success = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button, div[role="button"]'));
    
    for (const btn of buttons) {
      if (btn.textContent && 
          btn.textContent.trim().includes('Decline optional cookies') &&
          btn.offsetParent !== null) {
        
        btn.click();
        return true;
      }
    }
    
    return false;
  });
  
  if (success) {
    await Wait.toSeconds(3, 'Čekání na zmizení cookies modal');
    step = 'cookies_declined';
    return '✅ Cookies declined úspěšně! Cookies modal by měl být pryč.';
  } else {
    return '❌ "Decline optional cookies" tlačítko nenalezeno. Zkus "analyze" pro detaily.';
  }
}

async function executeOpenRegistration() {
  const regButton = await page.$('[data-testid="open-registration-form-button"]');
  
  if (regButton) {
    const buttonText = await regButton.evaluate(el => el.textContent);
    await regButton.click();
    await Wait.toSeconds(3, 'Čekání na otevření formuláře');
    
    const formInputs = await page.$$('input[name="firstname"], input[name="lastname"]');
    if (formInputs.length > 0) {
      step = 'registration_open';
      return '🎉 Registrační formulář se otevřel úspěšně!';
    } else {
      return '❓ Registrační tlačítko kliknuto, ale formulář se možná neotevřel.';
    }
    
  } else {
    return '❌ Registrační tlačítko nenalezeno. Možná cookies modal stále blokuje.';
  }
}

async function executeScreenshot() {
  const filename = `/tmp/fb_${Date.now()}.png`;
  await page.screenshot({ path: filename });
  return `📷 Screenshot uložen: ${filename}`;
}

async function executeNewTab(url) {
  try {
    const newPage = await browser.newPage();
    await newPage.goto(url, { waitUntil: 'networkidle0' });
    
    const title = await newPage.title();
    return `🆕 Nová záložka otevřena: ${title}\n📄 URL: ${url}`;
  } catch (err) {
    return `❌ Chyba při otevírání nové záložky: ${err.message}`;
  }
}

async function executeOpenFacebook() {
  try {
    await page.goto('https://www.facebook.com/', { waitUntil: 'networkidle0' });
    await Wait.toSeconds(1, 'Čekání na načtení FB');
    
    step = 'facebook_loaded';
    const title = await page.title();
    return `📘 Facebook otevřen: ${title}\n📄 URL: ${page.url()}`;
  } catch (err) {
    return `❌ Chyba při otevírání Facebooku: ${err.message}`;
  }
}

function getHelpText() {
  return `📖 DOSTUPNÉ PŘÍKAZY:
analyze - Analyzovat současný stav
cookies - Decline optional cookies
register - Otevřít registraci  
screenshot - Udělat screenshot
new_tab [url] - Otevřít novou záložku
facebook - Otevřít Facebook
help - Tato nápověda
status - Status session

POUŽITÍ:
echo "analyze" > ${COMMAND_FILE}
cat ${RESPONSE_FILE}`;
}

function getStatus() {
  return `📊 SESSION STATUS:
🎯 Step: ${step}
🌐 Browser: ${browser ? 'RUNNING' : 'STOPPED'}
📄 Page: ${page ? 'READY' : 'NOT_READY'}
📡 Watcher: ${commandWatcher ? 'ACTIVE' : 'INACTIVE'}`;
}

/**
 * Inicializace browser a Facebook
 */
async function initializeBrowser() {
  const user = await db.getUserById(DEBUG_USER_ID);
  if (!user) {
    throw new Error(`Debug user ${DEBUG_USER_ID} neexistuje`);
  }
  
  // Launch browser
  const profileDir = `Profile${user.id}`;
  const userDataDir = '/home/remotes/Chromium';
  
  const lockFile = path.join(userDataDir, profileDir, 'SingletonLock');
  try { fs.unlinkSync(lockFile); } catch {}
  
  browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: [
      '--suppress-message-center-popups',
      '--disable-notifications',
      '--start-maximized',
      '--no-sandbox',
      `--user-data-dir=${userDataDir}`,
      `--profile-directory=${profileDir}`
    ]
  });
  
  const context = browser.defaultBrowserContext();
  await context.overridePermissions('https://www.facebook.com', []);
  
  const fbBot = new FBBot(context, DEBUG_USER_ID, false);
  if (!await fbBot.init()) {
    throw new Error('FBBot init failed');
  }
  
  page = fbBot.page;
  
  step = 'ready';
}

/**
 * Analyzuj současnou stránku
 */
async function analyzePage() {
  console.log('\n🔍 === ANALÝZA STRÁNKY ===');
  
  const pageInfo = {
    url: page.url(),
    title: await page.title()
  };
  
  console.log(`📄 URL: ${pageInfo.url}`);
  console.log(`📄 Title: ${pageInfo.title}`);
  console.log(`📍 Step: ${step}`);
  
  // Cookies modal check
  const cookiesModal = await page.$('[data-testid="cookie-policy-manage-dialog"]');
  console.log(`🍪 Cookies modal: ${cookiesModal ? '✅ VISIBLE' : '❌ HIDDEN'}`);
  
  // Registration button check
  const regButton = await page.$('[data-testid="open-registration-form-button"]');
  console.log(`📝 Registration button: ${regButton ? '✅ VISIBLE' : '❌ HIDDEN'}`);
  
  // Count elements
  const counts = await page.evaluate(() => ({
    buttons: document.querySelectorAll('button').length,
    inputs: document.querySelectorAll('input').length,
    visibleButtons: Array.from(document.querySelectorAll('button')).filter(b => b.offsetParent !== null).length,
    visibleInputs: Array.from(document.querySelectorAll('input')).filter(i => i.offsetParent !== null).length
  }));
  
  console.log(`🔘 Buttons: ${counts.visibleButtons}/${counts.buttons}`);
  console.log(`💻 Inputs: ${counts.visibleInputs}/${counts.inputs}`);
  
  // Pokud cookies modal existuje, analyzuj jeho tlačítka
  if (cookiesModal) {
    console.log('\n🍪 COOKIES MODAL BUTTONS:');
    
    const cookieButtons = await page.evaluate(() => {
      const modal = document.querySelector('[data-testid="cookie-policy-manage-dialog"]');
      if (!modal) return [];
      
      const buttons = Array.from(modal.querySelectorAll('button, div[role="button"]'));
      return buttons
        .filter(btn => btn.offsetParent !== null)
        .map(btn => ({
          text: btn.textContent?.trim(),
          ariaLabel: btn.getAttribute('aria-label'),
          className: btn.className
        }));
    });
    
    cookieButtons.forEach((btn, i) => {
      console.log(`  ${i+1}. "${btn.text}"${btn.ariaLabel ? ` (${btn.ariaLabel})` : ''}`);
    });
  }
}

/**
 * Decline cookies
 */
async function declineCookies() {
  console.log('\n🍪 === DECLINE COOKIES ===');
  
  try {
    // Najdi přesný text "Decline optional cookies"
    const success = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, div[role="button"]'));
      
      for (const btn of buttons) {
        if (btn.textContent && 
            btn.textContent.trim().includes('Decline optional cookies') &&
            btn.offsetParent !== null) {
          
          console.log(`Našel jsem tlačítko: "${btn.textContent.trim()}"`);
          btn.click();
          return true;
        }
      }
      
      return false;
    });
    
    if (success) {
      console.log('✅ Kliknuto na "Decline optional cookies"');
      await Wait.toSeconds(3, 'Čekání na zmizení cookies modal');
      
      step = 'cookies_declined';
      console.log('🎉 Cookies modal by měl být pryč!');
      
      // Rychlá re-analýza
      await analyzePage();
      
    } else {
      console.log('❌ "Decline optional cookies" tlačítko nenalezeno');
      console.log('💡 Zkus "analyze" pro detailní přehled');
    }
    
  } catch (err) {
    console.log(`❌ Chyba při decline cookies: ${err.message}`);
  }
}

/**
 * Otevřít registraci
 */
async function openRegistration() {
  console.log('\n📝 === OPEN REGISTRATION ===');
  
  try {
    const regButton = await page.$('[data-testid="open-registration-form-button"]');
    
    if (regButton) {
      const buttonText = await regButton.evaluate(el => el.textContent);
      console.log(`✅ Našel jsem: "${buttonText}"`);
      
      await regButton.click();
      console.log('🖱️ Kliknuto na registrační tlačítko');
      
      await Wait.toSeconds(3, 'Čekání na otevření formuláře');
      
      step = 'registration_opening';
      
      // Check if form opened
      const formInputs = await page.$$('input[name="firstname"], input[name="lastname"]');
      if (formInputs.length > 0) {
        console.log('🎉 Registrační formulář se otevřel!');
        step = 'registration_open';
        
        // Analyze form
        const inputs = await page.$$eval('input', inputs => 
          inputs
            .filter(input => input.offsetParent !== null)
            .map(input => ({
              name: input.name,
              type: input.type,
              placeholder: input.placeholder
            }))
        );
        
        console.log('📋 Formulář obsahuje:');
        inputs.forEach((input, i) => {
          console.log(`  ${i+1}. ${input.name} (${input.type}): "${input.placeholder}"`);
        });
        
      } else {
        console.log('❓ Formulář se možná neotevřel - zkus "analyze"');
      }
      
    } else {
      console.log('❌ Registrační tlačítko nenalezeno');
      console.log('💡 Možná cookies modal stále blokuje - zkus "cookies"');
    }
    
  } catch (err) {
    console.log(`❌ Chyba při otevírání registrace: ${err.message}`);
  }
}

/**
 * Screenshot
 */
async function takeScreenshot() {
  const filename = `/tmp/fb_${Date.now()}.png`;
  await page.screenshot({ path: filename });
  console.log(`📷 Screenshot: ${filename}`);
}

/**
 * Help
 */
function showHelp() {
  console.log('\n📖 === NÁPOVĚDA ===');
  console.log('Dostupné příkazy (můžeš použít zkratky):');
  console.log('  analyze (a)    - Analyzovat současný stav stránky');
  console.log('  cookies (c)    - Kliknout "Decline optional cookies"');
  console.log('  register (r)   - Otevřít registrační formulář');
  console.log('  screenshot (s) - Udělat screenshot');
  console.log('  help (h)       - Zobrazit tuto nápovědu');
  console.log('  exit (q)       - Ukončit session (browser zůstane)');
  console.log('\n💡 TIP: Browser je otevřený na Chrome Remote Desktop pro ruční kontrolu');
}