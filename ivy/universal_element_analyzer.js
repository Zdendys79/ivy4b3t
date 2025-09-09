/**
 * UNIVERZÁLNÍ ELEMENT ANALYZER
 * - Neví co je na stránce - zjišťuje to od nuly
 * - Analyzuje VŠECHNY visible elementy v popředí
 * - Poskytuje detailní informace pro interakci (klik, vyplnění, atd.)
 * - Řadí podle z-index a pozice - co je nejvíce v popředí
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

// Příkaz z argumentu
const command = process.argv[2] || 'scan';

(async () => {
  try {
    Log.info('[ANALYZER]', `🔍 Univerzální element analyzer - příkaz: ${command}`);
    
    const user = await db.getUserById(DEBUG_USER_ID);
    browser = await launchBrowser(user);
    const context = browser.defaultBrowserContext();
    const fbBot = new FBBot(context, DEBUG_USER_ID, false);
    
    if (!await fbBot.init()) {
      throw new Error('FBBot init failed');
    }
    
    page = fbBot.page;
    
    // Navigace
    await page.goto('https://www.facebook.com/', { waitUntil: 'networkidle2' });
    await Wait.toSeconds(3, 'Načtení stránky');
    
    // Screenshot před analýzou
    await page.screenshot({ path: '/tmp/before_analysis.png' });
    Log.info('[ANALYZER]', '📷 Screenshot před analýzou: /tmp/before_analysis.png');
    
    // Spusť příkaz
    await executeCommand(command);
    
    Log.success('[ANALYZER]', `✅ Analýza dokončena`);
    
    // Ponech browser otevřený pro kontrolu
    console.log('\n⏰ Browser zůstane otevřený 60 sekund pro kontrolu výsledků...');
    await Wait.toSeconds(60, 'Browser otevřený pro kontrolu');
    
  } catch (err) {
    Log.error('[ANALYZER]', `Chyba: ${err.message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
    process.exit(0);
  }
})();

async function executeCommand(cmd) {
  switch (cmd) {
    case 'scan':
      await scanAllVisibleElements();
      break;
    case 'top':
      await analyzeTopElements();
      break;
    case 'interactive':
      await findInteractiveElements();
      break;
    case 'text':
      await analyzeTextContent();
      break;
    case 'click-first':
      await clickFirstInteractive();
      break;
    default:
      await scanAllVisibleElements();
      break;
  }
}

/**
 * HLAVNÍ FUNKCE - naskenuje VŠECHNY visible elementy
 */
