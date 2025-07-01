/**
 * Název souboru: iv_facebook_support.js
 * Umístění: ~/ivy/iv_facebook_support.js
 *
 * Popis: Specializované Facebook podporné funkce
 * Moderní ESM modul s inline exporty
 */

import * as wait from './iv_wait.js';
import { db } from './iv_sql.js';
import md5 from 'md5';
import { Log } from './iv_log.class.js';

/**
 * Ověří připravenost Facebook stránky před získáním zprávy z UTIO
 */
export async function verifyFacebookReadinessForUtio(user, group, fbBot) {
  try {
    Log.info(`[${user.id}]`, '🔍 Ověřuji připravenost Facebook stránky před UTIO operací...');

    // 1. Základní kontrola FacebookBot
    if (!fbBot || !fbBot.page || fbBot.page.isClosed()) {
      return {
        ready: false,
        reason: 'FacebookBot není dostupný nebo stránka je zavřená',
        critical: true
      };
    }

    // 2. Kontrola URL - jsme ve správné skupině?
    const currentUrl = fbBot.page.url();
    if (!currentUrl.includes(group.fb_id)) {
      return {
        ready: false,
        reason: `Nejsme ve správné skupině. Očekáváno: ${group.fb_id}, aktuální: ${currentUrl}`,
        critical: true,
        shouldNavigate: true
      };
    }

    // 3. Použij PageAnalyzer pokud je k dispozici
    if (fbBot.pageAnalyzer) {
      Log.info(`[${user.id}]`, 'Používám PageAnalyzer pro detailní ověření...');

      const readinessCheck = await fbBot.verifyPostingReadiness(group);
      if (!readinessCheck.ready) {
        return {
          ready: false,
          reason: readinessCheck.reason,
          critical: readinessCheck.reason.includes('zablokován') || readinessCheck.reason.includes('restricted'),
          details: readinessCheck.details
        };
      }

      Log.success(`[${user.id}]`, '✅ PageAnalyzer potvrdil připravenost stránky');
    } else {
      // Fallback ověření bez PageAnalyzer
      Log.warn(`[${user.id}]`, 'PageAnalyzer není k dispozici, používám základní ověření...');

      const basicCheck = await performBasicReadinessCheck(user, group, fbBot);
      if (!basicCheck.ready) {
        return basicCheck;
      }
    }

    // 5. Ověření schopnosti postovat do konkrétní skupiny
    const postingCheck = await verifyGroupPostingCapability(user, group, fbBot);
    if (!postingCheck.ready) {
      return postingCheck;
    }

    // 6. Kontrola pole pro psaní příspěvku
    const fieldCheck = await verifyPostingField(user, fbBot);
    if (!fieldCheck.ready) {
      return fieldCheck;
    }

    Log.success(`[${user.id}]`, '🎯 Facebook stránka je připravena pro UTIO operaci');
    return {
      ready: true,
      reason: 'Všechny kontroly prošly úspěšně',
      group: group,
      url: currentUrl
    };

  } catch (err) {
    Log.error(`[${user.id}]`, `Chyba při ověřování připravenosti: ${err.message}`);
    return {
      ready: false,
      reason: `Chyba při ověřování: ${err.message}`,
      critical: true
    };
  }
}

/**
 * Základní ověření bez PageAnalyzer
 */
export async function performBasicReadinessCheck(user, group, fbBot) {
  try {
    // Kontrola přihlášení
    const isLoggedIn = await fbBot.isProfileLoaded(user);
    if (!isLoggedIn) {
      return {
        ready: false,
        reason: 'Uživatel není přihlášen na Facebook',
        critical: true
      };
    }

    // Kontrola zablokovaného účtu
    const accountLocked = await fbBot.isAccountLocked();
    if (accountLocked) {
      return {
        ready: false,
        reason: typeof accountLocked === 'string' ? 
          accountLocked : 'Účet je zablokován nebo omezen',
        critical: true
      };
    }

    // Kontrola URL skupiny
    const currentUrl = fbBot.page.url();
    if (group && !currentUrl.includes(group.fb_id)) {
      return {
        ready: false,
        reason: `Nejsme ve správné skupině: ${group.fb_id}`,
        critical: false,
        shouldNavigate: true
      };
    }

    Log.success(`[${user.id}]`, '✅ Základní kontroly Facebook prošly');
    return {
      ready: true,
      reason: 'Základní kontroly prošly úspěšně'
    };

  } catch (err) {
    Log.error(`[${user.id}]`, `Chyba při základním ověření: ${err.message}`);
    return {
      ready: false,
      reason: `Chyba při ověření: ${err.message}`,
      critical: true
    };
  }
}

