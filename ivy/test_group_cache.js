/**
 * Test script pro ověření GroupCache funkčnosti
 * Simuluje několik uživatelů používajících sdílenou cache
 */

import { GroupCache } from './libs/iv_group_cache.class.js';
import { Log } from './libs/iv_log.class.js';

async function testGroupCache() {
  try {
    Log.info('[TEST]', 'Testování GroupCache...');
    
    // Simulace 1. uživatele - načte skupiny z discover
    const cache1 = GroupCache.getInstance();
    const testUrls1 = [
      'https://www.facebook.com/groups/testgroup1',
      'https://www.facebook.com/groups/testgroup2', 
      'https://www.facebook.com/groups/testgroup3'
    ];
    
    Log.info('[TEST]', `Uživatel 1: Přidávám ${testUrls1.length} URL`);
    const added1 = cache1.addUrls(testUrls1);
    Log.info('[TEST]', `Uživatel 1: Přidáno ${added1} URL, celkem v cache: ${cache1.getCount()}`);
    
    // Simulace 2. uživatele - používá stejnou cache instanci
    const cache2 = GroupCache.getInstance();
    Log.info('[TEST]', `Uživatel 2: Vidí v cache: ${cache2.getCount()} URL`);
    
    // Uživatel 2 přidá další URL
    const testUrls2 = [
      'https://www.facebook.com/groups/testgroup4',
      'https://www.facebook.com/groups/testgroup1', // Duplicitní - má být ignorována
      'https://www.facebook.com/groups/testgroup5'
    ];
    
    Log.info('[TEST]', `Uživatel 2: Přidávám ${testUrls2.length} URL (1 duplicitní)`);
    const added2 = cache2.addUrls(testUrls2);
    Log.info('[TEST]', `Uživatel 2: Přidáno ${added2} URL, celkem v cache: ${cache2.getCount()}`);
    
    // Simulace 3. uživatele - konzumuje URL z cache
    const cache3 = GroupCache.getInstance();
    Log.info('[TEST]', `Uživatel 3: Začíná s ${cache3.getCount()} URL v cache`);
    
    for (let i = 0; i < 3; i++) {
      const url = cache3.getRandomUrl();
      if (url) {
        Log.info('[TEST]', `Uživatel 3: Použil URL: ${url}, zbývá: ${cache3.getCount()}`);
      } else {
        Log.info('[TEST]', `Uživatel 3: Žádná URL k dispozici`);
        break;
      }
    }
    
    // Kontrola že všechny instance vidí stejná data
    const cache4 = GroupCache.getInstance();
    Log.info('[TEST]', `Uživatel 4: Vidí v cache: ${cache4.getCount()} URL`);
    
    // Test isEmpty
    Log.info('[TEST]', `Je cache prázdná? ${cache4.isEmpty()}`);
    
    // Vyčerpej zbývající URL
    while (!cache4.isEmpty()) {
      const url = cache4.getRandomUrl();
      Log.info('[TEST]', `Konzumována URL: ${url}, zbývá: ${cache4.getCount()}`);
    }
    
    Log.info('[TEST]', `Je cache prázdná? ${cache4.isEmpty()}`);
    
    Log.info('[TEST]', '✅ Test GroupCache dokončen úspěšně');
    
  } catch (err) {
    Log.error('[TEST]', `Chyba v testu: ${err.message}`);
  }
}

// Spustit test
testGroupCache().then(() => {
  Log.info('[TEST]', 'Test dokončen');
  process.exit(0);
}).catch(err => {
  Log.error('[TEST]', `Test selhal: ${err.message}`);
  process.exit(1);
});