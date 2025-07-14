#!/usr/bin/env node

/**
 * Jednorázový script pro zpracování existujících discovered_links
 * Extrahuje fb_id z URL a přidá je do group_details pro exploration
 */

import { db } from '../ivy/iv_sql.js';
import { Log } from '../ivy/iv_log.class.js';

async function processExistingLinks() {
  try {
    Log.info('[SCRIPT]', 'Spouštím zpracování existujících discovered_links...');
    
    // Získej všechny nezpracované linky
    const links = await db.safeQueryAll('discovered_links.getUnprocessedLinks', [1000]);
    
    if (links.length === 0) {
      Log.info('[SCRIPT]', 'Žádné nezpracované linky nenalezeny.');
      return;
    }

    Log.info('[SCRIPT]', `Nalezeno ${links.length} nezpracovaných linků.`);
    
    let processed = 0;
    let errors = 0;
    
    for (const link of links) {
      try {
        const fbId = db.extractFbIdFromUrl(link.url);
        
        if (!fbId) {
          Log.warn('[SCRIPT]', `Nelze extrahovat fb_id z URL: ${link.url}`);
          await db.safeExecute('discovered_links.markSingleAsProcessed', [link.id]);
          errors++;
          continue;
        }

        // Přidej do group_details
        await db.safeExecute('group_details.insertGroup', [
          fbId, 
          null, // name - bude doplněno při analýze
          null, // member_count
          null, // description  
          null, // category
          null, // privacy_type
          link.discovered_by_user_id, // discovered_by_user_id
          null, // notes
          null, // is_relevant - bude určeno při analýze
          null, // posting_allowed
          null, // language
          null  // activity_level
        ]);

        // Označ jako zpracované
        await db.safeExecute('discovered_links.markSingleAsProcessed', [link.id]);
        
        processed++;
        
        if (processed % 10 === 0) {
          Log.info('[SCRIPT]', `Zpracováno ${processed}/${links.length} linků...`);
        }
        
      } catch (err) {
        if (err.message.includes('Duplicate entry')) {
          // Skupina už existuje - označit jako zpracované
          await db.safeExecute('discovered_links.markSingleAsProcessed', [link.id]);
          processed++;
        } else {
          Log.error('[SCRIPT]', `Chyba při zpracování ${link.url}: ${err.message}`);
          errors++;
        }
      }
    }
    
    Log.success('[SCRIPT]', `Zpracování dokončeno! Úspěšně: ${processed}, Chyby: ${errors}`);
    
    // Zkontroluj výsledek
    const newGroups = await db.safeQueryAll('group_details.getGroupsForExploration', [10]);
    Log.info('[SCRIPT]', `Nyní je k dispozici ${newGroups.length} skupin pro exploration.`);
    
  } catch (err) {
    Log.error('[SCRIPT]', `Kritická chyba: ${err.message}`);
  } finally {
    process.exit(0);
  }
}

// Spusť script
processExistingLinks();