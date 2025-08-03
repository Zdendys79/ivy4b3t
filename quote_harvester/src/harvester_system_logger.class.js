/**
 * HarvesterSystemLogger - Integrace harvester s IVY system logem
 * Používá stejnou databázovou strukturu jako IVY SystemLogger
 */

import mysql from 'mysql2/promise';
import crypto from 'crypto';
import os from 'os';

export class HarvesterSystemLogger {
  constructor(dbConfig) {
    this.dbConfig = dbConfig;
    this.connection = null;
    this.versionCode = 'harvester-1.0';
    this.sessionId = this.generateSessionId();
  }

  /**
   * Generovat session ID
   */
  generateSessionId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    return `${timestamp}-${random}`;
  }

  /**
   * Připojení k databázi
   */
  async connect() {
    if (!this.connection) {
      this.connection = await mysql.createConnection(this.dbConfig);
    }
    return this.connection;
  }

  /**
   * Logovat událost do system logu
   */
  async logEvent(eventType, level, message, metadata = {}) {
    try {
      const conn = await this.connect();
      
      const query = `
        INSERT INTO log_system (hostname, event_type, event_level, message, details, timestamp)
        VALUES (?, ?, ?, ?, ?, NOW())
      `;
      
      const fullMetadata = {
        component: 'quote_harvester',
        version: this.versionCode,
        session_id: this.sessionId,
        ...metadata
      };
      
      await conn.execute(query, [
        os.hostname(),
        eventType,
        level,
        message,
        JSON.stringify(fullMetadata)
      ]);
      
      return true;
      
    } catch (error) {
      console.error(`System log error: ${error.message}`);
      return false;
    }
  }

  /**
   * Logovat selhání překladu
   */
  async logTranslationFailure(quoteId, originalText, languageCode, error) {
    return this.logEvent(
      'TRANSLATION_FAILURE',
      'ERROR',
      `Translation failed for quote ID ${quoteId}`,
      {
        quote_id: quoteId,
        original_text: originalText.substring(0, 100),
        language_code: languageCode,
        error_message: error,
        text_length: originalText.length
      }
    );
  }

  /**
   * Logovat úspěšný překlad
   */
  async logTranslationSuccess(quoteId, originalText, translatedText, languageCode) {
    return this.logEvent(
      'TRANSLATION_SUCCESS',
      'INFO',
      `Translation successful for quote ID ${quoteId}`,
      {
        quote_id: quoteId,
        language_code: languageCode,
        original_length: originalText.length,
        translated_length: translatedText.length
      }
    );
  }

  /**
   * Logovat start harvester
   */
  async logHarvesterStart() {
    return this.logEvent(
      'HARVESTER_START',
      'INFO',
      'Quote Harvester started',
      {
        node_version: process.version,
        platform: process.platform
      }
    );
  }

  /**
   * Logovat zastavení harvester
   */
  async logHarvesterStop(reason = 'normal') {
    return this.logEvent(
      'HARVESTER_STOP',
      'INFO',
      'Quote Harvester stopped',
      {
        stop_reason: reason
      }
    );
  }

  /**
   * Zkontrolovat zda citát má již zaznamenaná selhání
   */
  async getTranslationFailureCount(quoteId) {
    try {
      const conn = await this.connect();
      
      const query = `
        SELECT COUNT(*) as failure_count
        FROM log_system 
        WHERE event_type = 'TRANSLATION_FAILURE' 
          AND JSON_EXTRACT(details, '$.quote_id') = ?
          AND timestamp > DATE_SUB(NOW(), INTERVAL 24 HOUR)
      `;
      
      const [rows] = await conn.execute(query, [quoteId]);
      return rows[0].failure_count;
      
    } catch (error) {
      console.error(`Error checking failure count: ${error.message}`);
      return 0;
    }
  }

  /**
   * Zavřít připojení
   */
  async close() {
    if (this.connection) {
      await this.connection.end();
      this.connection = null;
    }
  }
}