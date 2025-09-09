/**
 * Jednoduché FB příkazy - bez readline, přímo spuštění
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

// Předání příkazu jako argument
const command = process.argv[2] || 'analyze';

(async () => {
  try {
    Log.info('[FB_CMD]', `🎯 Spouštím FB příkaz: ${command}`);
    
    const user = await db.getUserById(DEBUG_USER_ID);
    if (!user) {
      throw new Error(`Debug user ${DEBUG_USER_ID} neexistuje`);
    }
    
    // Spustit browser
    browser = await launchBrowser(user);
    const context = browser.defaultBrowserContext();
    const fbBot = new FBBot(context, DEBUG_USER_ID, false);
    
    if (!await fbBot.init()) {
      throw new Error('FBBot init failed');
    }
    
    page = fbBot.page;
    
    // Navigace
    await page.goto('https://www.facebook.com/', { waitUntil: 'networkidle2' });
    await Wait.toSeconds(2, 'Načtení stránky');
    
    // Vykonej příkaz
    await executeCommand(command);
    
    Log.success('[FB_CMD]', `✅ Příkaz ${command} dokončen`);
    
    // Počkej 30 sekund a pak zavři
    console.log('\n⏰ Browser zůstane otevřený 30 sekund pro kontrolu...');
    await Wait.toSeconds(30, 'Ponechání browser otevřený');
    
  } catch (err) {
    Log.error('[FB_CMD]', `Chyba: ${err.message}`);
  } finally {
    if (browser) {
      await browser.close();
      Log.info('[FB_CMD]', '🔴 Browser uzavřen');
    }
    process.exit(0);
  }
})();

async function executeCommand(cmd) {
  switch (cmd) {
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
    case 'full-flow':
      await fullRegistrationFlow();
      break;
    case 'analyze':
    default:
      await analyzeCurrentState();
      break;
  }
}

async function analyzeCookies() {
  console.log('\n🍪 === COOKIES MODAL ANALÝZA ===');
  
  // Hledej cookies modal
  const cookieModal = await page.$('[role="dialog"]');
  if (cookieModal) {
    const modalText = await cookieModal.evaluate(el => el.textContent?.substring(0, 300));
    console.log(`✅ Cookies modal nalezen: "${modalText}"`);
    
    // Hledej cookies tlačítka
    const cookieButtons = await page.$$eval('button', buttons => 
      buttons
        .filter(btn => btn.offsetParent !== null && 
                      (btn.textContent.toLowerCase().includes('cookie') ||
                       btn.textContent.toLowerCase().includes('decline') ||
                       btn.textContent.toLowerCase().includes('accept')))
        .map(btn => btn.textContent)
    );
    
    console.log(`🔘 Cookies tlačítka: ${cookieButtons.join(', ')}`);
    
    // Screenshot
    await page.screenshot({ path: '/tmp/cookies_modal.png' });
    console.log('📷 Screenshot: /tmp/cookies_modal.png');
    
  } else {
    console.log('❌ Cookies modal nenalezen');
  }
}

async function clickCookies() {
  console.log('\n🖱️ === KLIK NA COOKIES ===');
  
  try {
    // Zkus najít decline tlačítko
    const declined = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const declineBtn = buttons.find(btn => 
        btn.offsetParent !== null && 
        btn.textContent.toLowerCase().includes('decline')
      );
      
      if (declineBtn) {
        declineBtn.click();
        return true;
      }
      return false;
    });
    
    if (declined) {
      console.log('✅ Kliknuto na decline cookies');
      await Wait.toSeconds(3, 'Čekání po decline');
      
      await page.screenshot({ path: '/tmp/after_decline.png' });
      console.log('📷 Screenshot po decline: /tmp/after_decline.png');
    } else {
      console.log('❌ Decline tlačítko nenalezeno');
    }
  } catch (err) {
    console.log(`❌ Chyba při kliku: ${err.message}`);
  }
}

async function analyzeRegistration() {
  console.log('\n📝 === REGISTRAČNÍ TLAČÍTKO ===');
  
  const regBtn = await page.$('[data-testid="open-registration-form-button"]');
  if (regBtn) {
    const btnInfo = await regBtn.evaluate(el => ({
      text: el.textContent,
      isVisible: el.offsetParent !== null,
      disabled: el.disabled
    }));
    
    console.log(`✅ Registrační tlačítko: "${btnInfo.text}"`);
    console.log(`   Viditelné: ${btnInfo.isVisible}`);
    console.log(`   Disabled: ${btnInfo.disabled}`);
  } else {
    console.log('❌ Registrační tlačítko nenalezeno');
  }
}

async function clickRegistration() {
  console.log('\n🖱️ === KLIK NA REGISTRACI ===');
  
  try {
    const regBtn = await page.$('[data-testid="open-registration-form-button"]');
    if (regBtn) {
      await regBtn.click();
      console.log('✅ Kliknuto na Create new account');
      
      await Wait.toSeconds(3, 'Čekání na formulář');
      
      // Zkontroluj formulář
      const formInputs = await page.$$('input[name="firstname"], input[name="lastname"]');
      if (formInputs.length > 0) {
        console.log('🎉 Registrační formulář se otevřel!');
      } else {
        console.log('❓ Formulář se možná neotevřel');
      }
      
      await page.screenshot({ path: '/tmp/registration_form.png' });
      console.log('📷 Screenshot: /tmp/registration_form.png');
      
    } else {
      console.log('❌ Registrační tlačítko nenalezeno');
    }
  } catch (err) {
    console.log(`❌ Chyba: ${err.message}`);
  }
}

async function fullRegistrationFlow() {
  console.log('\n🔄 === PLNÝ REGISTRAČNÍ FLOW ===');
  
  // 1. Decline cookies
  console.log('1️⃣ Decline cookies...');
  await clickCookies();
  
  await Wait.toSeconds(2, 'Pause mezi kroky');
  
  // 2. Klik na registraci
  console.log('2️⃣ Otevření registrace...');
  await clickRegistration();
  
  await Wait.toSeconds(2, 'Pause mezi kroky');
  
  // 3. Analýza formuláře
  console.log('3️⃣ Analýza formuláře...');
  const inputs = await page.$$eval('input', inputs => 
    inputs
      .filter(input => input.offsetParent !== null)
      .map(input => ({
        name: input.name,
        type: input.type,
        placeholder: input.placeholder
      }))
  );
  
  console.log(`📋 Nalezeno ${inputs.length} input polí:`);
  inputs.forEach((input, i) => {
    console.log(`  ${i+1}. ${input.name} (${input.type}): "${input.placeholder}"`);
  });
  
  await page.screenshot({ path: '/tmp/full_flow_final.png' });
  console.log('📷 Finální screenshot: /tmp/full_flow_final.png');
}

async function analyzeCurrentState() {
  console.log('\n🔍 === SOUČASNÝ STAV ===');
  
  const info = {
    url: page.url(),
    title: await page.title(),
    inputs: await page.$$eval('input', inputs => inputs.filter(i => i.offsetParent !== null).length),
    buttons: await page.$$eval('button', buttons => buttons.filter(b => b.offsetParent !== null).length)
  };
  
  console.log(`📄 URL: ${info.url}`);
  console.log(`📄 Title: ${info.title}`);  
  console.log(`💻 Visible inputs: ${info.inputs}`);
  console.log(`🔘 Visible buttons: ${info.buttons}`);
}

async function launchBrowser(user) {
  const profileDir = `Profile${user.id}`;
  const userDataDir = '/home/remotes/Chromium';
  
  const lockFile = path.join(userDataDir, profileDir, 'SingletonLock');
  try { fs.unlinkSync(lockFile); } catch {}
  
  const browser = await puppeteer.launch({
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
  
  return browser;
}