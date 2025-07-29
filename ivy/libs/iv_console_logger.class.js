
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
        this.scheduleRecovery();
        this.setupGracefulShutdown();
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

        this.flushInterval = setInterval(() => this.flush(), 10 * 1000); // Flush every 10 seconds
        process.on('beforeExit', () => this.flush());
        
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

        // Auto-flush when buffer reaches batch size
        if (this.logBuffer.length >= this.batchSize) {
            this.flush();
        }
    }

    async flush() {
        /*
        // Prevent concurrent flush operations
        if (this.isFlushingInProgress) {
            return;
        }

        if (this.logBuffer.length === 0) {
            return;
        }

        this.isFlushingInProgress = true;
        const logsToFlush = [...this.logBuffer];
        this.logBuffer = [];
        
        const success = await this.tryDatabaseSave(logsToFlush);
        
        if (!success) {
            // Save to pending file
            await this.saveToFile(logsToFlush);
            this.offlineMode = true;
            this.originalConsole.log(`[CONSOLE] Database unavailable, saved ${logsToFlush.length} logs to pending file`);
        } else {
            this.originalConsole.log(`[CONSOLE] Saved ${logsToFlush.length} console messages to database`);
            // If database recovered, try to process pending files
            if (this.offlineMode) {
                this.offlineMode = false;
                setTimeout(() => this.processPendingFiles(), 1 * 1000);
            }
        }
        
        this.isFlushingInProgress = false;
        */

        // Clear buffer to prevent memory leaks, DB logging is disabled.
        if (this.logBuffer.length > 0) {
            this.logBuffer = [];
        }
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

    async tryDatabaseSave(logs, retries = this.retryAttempts, originalSessionId = null) {
        const sessionId = originalSessionId || this.sessionId;
        
        while (retries > 0) {
            try {
                await transaction(async (connection) => {
                    for (const log of logs) {
                        await connection.execute(
                            QueryUtils.getQuery('logs.insertConsoleLog'),
                            [sessionId, this.versionCode, this.hostname, log.level, log.prefix, log.message]
                        );
                    }
                });
                return true; // Success
            } catch (err) {
                retries--;
                if (retries > 0) {
                    await Wait.toSeconds(5, `DB retry, attempts left: ${retries}`);
                } else {
                    this.originalConsole.error(`[CONSOLE] DB failed after ${this.retryAttempts} attempts:`, err.message);
                }
            }
        }
        return false; // Failure
    }

    async saveToFile(logs) {
        try {
            const filename = `session_${this.sessionId}.json`;
            const filepath = path.join(this.pendingDir, filename);
            
            const fileData = {
                sessionId: this.sessionId,
                versionCode: this.versionCode,
                hostname: this.hostname,
                timestamp: new Date().toISOString(),
                retryCount: 0,
                logs: logs
            };
            
            await fs.writeFile(filepath, JSON.stringify(fileData, null, 2));
        } catch (err) {
            this.originalConsole.error('[CONSOLE] Failed to save logs to file:', err.message);
        }
    }

    async scheduleRecovery() {
        // Start recovery after 2 seconds
        setTimeout(() => this.processPendingFiles(), 2 * 1000);
        
        // Then check every 30 seconds for pending files
        setInterval(() => this.processPendingFiles(), 30 * 1000);
    }

    async processPendingFiles() {
        if (this.offlineMode) return; // Database still unavailable
        
        try {
            const files = await fs.readdir(this.pendingDir);
            
            for (const filename of files) {
                if (!filename.endsWith('.json')) continue;
                
                const filepath = path.join(this.pendingDir, filename);
                const processingPath = path.join(this.processingDir, filename + '.processing');
                
                try {
                    // Move to processing
                    await fs.rename(filepath, processingPath);
                    
                    // Load and process
                    const fileData = JSON.parse(await fs.readFile(processingPath, 'utf8'));
                    const success = await this.tryDatabaseSave(fileData.logs, 1, fileData.sessionId);
                    
                    if (success) {
                        // Success - delete file
                        await fs.unlink(processingPath);
                        this.originalConsole.log(`[CONSOLE] Recovered ${fileData.logs.length} logs from ${filename}`);
                    } else {
                        // Failure - move back or to failed
                        fileData.retryCount = (fileData.retryCount || 0) + 1;
                        
                        if (fileData.retryCount >= 5) {
                            // After 5 attempts move to failed
                            const failedPath = path.join(this.failedDir, filename + '.failed');
                            await fs.writeFile(failedPath, JSON.stringify(fileData, null, 2));
                            await fs.unlink(processingPath);
                            this.originalConsole.log(`[CONSOLE] Moved ${filename} to failed after 5 retry attempts`);
                        } else {
                            // Return to pending with updated retry count
                            await fs.writeFile(filepath, JSON.stringify(fileData, null, 2));
                            await fs.unlink(processingPath);
                        }
                    }
                    
                } catch (err) {
                    this.originalConsole.error(`[CONSOLE] Error processing ${filename}:`, err.message);
                    // Try to restore from processing back to pending
                    try {
                        await fs.rename(processingPath, filepath);
                    } catch (renameErr) {
                        this.originalConsole.error(`[CONSOLE] Could not restore ${filename}:`, renameErr.message);
                    }
                }
            }
            
        } catch (err) {
            // Ignore if directory doesn't exist yet
            if (err.code !== 'ENOENT') {
                this.originalConsole.error('[CONSOLE] Error in recovery process:', err.message);
            }
        }
    }

    async shutdown() {
        this.originalConsole.log('[CONSOLE] Shutting down logger...');
        
        // Save current buffer before shutdown
        if (this.logBuffer.length > 0) {
            await this.saveToFile([...this.logBuffer]);
            this.originalConsole.log(`[CONSOLE] Saved ${this.logBuffer.length} pending logs to file before shutdown`);
        }
        
        this.logBuffer = [];
    }

    setupGracefulShutdown() {
        const shutdownHandler = () => {
            this.shutdown().then(() => {
                process.exit(0);
            }).catch((err) => {
                this.originalConsole.error('[CONSOLE] Error during shutdown:', err.message);
                process.exit(1);
            });
        };
        
        process.on('SIGINT', shutdownHandler);
        process.on('SIGTERM', shutdownHandler);
        process.on('beforeExit', () => this.shutdown());
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
