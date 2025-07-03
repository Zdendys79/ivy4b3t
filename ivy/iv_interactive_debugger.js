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

export class InteractiveDebugger {
  constructor() {
    this.isEnabled = process.env.INTERACTIVE_DEBUG === 'true' || false;
    this.outputDir = './debug_reports';
    this.currentPage = null;
    this.currentUser = null;
    
    // Ensure output directory exists
    this.ensureOutputDir();
  }

  async ensureOutputDir() {
    try {
      await fs.mkdir(this.outputDir, { recursive: true });
    } catch (err) {
      Log.warn('[DEBUGGER]', `Cannot create output directory: ${err.message}`);
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

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const userId = this.currentUser?.id || 'unknown';
    
    Log.warn('[DEBUGGER]', '🛑 PAUSED ON ERROR/WARNING');
    Log.warn('[DEBUGGER]', `Error Level: ${errorLevel}`);
    Log.warn('[DEBUGGER]', `Message: ${message}`);
    Log.warn('[DEBUGGER]', '');
    Log.warn('[DEBUGGER]', '💡 Options:');
    Log.warn('[DEBUGGER]', '  [s] - STOP and create debug report');
    Log.warn('[DEBUGGER]', '  [c] - CONTINUE without report');
    Log.warn('[DEBUGGER]', '  [d] - DISABLE interactive debugging');
    Log.warn('[DEBUGGER]', '');
    Log.warn('[DEBUGGER]', '⏱️  Auto-continue in 30 seconds...');

    const response = await this.waitForUserInput(30);

    switch (response.toLowerCase()) {
      case 's':
        Log.info('[DEBUGGER]', '🔍 Creating debug report...');
        await this.createDebugReport(errorLevel, message, context, timestamp, userId);
        return true; // Stop execution
        
      case 'c':
        Log.info('[DEBUGGER]', '▶️ Continuing execution...');
        return false; // Continue
        
      case 'd':
        Log.info('[DEBUGGER]', '❌ Disabling interactive debugging');
        this.enable(false);
        return false; // Continue
        
      default:
        Log.info('[DEBUGGER]', '⏱️ Timeout - continuing execution...');
        return false; // Continue
    }
  }

  /**
   * Čeká na vstup uživatele s timeoutem
   */
  async waitForUserInput(timeoutSeconds = 30) {
    return new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      let resolved = false;

      // Timeout
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          rl.close();
          resolve('timeout');
        }
      }, timeoutSeconds * 1000);

      // User input
      rl.question('Enter your choice: ', (answer) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          rl.close();
          resolve(answer.trim());
        }
      });

      // Handle Ctrl+C gracefully
      rl.on('SIGINT', () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          rl.close();
          resolve('c'); // Continue on Ctrl+C
        }
      });
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
          Log.warn('[DEBUGGER]', `Screenshot failed: ${err.message}`);
        }
      }

      // 3. DOM HTML
      let domHtml = null;
      if (this.currentPage && !this.currentPage.isClosed()) {
        try {
          domHtml = await this.currentPage.content();
          Log.info('[DEBUGGER]', `📄 DOM captured (${domHtml.length} characters)`);
        } catch (err) {
          Log.warn('[DEBUGGER]', `DOM capture failed: ${err.message}`);
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
      Log.error('[DEBUGGER]', `Failed to create debug report: ${err.message}`);
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
      Log.error('[DEBUGGER]', `Failed to save debug incident to database: ${err.message}`);
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
export const debugger = new InteractiveDebugger();

// Helper funkce pro snadné použití
export async function pauseOnError(level, message, context = {}) {
  return await debugger.pauseOnError(level, message, context);
}

export async function quickPause(message) {
  return await debugger.quickPause(message);
}

export function setDebugContext(user, page) {
  debugger.setContext(user, page);
}

export function enableDebugger(enabled = true) {
  debugger.enable(enabled);
}