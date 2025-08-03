/**
 * DatabaseManager - Správa databázových operací pro Quote Harvester
 */

import mysql from 'mysql2/promise';
import crypto from 'crypto';

export class DatabaseManager {
  constructor() {
    this.connection = null;
    
    // Určit správnou databázi podle větve (stejná logika jako pre-commit-hook)
    const currentBranch = this.getCurrentBranch();
    const targetDatabase = currentBranch === 'main' 
      ? `${process.env.MYSQL_DATABASE}_test`
      : process.env.MYSQL_DATABASE;
    
    this.config = {
      host: process.env.MYSQL_HOST,
      port: process.env.MYSQL_PORT,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: targetDatabase,
      charset: 'utf8mb4'
    };
    
    console.log(`🗄️  Používám databázi: ${targetDatabase} (větev: ${currentBranch})`);
  }

  /**
   * Získat aktuální git větev
   */
  getCurrentBranch() {
    try {
      const { execSync } = require('child_process');
      return execSync('git branch --show-current', { encoding: 'utf8' }).trim();
    } catch (error) {
      console.warn('⚠️  Nelze zjistit git větev, používám default');
      return 'unknown';
    }
  }

  /**
   * Připojení k databázi
   */
  async connect() {
    if (!this.connection) {
      this.connection = await mysql.createConnection(this.config);
    }
    return this.connection;
  }

  /**
   * Test připojení
   */
  async testConnection() {
    const conn = await this.connect();
    const [rows] = await conn.execute('SELECT 1 as test');
    return rows[0].test === 1;
  }

  /**
   * Získat aktivní jazyky
   */
  async getActiveLanguages() {
    const conn = await this.connect();
    const [rows] = await conn.execute(
      'SELECT code, name_cs, name_en FROM c_languages WHERE is_active = 1 ORDER BY sort_order'
    );
    return rows;
  }

  /**
   * Import citátu do databáze
   */
  async importQuote(quote, sourceName) {
    const conn = await this.connect();
    
    // Vytvořit hash z originálního textu nebo z českého textu
    const textForHash = quote.original_text || quote.text;
    const hash = crypto.createHash('md5').update(textForHash).digest('hex');
    
    const query = `
      INSERT INTO quotes (text, original_text, language_code, author, hash)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE 
        text = VALUES(text),
        original_text = VALUES(original_text),
        language_code = VALUES(language_code),
        author = VALUES(author)
    `;
    
    const values = [
      quote.text,
      quote.original_text || null,
      quote.language_code,
      quote.author || null,
      hash
    ];
    
    await conn.execute(query, values);
  }

  /**
   * Kontrola existence citátu podle hash
   */
  async quoteExists(textForHash) {
    const conn = await this.connect();
    const hash = crypto.createHash('md5').update(textForHash).digest('hex');
    
    const [rows] = await conn.execute(
      'SELECT id FROM quotes WHERE hash = ?',
      [hash]
    );
    
    return rows.length > 0;
  }

  /**
   * Získat všechny citáty pro validaci
   */
  async getAllQuotes() {
    const conn = await this.connect();
    const [rows] = await conn.execute(
      'SELECT id, text, original_text, author, language_code FROM quotes'
    );
    return rows;
  }

  /**
   * Vyhledat podobné citáty (pro Levenshtein kontrolu)
   */
  async findSimilarQuotes(text, threshold = 0.8) {
    const conn = await this.connect();
    const [rows] = await conn.execute(
      'SELECT text, original_text FROM quotes WHERE CHAR_LENGTH(text) BETWEEN ? AND ?',
      [Math.floor(text.length * 0.7), Math.ceil(text.length * 1.3)]
    );
    return rows;
  }

  /**
   * Statistiky citátů
   */
  async getQuoteStats() {
    const conn = await this.connect();
    
    // Celkový počet
    const [totalRows] = await conn.execute('SELECT COUNT(*) as total FROM quotes');
    const total = totalRows[0].total;
    
    // Podle jazyků
    const [langRows] = await conn.execute(`
      SELECT 
        q.language_code,
        l.name_cs as language_name,
        COUNT(*) as count
      FROM quotes q
      LEFT JOIN c_languages l ON q.language_code = l.code
      GROUP BY q.language_code, l.name_cs
      ORDER BY count DESC
    `);
    
    // S/bez autorů
    const [authorRows] = await conn.execute(`
      SELECT 
        SUM(CASE WHEN author IS NOT NULL AND author != '' THEN 1 ELSE 0 END) as with_author,
        SUM(CASE WHEN author IS NULL OR author = '' THEN 1 ELSE 0 END) as without_author
      FROM quotes
    `);
    
    // S originálním textem
    const [originalRows] = await conn.execute(`
      SELECT COUNT(*) as with_original FROM quotes WHERE original_text IS NOT NULL
    `);
    
    return {
      total,
      byLanguage: langRows,
      withAuthor: authorRows[0].with_author,
      withoutAuthor: authorRows[0].without_author,
      withOriginal: originalRows[0].with_original
    };
  }

  /**
   * Uzavření připojení
   */
  async close() {
    if (this.connection) {
      await this.connection.end();
      this.connection = null;
    }
  }
}