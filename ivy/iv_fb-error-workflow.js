/**
 * Název souboru: iv_fb-error-workflow.js
 * Umístění: ~/ivy/iv_fb-error-workflow.js
 *
 * Popis: Integrační modul pro FB error reporting workflow
 * Obsahuje funkce pro detekci chyb, uživatelskou intervenci a vytváření reportů
 */

import { Log } from './libs/iv_log.class.js';
import { waitForUserIntervention, advancedUserIntervention } from './iv_interactive.js';
import { Wait } from './libs/iv_wait.class.js';
import { ErrorReportBuilder } from './libs/iv_ErrorReportBuilder.class.js';

/**
 * Hlavní funkce pro error reporting workflow
 * Volá se při detekci problému na FB stránce
 *
 * @param {Object} user - Uživatelský objekt
 * @param {Object} fbBot - FB bot instance
 * @param {Object} group - Skupina (volitelné)
 * @param {Object} errorDetails - Detaily chyby z PageAnalyzer
 * @returns {Promise<Object>} Výsledek workflow
 */
export async function handleFBError(user, fbBot, group = null, errorDetails = {}) {
  try {
    await Log.warn('[ERROR_WORKFLOW]', `Detekována chyba pro uživatele ${user.id}: ${errorDetails.type || 'UNKNOWN'}`);

    const pageUrl = fbBot.page ? fbBot.page.url() : 'unknown';
    const errorType = errorDetails.type || 'UNKNOWN';
    const errorReason = errorDetails.reason || 'Nespecifikovaná chyba';

    // KROK 1: 60s countdown s možností uživatelské intervence
    const userWantsAnalysis = await waitForUserIntervention(
      `${errorType}: ${errorReason}`,
      60
    );

    if (userWantsAnalysis) {
      // KROK 2: Uživatel zvolil detailní analýzu
      Log.info('[ERROR_WORKFLOW]', 'Spouštím detailní analýzu chyby...');

      const reportResult = await performDetailedErrorAnalysis(
        user, fbBot, group, errorType, errorReason, pageUrl
      );

      return {
        action: 'detailed_analysis',
        success: reportResult.success,
        reportId: reportResult.reportId,
        shouldContinue: await askUserNextAction()
      };

    } else {
      // KROK 3: Timeout - uložíme základní error report a pokračujeme
      Log.info('[ERROR_WORKFLOW]', 'Ukladam zakladni error report a pokracuji...');

      const reportBuilder = new ErrorReportBuilder();
      const reportId = await reportBuilder.saveBasicReport(
        user, errorType, errorReason, pageUrl
      );

      return {
        action: 'basic_report',
        success: reportId !== null,
        reportId: reportId,
        shouldContinue: true
      };
    }

  } catch (err) {
    await Log.error('[ERROR_WORKFLOW]', `Chyba v error workflow: ${err.message}`);
    return {
      action: 'error',
      success: false,
      shouldContinue: true,
      error: err.message
    };
  }
}

/**
 * Provede detailní analýzu chyby a vytvoří kompletní error report
 *
 * @param {Object} user - Uživatel
 * @param {Object} fbBot - FB bot
 * @param {Object} group - Skupina
 * @param {string} errorType - Typ chyby
 * @param {string} errorReason - Důvod chyby
 * @param {string} pageUrl - URL stránky
 * @returns {Promise<Object>} Výsledek analýzy
 */