async function scanAllVisibleElements() {
  console.log('\n🔍 === UNIVERZÁLNÍ ELEMENT SCAN ===');
  console.log('Hledám VŠECHNY viditelné elementy bez předpokladů...\n');
  
  const allElements = await page.evaluate(() => {
    const elements = [];
    
    // Projdi VŠECHNY elementy na stránce
    const allNodes = document.querySelectorAll('*');
    
    allNodes.forEach((el, index) => {
      // Pouze viditelné elementy
      if (el.offsetParent !== null) {
        const styles = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        
        // Pouze elementy v viewportu
        if (rect.top >= 0 && rect.left >= 0 && 
            rect.bottom <= window.innerHeight && 
            rect.right <= window.innerWidth) {
          
          elements.push({
            index: index,
            tagName: el.tagName,
            id: el.id,
            className: el.className,
            textContent: el.textContent?.trim().substring(0, 100),
            
            // Interaktivní vlastnosti
            isButton: el.tagName === 'BUTTON' || el.role === 'button',
            isInput: el.tagName === 'INPUT',
            isLink: el.tagName === 'A',
            isClickable: el.onclick !== null || el.role === 'button' || el.tagName === 'BUTTON' || el.tagName === 'A',
            
            // Pozice a velikost
            zIndex: parseInt(styles.zIndex) || 0,
            position: styles.position,
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            top: Math.round(rect.top),
            left: Math.round(rect.left),
            
            // Další užitečné atributy
            ariaLabel: el.getAttribute('aria-label'),
            dataTestId: el.getAttribute('data-testid'),
            name: el.name,
            type: el.type,
            placeholder: el.placeholder,
            value: el.value,
            href: el.href,
            disabled: el.disabled,
            
            // Obsah pro identifikaci
            innerHTML: el.innerHTML?.substring(0, 200)
          });
        }
      }
    });
    
    // Seřaď podle z-index (nejvyšší první) a pak podle pozice
    elements.sort((a, b) => {
      if (b.zIndex !== a.zIndex) return b.zIndex - a.zIndex;
      if (a.top !== b.top) return a.top - b.top;
      return a.left - b.left;
    });
    
    return elements;
  });
  
  console.log(`📊 NALEZENO CELKEM: ${allElements.length} viditelných elementů\n`);
  
  // Analýza podle kategorií
  const buttons = allElements.filter(el => el.isButton);
  const inputs = allElements.filter(el => el.isInput);
  const links = allElements.filter(el => el.isLink);
  const clickable = allElements.filter(el => el.isClickable);
  const highZIndex = allElements.filter(el => el.zIndex > 0);
  
  console.log(`🔘 BUTTONS: ${buttons.length}`);
  console.log(`💻 INPUTS: ${inputs.length}`);
  console.log(`🔗 LINKS: ${links.length}`);
  console.log(`👆 CLICKABLE: ${clickable.length}`);
  console.log(`⬆️  HIGH Z-INDEX: ${highZIndex.length}\n`);
  
  // DETAILNÍ VÝPIS TOP 20 elementů
  console.log('🎯 TOP 20 ELEMENTŮ (podle z-index a pozice):');
  console.log('='.repeat(80));
  
  allElements.slice(0, 20).forEach((el, i) => {
    const type = el.isButton ? '[BUTTON]' : 
                 el.isInput ? '[INPUT]' : 
                 el.isLink ? '[LINK]' : 
                 el.isClickable ? '[CLICKABLE]' : 
                 '[ELEMENT]';
                 
    console.log(`${String(i+1).padStart(2)}. ${type} ${el.tagName}`);
    
    if (el.textContent) {
      console.log(`    📝 Text: "${el.textContent}"`);
    }
    
    if (el.ariaLabel) {
      console.log(`    🏷️  Aria: "${el.ariaLabel}"`);
    }
    
    if (el.dataTestId) {
      console.log(`    🧪 TestID: "${el.dataTestId}"`);
    }
    
    if (el.isInput) {
      console.log(`    📋 Input: ${el.type}, placeholder: "${el.placeholder}", name: "${el.name}"`);
    }
    
    if (el.href) {
      console.log(`    🔗 Href: ${el.href}`);
    }
    
    console.log(`    📐 Size: ${el.width}x${el.height}, Pos: (${el.left}, ${el.top}), Z: ${el.zIndex}`);
    console.log(`    🎨 Class: "${el.className}"`);
    
    if (el.id) {
      console.log(`    🆔 ID: "${el.id}"`);
    }
    
    console.log('');
  });
  
  // SAVE DATA pro další analýzu
  fs.writeFileSync('/tmp/elements_scan.json', JSON.stringify(allElements, null, 2));
  console.log('💾 Data uložena do: /tmp/elements_scan.json');
  
  return allElements;
}

/**
 * Analyzuje elementy s nejvyšším z-index (v popředí)
 */
async function analyzeTopElements() {
  console.log('\n⬆️ === TOP Z-INDEX ELEMENTY ===');
  
  const topElements = await page.evaluate(() => {
    const elements = Array.from(document.querySelectorAll('*'))
      .filter(el => el.offsetParent !== null)
      .map(el => {
        const styles = window.getComputedStyle(el);
        return {
          element: el,
          zIndex: parseInt(styles.zIndex) || 0,
          position: styles.position,
          tagName: el.tagName,
          textContent: el.textContent?.trim().substring(0, 150)
        };
      })
      .filter(el => el.zIndex > 0)
      .sort((a, b) => b.zIndex - a.zIndex);
      
    return elements.slice(0, 15).map(el => ({
      tagName: el.tagName,
      zIndex: el.zIndex,
      position: el.position,
      textContent: el.textContent
    }));
  });
  
  console.log(`🔝 Nalezeno ${topElements.length} elementů s vysokým z-index:`);
  topElements.forEach((el, i) => {
    console.log(`  ${i+1}. ${el.tagName} (z:${el.zIndex}) - "${el.textContent}"`);
  });
}

