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
import { Log } from './libs/iv_log.class.js';
import { db } from './iv_sql.js';
import { Wait } from './libs/iv_wait.class.js';

process.stdin.setMaxListeners(20); // Zvýšení limitu pro posluchače kvůli interaktivnímu debuggeru

export class InteractiveDebugger {
  constructor() {
    this.outputDir = './debug_reports';
    this.currentPage = null;
    this.currentUser = null;
    this.isActive = false; // Prevent multiple concurrent debugger sessions
    this.globalInputLock = false; // Prevent multiple stdin listeners
    
    // Ensure output directory exists
    this.ensureOutputDir();
  }

  async ensureOutputDir() {
    try {
      await fs.mkdir(this.outputDir, { recursive: true });
    } catch (err) {
      Log.debug('[DEBUGGER]', `Cannot create output directory: ${err.message}`);
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
   * Hlavní funkce pro zastavení při chybě/varování
   */
  async pauseOnError(errorLevel, message, context = {}) {
    // Interactive debugging je vždy povolený
    
    // Vždy získat stack trace pro debugging
    const stack = new Error().stack;
    const callerInfo = stack.split('\n').slice(2, 5).join('\n'); // Získat 3 úrovně volání

    // Prevent multiple concurrent debugger sessions
    if (this.isActive) {
      // Použít Log.debug místo Log.warn aby se zabránilo rekurzi
      Log.debug('[DEBUGGER]', `POKUS O VÍCENÁSOBNÉ VOLÁNÍ DEBUGGERU!`);
      Log.debug('[DEBUGGER]', `Jiz aktivni debugger, ignoruji: ${message}`);
      Log.debug('[DEBUGGER]', `Stack trace:`);
      console.warn(callerInfo);
      
      // Zalogovat do databáze pro pozdější analýzu
      if (this.currentUser?.id) {
        await db.safeExecute('system.insertDebugIncident', [
          this.currentUser.id,
          'debugger_multiple_call_attempt',
          JSON.stringify({
            message: message,
            errorLevel: errorLevel,
            stack: stack,
            callerInfo: callerInfo,
            timestamp: new Date().toISOString()
          })
        ]).catch(err => {
          Log.debug('[DEBUGGER]', `Nelze zalogovat incident: ${err.message}`);
        });
      }
      
      return false; // Continue without pausing
    }

    this.isActive = true;

    // Logovat volání debuggeru včetně stack trace
    Log.info('[DEBUGGER]', `🔍 Debugger aktivován: ${message}`);
    Log.info('[DEBUGGER]', `Stack trace:`);
    console.info(callerInfo);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const userId = this.currentUser?.id || 'unknown';
    
    console.log('[s]top+report [c]ontinue [q]uit - Auto-continue in 30s...');

    const response = await this.waitForUserInput(30);
    console.log(`Choice: ${response}`);

    let result = false;
    
    switch (response.toLowerCase()) {
      case 's':
        await this.createDebugReport(errorLevel, message, context, timestamp, userId);
        result = true; // Stop execution
        break;
        
      case 'c':
        result = false; // Continue
        break;
        
      case 'd':
        Log.info('[DEBUGGER]', 'Interactive debugging nelze vypnout - je integrální částí aplikace');
        result = false; // Continue
        break;
        
      case 'q':
        process.exit(99); // Exit s kódem 99 pro správnou detekci v start.sh
        result = 'quit'; // Return a special value to stop further execution
        break;
        
      case 'timeout':
        result = false; // Continue
        break;
        
      default:
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
      Log.debug('[DEBUGGER]', 'No TTY available for interactive input - auto-continuing after timeout');
      await Wait.toSeconds(timeoutSeconds);
      return 'timeout';
    }

    return new Promise((resolve) => {
      let resolved = false;
      const startTime = Date.now();
      
      // Ulož resolver pro možné přerušení
      this.currentInputResolver = resolve;

      const cleanup = () => {
        if (timeout) clearTimeout(timeout);
        if (process.stdin.isTTY) {
          process.stdin.setRawMode(false);
        }
        process.stdin.removeListener('data', onData);
        process.stdin.removeListener('SIGINT', onSigint);
        process.stdin.pause();
        
        // Vyčisti resolver
        this.currentInputResolver = null;
      };

      const onData = (key) => {
        if (resolved || this.globalInputLock) return; // Guard against double processing and multiple instances
        this.globalInputLock = true; // Lock globally to prevent other instances
        
        const choice = key.toString().toLowerCase();
        Log.info('[DEBUGGER]', `Key received: "${choice}" (code: ${key[0]})`);
        if (['s', 'c', 'q'].includes(choice)) {
          resolved = true;
          cleanup();
          resolve(choice);
        }
        this.globalInputLock = false; // Unlock for next input
      };

      const onSigint = () => {
        if (!resolved) {
          resolved = true;
          cleanup();
          resolve('c'); // Continue on Ctrl+C
        }
      };

      // Timeout
      const timeout = setTimeout(() => {
        if (!resolved) {
          const actualSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
          Log.info('[DEBUGGER]', `Timeout reached after ${actualSeconds}s (expected ${timeoutSeconds}s) - auto-continuing`);
          resolved = true;
          cleanup();
          resolve('timeout');
        } else {
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
      
      Log.info('[DEBUGGER]', 'Capturing debug data...');

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
          Log.debug('[DEBUGGER]', `Screenshot failed: ${err.message}`);
        }
      }

      // 3. DOM HTML
      let domHtml = null;
      if (this.currentPage && !this.currentPage.isClosed()) {
        try {
          domHtml = await this.currentPage.content();
          Log.info('[DEBUGGER]', `DOM captured (${domHtml.length} characters)`);
        } catch (err) {
          Log.debug('[DEBUGGER]', `DOM capture failed: ${err.message}`);
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

      Log.info('[DEBUGGER]', 'Saving debug incident to database...');
      
      await this.saveDebugIncidentToDatabase(debugIncident);

      Log.success('[DEBUGGER]', `Debug incident saved to database with ID: ${incidentId}`);
      Log.info('[DEBUGGER]', 'Analysis can be done via database queries');
      Log.info('[DEBUGGER]', `   SELECT * FROM debug_incidents WHERE incident_id = '${incidentId}';`);

      return incidentId;

    } catch (err) {
      Log.debug('[DEBUGGER]', `Failed to create debug report: ${err.message}`);
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

      console.log('\nPlease describe what went wrong (press Enter twice to finish):');
      
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
      }, 120 * 1000); // 2 minutes
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

      console.log('\nWhat should Claude analyze? (press Enter twice to finish):');
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
      }, 60 * 1000); // 1 minute
    });
  }

  /**
   * Uloží debug incident do databáze
   */
  async saveDebugIncidentToDatabase(incident) {
    try {
      const params = [
        incident.incident_id,
        incident.user_id || null,
        incident.error_level,
        incident.error_message,
        incident.error_context || null,
        incident.page_url || null,
        incident.page_title || null,
        incident.user_agent || null,
        incident.screenshot_data || null,
        incident.dom_html || null,
        incident.console_logs || null,
        incident.user_comment || null,
        incident.user_analysis_request || null,
        incident.system_info || null,
        incident.stack_trace || null,
        incident.status
      ];

      await db.safeExecute('system.insertDebugIncident', params);
      
      Log.info('[DEBUGGER]', `Debug incident inserted into database`);
      
    } catch (err) {
      Log.debug('[DEBUGGER]', `Failed to save debug incident to database: ${err.message}`);
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

