/**
 * Název souboru: iv_ErrorReportBuilder.class.js
 * Umístění: ~/ivy/iv_ErrorReportBuilder.class.js
 *
 * Popis: Třída pro sestavování a ukládání detailních error reportů z FB analýzy
 * Používá se po detekci chyby a uživatelské intervenci pro vytvoření kompletního reportu
 */

import os from 'node:os';
import { Log } from './iv_log.class.js';
import { db } from '../iv_sql.js';

export class ErrorReportBuilder {
  constructor() {
    this.reportData = {};
  }

  /**
   * Inicializuje nový error report
   * @param {Object} user - Uživatelský objekt
   * @param {Object} group - Skupina (volitelné)
   * @param {string} errorType - Typ chyby
   * @param {string} errorReason - Důvod chyby
   * @param {string} pageUrl - URL stránky
   */
  initializeReport(user, group = null, errorType, errorReason, pageUrl) {
    this.reportData = {
      // Základní informace
      user_id: user?.id || null,
      user_name: user?.name || null,
      user_surname: user?.surname || null,
      group_id: group?.id || null,
      group_fb_id: group?.fb_id || null,

      // Error details
      error_type: errorType,
      error_reason: errorReason,
      page_url: pageUrl,
      page_title: null,

      // Analýza (bude doplněna později)
      page_elements_summary: null,
      detected_buttons: null,
      detected_texts: null,
      full_analysis_data: null,

      // Metadata
      hostname: os.hostname(),
      user_agent: null
    };

    Log.info('[ERROR_REPORT]', `Inicializován error report pro uživatele ${user?.id} - ${errorType}`);
  }

  /**
   * Přidá detailní analýzu stránky do reportu
   * @param {Object} pageAnalysis - Výsledek PageAnalyzer.analyzeFullPage()
   */
  async addPageAnalysis(pageAnalysis) {
    if (!pageAnalysis) {
      await Log.warn('[ERROR_REPORT]', 'Prázdná analýza stránky');
      return;
    }

    // Základní informace o stránce
    if (pageAnalysis.basic) {
      this.reportData.page_title = pageAnalysis.basic.title;
      this.reportData.user_agent = pageAnalysis.basic.userAgent;
    }

    // Detailní elementy stránky
    if (pageAnalysis.complexity) {
      const summary = this._createElementsSummary(pageAnalysis.complexity);
      this.reportData.page_elements_summary = summary;
    }

    // Navigační elementy (namísto buttons které navigation analysis neposkytuje)
    if (pageAnalysis.navigation && pageAnalysis.navigation.elements) {
      this.reportData.detected_navigation = JSON.stringify(pageAnalysis.navigation.elements);
    }

    // Texty na stránce
    if (pageAnalysis.basic && pageAnalysis.basic.bodyText) {
      const texts = this._extractImportantTexts(pageAnalysis.basic.bodyText);
      this.reportData.detected_texts = texts;
    }

    // Kompletní raw data
    this.reportData.full_analysis_data = JSON.stringify({
      timestamp: new Date().toISOString(),
      analysis: pageAnalysis,
      metadata: {
        hostname: os.hostname(),
        node_version: process.version,
        platform: process.platform
      }
    });

    Log.info('[ERROR_REPORT]', 'Přidána detailní analýza stránky do error reportu');
  }

  /**
   * Přidá vlastní screenshot (volitelné)
   * @param {Buffer} screenshotBuffer - Buffer se screenshotem
   */
  addScreenshot(screenshotBuffer) {
    if (!screenshotBuffer) return;

    // V produkci by se screenshot uložil do souboru a zde by byla jen cesta
    // Pro zjednodušení ukládáme jen informaci o existenci
    if (this.reportData.full_analysis_data) {
      const analysisData = JSON.parse(this.reportData.full_analysis_data);
      analysisData.has_screenshot = true;
      analysisData.screenshot_size = screenshotBuffer.length;
      this.reportData.full_analysis_data = JSON.stringify(analysisData);
    }

    Log.info('[ERROR_REPORT]', `Přidán screenshot (${screenshotBuffer.length} bytes) do error reportu`);
  }

  /**
   * Přidá custom text poznámky
   * @param {string} notes - Poznámky k chybě
   */
  addNotes(notes) {
    if (!notes) return;

    if (this.reportData.error_reason) {
      this.reportData.error_reason += ` | ${notes}`;
    } else {
      this.reportData.error_reason = notes;
    }

    Log.info('[ERROR_REPORT]', 'Přidány poznámky do error reportu');
  }

