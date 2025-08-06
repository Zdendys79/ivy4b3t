// iv_log.class.js – Centrální logovací nástroje pro IVY
// Zjednodušená verze: loguje vždy vše, bez závislosti na config.json.

const icons = {
  info: '[INFO]',
  warn: '[WARN]',
  error: '[ERROR]',
  success: '[OK]',
  debug: '[DEBUG]',
  db: '[DB]'
};

const now = () => new Date().toISOString().replace('T', ' ').slice(0, 19);

/**
 * Získá informace o volajícím souboru a řádku ze stack trace
 * @returns {string} Formát "soubor:řádek" nebo prázdný řetězec
 */
const getCallerLocation = () => {
  try {
    const stack = new Error().stack.split('\n');
    // Hledáme první řádek, který není v log souboru
    for (let i = 3; i < stack.length && i < 10; i++) {
      const line = stack[i];
      if (line && !line.includes('iv_log.class.js') && !line.includes('node:internal')) {
        // Parsuj soubor a řádek z stack trace
        const match = line.match(/at\s+.*\s+\((.+):(\d+):\d+\)/) || 
                      line.match(/at\s+(.+):(\d+):\d+/);
        if (match) {
          const filePath = match[1];
          const lineNumber = match[2];
          // Získej pouze název souboru (bez cesty)
          const fileName = filePath.split('/').pop();
          return `[${fileName}:${lineNumber}]`;
        }
      }
    }
  } catch (e) {
    // Tiše ignoruj chyby při parsování
  }
  return '';
};

export class Log {
  /**
   * Pomocná metoda pro interactive debugging - žádná duplicita kódu!
   */
  static async _handleInteractiveDebug(level, prefix, message, context = {}) {
    const { pauseOnError } = await import('../../ivy/iv_interactive_debugger.js');
    const result = await pauseOnError(level, `${prefix}: ${message}`, context);
    
    // Pouze skutečný 'quit' příkaz má ukončit program
    if (result === 'quit') {
      console.log('\n🛑 Execution paused by user request');
      console.log('Debug report created in ./debug_reports/');
      process.exit(99); // Special exit code for legitimate quit
    }
    
    // Pro 's' (stop+report) nebo 'c' (continue) pokračujeme v běhu
  }

  static info(prefix, ...msg) {
    const location = getCallerLocation();
    console.log(`${now()} ${prefix} ${icons.info}${location}`, ...msg);
  }

  static async warn(prefix, ...msg) {
    const location = getCallerLocation();
    console.warn(`${now()} ${prefix} ${icons.warn}${location}`, ...msg);
    await this._handleInteractiveDebug('WARNING', prefix, msg.join(' '));
  }

  static success(prefix, ...msg) {
    const location = getCallerLocation();
    console.log(`${now()} ${prefix} ${icons.success}${location}`, ...msg);
  }

  static debug(prefix, ...msg) {
    const location = getCallerLocation();
    console.log(`${now()} ${prefix} ${icons.debug}${location}`, ...msg);
  }

  static db(prefix, ...msg) {
    const location = getCallerLocation();
    console.log(`${now()} ${prefix} ${icons.db}${location}`, ...msg);
  }

  static async error(prefix, err) {
    const location = getCallerLocation();
    const message = err?.message || String(err);
    console.error(`${now()} ${prefix} ${icons.error}${location}`, message);
    
    // Stack trace se vypíše vždy, pokud existuje
    if (err?.stack) {
      console.error(err.stack);
    }
    
    await this._handleInteractiveDebug('ERROR', prefix, message, { stack: err?.stack });
  }

  // Interactive debugging methods
  static async triggerDebugger(level, message, context = {}) {
    await this._handleInteractiveDebug(level, '[DEBUG]', message, context);
  }

  static async warnInteractive(module, message, context = {}) {
    this.warn(module, message);
    const { pauseOnError } = await import('../../ivy/iv_interactive_debugger.js');
    return await pauseOnError('WARNING', `${module}: ${message}`, context);
  }

  static async errorInteractive(module, error, context = {}) {
    const message = error.message || String(error);
    this.error(module, message);
    if (error.stack) {
      this.debug(error.stack);
    }
    const { pauseOnError } = await import('../../ivy/iv_interactive_debugger.js');
    return await pauseOnError('ERROR', `${module}: ${message}`, { ...context, stack: error.stack });
  }

  static async systemLog(eventType, message, metadata = {}) {
    try {
      const { SystemLogger } = await import('./iv_system_logger.class.js');
      return await SystemLogger.logEvent(
        eventType,
        'INFO', 
        message,
        metadata,
        process.env.HOSTNAME || 'unknown',
        process.env.VERSION_CODE || 'dev',
        process.env.GIT_BRANCH || 'main',
        process.env.SESSION_ID || Date.now().toString()
      );
    } catch (err) {
      this.error('[LOG]', `SystemLog failed: ${err.message}`);
      return false;
    }
  }
}
