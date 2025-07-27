#!/usr/bin/env node

import puppeteer from 'puppeteer';
import readline from 'readline';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { Wait } from './libs/iv_wait.class.js';

const isLinux = process.platform === 'linux';

// Nastavení pro interaktivní vstup
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Globální proměnné pro správu elementů
let currentIndex = 0;
let elements = [];
let highlightedElement = null;

// CSS pro zvýraznění
const HIGHLIGHT_STYLE = `
  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }
  .debug-highlight {
    outline: 3px solid red !important;
    background-color: rgba(255, 0, 0, 0.2) !important;
    animation: blink 1s ease-in-out infinite !important;
  }
`;

async function launchBrowser() {
  const profileDir = 'Profile0';
  const userDataDir = isLinux ? '/home/remotes/Chromium' : './profiles';
  const lockFile = path.join(userDataDir, profileDir, 'SingletonLock');

  // Odstranění lock souboru
  if (fs.existsSync(lockFile)) {
    fs.unlinkSync(lockFile);
  }

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: [
      '--suppress-message-center-popups',
      '--disable-notifications',
      '--disable-infobars',
      '--disable-session-crashed-bubble',
      '--disable-restore-session-state',
      '--hide-crash-restore-bubble',
      '--disable-background-networking',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-features=TranslateUI,SessionRestore',
      '--disable-ipc-flooding-protection',
      '--disable-prompt-on-repost',
      '--disable-hang-monitor',
      '--disable-client-side-phishing-detection',
      '--disable-popup-blocking',
      '--start-maximized',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      `--profile-directory=${profileDir}`,
      `--user-data-dir=${userDataDir}`
    ]
  });

  const context = browser.defaultBrowserContext();
  for (const origin of ['https://www.facebook.com', 'https://m.facebook.com']) {
    await context.overridePermissions(origin, []);
  }

  return { browser, context };
}

async function findElementsWithShortText(page) {
  return await page.evaluate(() => {
    // Zaměřujeme se hlavně na DIV a SPAN elementy
    const allElements = document.querySelectorAll('div, span, a, button, input, label, h1, h2, h3, h4, h5, h6, p');
    const results = [];
    
    allElements.forEach((element, index) => {
      // Přeskočit skryté elementy
      const style = window.getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden' || element.offsetWidth === 0) {
        return;
      }
      
      // Kontrola, zda je element ve viewportu (viditelný na obrazovce)
      const rect = element.getBoundingClientRect();
      const isInViewport = rect.top >= 0 && 
                          rect.left >= 0 && 
                          rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
                          rect.right <= (window.innerWidth || document.documentElement.clientWidth);
      
      if (!isInViewport) {
        return;
      }
      
      // Získání textu - buď přímý text nebo placeholder/aria-label pro inputy
      let directText = Array.from(element.childNodes)
        .filter(node => node.nodeType === Node.TEXT_NODE)
        .map(node => node.textContent.trim())
        .join(' ')
        .trim();
      
      // Pro inputy a další elementy bez přímého textu, použij placeholder nebo aria-label
      if (!directText && (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.tagName === 'SELECT')) {
        directText = element.placeholder || element.getAttribute('aria-label') || element.value || '';
      }
      
      // Pro buttony a odkazy můžeme zkusit i aria-label nebo title
      if (!directText && (element.tagName === 'BUTTON' || element.tagName === 'A')) {
        directText = element.getAttribute('aria-label') || element.title || '';
      }
      
      // Filtrování - max 10 slov a neprázdný text
      if (directText && directText.split(/\s+/).length <= 10) {
        results.push({
          index: results.length,
          text: directText,
          tagName: element.tagName,
          className: element.className,
          id: element.id,
          xpath: getXPath(element)
        });
        
        // Přidání data atributu pro snadnou identifikaci
        element.setAttribute('data-debug-index', results.length - 1);
      }
    });
    
    function getXPath(element) {
      if (element.id) return `//*[@id="${element.id}"]`;
      if (element === document.body) return '/html/body';
      
      let position = 0;
      let siblings = element.parentNode.childNodes;
      for (let i = 0; i < siblings.length; i++) {
        let sibling = siblings[i];
        if (sibling === element) return getXPath(element.parentNode) + '/' + element.tagName.toLowerCase() + '[' + (position + 1) + ']';
        if (sibling.nodeType === 1 && sibling.tagName === element.tagName) position++;
      }
    }
    
    return results;
  });
}

