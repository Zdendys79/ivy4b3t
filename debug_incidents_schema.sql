-- Debug Incidents Table Schema
-- Stores interactive debugging incidents directly in database
-- Accessible from both VM and Claude for analysis

CREATE TABLE IF NOT EXISTS `debug_incidents` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `incident_id` varchar(100) NOT NULL UNIQUE,
  `timestamp` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `user_id` varchar(50) DEFAULT NULL,
  `error_level` enum('ERROR','WARNING','CRITICAL','INFO') NOT NULL DEFAULT 'ERROR',
  `error_message` text NOT NULL,
  `error_context` longtext DEFAULT NULL COMMENT 'JSON context data',
  
  -- Page and browser data
  `page_url` varchar(500) DEFAULT NULL,
  `page_title` varchar(200) DEFAULT NULL,
  `user_agent` varchar(300) DEFAULT NULL,
  `screenshot_data` longblob DEFAULT NULL COMMENT 'PNG screenshot as binary data',
  `dom_html` longtext DEFAULT NULL COMMENT 'Complete DOM HTML',
  `console_logs` longtext DEFAULT NULL COMMENT 'Browser console logs as JSON',
  
  -- User feedback
  `user_comment` text DEFAULT NULL COMMENT 'User description of the problem',
  `user_analysis_request` text DEFAULT NULL COMMENT 'Specific analysis request from user',
  
  -- System information
  `system_info` text DEFAULT NULL COMMENT 'Node.js and system details as JSON',
  `stack_trace` text DEFAULT NULL COMMENT 'Error stack trace if available',
  
  -- Analysis tracking
  `status` enum('NEW','ANALYZING','RESOLVED','ARCHIVED') NOT NULL DEFAULT 'NEW',
  `analyzed_by` varchar(50) DEFAULT NULL COMMENT 'Who analyzed (claude/user)',
  `analysis_notes` text DEFAULT NULL COMMENT 'Analysis findings and recommendations',
  `resolution_notes` text DEFAULT NULL COMMENT 'How the issue was resolved',
  `resolved_at` timestamp NULL DEFAULT NULL,
  
  -- Metadata
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  PRIMARY KEY (`id`),
  KEY `idx_incident_id` (`incident_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_status` (`status`),
  KEY `idx_error_level` (`error_level`),
  KEY `idx_timestamp` (`timestamp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Interactive debugging incidents with all debug data';

-- Analysis helper view for easier querying
CREATE OR REPLACE VIEW `debug_incidents_summary` AS
SELECT 
  `id`,
  `incident_id`,
  `timestamp`,
  `user_id`,
  `error_level`,
  LEFT(`error_message`, 100) AS `error_summary`,
  `page_url`,
  LENGTH(`screenshot_data`) AS `screenshot_size_bytes`,
  LENGTH(`dom_html`) AS `dom_size_chars`,
  `user_comment`,
  `status`,
  `analyzed_by`,
  LEFT(`analysis_notes`, 200) AS `analysis_summary`,
  `created_at`,
  `updated_at`
FROM `debug_incidents`
ORDER BY `timestamp` DESC;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS `idx_debug_created_status` ON `debug_incidents` (`created_at`, `status`);
CREATE INDEX IF NOT EXISTS `idx_debug_user_level` ON `debug_incidents` (`user_id`, `error_level`);