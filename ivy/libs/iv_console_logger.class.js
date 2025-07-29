
import os from 'node:os';
import fs from 'fs/promises';
import path from 'path';
import { db, transaction } from '../iv_sql.js';
import { get as getVersion } from '../iv_version.js';
import { QueryUtils } from '../sql/queries/index.js';
import { Wait } from './iv_wait.class.js';

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
        
        // Offline buffer system
        this.offlineMode = false;
        this.pendingDir = './logs/pending';
        this.processingDir = './logs/processing';
        this.failedDir = './logs/failed';
        this.retryAttempts = 3;
        this.retryDelay = 5; // 5 seconds
        
        this.ensureDirectories();
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

        
        this.isInitialized = true;
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

    }

    async ensureDirectories() {
        try {
            for (const dir of [this.pendingDir, this.processingDir, this.failedDir]) {
                await fs.mkdir(dir, { recursive: true });
            }
        } catch (err) {
            this.originalConsole.error('[CONSOLE] Cannot create log directories:', err.message);
        }
    }






    async getRecoveryStatus() {
        try {
            const pending = await fs.readdir(this.pendingDir);
            const processing = await fs.readdir(this.processingDir);
            const failed = await fs.readdir(this.failedDir);
            
            return {
                pendingFiles: pending.filter(f => f.endsWith('.json')).length,
                processingFiles: processing.filter(f => f.endsWith('.processing')).length,
                failedFiles: failed.filter(f => f.endsWith('.failed')).length,
                offlineMode: this.offlineMode
            };
        } catch (err) {
            return {
                pendingFiles: 0,
                processingFiles: 0,
                failedFiles: 0,
                offlineMode: this.offlineMode,
                error: err.message
            };
        }
    }
}

export const consoleLogger = new ConsoleLogger();
