-- Tabulka pro sledování login timeoutů podle IP adresy
-- Eskalující timeouty: 5s, 10s, 20s, 40s, 80s, 160s...

CREATE TABLE IF NOT EXISTS login_timeouts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ip_address VARCHAR(45) NOT NULL,
    failed_attempts INT DEFAULT 0,
    timeout_until DATETIME NULL,
    first_attempt DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_attempt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_ip (ip_address),
    KEY idx_timeout_until (timeout_until),
    KEY idx_last_attempt (last_attempt)
);

-- Vyčistit staré záznamy starší než 24 hodin
-- Toto by mělo běžet jako CRON job nebo být voláno při každém přihlášení
-- DELETE FROM login_timeouts WHERE last_attempt < DATE_SUB(NOW(), INTERVAL 24 HOUR);