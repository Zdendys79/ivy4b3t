
import os from 'node:os';
import { db } from './iv_sql.js';
import { get as getVersion } from './iv_version.js';

class ConsoleLogger {
    constructor() {
        this.logBuffer = [];
        this.sessionId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        this.versionCode = getVersion();
        this.hostname = os.hostname();
        this.originalConsole = {};
        this.flushInterval = null;
        this.isInitialized = false;
        this.batchSize = 100; // Flush when buffer reaches 100 items
        this.isFlushingInProgress = false; // Prevent concurrent flush operations
    }

    init() {
        if (this.isInitialized) {
            return;
        }

        const levels = ['log', 'warn', 'error', 'info', 'debug'];
        levels.forEach(level => {
            this.originalConsole[level] = console[level];
            console[level] = (...args) => {
                this.originalConsole[level](...args);
                this.capture(level.toUpperCase(), args);
            };
        });

        this.flushInterval = setInterval(() => this.flush(), 10000); // Flush every 10 seconds
        process.on('beforeExit', () => this.flush());
        
        this.isInitialized = true;
        this.originalConsole.log(`[ConsoleLogger] Initialized with session ID: ${this.sessionId}`);
    }

    capture(level, args) {
        // Remap console.log to INFO, etc.
        const mappedLevel = {
            LOG: 'INFO',
            WARN: 'WARN',
            ERROR: 'ERROR',
            INFO: 'INFO',
            DEBUG: 'DEBUG'
        }[level] || 'INFO';

        const message = args.map(arg => {
            if (arg instanceof Error) {
                return `[${arg.name}]: ${arg.message}${arg.stack ? '\n' + arg.stack : ''}`;
            }
            if (typeof arg === 'string') {
                // For simple strings, return as is. No sanitization needed here.
                return arg;
            }
            try {
                // For objects/arrays, stringify them.
                // Only replace backslashes within strings in JSON, not quotes.
                const sanitizedJson = JSON.stringify(arg, (key, value) => {
                    if (typeof value === 'string') {
                        return value.replace(/\\/g, '/');
                    }
                    return value;
                }, 2);
                return sanitizedJson;
            } catch (e) {
                // Fallback for non-serializable objects, return as string.
                // Only replace backslashes, not quotes.
                return String(arg).replace(/\\/g, '/');
            }
        }).join(' ');

        // Simple parsing for prefix
        const prefixMatch = message.match(/^(\[.*?\])/);
        const prefix = prefixMatch ? prefixMatch[1] : null;
        const finalMessage = prefix ? message.substring(prefix.length).trim() : message;

        // Omezení délky zprávy pro databázi
        const MAX_MESSAGE_LENGTH = 1024; // Maximální délka zprávy pro sloupec TEXT
        const truncatedMessage = finalMessage.length > MAX_MESSAGE_LENGTH
            ? finalMessage.substring(0, MAX_MESSAGE_LENGTH - 3) + '...'
            : finalMessage;

        this.logBuffer.push({
            level: mappedLevel,
            prefix: prefix,
            message: truncatedMessage
        });

        // Auto-flush when buffer reaches batch size
        if (this.logBuffer.length >= this.batchSize) {
            this.flush();
        }
    }

    async flush() {
        // Prevent concurrent flush operations
        if (this.isFlushingInProgress) {
            return;
        }

        if (this.logBuffer.length === 0) {
            return;
        }

        this.isFlushingInProgress = true;

        try {
            const logsToFlush = [...this.logBuffer];
            this.logBuffer = [];

            // Use transaction for batch insert
            await db.transaction(async (connection) => {
                for (const log of logsToFlush) {
                    await connection.query(
                        db.getQuery('logs.insertConsoleLog'),
                        [this.sessionId, this.versionCode, this.hostname, log.level, log.prefix, log.message]
                    );
                }
            });
        } catch (err) {
            this.originalConsole.error('[LOGGER-FAIL] Failed to flush logs to database:', err);
            // Put logs back to buffer to try again later
            this.logBuffer.unshift(...logsToFlush);
        } finally {
            this.isFlushingInProgress = false;
        }
    }
}

export const consoleLogger = new ConsoleLogger();
