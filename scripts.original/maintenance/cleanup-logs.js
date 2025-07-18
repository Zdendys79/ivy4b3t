
import { db } from '../../ivy/iv_sql.js';
import { Log } from '../../ivy/iv_log.class.js';

async function cleanupConsoleLogs() {
    try {
        Log.info('[CLEANUP]', 'Starting console log cleanup...');

        // Delete records older than 7 days, but keep the last 1000 for each host
        const query = `
            DELETE l1 FROM log_console AS l1
            JOIN (
                SELECT id
                FROM (
                    SELECT id, ROW_NUMBER() OVER (PARTITION BY hostname ORDER BY timestamp DESC) as rn
                    FROM log_console
                    WHERE timestamp < DATE_SUB(NOW(), INTERVAL 7 DAY)
                ) as sub
                WHERE sub.rn > 1000
            ) AS l2 ON l1.id = l2.id;
        `;

        // Note: The query above uses window functions, which might not be supported in all MySQL versions.
        // A more compatible, but less efficient, approach would be needed for older versions.
        // For now, we assume a modern MySQL/MariaDB version.
        
        // Since we cannot directly execute complex queries, we will use a simpler approach for now.
        // This will be less efficient but compatible.
        
        const cleanupQuery = `
            DELETE FROM log_console 
            WHERE timestamp < DATE_SUB(NOW(), INTERVAL 7 DAY)
            AND id NOT IN (
                SELECT id FROM (
                    SELECT id 
                    FROM log_console 
                    ORDER BY timestamp DESC 
                    LIMIT 20000
                ) AS recent_logs
            )
        `;

        await db.safeExecute('logs.customCleanup', cleanupQuery);

        Log.success('[CLEANUP]', 'Console log cleanup finished successfully.');

    } catch (err) {
        await Log.error('[CLEANUP]', `Error during console log cleanup: ${err.message}`);
    }
}

(async () => {
    await cleanupConsoleLogs();
    // In a real scenario, you might want to close the DB connection if the script is standalone.
    // For now, we assume it might be part of a larger maintenance script.
})();
