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

export class Log {
  static info(prefix, ...msg) {
    console.log(`${now()} ${prefix} ${icons.info}`, ...msg);
  }

  static warn(prefix, ...msg) {
    console.warn(`${now()} ${prefix} ${icons.warn}`, ...msg);
  }

  static success(prefix, ...msg) {
    console.log(`${now()} ${prefix} ${icons.success}`, ...msg);
  }

  static debug(prefix, ...msg) {
    console.log(`${now()} ${prefix} ${icons.debug}`, ...msg);
  }

  static db(prefix, ...msg) {
    console.log(`${now()} ${prefix} ${icons.db}`, ...msg);
  }

  static error(prefix, err) {
    const message = err?.message || String(err);
    console.error(`${now()} ${prefix} ${icons.error}`, message);
    
    // Stack trace se vypíše vždy, pokud existuje
    if (err?.stack) {
      console.error(err.stack);
    }
  }

  // Interactive debugging methods
  static async triggerDebugger(level, message, context = {}) {
    try {
      // Import dynamically to avoid circular dependencies
      const { pauseOnError } = await import('../iv_interactive_debugger.js');
      const shouldStop = await pauseOnError(level, message, context);
      
      if (shouldStop) {
        console.log('\n🛑 Execution paused by user request');
        console.log('🔍 Debug report created in ./debug_reports/');
        process.exit(1); // Stop execution
      }
    } catch (err) {
      // Fail silently if debugger is not available
      console.warn(`[DEBUG] Debugger unavailable: ${err.message}`);
    }
  }

  static async warnInteractive(module, message, context = {}) {
    this.warn(module, message);
    const { pauseOnError } = await import('./iv_interactive_debugger.js');
    return await pauseOnError('WARNING', `${module}: ${message}`, context);
  }

  static async errorInteractive(module, error, context = {}) {
    const message = error.message || String(error);
    this.error(module, message);
    if (error.stack) {
      this.debug(error.stack);
    }
    const { pauseOnError } = await import('./iv_interactive_debugger.js');
    return await pauseOnError('ERROR', `${module}: ${message}`, { ...context, stack: error.stack });
  }
}