  /**
   * Uloží error report do databáze
   * @returns {Promise<number|null>} ID vytvořeného reportu nebo null při chybě
   */
  async saveReport() {
    try {
      if (!this.reportData.error_type || !this.reportData.page_url) {
        throw new Error('Chybí povinné údaje pro error report (error_type, page_url)');
      }

      Log.info('[ERROR_REPORT]', 'Ukládám error report do databáze...');

      const params = [
        this.reportData.user_id || null,
        this.reportData.user_name || null,
        this.reportData.user_surname || null,
        this.reportData.group_id || null,
        this.reportData.group_fb_id || null,
        this.reportData.error_type || null,
        this.reportData.error_reason || null,
        this.reportData.page_url || null,
        this.reportData.page_title || null,
        this.reportData.page_elements_summary || null,
        this.reportData.detected_buttons || null,
        this.reportData.detected_texts || null,
        this.reportData.full_analysis_data || null,
        this.reportData.hostname || null,
        this.reportData.user_agent || null
      ];

      const result = await db.safeExecute('error_reports.insertErrorReport', params);

      if (result && result.insertId) {
        Log.success('[ERROR_REPORT]', `Error report uložen s ID: ${result.insertId}`);
        return result.insertId;
      } else {
        throw new Error('Nepodařilo se získat ID nového error reportu');
      }

    } catch (err) {
      await Log.error('[ERROR_REPORT]', `Chyba při ukládání error reportu: ${err.message}`);
      return null;
    }
  }

  /**
   * Uloží jednoduchý error report (bez detailní analýzy)
   * @param {Object} user - Uživatel
   * @param {string} errorType - Typ chyby
   * @param {string} errorReason - Důvod
   * @param {string} pageUrl - URL
   * @returns {Promise<number|null>} ID reportu
   */
  async saveBasicReport(user, errorType, errorReason, pageUrl) {
    try {
      Log.info('[ERROR_REPORT]', `Ukládám základní error report pro ${user?.id}`);

      const result = await db.safeExecute('error_reports.insertBasicErrorReport', [
        user?.id || null,
        errorType,
        errorReason,
        pageUrl,
        os.hostname()
      ]);

      if (result && result.insertId) {
        Log.success('[ERROR_REPORT]', `Základní error report uložen s ID: ${result.insertId}`);
        return result.insertId;
      }

      return null;
    } catch (err) {
      await Log.error('[ERROR_REPORT]', `Chyba při ukládání základního error reportu: ${err.message}`);
      return null;
    }
  }

  /**
   * Získá aktuální data reportu pro debugging
   * @returns {Object} Kopie reportData
   */
  getReportData() {
    return { ...this.reportData };
  }

  // ==========================================
  // PRIVATE HELPER METODY
  // ==========================================

  /**
   * Vytvoří shrnutí elementů na stránce
   * @param {Object} complexity - Výsledek complexity analýzy
   * @returns {string} Textové shrnutí
   * @private
   */
  _createElementsSummary(complexity) {
    if (!complexity.metrics) return 'Analýza elementů nedostupná';

    const metrics = complexity.metrics;
    const summary = [
      `Elementy: ${metrics.elements || 0}`,
      `Obrázky: ${metrics.images || 0}`,
      `Skripty: ${metrics.scripts || 0}`,
      `Odkazy: ${metrics.links || 0}`,
      `Tlačítka: ${metrics.buttons || 0}`,
      `Formuláře: ${metrics.forms || 0}`
    ];

    if (complexity.suspiciouslySimple) {
      summary.push('VAROVÁNÍ: Podezřele jednoduchá stránka');
    }

    if (complexity.isNormal === false) {
      summary.push('VAROVÁNÍ: Neobvyklá struktura stránky');
    }

    return summary.join(', ');
  }

  /**
   * Extrahuje důležité texty ze stránky
   * @param {string} bodyText - Text ze stránky
   * @returns {string} Filtrované texty
   * @private
   */
  _extractImportantTexts(bodyText) {
    if (!bodyText || bodyText.length < 10) {
      return 'Žádný text nenalezen';
    }

    // Klíčová slova pro FB chyby
    const importantKeywords = [
      'videoselfie', 'video selfie', 'identity', 'verify', 'ověření',
      'checkpoint', 'security', 'bezpečnost', 'restricted', 'zablokován',
      'suspicious', 'podezřelý', 'phone', 'telefon', 'error', 'chyba',
      'account', 'účet', 'login', 'přihlášení'
    ];

    const lines = bodyText.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 5 && line.length < 200) // Rozumná délka
      .filter(line => {
        const lowerLine = line.toLowerCase();
        return importantKeywords.some(keyword => lowerLine.includes(keyword));
      })
      .slice(0, 10); // Max 10 řádků

    return lines.length > 0 ? lines.join(' | ') : 'Žádné relevantní texty';
  }
}
