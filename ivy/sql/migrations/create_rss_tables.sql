-- RSS Tables Migration for IVY4B3T Project
-- Created: 2025-07-28
-- Purpose: RSS feed management and URL storage system

-- Table for RSS channels/feeds
CREATE TABLE IF NOT EXISTS rss_channels (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL COMMENT 'Human readable name of the RSS channel',
    url VARCHAR(500) NOT NULL UNIQUE COMMENT 'RSS feed URL',
    description TEXT COMMENT 'Description of the RSS channel',
    category VARCHAR(100) DEFAULT 'general' COMMENT 'Category (news, tech, sports, etc.)',
    active TINYINT(1) DEFAULT 1 COMMENT '1 = active, 0 = inactive',
    last_fetched TIMESTAMP NULL COMMENT 'When was this channel last processed',
    fetch_count INT DEFAULT 0 COMMENT 'How many times this channel was fetched',
    error_count INT DEFAULT 0 COMMENT 'Number of consecutive errors',
    last_error TEXT COMMENT 'Last error message if any',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_active (active),
    INDEX idx_last_fetched (last_fetched),
    INDEX idx_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='RSS channels/feeds configuration';

-- Table for individual URLs from RSS feeds
CREATE TABLE IF NOT EXISTS rss_urls (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    channel_id INT NOT NULL COMMENT 'Reference to rss_channels.id',
    url VARCHAR(1000) NOT NULL COMMENT 'Article/content URL',
    title VARCHAR(500) COMMENT 'Article title from RSS',
    description TEXT COMMENT 'Article description from RSS',
    published_date TIMESTAMP NULL COMMENT 'Publication date from RSS',
    used_count INT DEFAULT 0 COMMENT 'How many times this URL was used',
    last_used TIMESTAMP NULL COMMENT 'When was this URL last used',
    is_active TINYINT(1) DEFAULT 1 COMMENT '1 = available for use, 0 = inactive',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (channel_id) REFERENCES rss_channels(id) ON DELETE CASCADE,
    UNIQUE KEY unique_url (url(500)) COMMENT 'Prevent duplicate URLs',
    INDEX idx_channel_active (channel_id, is_active),
    INDEX idx_used_count (used_count),
    INDEX idx_last_used (last_used),
    INDEX idx_created_at (created_at),
    INDEX idx_published_date (published_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Individual URLs collected from RSS feeds';

-- Insert default Czech RSS channels
INSERT IGNORE INTO rss_channels (name, url, description, category) VALUES
('iDNES.cz - Zprávy', 'https://www.idnes.cz/rss.aspx', 'Hlavní zprávy z iDNES.cz', 'news'),
('Novinky.cz', 'https://www.novinky.cz/rss', 'Aktuální zprávy z Novinky.cz', 'news'),
('Aktuálně.cz', 'https://www.aktualne.cz/rss/', 'Zprávy z Aktuálně.cz', 'news'),
('Lidovky.cz', 'https://www.lidovky.cz/rss.aspx', 'Zprávy z Lidových novin', 'news'),
('Blesk.cz', 'https://www.blesk.cz/rss', 'Zprávy z Blesk.cz', 'tabloid'),
('Deník.cz', 'https://www.denik.cz/rss/all.html', 'Regionální zprávy z Deník.cz', 'regional'),
('Česká televize - ČT24', 'https://ct24.ceskatelevize.cz/rss/hlavni-zpravy', 'Zprávy z ČT24', 'news'),
('iROZHLAS', 'https://www.irozhlas.cz/rss', 'Zprávy z Českého rozhlasu', 'news'),
('E15.cz - Ekonomika', 'https://www.e15.cz/rss', 'Ekonomické zprávy z E15.cz', 'business'),
('Sport.cz', 'https://www.sport.cz/rss.asp', 'Sportovní zprávy', 'sports');