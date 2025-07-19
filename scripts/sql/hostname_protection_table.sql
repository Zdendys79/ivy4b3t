-- Tabulka pro sledování hostname ochrany proti lavině banů
CREATE TABLE `hostname_protection` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `hostname` varchar(100) NOT NULL,
  `blocked_until` datetime NOT NULL,
  `blocked_reason` varchar(255) NOT NULL,
  `blocked_user_id` smallint(5) unsigned NOT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `hostname_unique` (`hostname`),
  KEY `idx_blocked_until` (`blocked_until`),
  KEY `idx_hostname_time` (`hostname`, `blocked_until`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;