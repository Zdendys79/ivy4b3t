/**
 * @file ivy/test.js
 * @brief Test script for console logging and offline buffer functionality.
 *
 * This script generates multiple log messages to test:
 * - Batch flush when reaching 100+ messages
 * - Time-based flush during 30s pause
 * - Shutdown flush when program exits
 * - Success messages for database operations
 */

import { consoleLogger } from './iv_console_logger.class.js';
import { Log } from './iv_log.class.js';
import { initializeDatabase, db, closeDB } from './iv_sql.js';
import { interactiveDebugger, setDebugContext } from './iv_interactive_debugger.js';
import { get as getVersion } from './iv_version.js';
import os from 'node:os';

async function runTest() {
    console.log('========================================');
    console.log('  IVY DEBUG INCIDENTS & LOGGING TEST');
    console.log('========================================');

    // Initialize ConsoleLogger to capture console output
    consoleLogger.init();

    // Initialize database connection
    Log.info('[TEST]', 'Initializing database...');
    const dbInitialized = await initializeDatabase();
    if (!dbInitialized) {
        Log.error('[TEST]', 'Database initialization failed. Exiting.');
        process.exit(1);
    }
    Log.success('[TEST]', 'Database initialized successfully.');

    // Disable interactive debugger to avoid pauses during test
    interactiveDebugger.enable(false);

    Log.info('[TEST]', 'Generating 130+ log messages to test batch flush...');
    
    // Generate 130 log messages to trigger batch flush at 100
    for (let i = 1; i <= 130; i++) {
        const messageTypes = ['info', 'debug', 'success'];
        const randomType = messageTypes[Math.floor(Math.random() * messageTypes.length)];
        const randomData = {
            iteration: i,
            timestamp: Date.now(),
            randomValue: Math.floor(Math.random() * 1000),
            hostname: os.hostname(),
            version: getVersion()
        };
        
        Log[randomType]('[TEST]', `Message ${i}/130: Random test data:`, JSON.stringify(randomData));
        
        // Small delay to make it more realistic
        if (i % 10 === 0) {
            await new Promise(resolve => setTimeout(resolve, 50));
        }
    }
    
    Log.info('[TEST]', 'Generated 130 messages. First batch should be flushed to database.');
    Log.info('[TEST]', 'Now waiting 30 seconds to test time-based flush...');
    
    // Wait 30 seconds to test time-based flush
    await new Promise(resolve => setTimeout(resolve, 30000));
    
    Log.info('[TEST]', 'Creating final batch of messages before shutdown...');
    
    // Generate a few more messages before shutdown
    for (let i = 1; i <= 15; i++) {
        Log.info('[TEST]', `Final message ${i}/15: Testing shutdown flush`);
    }
    
    Log.info('[TEST]', 'Test completed. Check console for flush confirmations and database for all entries.');

    // Ensure logs are flushed before exiting
    await consoleLogger.flush();

    // Close DB connection
    await closeDB();
    process.exit(0);
}

runTest();