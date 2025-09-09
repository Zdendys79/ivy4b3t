/**
 * Rychlá analýza aktuálně viditelných elementů v browser procesu
 * Připojí se k běžícímu browser procesu
 */

import puppeteer from 'puppeteer';
import { Log } from './libs/iv_log.class.js';

(async () => {
  try {
    Log.info('[ANALYZE]', '🔍 Připojuji se k běžícímu browser procesu...');
    
    // Připoj se k běžícímu Chrome procesu
    const browserURL = 'http://127.0.0.1:9222';
    
    try {
      const browser = await puppeteer.connect({ browserURL });
      const pages = await browser.pages();
      
      if (pages.length === 0) {
        throw new Error('Žádné aktivní stránky nenalezeny');
      }
      
      // Použij poslední aktivní stránku
      const page = pages[pages.length - 1];
      
      Log.success('[ANALYZE]', `✅ Připojen k stránce: ${await page.title()}`);
      Log.info('[ANALYZE]', `🔗 URL: ${page.url()}`);
      
      // ANALÝZA 1: Co je aktuálně v popředí
      await analyzeTopElements(page);
      
      // ANALÝZA 2: Modal/overlay detekce  
      await analyzeModals(page);
      
      // ANALÝZA 3: Registrační formulář
      await analyzeRegistrationForm(page);
      
      // Screenshot aktuálního stavu
      await page.screenshot({ path: '/tmp/current_state.png', fullPage: false });
      Log.info('[ANALYZE]', '📷 Screenshot aktuálního stavu: /tmp/current_state.png');
      
      // Odpojit se (neukončovat browser)
      browser.disconnect();
      
    } catch (connectErr) {
      Log.warn('[ANALYZE]', 'Nepodařilo se připojit k běžícímu Chrome, zkouším přímý přístup...');
      
      // Fallback - pokud se nepodaří připojit
      Log.info('[ANALYZE]', 'Zkontroluj ruční browser na Chrome Remote Desktop');
    }
    
  } catch (err) {
    Log.error('[ANALYZE]', `Chyba: ${err.message}`);
  }
})();

/**
 * Analyzuje top-level elementy v popředí
 */
async function analyzeTopElements(page) {
  Log.info('[ANALYZE]', '1️⃣ Analyzuji elementy v popředí...');
  
  const topElements = await page.evaluate(() => {
    // Najdi elementy s nejvyšším z-index
    const allElements = Array.from(document.querySelectorAll('*'));
    const elementsWithZIndex = allElements
      .filter(el => {
        const style = window.getComputedStyle(el);
        const zIndex = parseInt(style.zIndex);
        return !isNaN(zIndex) && zIndex > 0;
      })
      .map(el => {
        const style = window.getComputedStyle(el);
        return {
          tagName: el.tagName,
          className: el.className,
          id: el.id,
          zIndex: parseInt(style.zIndex),
          isVisible: el.offsetParent !== null,
          textContent: el.textContent?.substring(0, 100),
          position: style.position
        };
      })
      .sort((a, b) => b.zIndex - a.zIndex);
      
    return elementsWithZIndex.slice(0, 10); // Top 10 z-index
  });
  
  Log.info('[ANALYZE]', `📋 Nalezeno ${topElements.length} elementů s z-index:`);
  topElements.forEach((el, i) => {
    Log.info('[ANALYZE]', `  ${i+1}. ${el.tagName} (z:${el.zIndex}) - "${el.textContent}"`);
  });
}

/**
 * Hledá modály a overlay
 */
async function analyzeModals(page) {
  Log.info('[ANALYZE]', '2️⃣ Hledám modály a overlay...');
  
  const modals = await page.evaluate(() => {
    const modalSelectors = [
      '[role="dialog"]',
      '[role="modal"]', 
      '.modal',
      '.overlay',
      '.popup',
      '[data-testid*="modal"]',
      '[data-testid*="dialog"]',
      'div[style*="position: fixed"]',
      'div[style*="z-index"]'
    ];
    
    const foundModals = [];
    
    modalSelectors.forEach(selector => {
      const elements = Array.from(document.querySelectorAll(selector));
      elements.forEach(el => {
        if (el.offsetParent !== null) { // je viditelný
          foundModals.push({
            selector: selector,
            tagName: el.tagName,
            className: el.className,
            id: el.id,
            isVisible: true,
            textContent: el.textContent?.substring(0, 150)
          });
        }
      });
    });
    
    return foundModals;
  });
  
  if (modals.length > 0) {
    Log.success('[ANALYZE]', `🎭 Nalezeno ${modals.length} modal/overlay elementů:`);
    modals.forEach((modal, i) => {
      Log.info('[ANALYZE]', `  ${i+1}. ${modal.tagName}: "${modal.textContent}"`);
    });
  } else {
    Log.info('[ANALYZE]', '❌ Žádné modály nebo overlay nenalezeny');
  }
}

/**
 * Hledá registrační formulář
 */
async function analyzeRegistrationForm(page) {
  Log.info('[ANALYZE]', '3️⃣ Hledám registrační formulář...');
  
  const formElements = await page.evaluate(() => {
    const registrationInputs = [
      'input[name="firstname"]',
      'input[name="lastname"]',
      'input[name="reg_email__"]', 
      'input[name="reg_passwd__"]',
      '[data-testid="reg_first_name"]',
      '[data-testid="reg_last_name"]',
      'input[placeholder*="First name"]',
      'input[placeholder*="Last name"]',
      'input[placeholder*="Email"]',
      'input[placeholder*="Password"]'
    ];
    
    const foundInputs = [];
    
    registrationInputs.forEach(selector => {
      const elements = Array.from(document.querySelectorAll(selector));
      elements.forEach(el => {
        foundInputs.push({
          selector: selector,
          name: el.name,
          type: el.type,
          placeholder: el.placeholder,
          isVisible: el.offsetParent !== null,
          value: el.value
        });
      });
    });
    
    return foundInputs;
  });
  
  if (formElements.length > 0) {
    Log.success('[ANALYZE]', `📝 Nalezen registrační formulář (${formElements.length} inputů):`);
    formElements.forEach((input, i) => {
      Log.info('[ANALYZE]', `  ${i+1}. ${input.name} (${input.type}) - "${input.placeholder}" (visible: ${input.isVisible})`);
    });
  } else {
    Log.info('[ANALYZE]', '❌ Registrační formulář nenalezen - možná se neotevřel');
  }
}