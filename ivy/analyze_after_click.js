/**
 * Dodatečná analýza - co se stalo po kliku na registrační tlačítko
 * Spustí se samostatně s čistým profilem a pak analyzuje situaci
 */

import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer';

import { db } from './iv_sql.js';
import { FBBot } from './libs/iv_fb.class.js';
import { Log } from './libs/iv_log.class.js';
import { Wait } from './libs/iv_wait.class.js';

const isLinux = process.platform === 'linux';
const DEBUG_USER_ID = 997;
let browser;

// Graceful shutdown
process.on('SIGINT', async () => {
  if (browser) await browser.close();
  process.exit(0);
});

(async () => {
  try {
    Log.info('[CLICK_ANALYZE]', '🔍 Analyzuji proč se registrace neotevřela...');
    
    const user = await db.getUserById(DEBUG_USER_ID);
    browser = await launchDebugBrowser(user);
    const context = browser.defaultBrowserContext();
    const fbBot = new FBBot(context, DEBUG_USER_ID, false);
    
    if (!await fbBot.init()) {
      throw new Error('FBBot init failed');
    }
    
    const page = fbBot.page;
    
    // Navigace na FB
    await page.goto('https://www.facebook.com/', { waitUntil: 'networkidle2' });
    await Wait.toSeconds(2, 'Načtení stránky');
    
    Log.info('[CLICK_ANALYZE]', '📄 Stránka načtena, analyzuji stav PŘED klikem...');
    
    // PŘED KLIKEM - screenshot
    await page.screenshot({ path: '/tmp/before_click_analyze.png' });
    
    // Najdi tlačítko
    const button = await page.$('[data-testid="open-registration-form-button"]');
    if (!button) {
      throw new Error('Registrační tlačítko nenalezeno!');
    }
    
    // Zkontroluj vlastnosti tlačítka
    const buttonProps = await button.evaluate(el => ({
      text: el.textContent,
      href: el.href,
      disabled: el.disabled,
      style: window.getComputedStyle(el).display,
      onclick: el.onclick ? 'má onclick' : 'nemá onclick',
      eventListeners: window.getEventListeners ? 'lze získat' : 'nelze získat'
    }));
    
    Log.info('[CLICK_ANALYZE]', `🔘 Tlačítko vlastnosti:`, buttonProps);
    
    // Zkus HOVER před klikem
    await button.hover();
    await Wait.toSeconds(0.5, 'Hover effect');
    
    // KLIKNI s detailním loggingem
    Log.info('[CLICK_ANALYZE]', '🖱️ KLIKÁM s detailním logginiem...');
    
    // Poslechni network requesty
    const networkRequests = [];
    page.on('request', req => networkRequests.push({ url: req.url(), method: req.method() }));
    page.on('response', res => Log.debug('[CLICK_ANALYZE]', `📡 Response: ${res.status()} ${res.url()}`));
    
    // Poslechni console logy
    page.on('console', msg => Log.info('[CLICK_ANALYZE]', `🖥️ Console: ${msg.text()}`));
    
    // KLIK!
    await button.click();
    
    // Čekej na potenciální změny
    await Wait.toSeconds(5, 'Čekání na reakci po kliku');
    
    Log.info('[CLICK_ANALYZE]', `📡 Network requests po kliku: ${networkRequests.length}`);
    networkRequests.slice(0, 5).forEach(req => {
      Log.info('[CLICK_ANALYZE]', `  - ${req.method} ${req.url}`);
    });
    
    // ANALÝZA PO KLIKU
    await analyzeDOMChanges(page);
    await analyzeNewElements(page);
    
    // Screenshot po kliku
    await page.screenshot({ path: '/tmp/after_click_detailed.png' });
    Log.info('[CLICK_ANALYZE]', '📷 Detailní screenshot: /tmp/after_click_detailed.png');
    
    Log.info('[CLICK_ANALYZE]', '🏁 Analýza dokončena. Ctrl+C pro ukončení.');
    await new Promise(() => {});
    
  } catch (err) {
    Log.error('[CLICK_ANALYZE]', `Chyba: ${err.message}`);
  } finally {
    if (browser) await browser.close();
  }
})();

/**
 * Analyzuje změny v DOM po kliku
 */
async function analyzeDOMChanges(page) {
  Log.info('[CLICK_ANALYZE]', '🔄 Analyzuji změny v DOM...');
  
  // Hledej nové elementy
  const newElements = await page.evaluate(() => {
    const potentialNew = document.querySelectorAll('div[style*="display"], div[class*="show"], div[class*="visible"], [role="dialog"], [role="modal"]');
    
    return Array.from(potentialNew)
      .filter(el => el.offsetParent !== null) // jen viditelné
      .slice(0, 10)
      .map(el => ({
        tagName: el.tagName,
        className: el.className,
        style: el.getAttribute('style'),
        role: el.getAttribute('role'),
        textSnippet: el.textContent?.substring(0, 100)
      }));
  });
  
  Log.info('[CLICK_ANALYZE]', `🆕 Potenciálně nové elementy: ${newElements.length}`);
  newElements.forEach((el, i) => {
    Log.info('[CLICK_ANALYZE]', `  ${i+1}. ${el.tagName}.${el.className}: "${el.textSnippet}"`);
  });
}

/**
 * Analyzuje konkrétně registrační elementy
 */
async function analyzeNewElements(page) {
  Log.info('[CLICK_ANALYZE]', '📋 Hledám registrační formulář...');
  
  // Všechny možné registrační inputy
  const regInputs = await page.$$eval('input', inputs => 
    inputs
      .filter(input => input.offsetParent !== null) // viditelné
      .map(input => ({
        name: input.name,
        type: input.type, 
        placeholder: input.placeholder,
        className: input.className,
        id: input.id
      }))
  );
  
  Log.info('[CLICK_ANALYZE]', `💻 Viditelné inputy: ${regInputs.length}`);
  regInputs.forEach((input, i) => {
    Log.info('[CLICK_ANALYZE]', `  ${i+1}. ${input.name} (${input.type}): "${input.placeholder}"`);
  });
  
  // Hledej specifické registrační patterns
  const specificSearch = await page.evaluate(() => {
    const searches = {
      firstNameInputs: document.querySelectorAll('input[placeholder*="irst name"], input[placeholder*="Jméno"], input[name*="first"]'),
      emailInputs: document.querySelectorAll('input[placeholder*="mail"], input[type="email"], input[name*="email"]'),
      submitButtons: document.querySelectorAll('button[type="submit"], button:contains("Sign"), button:contains("Create"), input[type="submit"]')
    };
    
    const results = {};
    Object.keys(searches).forEach(key => {
      results[key] = Array.from(searches[key])
        .filter(el => el.offsetParent !== null)
        .length;
    });
    
    return results;
  });
  
  Log.info('[CLICK_ANALYZE]', '🎯 Specifické search výsledky:', specificSearch);
}

/**
 * Launch browser function (reused)
 */
async function launchDebugBrowser(user) {
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