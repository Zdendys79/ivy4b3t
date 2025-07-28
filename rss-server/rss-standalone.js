#!/usr/bin/env node

/**
 * Standalone RSS processor for IVY4B3T Project
 * Spouští se Ubuntu plánovačem (cron) nezávisle na robotech
 */

import { rssReader } from './rss_reader.js';
import { Log } from './libs/iv_log.class.js';

async function runRSSProcessing() {
  try {
    Log.info('[RSS-STANDALONE]', 'Spouštím samostatné zpracování RSS...');
    
    const result = await rssReader.processAllFeeds();
    
    if (result && result.success) {
      Log.info('[RSS-STANDALONE]', `RSS zpracování dokončeno: ${result.totalNewUrls} nových URL`);
      process.exit(0);
    } else {
      Log.error('[RSS-STANDALONE]', 'RSS zpracování selhalo');
      process.exit(1);
    }
    
  } catch (error) {
    Log.error('[RSS-STANDALONE]', `Kritická chyba: ${error.message}`);
    process.exit(1);
  }
}

// Spustit zpracování
runRSSProcessing();