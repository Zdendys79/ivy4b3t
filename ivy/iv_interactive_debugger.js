/**
 * Název souboru: iv_interactive_debugger.js
 * Umístění: ~/ivy/iv_interactive_debugger.js
 *
 * Popis: Interaktivní debugging systém pro zastavení při chybách
 * Umožňuje uživateli reagovat na chyby, kopírovat DOM a odeslat analýzu
 */

import fs from 'fs/promises';
import path from 'path';
import readline from 'readline';
import { Log } from './iv_log.class.js';
import { db } from './iv_sql.js';

process.stdin.setMaxListeners(20); // Zvýšení limitu pro posluchače kvůli interaktivnímu debuggeru

export class InteractiveDebugger {
  constructor() {
    this.isEnabled = true; // Always enabled as integral part of the application
    this.outputDir = './debug_reports';
    this.currentPage = null;
    this.currentUser = null;
    this.isActive = false; // Prevent multiple concurrent debugger sessions
    
    // Ensure output directory exists
    this.ensureOutputDir();
  }

  async ensureOutputDir() {
    try {
      await fs.mkdir(this.outputDir, { recursive: true });
    } catch (err) {
      await Log.warn('[DEBUGGER]', `Cannot create output directory: ${err.message}`);
    }
  }

  /**
   * Nastaví aktuální kontext pro debugging
   */
  setContext(user, page) {
    this.currentUser = user;
    this.currentPage = page;
  }

  /**
   * Povolit/zakázat interaktivní debugging
   */
  enable(enabled = true) {
    this.isEnabled = enabled;
    Log.info('[DEBUGGER]', `Interactive debugging ${enabled ? 'ENABLED' : 'DISABLED'}`);
  }

  /**
   * Hlavní funkce pro zastavení při chybě/varování
   */
  async pauseOnError(errorLevel, message, context = {}) {
    if (!this.isEnabled) {
      return false; // Pokračuj bez zastavení
    }

    // Prevent multiple concurrent debugger sessions
    if (this.isActive) {
      Log.info('[DEBUGGER]', `⏸️ Debugger already active, skipping: ${message}`);
      return false; // Continue without pausing
    }

    this.isActive = true;

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const userId = this.currentUser?.id || 'unknown';
    
    Log.info('[DEBUGGER]', `🛑 ${errorLevel}: ${message}`);
    Log.info('[DEBUGGER]', '💡 [s]top+report [c]ontinue [d]isable [q]uit - Auto-continue in 30s...');

    const response = await this.waitForUserInput(30);

    let result = false;
    
    switch (response.toLowerCase()) {
      case 's':
        Log.info('[DEBUGGER]', '🔍 Creating debug report...');
        await this.createDebugReport(errorLevel, message, context, timestamp, userId);
        result = true; // Stop execution
        break;
        
      case 'c':
        Log.info('[DEBUGGER]', '▶️ Continuing execution...');
        result = false; // Continue
        break;
        
      case 'd':
        Log.info('[DEBUGGER]', '❌ Disabling interactive debugging');
        this.enable(false);
        result = false; // Continue
        break;
        
      case 'q':
        Log.info('[DEBUGGER]', '🛑 QUIT program requested by user, initiating graceful shutdown...');
        process.kill(process.pid, 'SIGINT'); // Send SIGINT to trigger graceful shutdown
        result = 'quit'; // Return a special value to stop further execution
        break;
        
      default:
        Log.info('[DEBUGGER]', '⏱️ Timeout - continuing execution...');
        result = false; // Continue
        break;
    }

    this.isActive = false; // Release the lock
    return result;
  }

