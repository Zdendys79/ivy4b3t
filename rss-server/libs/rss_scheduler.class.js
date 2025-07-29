/**
 * RSS Scheduler for IVY4B3T Project
 * Purpose: Schedule RSS feeds processing every hour
 * 
 * Features:
 * - Runs every hour automatically
 * - Integrated with IVY system logging
 * - Handles one RSS channel per run (round-robin)
 * - Can be started/stopped independently
 */

import os from 'node:os';
import { Log } from './iv_log.class.js';
import { processRSS } from '../rss_reader.js';
import { SystemLogger } from './iv_system_logger.class.js';
import { consoleLogger } from './iv_console_logger.class.js';
import { get as getVersion } from '../iv_version.js';

export class RSSScheduler {
  constructor() {
    this.intervalId = null;
    this.isRunning = false;
    this.lastRun = null;
    this.runCount = 0;
  }

  /**
   * Start the RSS scheduler (runs every hour)
   */
  start() {
    if (this.isRunning) {
      Log.warn('[RSS_SCHEDULER]', 'RSS Scheduler is already running');
      return false;
    }

    Log.info('[RSS_SCHEDULER]', 'Starting RSS Scheduler - will run every hour');
    
    // Run immediately first time
    this.runRSSProcessing();
    
    // Then schedule every hour (3600000 ms)
    this.intervalId = setInterval(() => {
      this.runRSSProcessing();
    }, 60 * 60 * 1000); // 1 hour
    
    this.isRunning = true;
    return true;
  }

  /**
   * Stop the RSS scheduler
   */
  stop() {
    if (!this.isRunning) {
      Log.warn('[RSS_SCHEDULER]', 'RSS Scheduler is not running');
      return false;
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    Log.info('[RSS_SCHEDULER]', 'RSS Scheduler stopped');
    return true;
  }

  /**
   * Run RSS processing cycle
   */
  async runRSSProcessing() {
    const startTime = Date.now();
    this.runCount++;
    
    try {
      Log.info('[RSS_SCHEDULER]', `Starting RSS processing cycle #${this.runCount}`);
      
      const result = await processRSS();
      const duration = Date.now() - startTime;
      
      if (result.success) {
        const message = `RSS cycle #${this.runCount} completed: ${result.newUrls} new URLs from ${result.channel} (${(duration/1000).toFixed(3)}s)`;
        Log.info('[RSS_SCHEDULER]', message);
        
        // Log do system logu
        await SystemLogger.logRSS(
          os.hostname(),
          getVersion(),
          process.env.IVY_GIT_BRANCH,
          consoleLogger.sessionId,
          'INFO',
          message,
          {
            cycle: this.runCount,
            channel: result.channel,
            newUrls: result.newUrls,
            duplicates: result.duplicates,
            cleanedUrls: result.cleanedUrls,
            processingTime: duration,
            stats: result.stats
          }
        );
        
        if (result.stats) {
          Log.info('[RSS_SCHEDULER]', 
            `Database stats: ${result.stats.total_urls} total, ${result.stats.unused_urls} unused, ${result.stats.recent_urls} recent`
          );
        }
      } else {
        const message = `RSS cycle #${this.runCount} failed: ${result.error} (${(duration/1000).toFixed(3)}s)`;
        Log.error('[RSS_SCHEDULER]', message);
        
        // Log chybu do system logu
        await SystemLogger.logRSS(
          os.hostname(),
          getVersion(),
          process.env.IVY_GIT_BRANCH,
          consoleLogger.sessionId,
          'ERROR',
          message,
          {
            cycle: this.runCount,
            error: result.error,
            processingTime: duration
          }
        );
      }
      
      this.lastRun = new Date();
      return result;
      
    } catch (err) {
      const duration = Date.now() - startTime;
      const message = `RSS cycle #${this.runCount} error: ${err.message} (${(duration/1000).toFixed(3)}s)`;
      Log.error('[RSS_SCHEDULER]', message);
      
      // Log chybu do system logu
      await SystemLogger.logRSS(
        os.hostname(),
        getVersion(),
        process.env.IVY_GIT_BRANCH,
        consoleLogger.sessionId,
        'ERROR',
        message,
        {
          cycle: this.runCount,
          error: err.message,
          processingTime: duration,
          stack: err.stack
        }
      );
      
      this.lastRun = new Date();
      return { success: false, error: err.message };
    }
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      runCount: this.runCount,
      lastRun: this.lastRun,
      nextRun: this.isRunning && this.lastRun ? 
        new Date(this.lastRun.getTime() + 60 * 60 * 1000) : null
    };
  }

  /**
   * Force run RSS processing immediately (for testing/manual trigger)
   */
  async forceRun() {
    Log.info('[RSS_SCHEDULER]', 'Manual RSS processing triggered');
    return await this.runRSSProcessing();
  }
}

// Singleton instance
export const rssScheduler = new RSSScheduler();