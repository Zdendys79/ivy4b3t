/**
 * Logger - Jednoduchý logger pro Quote Harvester
 */

export class Logger {
  constructor(level = 'info') {
    this.level = level;
    this.levels = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
      success: 1
    };
  }

  debug(message, ...args) {
    if (this.levels.debug >= this.levels[this.level]) {
      console.log(`🔍 [DEBUG] ${this.timestamp()} ${message}`, ...args);
    }
  }

  info(message, ...args) {
    if (this.levels.info >= this.levels[this.level]) {
      console.log(`ℹ️  [INFO]  ${this.timestamp()} ${message}`, ...args);
    }
  }

  warn(message, ...args) {
    if (this.levels.warn >= this.levels[this.level]) {
      console.warn(`⚠️  [WARN]  ${this.timestamp()} ${message}`, ...args);
    }
  }

  error(message, ...args) {
    if (this.levels.error >= this.levels[this.level]) {
      console.error(`❌ [ERROR] ${this.timestamp()} ${message}`, ...args);
    }
  }

  success(message, ...args) {
    console.log(`✅ [SUCCESS] ${this.timestamp()} ${message}`, ...args);
  }

  timestamp() {
    return new Date().toISOString().replace('T', ' ').substr(0, 19);
  }
}