  /**
   * Čeká na vstup uživatele s timeoutem
   */
  async waitForUserInput(timeoutSeconds = 30) {
    // Kontrola, zda máme TTY pro interaktivní vstup
    if (!process.stdin.isTTY) {
      await Log.warn('[DEBUGGER]', '🚫 No TTY available for interactive input - auto-continuing after timeout');
      await new Promise(resolve => setTimeout(resolve, timeoutSeconds * 1000));
      return 'timeout';
    }

    return new Promise((resolve) => {
      let resolved = false;

      const cleanup = () => {
        if (timeout) clearTimeout(timeout);
        if (process.stdin.isTTY) {
          process.stdin.setRawMode(false);
        }
        process.stdin.removeListener('data', onData);
        process.stdin.removeListener('SIGINT', onSigint);
        process.stdin.pause();
      };

      const onData = (key) => {
        const choice = key.toString().toLowerCase();
        Log.info('[DEBUGGER]', `🔤 Key received: "${choice}" (code: ${key[0]})`);
        if (['s', 'c', 'd', 'q'].includes(choice)) {
          if (!resolved) {
            resolved = true;
            cleanup();
            resolve(choice);
          }
        }
      };

      const onSigint = () => {
        if (!resolved) {
          resolved = true;
          cleanup();
          resolve('c'); // Continue on Ctrl+C
        }
      };

      // Timeout s lepším loggingem
      const timeout = setTimeout(() => {
        if (!resolved) {
          Log.info('[DEBUGGER]', `⏰ Timeout reached after ${timeoutSeconds} seconds - auto-continuing`);
          resolved = true;
          cleanup();
          resolve('timeout');
        }
      }, timeoutSeconds * 1000);

      // Setup listeners - pouze raw mode bez readline
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
      }
      process.stdin.on('data', onData);
      process.stdin.on('SIGINT', onSigint);
      process.stdin.resume();
    });
  }

  /**
   * Vytvoří kompletní debug report a uloží do databáze
   */
  async createDebugReport(errorLevel, message, context, timestamp, userId) {
    try {
      const incidentId = `${timestamp}_${userId}_${errorLevel}`;
      
      Log.info('[DEBUGGER]', '📊 Capturing debug data...');

      // 1. Základní informace o chybě
      const errorInfo = {
        timestamp: new Date().toISOString(),
        errorLevel: errorLevel,
        message: message,
        context: context,
        userId: userId,
        url: this.currentPage?.url() || 'unknown',
        userAgent: await this.currentPage?.evaluate(() => navigator.userAgent).catch(() => 'unknown')
      };

      // 2. Screenshot jako binary data
      let screenshotData = null;
      if (this.currentPage && !this.currentPage.isClosed()) {
        try {
          screenshotData = await this.currentPage.screenshot({
            type: 'png',
            fullPage: true
          });
          Log.info('[DEBUGGER]', `📸 Screenshot captured (${screenshotData.length} bytes)`);
        } catch (err) {
          await Log.warn('[DEBUGGER]', `Screenshot failed: ${err.message}`);
        }
      }

      // 3. DOM HTML
      let domHtml = null;
      if (this.currentPage && !this.currentPage.isClosed()) {
        try {
          domHtml = await this.currentPage.content();
          Log.info('[DEBUGGER]', `📄 DOM captured (${domHtml.length} characters)`);
        } catch (err) {
          await Log.warn('[DEBUGGER]', `DOM capture failed: ${err.message}`);
          domHtml = `DOM capture failed: ${err.message}`;
        }
      }

      // 4. Console logs
      let consoleLogs = null;
      try {
        const logs = await this.currentPage?.evaluate(() => {
          if (window.capturedLogs) {
            return window.capturedLogs;
          }
          return ['Console logging not available'];
        }).catch(() => ['Console capture failed']);

        consoleLogs = JSON.stringify(logs, null, 2);
      } catch (err) {
        consoleLogs = JSON.stringify(['Console logs capture failed: ' + err.message]);
      }

      // 5. Uživatelský komentář
      const userComment = await this.getUserComment();
      const userAnalysisRequest = await this.getUserAnalysisRequest();

      // 6. System information
      const systemInfo = {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        memory: process.memoryUsage(),
        uptime: process.uptime(),
        hostname: (await import('os')).hostname(),
        env: {
          NODE_ENV: process.env.NODE_ENV,
          DEBUG: process.env.DEBUG,
          INTERACTIVE_DEBUG: process.env.INTERACTIVE_DEBUG
        }
      };

      // 7. Stack trace pokud je dostupný
      let stackTrace = null;
      if (context.stack) {
        stackTrace = context.stack;
      } else if (context.error && context.error.stack) {
        stackTrace = context.error.stack;
      }

      // 8. Uložení do databáze
      const debugIncident = {
        incident_id: incidentId,
        user_id: userId,
        error_level: errorLevel.toUpperCase(),
        error_message: message,
        error_context: JSON.stringify(context, null, 2),
        page_url: errorInfo.url,
        page_title: await this.currentPage?.title().catch(() => 'Unknown'),
        user_agent: errorInfo.userAgent,
        screenshot_data: screenshotData,
        dom_html: domHtml,
        console_logs: consoleLogs,
        user_comment: userComment,
        user_analysis_request: userAnalysisRequest,
        system_info: JSON.stringify(systemInfo, null, 2),
        stack_trace: stackTrace,
        status: 'NEW'
      };

      Log.info('[DEBUGGER]', '💾 Saving debug incident to database...');
      
      await this.saveDebugIncidentToDatabase(debugIncident);

      Log.success('[DEBUGGER]', `🎯 Debug incident saved to database with ID: ${incidentId}`);
      Log.info('[DEBUGGER]', '🔍 Analysis can be done via database queries');
      Log.info('[DEBUGGER]', `   SELECT * FROM debug_incidents WHERE incident_id = '${incidentId}';`);

      return incidentId;

    } catch (err) {
      await Log.error('[DEBUGGER]', `Failed to create debug report: ${err.message}`);
      return null;
    }
  }

  /**
   * Získá komentář od uživatele
   */
  async getUserComment() {
    return new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      console.log('\n📝 Please describe what went wrong (press Enter twice to finish):');
      
      let comment = '';
      let emptyLines = 0;

      rl.on('line', (line) => {
        if (line.trim() === '') {
          emptyLines++;
          if (emptyLines >= 2) {
            rl.close();
            resolve(comment.trim());
            return;
          }
        } else {
          emptyLines = 0;
          comment += line + '\n';
        }
      });

      // Timeout after 2 minutes
      setTimeout(() => {
        rl.close();
        resolve(comment.trim());
      }, 120000);
    });
  }

  /**
   * Získá specifický požadavek na analýzu od uživatele
   */
  async getUserAnalysisRequest() {
    return new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      console.log('\n🔍 What should Claude analyze? (press Enter twice to finish):');
      console.log('   Examples: "Check why login failed", "Analyze DOM structure", "Look for blocked elements"');
      
      let request = '';
      let emptyLines = 0;

      rl.on('line', (line) => {
        if (line.trim() === '') {
          emptyLines++;
          if (emptyLines >= 2) {
            rl.close();
            resolve(request.trim());
            return;
          }
        } else {
          emptyLines = 0;
          request += line + '\n';
        }
      });

      // Timeout after 1 minute
      setTimeout(() => {
        rl.close();
        resolve(request.trim());
      }, 60000);
    });
  }

  /**
   * Uloží debug incident do databáze
   */
  async saveDebugIncidentToDatabase(incident) {
    try {
      const sql = `
        INSERT INTO debug_incidents (
          incident_id, user_id, error_level, error_message, error_context,
          page_url, page_title, user_agent, screenshot_data, dom_html,
          console_logs, user_comment, user_analysis_request, system_info,
          stack_trace, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const params = [
        incident.incident_id,
        incident.user_id,
        incident.error_level,
        incident.error_message,
        incident.error_context,
        incident.page_url,
        incident.page_title,
        incident.user_agent,
        incident.screenshot_data,
        incident.dom_html,
        incident.console_logs,
        incident.user_comment,
        incident.user_analysis_request,
        incident.system_info,
        incident.stack_trace,
        incident.status
      ];

      await db.safeExecute('system.insertDebugIncident', params);
      
      Log.info('[DEBUGGER]', `💾 Debug incident inserted into database`);
      
    } catch (err) {
      await Log.error('[DEBUGGER]', `Failed to save debug incident to database: ${err.message}`);
      throw err;
    }
  }

  /**
   * Vytvoří README soubor pro debug report
   */
  async createReportReadme(reportDir, reportId, errorInfo) {
    const readme = `# Debug Report: ${reportId}

## Error Information
- **Timestamp**: ${errorInfo.timestamp}
- **Error Level**: ${errorInfo.errorLevel}
- **Message**: ${errorInfo.message}
- **User ID**: ${errorInfo.userId}
- **URL**: ${errorInfo.url}

## Files in this report
- \`error_info.json\` - Detailed error information
- \`screenshot.png\` - Full page screenshot
- \`dom.html\` - Complete DOM HTML
- \`console_logs.json\` - Browser console logs
- \`user_comment.txt\` - User description of the problem
- \`system_info.json\` - System and environment information

## How to analyze
1. Open \`screenshot.png\` to see visual state
2. Open \`dom.html\` in browser to inspect DOM
3. Read \`user_comment.txt\` for context
4. Check \`console_logs.json\` for browser errors
5. Review \`error_info.json\` for technical details

Generated by Interactive Debugger at ${new Date().toISOString()}
`;

    await fs.writeFile(path.join(reportDir, 'README.md'), readme);
  }

  /**
   * Jednoduchá funkce pro rychlé zastavení
   */
  async quickPause(message, level = 'WARNING') {
    return await this.pauseOnError(level, message);
  }
}

// Singleton instance
export const interactiveDebugger = new InteractiveDebugger();

// Helper funkce pro snadné použití
export async function pauseOnError(level, message, context = {}) {
  return await interactiveDebugger.pauseOnError(level, message, context);
}

export async function quickPause(message) {
  return await interactiveDebugger.quickPause(message);
}

export function setDebugContext(user, page) {
  interactiveDebugger.setContext(user, page);
}

export function enableDebugger(enabled = true) {
  interactiveDebugger.enable(enabled);
}