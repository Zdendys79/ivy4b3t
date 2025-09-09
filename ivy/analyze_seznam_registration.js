/**
 * ANALÝZA REGISTRAČNÍHO FORMULÁŘE SEZNAM.CZ
 * Prozkoumá registrační formulář pro vytvoření e-mailu
 */

import puppeteer from 'puppeteer';

async function analyzeSeznamRegistration() {
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: '/usr/bin/chromium-browser',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--display=' + (process.env.DISPLAY || ':0')
    ]
  });

  try {
    console.log('🔍 === ANALÝZA REGISTRACE SEZNAM.CZ ===');
    
    const page = await browser.newPage();
    await page.goto('https://registrace.seznam.cz/', { waitUntil: 'networkidle0' });
    
    const title = await page.title();
    const url = page.url();
    
    console.log(`📄 Titulek: ${title}`);
    console.log(`🌐 URL: ${url}`);
    
    // Najdi všechny input pole
    const inputs = await page.$$eval('input', inputs => 
      inputs.map(input => ({
        type: input.type,
        name: input.name,
        id: input.id,
        placeholder: input.placeholder,
        required: input.required,
        className: input.className
      }))
    );
    
    console.log(`\n📝 NALEZENÉ INPUT POLE (${inputs.length}):`);
    inputs.forEach((input, i) => {
      console.log(`${i+1}. Type: ${input.type}, Name: ${input.name || 'N/A'}, ID: ${input.id || 'N/A'}`);
      if (input.placeholder) console.log(`   Placeholder: ${input.placeholder}`);
    });
    
    // Najdi všechny buttony
    const buttons = await page.$$eval('button, input[type="submit"]', buttons => 
      buttons.map(button => ({
        text: button.textContent || button.value,
        type: button.type,
        className: button.className
      }))
    );
    
    console.log(`\n🔘 NALEZENÉ BUTTONY (${buttons.length}):`);
    buttons.forEach((button, i) => {
      console.log(`${i+1}. Text: "${button.text}", Type: ${button.type}`);
    });
    
    // Najdi všechny select pole
    const selects = await page.$$eval('select', selects => 
      selects.map(select => ({
        name: select.name,
        id: select.id,
        options: Array.from(select.options).map(opt => opt.text)
      }))
    );
    
    if (selects.length > 0) {
      console.log(`\n📋 NALEZENÉ SELECT POLE (${selects.length}):`);
      selects.forEach((select, i) => {
        console.log(`${i+1}. Name: ${select.name || 'N/A'}, ID: ${select.id || 'N/A'}`);
        console.log(`   Možnosti: ${select.options.slice(0, 5).join(', ')}${select.options.length > 5 ? '...' : ''}`);
      });
    }
    
    // Pořiď screenshot
    const screenshotPath = `/tmp/seznam_registration_${Date.now()}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`\n📷 Screenshot uložen: ${screenshotPath}`);
    
    // Zkoumání konkrétních elementů
    const emailField = await page.$('input[type="email"], input[name*="email"], input[id*="email"]');
    if (emailField) {
      const emailInfo = await emailField.evaluate(el => ({
        placeholder: el.placeholder,
        name: el.name,
        id: el.id,
        required: el.required
      }));
      console.log(`\n📧 E-MAIL POLE NALEZENO:`);
      console.log(`   Name: ${emailInfo.name}, ID: ${emailInfo.id}`);
      console.log(`   Placeholder: ${emailInfo.placeholder}`);
      console.log(`   Povinné: ${emailInfo.required ? 'Ano' : 'Ne'}`);
    }
    
    console.log(`\n✅ Analýza dokončena! Browser zůstává otevřený pro další prozkoumání.`);
    
  } catch (error) {
    console.log(`❌ Chyba při analýze: ${error.message}`);
    await browser.close();
    throw error;
  }
  
  // Browser zůstane otevřený pro ruční prozkoumání
  console.log(`\n⏳ Browser zůstává otevřený... Stiskni Ctrl+C pro ukončení.`);
  
  // Čekej na ukončení
  process.on('SIGINT', async () => {
    console.log('\n👋 Ukončuji browser...');
    await browser.close();
    process.exit(0);
  });
}

// Spuštění
analyzeSeznamRegistration();