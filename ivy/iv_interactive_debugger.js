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
   * Vytvoří kompletní debug report
   */
  async createDebugReport(errorLevel, message, context, timestamp, userId) {
    try {
      const reportId = `${timestamp}_${userId}_${errorLevel}`;
      const reportDir = path.join(this.outputDir, reportId);
      
      await fs.mkdir(reportDir, { recursive: true });

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

      await fs.writeFile(
        path.join(reportDir, 'error_info.json'),
        JSON.stringify(errorInfo, null, 2)
      );

      // 2. Screenshot
      if (this.currentPage && !this.currentPage.isClosed()) {
        try {
          await this.currentPage.screenshot({
            path: path.join(reportDir, 'screenshot.png'),
            fullPage: true
          });
          Log.info('[DEBUGGER]', '📸 Screenshot captured');
        } catch (err) {
          Log.warn('[DEBUGGER]', `Screenshot failed: ${err.message}`);
        }
      }

      // 3. DOM HTML
      if (this.currentPage && !this.currentPage.isClosed()) {
        try {
          const html = await this.currentPage.content();
          await fs.writeFile(path.join(reportDir, 'dom.html'), html);
          Log.info('[DEBUGGER]', '📄 DOM HTML captured');
        } catch (err) {
          Log.warn('[DEBUGGER]', `DOM capture failed: ${err.message}`);
        }
      }

      // 4. Console logs (if available)
      try {
        const consoleLogs = await this.currentPage?.evaluate(() => {
          if (window.capturedLogs) {
            return window.capturedLogs;
          }
          return ['Console logging not available'];
        }).catch(() => ['Console capture failed']);

        await fs.writeFile(
          path.join(reportDir, 'console_logs.json'),
          JSON.stringify(consoleLogs, null, 2)
        );
      } catch (err) {
        Log.warn('[DEBUGGER]', `Console logs capture failed: ${err.message}`);
      }

      // 5. Uživatelský komentář
      const userComment = await this.getUserComment();
      if (userComment) {
        await fs.writeFile(path.join(reportDir, 'user_comment.txt'), userComment);
        Log.info('[DEBUGGER]', '💬 User comment saved');
      }

      // 6. System information
      const systemInfo = {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        memory: process.memoryUsage(),
        uptime: process.uptime(),
        env: {
          NODE_ENV: process.env.NODE_ENV,
          DEBUG: process.env.DEBUG
        }
      };

      await fs.writeFile(
        path.join(reportDir, 'system_info.json'),
        JSON.stringify(systemInfo, null, 2)
      );

      Log.success('[DEBUGGER]', `🎯 Debug report created: ${reportDir}`);
      
      // Vytvoř README pro report
      await this.createReportReadme(reportDir, reportId, errorInfo);

      return reportDir;

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