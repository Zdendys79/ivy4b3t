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
   * Formátuje čas v lidsky čitelném formátu
   * @param {number} time - Čas jako číslo
   * @param {string} unit - Jednotka času: 'ms' (default), 's', 'm', 'h'
   * @returns {string} Lidsky čitelný formát času
   */
  static formatTime(time, unit = 'ms') {
    // Převést vše na sekundy
    let totalSeconds;
    switch (unit) {
      case 'ms':
        totalSeconds = time / 1000;
        break;
      case 's':
        totalSeconds = time;
        break;
      case 'm':
        totalSeconds = time * 60;
        break;
      case 'h':
        totalSeconds = time * 3600;
        break;
      default:
        throw new Error(`Unsupported time unit: ${unit}`);
    }

    // Formátování podle velikosti času
    if (totalSeconds <= 10) {
      // Do 10s - 3 desetinná místa
      return `${totalSeconds.toFixed(3)}s`;
    } 
    else if (totalSeconds <= 30) {
      // Do 30s - 1 desetinné místo
      return `${totalSeconds.toFixed(1)}s`;
    }
    else if (totalSeconds <= 119) {
      // Do 119s - celé sekundy
      return `${Math.round(totalSeconds)}s`;
    }
    else if (totalSeconds <= 7140) { // 119 minut = 7140 sekund
      // Do 119 minut - min:sec bez desetinných míst
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = Math.round(totalSeconds % 60);
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
    else if (totalSeconds <= 172740) { // 47h 59m = 172740 sekund
      // Do 47h 59m - h:m bez sekund
      const totalMinutes = Math.round(totalSeconds / 60);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      return `${hours}:${minutes.toString().padStart(2, '0')}`;
    }
    else {
      // Nad 47h 59m - Xd h:m
      const totalMinutes = Math.round(totalSeconds / 60);
      const days = Math.floor(totalMinutes / (24 * 60));
      const remainingMinutes = totalMinutes % (24 * 60);
      const hours = Math.floor(remainingMinutes / 60);
      const minutes = remainingMinutes % 60;
      return `${days}d ${hours}:${minutes.toString().padStart(2, '0')}`;
    }
  }

  /**
   * Pomocná metoda pro interactive debugging - žádná duplicita kódu!
   */
  static async _handleInteractiveDebug(level, prefix, message, context = {}) {
    const { pauseOnError } = await import('../iv_interactive_debugger.js');
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
    
    // Debug systém pouze pro hlavní ivy.js, ne pro utility skripty
    const scriptName = process.argv[1]?.split('/').pop();
    if (scriptName === 'ivy.js') {
      await this._handleInteractiveDebug('WARNING', prefix, msg.join(' '));
    }
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
    
    // Debug systém pouze pro hlavní ivy.js, ne pro utility skripty
    const scriptName = process.argv[1]?.split('/').pop();
    if (scriptName === 'ivy.js') {
      await this._handleInteractiveDebug('ERROR', prefix, message, { stack: err?.stack });
    }
  }

  // Interactive debugging methods
  static async triggerDebugger(level, message, context = {}) {
    await this._handleInteractiveDebug(level, '[DEBUG]', message, context);
  }

  static async warnInteractive(module, message, context = {}) {
    this.warn(module, message);
    const { pauseOnError } = await import('../iv_interactive_debugger.js');
    return await pauseOnError('WARNING', `${module}: ${message}`, context);
  }

  static async errorInteractive(module, error, context = {}) {
    const message = error.message || String(error);
    this.error(module, message);
    if (error.stack) {
      this.debug(error.stack);
    }
    const { pauseOnError } = await import('../iv_interactive_debugger.js');
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
