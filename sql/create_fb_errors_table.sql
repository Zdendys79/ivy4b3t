-- Tabulka pro známé Facebook chyby a blokace
CREATE TABLE IF NOT EXISTS fb_known_errors (
    id INT AUTO_INCREMENT PRIMARY KEY,
    error_text VARCHAR(255) NOT NULL UNIQUE,
    error_type ENUM('block', 'verification', 'checkpoint', 'warning', 'other') NOT NULL,
    severity ENUM('fatal', 'recoverable', 'warning') NOT NULL,
    is_solvable BOOLEAN DEFAULT FALSE,
    solution_action VARCHAR(100) DEFAULT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_error_type (error_type),
    INDEX idx_severity (severity)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Vložení známých chyb
INSERT INTO fb_known_errors (error_text, error_type, severity, is_solvable, solution_action, description) VALUES
('Potvrďte svou totožnost pomocí videoselfie', 'verification', 'fatal', FALSE, NULL, 'Vyžaduje připojenou kameru na další stránce. Zatím neřešitelná.'),
('Váš účet byl dočasně uzamčen', 'block', 'fatal', FALSE, NULL, 'Účet je zablokován Facebookem');