/**
 * Ověří schopnost postovat do konkrétní skupiny
 */
export async function verifyGroupPostingCapability(user, group, fbBot) {
  try {
    Log.info(`[${user.id}]`, 'Ověřuji schopnost postovat do skupiny...');

    // Test dostupnosti posting pole
    const hasPostingField = await fbBot.page.evaluate(() => {
      const selectors = [
        '[data-testid="status-attachment-mentions-input"]',
        '[contenteditable="true"]',
        'textarea[placeholder*="What\'s on your mind"]',
        'textarea[placeholder*="Co máš na mysli"]'
      ];

      return selectors.some(selector => {
        const element = document.querySelector(selector);
        return element && element.offsetParent !== null;
      });
    });

    if (!hasPostingField) {
      return {
        ready: false,
        reason: 'Posting pole není dostupné',
        critical: false
      };
    }

    return {
      ready: true,
      reason: 'Skupina podporuje postování'
    };

  } catch (err) {
    Log.error(`[${user.id}]`, `Chyba při ověřování posting capability: ${err.message}`);
    return {
      ready: false,
      reason: `Chyba při ověřování: ${err.message}`,
      critical: false
    };
  }
}

/**
 * Kontrola pole pro psaní příspěvku
 */
export async function verifyPostingField(user, fbBot) {
  try {
    const fieldAvailable = await fbBot.page.evaluate(() => {
      const field = document.querySelector('[contenteditable="true"]');
      return field && !field.disabled && field.offsetParent !== null;
    });

    if (!fieldAvailable) {
      return {
        ready: false,
        reason: 'Pole pro psaní není dostupné',
        critical: false
      };
    }

    return {
      ready: true,
      reason: 'Posting pole je dostupné'
    };

  } catch (err) {
    Log.error(`[${user.id}]`, `Chyba při kontrole posting pole: ${err.message}`);
    return {
      ready: false,
      reason: `Chyba kontroly pole: ${err.message}`,
      critical: false
    };
  }
}

/**
 * Kontrola responzivnosti stránky
 */
export async function checkPageResponsiveness(user, fbBot) {
  try {
    const startTime = Date.now();
    
    await fbBot.page.evaluate(() => {
      return document.readyState === 'complete';
    });
    
    const responseTime = Date.now() - startTime;
    
    if (responseTime > 5000) {
      return {
        responsive: false,
        reason: `Stránka reaguje pomalu (${responseTime}ms)`,
        responseTime: responseTime
      };
    }

    return {
      responsive: true,
      reason: 'Stránka reaguje rychle',
      responseTime: responseTime
    };

  } catch (err) {
    Log.error(`[${user.id}]`, `Chyba při kontrole responzivnosti: ${err.message}`);
    return {
      responsive: false,
      reason: `Chyba responzivnosti: ${err.message}`,
      responseTime: null
    };
  }
}

/**
 * Ověří stav Facebook stránky po návratu z UTIO
 */
