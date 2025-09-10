-- Tabulka pro zaznamenávání porušení pravidel CLAUDE.md
CREATE TABLE IF NOT EXISTS `ivy_claude_violations` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `timestamp` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `rule` VARCHAR(100) NOT NULL COMMENT 'Název porušeného pravidla',
  `description` TEXT NOT NULL COMMENT 'Popis porušení',
  `claude_version` VARCHAR(50) NOT NULL COMMENT 'Verze Claude (např. opus-4.1)',
  `severity` ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
  `file_affected` VARCHAR(255) DEFAULT NULL COMMENT 'Soubor kde k porušení došlo',
  `line_number` INT DEFAULT NULL COMMENT 'Číslo řádku v souboru',
  INDEX idx_timestamp (timestamp),
  INDEX idx_rule (rule),
  INDEX idx_severity (severity)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Záznam porušení pravidel z CLAUDE.md manifestu';

-- Příklady porušení pro dokumentaci
INSERT INTO `ivy_claude_violations` (`rule`, `description`, `claude_version`, `severity`, `file_affected`) VALUES
('EXAMPLE: MCP MySQL Write', 'Pokus o INSERT přes MCP místo BASH', 'opus-4.1-example', 'high', 'test_script.js'),
('EXAMPLE: Hardcoded Value', 'Heslo uloženo přímo v kódu místo env proměnné', 'opus-4.1-example', 'critical', 'config.js'),
('EXAMPLE: Fallback Method', 'Použití try/catch s fallback místo throw error', 'opus-4.1-example', 'medium', 'handler.js'),
('EXAMPLE: Wrong Naming', 'Třída pojmenována camelCase místo PascalCase', 'opus-4.1-example', 'low', 'myClass.js');