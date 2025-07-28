/**
 * Název souboru: iv_interactive_debugger.js
 * Umístění: ~/ivy/iv_interactive_debugger.js
 *
 * Popis: Interaktivní debugging systém pro zastavení při chybách
 * Umožňuje uživateli reagovat na chyby, kopírovat DOM a odeslat analýzu
 */

import { Log } from './libs/iv_log.class.js';
import { Wait } from './libs/iv_wait.class.js';

process.stdin.setMaxListeners(20); // Zvýšení limitu pro posluchače kvůli interaktivnímu debuggeru

export class InteractiveDebugger {
  constructor() {
    this.isActive = false; // Prevent multiple concurrent debugger sessions
    this.globalInputLock = false; // Prevent multiple stdin listeners
    this.criticalErrorCount = 0; // Track critical errors
  }

  /**
   * Emergency shutdown - stops all intervals and timers
   */
  emergencyShutdown(reason = 'Critical error') {
    console.log(`[EMERGENCY] SHUTDOWN: ${reason}`);
    
    // Stop all intervals and timeouts
    // Get all active handles (intervals, timeouts)
    const handles = process._getActiveHandles();
    handles.forEach(handle => {
      if (handle && typeof handle.close === 'function') {
        try {
          handle.close();
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    });
    
    // Force process exit after brief cleanup
    setTimeout(() => {
      process.exit(99); // Exit code 99 will stop start.sh script
    }, 1000);
  }

  // ODSTRANĚNO: setContext funkce


  /**
   * Hlavní funkce pro zastavení při chybě/varování - ZJEDNODUŠENÁ
   */
  async pauseOnError(errorLevel, message, context = {}) {
    // Check for critical database errors that should trigger emergency shutdown
    const criticalDbErrors = ['ER_MALFORMED_PACKET', 'ECONNREFUSED', 'ENOTFOUND'];
    const isCriticalDbError = criticalDbErrors.some(error => message.includes(error));
    
    if (isCriticalDbError) {
      this.criticalErrorCount++;
      if (this.criticalErrorCount >= 3) {
        console.log(`[CRITICAL] DB ERROR ${this.criticalErrorCount}/3 - EMERGENCY SHUTDOWN`);
        this.emergencyShutdown(message);
        return;
      }
    }

    // Prevent multiple concurrent debugger sessions
    if (this.isActive) {
      if (isCriticalDbError) {
        this.emergencyShutdown('Debugger recursion');
        return;
      }
      return false; // Continue without pausing
    }

    this.isActive = true;

    // Compact error display - 1 line
    console.log(`[DEBUGGER] ${errorLevel}: ${message} [c/q]`);

    const response = await this.waitForUserInput(10);

    let result = false;
    
    switch (response.toLowerCase()) {
      case 'q':
        process.exit(99);
        break;
      default:
        result = false; // Continue
        break;
    }

    this.isActive = false;
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

  // ODSTRANĚNO: Všechny balastní funkce pro debug reports

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

// ODSTRANĚNO: setDebugContext