async function performDetailedErrorAnalysis(user, fbBot, group, errorType, errorReason, pageUrl) {
  try {
    Log.info('[ERROR_ANALYSIS]', 'Spouštím kompletní analýzu stránky...');

    // Vytvoření error report builderu
    const reportBuilder = new ErrorReportBuilder();
    reportBuilder.initializeReport(user, group, errorType, errorReason, pageUrl);

    let fullAnalysis = null;

    // Pokusíme se o detailní analýzu pouze pokud máme PageAnalyzer
    if (fbBot.pageAnalyzer) {
      try {
        fullAnalysis = await fbBot.pageAnalyzer.analyzeFullPage({
          includePostingCapability: true,
          includeGroupAnalysis: Boolean(group),
        });

        Log.info('[ERROR_ANALYSIS]', 'Detailní analýza dokončena');
        reportBuilder.addPageAnalysis(fullAnalysis);

      } catch (analysisErr) {
        await Log.warn('[ERROR_ANALYSIS]', `Detailní analýza selhala: ${analysisErr.message}`);
        reportBuilder.addNotes(`Analýza selhala: ${analysisErr.message}`);
      }
    } else {
      await Log.warn('[ERROR_ANALYSIS]', 'PageAnalyzer není k dispozici');
      reportBuilder.addNotes('PageAnalyzer nedostupný');
    }

    // Pokus o screenshot (volitelné)
    try {
      if (fbBot.page && !fbBot.page.isClosed()) {
        const screenshot = await fbBot.page.screenshot({
          fullPage: false, type: 'png'
        });
        reportBuilder.addScreenshot(screenshot);
        Log.info('[ERROR_ANALYSIS]', 'Screenshot přidán do reportu');
      }
    } catch (screenshotErr) {
      await Log.warn('[ERROR_ANALYSIS]', `Screenshot selhal: ${screenshotErr.message}`);
    }

    // Uložení kompletního reportu
    const reportId = await reportBuilder.saveReport();

    if (reportId) {
      Log.success('[ERROR_ANALYSIS]', `Kompletní error report vytvořen s ID: ${reportId}`);

      // Zobrazení shrnutí
      await displayAnalysisSummary(fullAnalysis, reportId);

      return {
        success: true,
        reportId: reportId,
        analysis: fullAnalysis
      };
    } else {
      throw new Error('Nepodařilo se uložit error report');
    }

  } catch (err) {
    await Log.error('[ERROR_ANALYSIS]', `Detailní analýza selhala: ${err.message}`);
    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * Zeptá se uživatele na další akci po error reportu
 * @returns {Promise<boolean>} true = pokračovat, false = ukončit
 */
async function askUserNextAction() {
  const action = await advancedUserIntervention({
    timeout: 30,
    reason: 'Error report vytvořen. Co dělat dál?',
    keys: {
      'c': { label: 'Continue (pokračovat)', action: 'continue' },
      's': { label: 'Stop (ukončit)', action: 'stop' },
      'r': { label: 'Restart (restartovat účet)', action: 'restart' }
    }
  });

  switch (action) {
    case 'continue':
      Log.info('[ERROR_WORKFLOW]', 'Pokracuji v praci...');
      return true;
    case 'stop':
      Log.info('[ERROR_WORKFLOW]', 'Ukoncuji praci na uctu...');
      return false;
    case 'restart':
      Log.info('[ERROR_WORKFLOW]', '🔄 Restartuji účet...');
      return false; // Způsobí restart cyklu
    default:
      Log.info('[ERROR_WORKFLOW]', 'Timeout - pokracuji automaticky...');
      return true;
  }
}

/**
 * Zobrazí shrnutí analýzy pro uživatele
 * @param {Object} analysis - Výsledek analýzy
 * @param {number} reportId - ID error reportu
 */
async function displayAnalysisSummary(analysis, reportId) {
  if (!analysis) {
    Log.info('[ERROR_SUMMARY]', 'Error report ulozen bez detailni analyzy');
    return;
  }

  Log.info('[ERROR_SUMMARY]', '=== SHRNUTÍ ERROR ANALÝZY ===');
  Log.info('[ERROR_SUMMARY]', `Report ID: ${reportId}`);

  if (analysis.basic) {
    Log.info('[ERROR_SUMMARY]', `Titul stranky: ${analysis.basic.title || 'N/A'}`);
    Log.info('[ERROR_SUMMARY]', `🌐 URL: ${analysis.basic.url || 'N/A'}`);
  }

  if (analysis.errors && analysis.errors.hasErrors) {
    await Log.warn('[ERROR_SUMMARY]', `Typ chyby: ${analysis.errors.patterns.type || 'UNKNOWN'}`);
    await Log.warn('[ERROR_SUMMARY]', `Duvod: ${analysis.errors.patterns.reason || 'Neznamy'}`);
    await Log.warn('[ERROR_SUMMARY]', `Závažnost: ${analysis.errors.severity || 'unknown'}`);
  }

  if (analysis.complexity) {
    const metrics = analysis.complexity.metrics;
    if (metrics) {
      Log.info('[ERROR_SUMMARY]', `🧮 Elementy na stránce: ${metrics.elements || 0}`);
      Log.info('[ERROR_SUMMARY]', `Obrazky: ${metrics.images || 0}`);
      Log.info('[ERROR_SUMMARY]', `🔗 Odkazy: ${metrics.links || 0}`);
    }
  }

  if (analysis.posting) {
    const canPost = analysis.posting.canInteract;
    Log.info('[ERROR_SUMMARY]', `Možnost postování: ${canPost ? 'ANO' : 'NE'}`);
  }

  Log.info('[ERROR_SUMMARY]', '==========================================');
}

/**
 * Rychlá integrace do existujícího FB workflow
 * Použij tuto funkci v iv_fb_support.js nebo iv_fb.class.js
 *
 * @param {Object} user - Uživatel
 * @param {Object} fbBot - FB bot instance
 * @param {Object} verificationOptions - Možnosti ověření
 * @returns {Promise<Object>} Výsledek s možností error reportingu
 */
export async function enhancedFBReadiness(user, fbBot, verificationOptions = {}) {
  try {
    // Stávající ověření připravenosti
    const basicReadiness = await performBasicReadinessCheck(user, fbBot, verificationOptions);

    if (basicReadiness.ready) {
      return basicReadiness; // Vše v pořádku
    }

    // Pokud NENÍ připraven a máme error details, spustíme error workflow
    if (!basicReadiness.ready && basicReadiness.analysis) {
      await Log.warn('[ENHANCED_FB]', `Detekován problém: ${basicReadiness.reason}`);

      const errorDetails = {
        type: basicReadiness.analysis.errors?.patterns?.type || 'UNKNOWN',
        reason: basicReadiness.reason
      };

      const group = verificationOptions.requireSpecificGroup || null;
      const workflowResult = await handleFBError(user, fbBot, group, errorDetails);

      // Vrátíme rozšířený výsledek
      return {
        ...basicReadiness,
        errorWorkflow: workflowResult,
        shouldContinue: workflowResult.shouldContinue
      };
    }

    return basicReadiness;

  } catch (err) {
    await Log.error('[ENHANCED_FB]', `Chyba v enhanced FB readiness: ${err.message}`);
    return {
      ready: false,
      reason: `Chyba při ověření: ${err.message}`,
      critical: true
    };
  }
}

/**
 * Základní ověření připravenosti (placeholder pro existující logiku)
 * Tato funkce by měla být nahrazena skutečnou implementací z iv_fb_support.js
 */
async function performBasicReadinessCheck(user, fbBot, options) {
  // Placeholder - zde by byla stávající logika z verifyFBReadiness()
  if (!fbBot || !fbBot.page) {
    return {
      ready: false,
      reason: 'FB bot není připraven',
      critical: true
    };
  }

  return {
    ready: true,
    reason: 'Základní kontrola prošla',
    analysis: null
  };
}

/**
 * Utility funkce pro rychlé vytvoření error reportu bez workflow
 * Použij pro jednoduché případy kde nechceš celý workflow
 *
 * @param {Object} user - Uživatel
 * @param {string} errorType - Typ chyby
 * @param {string} reason - Důvod
 * @param {string} url - URL stránky
 * @returns {Promise<number|null>} ID reportu
 */
export async function quickErrorReport(user, errorType, reason, url) {
  try {
    const reportBuilder = new ErrorReportBuilder();
    const reportId = await reportBuilder.saveBasicReport(user, errorType, reason, url);

    if (reportId) {
      Log.info('[QUICK_REPORT]', `Rychlý error report vytvořen: ID ${reportId}`);
    }

    return reportId;
  } catch (err) {
    await Log.error('[QUICK_REPORT]', `Chyba při vytváření rychlého reportu: ${err.message}`);
    return null;
  }
}

/**
 * Analyzuje existující error reporty pro pattern matching
 * Pomáhá identifikovat opakující se problémy
 *
 * @param {string} errorType - Typ chyby k analýze
 * @param {number} days - Počet dní zpět (výchozí 7)
 * @returns {Promise<Object>} Analýza patterns
 */
export async function analyzeErrorPatterns(errorType, days = 7) {
  try {
    const { db } = await import('./iv_sql.js');

    // Získej podobné chyby za posledních X dní
    const similarErrors = await db.safeQueryAll('error_reports.getErrorReportsByType', [
      errorType, 50 // max 50 reportů
    ]);

    if (!similarErrors || similarErrors.length === 0) {
      return {
        hasPatterns: false,
        count: 0,
        recommendation: 'Žádné podobné chyby nenalezeny'
      };
    }

    // Základní analýza
    const userIds = new Set(similarErrors.map(e => e.user_id).filter(Boolean));
    const hostnames = new Set(similarErrors.map(e => e.hostname).filter(Boolean));
    const resolvedCount = similarErrors.filter(e => e.resolved).length;

    const analysis = {
      hasPatterns: similarErrors.length >= 3,
      count: similarErrors.length,
      affectedUsers: userIds.size,
      affectedHosts: hostnames.size,
      resolutionRate: (resolvedCount / similarErrors.length * 100).toFixed(1),
      mostRecentOccurrence: similarErrors[0]?.created
    };

    // Doporučení podle patterns
    if (analysis.hasPatterns) {
      if (analysis.resolutionRate > 80) {
        analysis.recommendation = 'Vysoká míra vyřešení - zkus standardní postup';
      } else if (analysis.affectedUsers === 1) {
        analysis.recommendation = 'Problém specifický pro jednoho uživatele';
      } else if (analysis.affectedHosts === 1) {
        analysis.recommendation = 'Problém specifický pro jeden host';
      } else {
        analysis.recommendation = 'Systémový problém - vyžaduje pozornost';
      }
    } else {
      analysis.recommendation = 'Nový typ problému - sleduj vývoj';
    }

    Log.info('[PATTERN_ANALYSIS]', `Analýza ${errorType}: ${analysis.count} případů, ${analysis.resolutionRate}% vyřešeno`);

    return analysis;

  } catch (err) {
    await Log.error('[PATTERN_ANALYSIS]', `Chyba při analýze patterns: ${err.message}`);
    return {
      hasPatterns: false,
      count: 0,
      error: err.message,
      recommendation: 'Analýza selhala'
    };
  }
}
