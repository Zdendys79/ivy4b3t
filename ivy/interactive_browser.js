/**
 * UNIVERZÁLNÍ INTERAKTIVNÍ BROWSER OVLÁDÁNÍ
 * - Puppeteer browser pro libovolné weby
 * - Příkazy pro navigaci, analýzu a interakci
 * - Žádná FB-specifická funkcionalita
 */

import os from 'node:os';
import fs from 'node:fs';
import puppeteer from 'puppeteer';

import { Wait } from './libs/iv_wait.class.js';

let browser;
let page;
let step = 'init';

// Communication files
const COMMAND_FILE = '/tmp/browser_commands.txt';
const RESPONSE_FILE = '/tmp/browser_responses.txt';

// Inicializace
if (fs.existsSync(COMMAND_FILE)) fs.unlinkSync(COMMAND_FILE);
if (fs.existsSync(RESPONSE_FILE)) fs.unlinkSync(RESPONSE_FILE);

let commandWatcher;

(async () => {
  try {
    console.log('🚀 === UNIVERZÁLNÍ BROWSER OVLÁDÁNÍ ===');
    console.log('Inicializuji browser...');
    
    await initializeBrowser();
    
    console.log('\n✅ Browser připraven!');
    console.log('📋 Dostupné příkazy:');
    console.log('  goto [url]  - Přejít na URL');
    console.log('  analyze     - Analyzovat stránku');
    console.log('  screenshot  - Udělat screenshot');
    console.log('  new_tab     - Otevřít novou záložku');
    console.log('  help        - Zobrazit nápovědu');
    console.log('  exit        - Ukončit');

    // Počáteční analýza
    const initialAnalysis = await executeAnalyze();
    console.log('\n🔍 === POČÁTEČNÍ STAV ===');
    console.log(initialAnalysis);
    
    startCommandWatcher();
    
    console.log('\n📡 KOMUNIKAČNÍ KANÁL AKTIVNÍ:');
    console.log(`📝 Pošli příkaz: echo "goto https://registrace.seznam.cz/" > ${COMMAND_FILE}`);
    console.log(`📖 Přečti odpověď: cat ${RESPONSE_FILE}`);
    
  } catch (err) {
    console.error('❌ Chyba při inicializaci:', err);
    process.exit(1);
  }
})();

async function initializeBrowser() {
  browser = await puppeteer.launch({
    headless: false,
    args: [
      '--start-maximized',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--display=' + (process.env.DISPLAY || ':0')
    ]
  });
  
  page = await browser.newPage();
  step = 'ready';
}

function startCommandWatcher() {
  commandWatcher = setInterval(async () => {
    if (fs.existsSync(COMMAND_FILE)) {
      try {
        const commandLine = fs.readFileSync(COMMAND_FILE, 'utf8').trim();
        const parts = commandLine.split(' ');
        const command = parts[0].toLowerCase();
        
        if (command) {
          console.log(`📨 Přijat příkaz: "${commandLine}"`);
          
          fs.unlinkSync(COMMAND_FILE);
          
          let response = '';
          
          try {
            switch (command) {
              case 'goto':
              case 'go':
                const url = parts.slice(1).join(' ') || 'https://www.google.com/';
                response = await executeGoto(url);
                break;
                
              case 'analyze':
              case 'a':
                response = await executeAnalyze();
                break;
                
              case 'screenshot':
              case 's':
                response = await executeScreenshot();
                break;
                
              case 'new_tab':
              case 'nt':
                const tabUrl = parts.slice(1).join(' ') || 'https://www.google.com/';
                response = await executeNewTab(tabUrl);
                break;
                
              case 'help':
              case 'h':
                response = getHelpText();
                break;
                
              case 'status':
                response = getStatus();
                break;
                
              case 'exit':
                response = 'Ukončujem browser...';
                await browser.close();
                process.exit(0);
                
              default:
                response = `❌ Neznámý příkaz: "${command}"\nDostupné: goto, analyze, screenshot, new_tab, help, status, exit`;
            }
            
          } catch (err) {
            response = `❌ Chyba při vykonávání příkazu: ${err.message}`;
          }
          
          fs.writeFileSync(RESPONSE_FILE, `[${new Date().toLocaleTimeString()}] ${response}\n\n`, 'utf8');
          console.log(`📤 Odpověď zapsána do ${RESPONSE_FILE}`);
        }
        
      } catch (err) {
        console.error('❌ Chyba při zpracování příkazu:', err);
      }
    }
  }, 1000);
}

async function executeGoto(url) {
  try {
    await page.goto(url, { waitUntil: 'networkidle0' });
    await Wait.toSeconds(1, 'Čekání na načtení stránky');
    
    const title = await page.title();
    step = 'loaded';
    return `🌐 Přešel na: ${title}\n📄 URL: ${page.url()}`;
  } catch (err) {
    return `❌ Chyba při přechodu na ${url}: ${err.message}`;
  }
}

async function executeAnalyze() {
  try {
    const url = page.url();
    const title = await page.title();
    
    const buttons = await page.$$('button, input[type="submit"], input[type="button"]');
    const inputs = await page.$$('input, textarea, select');
    
    let analysis = `🔍 ANALÝZA STRÁNKY:\n`;
    analysis += `📄 URL: ${url}\n`;
    analysis += `📄 Title: ${title}\n`;
    analysis += `📍 Step: ${step}\n`;
    analysis += `🔘 Buttons: ${buttons.length}\n`;
    analysis += `💻 Inputs: ${inputs.length}`;
    
    return analysis;
  } catch (err) {
    return `❌ Chyba při analýze: ${err.message}`;
  }
}

async function executeScreenshot() {
  const filename = `/tmp/browser_${Date.now()}.png`;
  await page.screenshot({ path: filename, fullPage: true });
  return `📷 Screenshot uložen: ${filename}`;
}

async function executeNewTab(url) {
  try {
    const newPage = await browser.newPage();
    await newPage.goto(url, { waitUntil: 'networkidle0' });
    
    // Přepni kontext na novou záložku
    page = newPage;
    
    const title = await page.title();
    return `🆕 Nová záložka otevřena a aktivní: ${title}\n📄 URL: ${url}`;
  } catch (err) {
    return `❌ Chyba při otevírání nové záložky: ${err.message}`;
  }
}

function getHelpText() {
  return `📖 DOSTUPNÉ PŘÍKAZY:
goto [url] - Přejít na zadanou URL
analyze - Analyzovat současnou stránku
screenshot - Pořídí screenshot stránky
new_tab [url] - Otevřít novou záložku
help - Tato nápověda
status - Status browseru
exit - Ukončit browser

POUŽITÍ:
echo "goto https://seznam.cz/" > ${COMMAND_FILE}
cat ${RESPONSE_FILE}`;
}

function getStatus() {
  return `📊 BROWSER STATUS:
🎯 Step: ${step}
🌐 Browser: ${browser ? 'RUNNING' : 'STOPPED'}
📄 Page: ${page ? 'READY' : 'NOT_READY'}
📄 URL: ${page ? page.url() : 'N/A'}
📡 Watcher: ${commandWatcher ? 'ACTIVE' : 'INACTIVE'}`;
}