export async function verifyStateAfterUtioReturn(user, group, fbBot, originalState) {
  try {
    Log.info(`[${user.id}]`, '🔄 Ověřuji stav Facebook po návratu z UTIO...');

    // Kontrola URL
    const currentUrl = fbBot.page.url();
    const currentTitle = await fbBot.page.title().catch(() => 'Unknown');

    // Ověř že jsme stále ve stejné skupině
    if (!currentUrl.includes(group.fb_id)) {
      return {
        valid: false,
        reason: `URL se změnila. Původní obsahovala: ${group.fb_id}, aktuální: ${currentUrl}`,
        shouldReload: true
      };
    }

    // Kontrola zda se stránka dramaticky nezměnila
    if (Math.abs(currentTitle.length - originalState.title.length) > 50) {
      Log.warn(`[${user.id}]`, 'Titul stránky se významně změnil');
    }

    // Rychlá kontrola dostupnosti Facebook funkcí
    const functionsCheck = await fbBot.page.evaluate(() => {
      try {
        const elementCount = document.querySelectorAll('*').length;
        const bodyText = document.body.textContent.toLowerCase();
        const hasErrors = bodyText.includes('something went wrong') ||
                         bodyText.includes('něco se pokazilo') ||
                         bodyText.includes('error occurred');

        return {
          accessible: elementCount > 100,
          hasErrors: hasErrors,
          elementCount: elementCount
        };
      } catch (err) {
        return {
          accessible: false,
          hasErrors: true,
          error: err.message
        };
      }
    });

    if (!functionsCheck.accessible) {
      return {
        valid: false,
        reason: 'Stránka není přístupná nebo má málo elementů',
        shouldReload: true
      };
    }

    if (functionsCheck.hasErrors) {
      return {
        valid: false,
        reason: 'Na stránce jsou chybové zprávy',
        shouldReload: true
      };
    }

    // Kontrola zda není účet zablokován
    if (fbBot.pageAnalyzer) {
      const quickCheck = await fbBot.pageAnalyzer.quickStatusCheck();
      if (quickCheck.hasErrors) {
        return {
          valid: false,
          reason: 'Detekován problém s účtem po návratu z UTIO',
          shouldReload: false
        };
      }
    }

    Log.success(`[${user.id}]`, '✅ Stav Facebook stránky je v pořádku po návratu z UTIO');
    return {
      valid: true,
      reason: 'Stav je konzistentní'
    };

  } catch (err) {
    Log.error(`[${user.id}]`, `Chyba při ověřování stavu: ${err.message}`);
    return {
      valid: false,
      reason: `Chyba při ověřování: ${err.message}`,
      shouldReload: true
    };
  }
}

/**
 * Univerzální ověření připravenosti Facebook stránky
 */
export async function verifyFacebookReadiness(user, fbBot, options = {}) {
  const {
    requireSpecificGroup = null,
    requirePostingCapability = true,
    allowWarnings = false,
    includeDetailedAnalysis = false
  } = options;

  try {
    Log.info(`[${user.id}]`, '🔍 Provádím ověření připravenosti Facebook...');

    // Základní kontroly
    if (!fbBot || !fbBot.page || fbBot.page.isClosed()) {
      return {
        ready: false,
        reason: 'FacebookBot není dostupný',
        critical: true
      };
    }

    // Použij PageAnalyzer pokud je dostupný
    if (fbBot.pageAnalyzer && includeDetailedAnalysis) {
      const fullAnalysis = await fbBot.pageAnalyzer.analyzeFullPage({
        includePostingCapability: requirePostingCapability,
        includeGroupAnalysis: !requireSpecificGroup
      });

      if (fullAnalysis.status === 'blocked') {
        return {
          ready: false,
          reason: fullAnalysis.errors.patterns.reason || 'Účet je zablokován',
          critical: true,
          analysis: fullAnalysis
        };
      }

      if (fullAnalysis.status === 'warning' && !allowWarnings) {
        return {
          ready: false,
          reason: fullAnalysis.errors.patterns.reason || 'Detekováno varování',
          critical: false,
          analysis: fullAnalysis
        };
      }

      if (requirePostingCapability && fullAnalysis.posting && !fullAnalysis.posting.canInteract) {
        return {
          ready: false,
          reason: 'Stránka neumožňuje interakci',
          critical: true,
          analysis: fullAnalysis
        };
      }

      return {
        ready: true,
        reason: 'Detailní analýza prošla úspěšně',
        analysis: fullAnalysis
      };
    }

    // Základní ověření bez detailní analýzy
    const basicCheck = await performBasicReadinessCheck(user, requireSpecificGroup, fbBot);
    return basicCheck;

  } catch (err) {
    Log.error(`[${user.id}]`, `Chyba při ověřování připravenosti: ${err.message}`);
    return {
      ready: false,
      reason: `Chyba při ověřování: ${err.message}`,
      critical: true
    };
  }
}

/**
 * Ověří, zda je Facebook stránka připravená k použití
 */
export async function isFacebookReady(fbBot) {
  try {
    if (!fbBot || !fbBot.page) {
      return false;
    }

    if (fbBot.page.isClosed()) {
      return false;
    }

    const url = fbBot.page.url();
    if (!url.includes('facebook.com')) {
      return false;
    }

    const title = await fbBot.page.title();
    if (title.toLowerCase().includes('error') ||
      title.toLowerCase().includes('not found') ||
      title.toLowerCase().includes('blocked')) {
      return false;
    }

    return true;

  } catch (err) {
    Log.warn('[FACEBOOK_SUPPORT]', `Chyba při kontrole Facebook stránky: ${err.message}`);
    return false;
  }
}