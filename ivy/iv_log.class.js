// iv_log.class.js – Centrální logovací nástroje pro IVY
// Cíl: Řízení výstupu podle úrovně (error, warn, info, debug)

const now = () => new Date().toISOString().replace('T', ' ').slice(0, 19);

// Možnosti: 'debug', 'info', 'warn', 'error'
import { CONFIG } from './config.js';

const BRANCH = CONFIG.branch || 'main';
const LOG_LEVEL = CONFIG.log_levels?.[BRANCH] || 'info';


// Ikony zapnuty?
const USE_ICONS = false;

const icons = {
  info: USE_ICONS ? 'ℹ️' : '[INFO]',
  warn: USE_ICONS ? '⚠️' : '[WARN]',
  error: USE_ICONS ? '❌' : '[ERROR]',
  success: USE_ICONS ? '✅' : '[OK]',
  debug: USE_ICONS ? '🐛' : '[DEBUG]',
  db: USE_ICONS ? '🗄️' : '[DB]'
};

const shouldLog = (level) => {
  const levels = ['error', 'warn', 'info', 'debug'];
  return levels.indexOf(level) <= levels.indexOf(LOG_LEVEL);
};

export class Log {
  static info(prefix, ...msg) {
    if (shouldLog('info')) console.log(`${now()} ${prefix} ${icons.info}`, ...msg);
  }

  static warn(prefix, ...msg) {
    if (shouldLog('warn')) console.warn(`${now()} ${prefix} ${icons.warn}`, ...msg);
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
  }
}
