// iv_log.class.js – Centrální logovací nástroje pro IVY
// Cíl: Výpis informací podle logovací úrovně z config.json (např. main=debug)

import fs from 'fs';
import path from 'path';

const CONFIG_PATH = path.resolve('./config.json');
const CONFIG = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
const BRANCH = CONFIG.branch || 'main'; // default fallback
const LOG_LEVEL = CONFIG.log_levels?.[BRANCH] || 'info';
const USE_ICONS = CONFIG.use_icons !== false;

const icons = {
  info: USE_ICONS ? CONFIG.icons?.info || '[INFO]' : '[INFO]',
  warn: USE_ICONS ? CONFIG.icons?.warn || '[WARN]' : '[WARN]',
  error: USE_ICONS ? CONFIG.icons?.error || '[ERROR]' : '[ERROR]',
  success: USE_ICONS ? CONFIG.icons?.success || '[OK]' : '[OK]',
  debug: USE_ICONS ? CONFIG.icons?.debug || '[DEBUG]' : '[DEBUG]',
  db: USE_ICONS ? CONFIG.icons?.db || '[DB]' : '[DB]'
};

const shouldLog = (level) => {
  const levels = ['error', 'warn', 'info', 'debug'];
  return levels.indexOf(level) <= levels.indexOf(LOG_LEVEL);
};

const now = () => new Date().toISOString().replace('T', ' ').slice(0, 19);

export class Log {
  static info(prefix, ...msg) {
    if (shouldLog('info')) console.log(`${now()} ${prefix} ${icons.info}`, ...msg);
  }

  static warn(prefix, ...msg) {
    if (shouldLog('warn')) console.warn(`${now()} ${prefix} ${icons.warn}`, ...msg);
    
    // Trigger interactive debugger for warnings (but NOT for debugger messages to avoid loops)
    if (prefix !== '[DEBUGGER]') {
      const message = msg.join(' ');
      this.triggerDebugger('WARNING', `${prefix}: ${message}`, { prefix, message });
    }
  }

  static success(prefix, ...msg) {
    if (shouldLog('info')) console.log(`${now()} ${prefix} ${icons.success}`, ...msg);
  }

  static debug(prefix, ...msg) {
    if (shouldLog('debug')) console.log(`${now()} ${prefix} ${icons.debug}`, ...msg);
  }

  static db(prefix, ...msg) {
    if (shouldLog('debug')) console.log(`${now()} ${prefix} ${icons.db}`, ...msg);
  }

  static error(prefix, err) {
    const type = err?.name || typeof err;
    const message = err?.message || String(err);
    const stack = err?.stack ? '\n' + err.stack : '';
    console.error(`${now()} ${prefix} ${icons.error} [${type}]: ${message}${stack}`);
    
    // Trigger interactive debugger for errors
    this.triggerDebugger('ERROR', `${prefix}: ${message}`, { type, stack, prefix });
  }

  // Interactive debugging methods
  static async triggerDebugger(level, message, context = {}) {
    try {
      // Import dynamically to avoid circular dependencies
      const { pauseOnError } = await import('./iv_interactive_debugger.js');
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

  static async errorInteractive(prefix, err) {
    this.error(prefix, err);
  }

  static async warnInteractive(prefix, ...msg) {
    this.warn(prefix, ...msg);
    await this.triggerDebugger('WARNING', `${prefix}: ${msg.join(' ')}`, { prefix, args: msg });
  }
}
