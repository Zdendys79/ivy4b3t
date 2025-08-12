#!/bin/bash

# Skript pro vytvoření tabulky translation_issues
# Spusť tento skript pro vytvoření tabulky v databázi

echo "🔧 Vytvářím tabulku translation_issues..."

mysql -h $MYSQL_HOST -P $MYSQL_PORT -u $MYSQL_USER -p$MYSQL_PASSWORD ${MYSQL_DATABASE}_test << 'EOF'

CREATE TABLE `translation_issues` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `quote_id` int(10) unsigned NOT NULL,
  `issue_type` enum('grammar','meaning','style','cultural','idiom','untranslatable','other') NOT NULL DEFAULT 'other',
  `severity` enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',
  `original_text` text NOT NULL,
  `problematic_translation` text NOT NULL,
  `ai_analysis` text DEFAULT NULL COMMENT 'Detailní analýza od Claude AI',
  `suggested_solutions` json DEFAULT NULL COMMENT 'Pole návrhů řešení',
  `human_notes` text DEFAULT NULL COMMENT 'Poznámky lidského překladatele',
  `resolution_status` enum('pending','in_review','resolved','rejected') NOT NULL DEFAULT 'pending',
  `resolved_translation` text DEFAULT NULL,
  `resolved_by` varchar(100) DEFAULT NULL COMMENT 'Kdo problém vyřešil',
  `language_code` varchar(3) NOT NULL,
  `author` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_quote_id` (`quote_id`),
  KEY `idx_issue_type` (`issue_type`),  
  KEY `idx_resolution_status` (`resolution_status`),
  KEY `idx_language_code` (`language_code`),
  CONSTRAINT `fk_translation_issues_quote` FOREIGN KEY (`quote_id`) REFERENCES `quotes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Správa problematických překladů s návrhy řešení';

-- Indexy pro výkon
CREATE INDEX `idx_pending_issues` ON `translation_issues` (`resolution_status`, `severity`, `created_at`);
CREATE INDEX `idx_issue_stats` ON `translation_issues` (`issue_type`, `language_code`, `resolution_status`);

EOF

echo "✅ Tabulka translation_issues vytvořena!"
echo ""
echo "📋 STRUKTURA TABULKY:"
echo "   - issue_type: grammar, meaning, style, cultural, idiom, untranslatable, other"
echo "   - severity: low, medium, high, critical"  
echo "   - resolution_status: pending, in_review, resolved, rejected"
echo "   - suggested_solutions: JSON pole s návrhy řešení"
echo "   - ai_analysis: detailní analýza problému od Claude"