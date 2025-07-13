-- Definiční skript pro tabulku pro ukládání objevených odkazů na skupiny
CREATE TABLE IF NOT EXISTS `discovered_group_links` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `url` VARCHAR(2048) NOT NULL,
  `discovered_by_user_id` SMALLINT(5) UNSIGNED DEFAULT NULL,
  `discovered_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `processed` BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (`id`),
  UNIQUE KEY `url` (`url`(255)),
  KEY `discovered_by_user_id` (`discovered_by_user_id`),
  KEY `processed` (`processed`),
  CONSTRAINT `discovered_group_links_ibfk_1` FOREIGN KEY (`discovered_by_user_id`) REFERENCES `fb_users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8;