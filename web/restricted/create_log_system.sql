-- Vytvoření tabulky log_system
-- Tabulka pro systémový log spuštění, restartů a událostí podle hostname

USE ivy;

CREATE TABLE IF NOT EXISTS log_system (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    hostname VARCHAR(100) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    event_level VARCHAR(20) NOT NULL DEFAULT 'INFO',
    message TEXT NOT NULL,
    details JSON NULL,
    user_id SMALLINT(5) UNSIGNED NULL,
    process_id VARCHAR(50) NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_hostname_timestamp (hostname, timestamp),
    INDEX idx_event_type_timestamp (event_type, timestamp),
    INDEX idx_event_level (event_level),
    FOREIGN KEY (user_id) REFERENCES fb_users(id) ON DELETE SET NULL
);

-- Počáteční záznam o vytvoření tabulky
INSERT INTO log_system (hostname, event_type, event_level, message, details, process_id) 
VALUES (
    @@hostname,
    'SYSTEM_INIT',
    'INFO',
    'System log table created and initialized',
    JSON_OBJECT('table_name', 'log_system', 'created_at', NOW()),
    CONNECTION_ID()
);

SELECT COUNT(*) as 'System log table created' FROM log_system;