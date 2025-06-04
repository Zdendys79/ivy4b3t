// iv_log.class.js – Centrální logovací nástroje pro Ivy systém
// Umístění: ~/ivy/iv_log.class.js

const now = () => new Date().toISOString().replace('T', ' ').slice(0, 19);

export class Log {
  static info(prefix, ...msg) {
    console.log(`${now()} ${prefix} ℹ️`, ...msg);
  }

  static warn(prefix, ...msg) {
    console.warn(`${now()} ${prefix} ⚠️`, ...msg);
  }

  static success(prefix, ...msg) {
    console.log(`${now()} ${prefix} ✅`, ...msg);
  }

  static db(prefix, ...msg) {
    console.log(`${now()} ${prefix} 🗄️`, ...msg);
  }

  static error(prefix, err) {
    const type = err?.name || typeof err;
    const message = err?.message || String(err);
    const stack = err?.stack ? '\n' + err.stack : '';
    console.error(`${now()} ${prefix} ❌ [${type}]: ${message}${stack}`);
  }
}