/**
 * Najde všechny interaktivní elementy
 */
async function findInteractiveElements() {
  console.log('\n👆 === INTERAKTIVNÍ ELEMENTY ===');
  
  const interactive = await page.evaluate(() => {
    const elements = [];
    const selectors = 'button, input, a, [role="button"], [onclick], [data-testid]';
    
    document.querySelectorAll(selectors).forEach(el => {
      if (el.offsetParent !== null) {
        elements.push({
          tagName: el.tagName,
          role: el.getAttribute('role'),
          textContent: el.textContent?.trim().substring(0, 80),
          onclick: el.onclick ? 'má onclick' : null,
          dataTestId: el.getAttribute('data-testid'),
          ariaLabel: el.getAttribute('aria-label'),
          disabled: el.disabled,
          type: el.type,
          name: el.name
        });
      }
    });
    
    return elements;
  });
  
  console.log(`🎮 Nalezeno ${interactive.length} interaktivních elementů:`);
  interactive.forEach((el, i) => {
    console.log(`  ${i+1}. ${el.tagName}${el.role ? `[${el.role}]` : ''}`);
    if (el.textContent) console.log(`      Text: "${el.textContent}"`);
    if (el.ariaLabel) console.log(`      Aria: "${el.ariaLabel}"`);
    if (el.dataTestId) console.log(`      TestID: "${el.dataTestId}"`);
    if (el.name) console.log(`      Name: "${el.name}"`);
    if (el.disabled) console.log(`      ❌ DISABLED`);
  });
}

/**
 * Analyzuje textový obsah
 */
async function analyzeTextContent() {
  console.log('\n📝 === TEXTOVÝ OBSAH ===');
  
  const textContent = await page.evaluate(() => {
    const texts = [];
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );
    
    let node;
    while (node = walker.nextNode()) {
      const text = node.textContent.trim();
      if (text.length > 10 && text.length < 200) {
        texts.push({
          text: text,
          parentTag: node.parentElement.tagName,
          parentClass: node.parentElement.className,
          isVisible: node.parentElement.offsetParent !== null
        });
      }
    }
    
    return texts.filter(t => t.isVisible).slice(0, 30);
  });
  
  console.log(`📄 Nalezeno ${textContent.length} textových bloků:`);
  textContent.forEach((text, i) => {
    console.log(`  ${i+1}. "${text.text}" (v ${text.parentTag})`);
  });
}

/**
 * Klikne na první interaktivní element
 */
async function clickFirstInteractive() {
  console.log('\n🖱️ === KLIK NA PRVNÍ INTERAKTIVNÍ ELEMENT ===');
  
  const elements = await scanAllVisibleElements();
  const clickable = elements.filter(el => el.isClickable);
  
  if (clickable.length > 0) {
    const first = clickable[0];
    console.log(`🎯 Klikám na: ${first.tagName} - "${first.textContent}"`);
    
    try {
      // Klik podle selektoru
      if (first.dataTestId) {
        await page.click(`[data-testid="${first.dataTestId}"]`);
      } else if (first.id) {
        await page.click(`#${first.id}`);
      } else {
        // Klik podle pozice
        await page.click(`${first.tagName}:nth-of-type(${first.index + 1})`);
      }
      
      console.log('✅ Klik proveden');
      
      await Wait.toSeconds(3, 'Čekání po kliku');
      await page.screenshot({ path: '/tmp/after_click.png' });
      console.log('📷 Screenshot po kliku: /tmp/after_click.png');
      
    } catch (err) {
      console.log(`❌ Chyba při kliku: ${err.message}`);
    }
  } else {
    console.log('❌ Žádné interaktivní elementy nenalezeny');
  }
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