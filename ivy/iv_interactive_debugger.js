/**
 * Název souboru: iv_interactive_debugger.js
 * Umístění: ~/ivy/iv_interactive_debugger.js
 *
 * Popis: Interaktivní debugging systém pro zastavení při chybách
 * Umožňuje uživateli reagovat na chyby, kopírovat DOM a odeslat analýzu
 */

import { Log } from './libs/iv_log.class.js';
import { Wait } from './libs/iv_wait.class.js';
import { db } from './iv_sql.js';

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
    // Automaticky loguj každou ERROR do databáze
    if (errorLevel === 'ERROR') {
      await this.saveToDatabase(errorLevel, message, context);
    }
    
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

    const response = await this.waitForUserInput(); // Bez timeout - čeká nekonečně na vstup

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
   * Čeká na vstup uživatele s timeoutem - NYNÍ POUŽÍVÁ UNIVERZÁLNÍ WAIT METODU
   */
  async waitForUserInput(timeoutSeconds = 30) {
    // Ulož resolver pro možné přerušení
    this.currentInputResolver = null;
    
    const result = await Wait.forUserInput(timeoutSeconds);
    
    // Zpracování výsledku podle původního chování
    if (result === 'timeout') {
      Log.info('[DEBUGGER]', `Timeout reached after ${timeoutSeconds}s (expected ${timeoutSeconds}s) - auto-continuing`);
      return 'timeout';
    }
    
    return result;
  }

  /**
   * Uloží debug data do databáze - automaticky pro ERROR
   */
  async saveToDatabase(errorLevel, message, context = {}) {
    try {
      // Zabránit zacyklení - nelogovat SQL chyby debuggeru
      if (message.includes('system.insertDebugIncident') || message.includes('Query failed: system.insertDebugIncident')) {
        return;
      }
      
      const userId = global.systemState?.currentUserId || null;
      
      // Generuj unikátní incident_id
      const incidentId = `INC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      await db.safeExecute('system.insertDebugIncident', [
        incidentId,                     // incident_id (nový první parametr)
        userId,                         // user_id  
        errorLevel,                     // error_level
        message,                        // error_message
        JSON.stringify(context),        // error_context
        null,                          // page_url
        context.stack || null,         // stack_trace
        'NEW'                          // status
      ]);
      
    } catch (err) {
      // Nelogovat chyby logování aby nedošlo k zacyklení
      console.log(`[DEBUGGER] DB logging failed silently`);
    }
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

// ODSTRANĚNO: setDebugContext

