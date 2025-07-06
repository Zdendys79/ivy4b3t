
CREATE TABLE IF NOT EXISTS `log_console` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `session_id` varchar(50) NOT NULL COMMENT 'Unique ID for each script run',
  `version_code` varchar(20) NOT NULL COMMENT 'Version code from package.json',
  `hostname` varchar(50) NOT NULL,
  `timestamp` timestamp(6) NOT NULL DEFAULT current_timestamp(6),
  `level` enum('INFO','WARN','ERROR','DEBUG','SUCCESS','DB') NOT NULL,
  `prefix` varchar(50) DEFAULT NULL COMMENT 'Log prefix like [WORKER], [FB]',
  `message` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `session_id_idx` (`session_id`),
  KEY `hostname_timestamp_idx` (`hostname`,`timestamp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='Captures console logs from the application';