async function highlightElement(page, index) {
  await page.evaluate((idx, previousIdx) => {
    // Odstranění předchozího zvýraznění
    if (previousIdx !== null) {
      const prevElement = document.querySelector(`[data-debug-index="${previousIdx}"]`);
      if (prevElement) {
        prevElement.classList.remove('debug-highlight');
      }
    }
    
    // Zvýraznění nového elementu
    const element = document.querySelector(`[data-debug-index="${idx}"]`);
    if (element) {
      element.classList.add('debug-highlight');
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, index, highlightedElement);
  
  highlightedElement = index;
}

async function main() {
  console.clear();
  console.log('Spouštím prohlížeč s profilem ID 0...');
  const { browser, context } = await launchBrowser();
  
  const page = await context.newPage();
  
  // Funkce pro injekci CSS stylů
  const injectStyles = async () => {
    await page.addStyleTag({ content: HIGHLIGHT_STYLE });
  };
  
  console.log('Navigace na Facebook...');
  await page.goto('https://www.facebook.com', { waitUntil: 'networkidle2' });
  
  // Počkání na načtení stránky
  await Wait.toSeconds(3, 'Načtení FB stránky');
  
  // Injekce stylů
  await injectStyles();
  
  console.log('\nHledám elementy s textem do 10 slov...');
  elements = await findElementsWithShortText(page);
  
  console.log(`\nNalezeno ${elements.length} elementů\n`);
  
  // Zobrazení prvních 10 elementů
  const displayElements = () => {
    console.clear();
    console.log('=== INTERAKTIVNÍ DEBUGGER ELEMENTŮ ===\n');
    console.log('Ovládání: ↑/↓ = pohyb, ENTER = kliknutí, q = konec\n');
    
    const start = Math.max(0, currentIndex - 5);
    const end = Math.min(elements.length, start + 10);
    
    for (let i = start; i < end; i++) {
      const elem = elements[i];
      const marker = i === currentIndex ? '→ ' : '  ';
      console.log(`${marker}[${i}] <${elem.tagName}> "${elem.text.substring(0, 50)}${elem.text.length > 50 ? '...' : ''}"`);
    }
    
    console.log(`\nAktuální: [${currentIndex}] z ${elements.length - 1}`);
    console.log(`Text: "${elements[currentIndex]?.text}"`);
    console.log(`Tag: ${elements[currentIndex]?.tagName}, ID: ${elements[currentIndex]?.id || 'none'}, Class: ${elements[currentIndex]?.className || 'none'}`);
  };
  
  // První zobrazení a zvýraznění
  if (elements.length > 0) {
    displayElements();
    await highlightElement(page, 0);
  }
  
  // Nastavení raw mode pro čtení kláves
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');
  
  // Zpracování kláves
  process.stdin.on('data', async (key) => {
    if (key === '\u0003' || key === 'q') { // Ctrl+C nebo q
      console.log('\nUkončuji...');
      await browser.close();
      process.exit();
    }
    
    if (key === '\u001b[A') { // Šipka nahoru
      if (currentIndex > 0) {
        currentIndex--;
        displayElements();
        await highlightElement(page, currentIndex);
      }
    }
    
    if (key === '\u001b[B') { // Šipka dolů
      if (currentIndex < elements.length - 1) {
        currentIndex++;
        displayElements();
        await highlightElement(page, currentIndex);
      }
    }
    
    if (key === '\r') { // Enter
      console.log(`\nKlikám na element [${currentIndex}]...`);
      try {
        await page.evaluate((idx) => {
          const element = document.querySelector(`[data-debug-index="${idx}"]`);
          if (element) {
            element.click();
            return true;
          }
          return false;
        }, currentIndex);
        console.log('Kliknutí provedeno!');
        
        // Počkat chvíli na případné změny na stránce
        await Wait.toSeconds(2, 'Čekání na změny na stránce');
        
        // Znovu načíst elementy
        console.log('\nObnovuji seznam elementů...');
        
        // Znovu injektovat styly (pro případ, že se stránka změnila)
        await injectStyles();
        
        elements = await findElementsWithShortText(page);
        
        // Resetovat index pokud je mimo rozsah
        if (currentIndex >= elements.length) {
          currentIndex = 0;
        }
        
        // Znovu zobrazit a zvýraznit
        displayElements();
        if (elements.length > 0) {
          await highlightElement(page, currentIndex);
        }
      } catch (error) {
        console.log('Chyba při kliknutí:', error.message);
      }
    }
  });
}

main().catch(console.error);