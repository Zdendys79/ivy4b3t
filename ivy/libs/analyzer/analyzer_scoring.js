/**
 * Název souboru: analyzer/analyzer_scoring.js
 * Účel: Score calculation and status determination methods pro PageAnalyzer
 *       _calculateComplexityScore, _calculateNavigationScore,
 *       _calculateInteractionScore, _calculateErrorSeverity,
 *       _determineOverallStatus, _generateRecommendations,
 *       _generateDetailedWarnings
 */

export const ScoringMixin = {

  _calculateComplexityScore(metrics) {
    if (!metrics) return 0;

    let score = 0;
    score += Math.min(metrics.elements / 100, 10); // Max 10 bodů za elementy
    score += Math.min(metrics.images / 2, 5);      // Max 5 bodů za obrázky
    score += Math.min(metrics.scripts / 5, 3);     // Max 3 body za scripty
    score += Math.min(metrics.links / 10, 2);      // Max 2 body za odkazy

    return Math.round(score);
  },

  _calculateNavigationScore(elements) {
    const foundCount = Object.values(elements).filter(Boolean).length;
    return Math.round((foundCount / Object.keys(elements).length) * 10);
  },

  _calculateInteractionScore(elements) {
    const foundCount = Object.values(elements).filter(Boolean).length;
    return Math.round((foundCount / Object.keys(elements).length) * 10);
  },

  _calculateErrorSeverity(patterns, accountLocked, checkpoint) {
    if (accountLocked) return 'critical';
    if (checkpoint.detected) return 'high';
    if (patterns.detected && patterns.type === 'UNEXPECTED_LOGIN_PAGE') return 'critical';
    if (patterns.detected && (patterns.type === 'AD_CONSENT_REQUIRED' || patterns.type === 'COOKIE_CONSENT_REQUIRED')) return 'action_required';
    if (patterns.detected) return 'medium';
    return 'none';
  },

  _determineOverallStatus(basic, errors, complexity) {
    if (errors.patterns.type === 'UNEXPECTED_LOGIN_PAGE') {
      return 'login_required';
    }
    if (errors.severity === 'action_required') {
      if (errors.patterns.type === 'AD_CONSENT_REQUIRED') return 'ad_consent_required';
      if (errors.patterns.type === 'COOKIE_CONSENT_REQUIRED') return 'cookie_consent_required';
    }

    if (errors.hasErrors) {
      return errors.severity === 'critical' ? 'blocked' : 'warning';
    }

    if (!basic.isLoggedIn) {
      return 'not_logged_in';
    }

    if (complexity.suspiciouslySimple) {
      return 'suspicious';
    }

    return 'ok';
  },

  _generateRecommendations(basic, errors, complexity) {
    const recommendations = [];

    if (!basic.isLoggedIn) {
      recommendations.push('Přihlaste se na FB');
    }

    if (errors.hasErrors) {
      if (errors.accountLocked) {
        recommendations.push('Účet je zablokován - kontaktujte podporu FB');
      }
      if (errors.checkpoint.detected) {
        recommendations.push('Dokončete bezpečnostní ověření');
      }
    }

    if (complexity.suspiciouslySimple) {
      recommendations.push('Stránka má podezřelou strukturu - ověřte správnost URL');
    }

    if (recommendations.length === 0) {
      recommendations.push('Stránka je připravena k použití');
    }

    return recommendations;
  },

  _generateDetailedWarnings(errorAnalysis, groupAnalysis) {
    const warnings = [];

    // Zpracuj chybové patterny
    if (errorAnalysis && errorAnalysis.patterns && errorAnalysis.patterns.detected) {
      warnings.push(errorAnalysis.patterns.reason);

      if (errorAnalysis.patterns.additionalInfo) {
        warnings.push(errorAnalysis.patterns.additionalInfo);
      }
    }

    // Zpracuj varování ze skupiny
    if (groupAnalysis && groupAnalysis.warningDetails && groupAnalysis.warningDetails.length > 0) {
      warnings.push(...groupAnalysis.warningDetails);
    }

    return warnings;
  }
};
