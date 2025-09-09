/**
 * Helper pro posílání příkazů do interactive FB debug procesu
 * Umožňuje jednoduché ovládání přes UI commands
 */

import { db } from './iv_sql.js';
import { Log } from './libs/iv_log.class.js';
import os from 'node:os';

const hostname = os.hostname();
const DEBUG_USER_ID = 997;

/**
 * Pošle příkaz do interactive debug procesu
 */
async function sendDebugCommand(command, data = {}) {
  try {
    Log.info('[DEBUG_HELPER]', `📤 Posílám příkaz: ${command}`);
    
    // Vlož UI příkaz do databáze
    const commandId = await db.insertUICommand(hostname, DEBUG_USER_ID, command, data);
    
    Log.info('[DEBUG_HELPER]', `✅ Příkaz ${command} odeslán s ID: ${commandId}`);
    
    // Čekej na dokončení (max 30s)
    let attempts = 0;
    const maxAttempts = 30; // 30 sekund
    
    while (attempts < maxAttempts) {
      const result = await db.getUICommandResult(commandId);
      
      if (result && result.completed_at) {
        Log.success('[DEBUG_HELPER]', `✅ Příkaz dokončen: ${command}`);
        
        try {
          const parsedResult = JSON.parse(result.result || '{}');
          return parsedResult;
        } catch (parseErr) {
          return { result: result.result };
        }
      }
      
      // Čekej 1 sekundu
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }
    
    throw new Error(`Timeout: Příkaz ${command} nebyl dokončen během 30 sekund`);
    
  } catch (err) {
    await Log.error('[DEBUG_HELPER]', `Chyba při posílání příkazu: ${err.message}`);
    throw err;
  }
}

// Export jednotlivých funkcí pro snadné použití
export const debugCommands = {
  
  // Navigace na URL
  navigate: async (url) => {
    return await sendDebugCommand('navigate', { url });
  },
  
  // Analýza DOM struktury
  analyzeDom: async (selector = 'body') => {
    return await sendDebugCommand('analyze_dom', { selector });
  },
  
  // Hledání elementů
  findElements: async (selector) => {
    return await sendDebugCommand('find_elements', { selector });
  },
  
  // Screenshot
  screenshot: async () => {
    return await sendDebugCommand('screenshot');
  },
  
  // Vykonání JavaScript
  evaluateJs: async (code) => {
    return await sendDebugCommand('evaluate_js', { code });
  },
  
  // Klik na element
  clickElement: async (selector) => {
    return await sendDebugCommand('click_element', { selector });
  },
  
  // Napsání textu
  typeText: async (selector, text) => {
    return await sendDebugCommand('type_text', { selector, text });
  },
  
  // Info o stránce
  getPageInfo: async () => {
    return await sendDebugCommand('get_page_info');
  }
};

// Pro přímé volání z konzole
export { sendDebugCommand };

// Pokud je spuštěno jako standalone script
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];
  const dataArg = process.argv[3];
  
  if (!command) {
    console.log('Použití: node debug_helper.js <command> [data]');
    console.log('Příklady:');
    console.log('  node debug_helper.js navigate "https://facebook.com"');
    console.log('  node debug_helper.js find_elements "[aria-label*=\"Stories\"]"');
    console.log('  node debug_helper.js screenshot');
    process.exit(1);
  }
  
  try {
    let data = {};
    if (dataArg) {
      try {
        data = JSON.parse(dataArg);
      } catch (err) {
        // Pokud to není JSON, použij jako string
        data = { value: dataArg };
      }
    }
    
    const result = await sendDebugCommand(command, data);
    console.log('Výsledek:');
    console.log(JSON.stringify(result, null, 2));
    
  } catch (err) {
    console.error('Chyba:', err.message);
    process.exit(1);
  }
}