import { consoleLogger } from './iv_console_logger.class.js';
import { Log } from './iv_log.class.js';
import { initializeDatabase, db } from './iv_sql.js';
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

    // Set up dummy context for debugger
    const dummyUser = { id: 999, name: 'Test', surname: 'User' };
    const dummyPage = {
        url: () => 'http://test.example.com/debug',
        title: async () => 'Test Debug Page',
        screenshot: async () => Buffer.from('dummy_screenshot_data'),
        content: async () => '<html><body><h1>Test Debug Page</h1></body></html>',
        isClosed: () => false,
        evaluate: async (fn) => {
            if (fn.toString().includes('navigator.userAgent')) {
                return 'TestUserAgent/1.0';
            }
            if (fn.toString().includes('window.capturedLogs')) {
                return ['Dummy captured log 1', 'Dummy captured log 2'];
            }
            return null;
        }
    };
    setDebugContext(dummyUser, dummyPage);
    interactiveDebugger.enable(true); // Ensure debugger is enabled

    Log.info('[TEST]', 'Generating various log messages...');
    Log.debug('[TEST]', 'This is a debug message.');
    Log.warn('[TEST]', 'This is a warning message.');
    Log.success('[TEST]', 'This is a success message.');

    // Simulate a very long log message to trigger DB error
    const longMessage = 'A'.repeat(2000); // Exceeds 1024 char limit for 'message' column
    Log.info('[TEST]', `Attempting to log a very long message (${longMessage.length} chars)...`);
    Log.info('[TEST]', longMessage); // This should trigger the DB error on flush

    // Simulate a custom error to trigger interactive debugger and debug_incidents save
    Log.info('[TEST]', 'Simulating a custom error to trigger debug report...');
    try {
        throw new Error('SimulatedError: This is a test error for debug report generation.');
    } catch (err) {
        await Log.error('[TEST]', err); // This should pause and try to save to debug_incidents
    }

    Log.info('[TEST]', 'Test finished. Check console output and database for debug reports.');

    // Ensure logs are flushed before exiting
    await consoleLogger.flush();

    // Close DB connection
    await db.closeDB();
    process.exit(0);
}

runTest();
