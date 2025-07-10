/**
 * Název souboru: iv_fb_support.js
 * Umístění: ~/ivy/iv_fb_support.js
 *
 * Popis: Specializované FB podporné funkce
 * Moderní ESM modul s inline exporty
 */

import { Log } from './iv_log.class.js';
import { handleFBError, quickErrorReport, analyzeErrorPatterns } from './iv_fb-error-workflow.js';
import { db } from './iv_sql.js';
import * as wait from './iv_wait.js';


/**
 * Univerzální ověření připravenosti FB stránky s error reporting
 */
export async function verifyFBReadiness(user, fbBot, options = {}) {
  const {
    requireSpecificGroup = null,
    requirePostingCapability = true,
    allowWarnings = false,
    includeDetailedAnalysis = false,
    enableErrorReporting = false  // NOVÝ PARAMETR
  } = options;

  try {
    Log.info(`[${user.id}]`, '🔍 Provádím ověření připravenosti FB...');

    // Základní kontroly
    if (!fbBot || !fbBot.page || fbBot.page.isClosed()) {
      const errorType = 'PAGE_ERROR';
      const reason = 'FBBot není dostupný';

      if (enableErrorReporting) {
        await quickErrorReport(user, errorType, reason, 'unknown');
      }

      return {
        ready: false,
        reason: reason,
        critical: true
      };
    }

    const currentUrl = fbBot.page.url();

    // Kontrola na základní FB doménu
    if (!currentUrl.includes('facebook.com')) {
      const errorType = 'PAGE_ERROR';
      const reason = 'Stránka není na FB doméně';

      if (enableErrorReporting) {
        await quickErrorReport(user, errorType, reason, currentUrl);
      }

      return {
        ready: false,
        reason: reason,
        critical: true
      };
    }

    // Použij PageAnalyzer pokud je dostupný
    if (fbBot.pageAnalyzer && includeDetailedAnalysis) {
      Log.info(`[${user.id}]`, '🔍 Spouštím detailní analýzu s PageAnalyzer...');

      try {
        const fullAnalysis = await fbBot.pageAnalyzer.analyzeFullPage({
          includePostingCapability: requirePostingCapability,
          includeGroupAnalysis: Boolean(requireSpecificGroup)
        });

        // KRITICKÉ CHYBY - spustit plný error workflow
        if (fullAnalysis.status === 'blocked') {
          const errorDetails = {
            type: fullAnalysis.errors.patterns.type || 'ACCOUNT_BLOCKED',
            reason: fullAnalysis.errors.patterns.reason || 'Účet je zablokován'
          };

          if (enableErrorReporting) {
            await Log.warn(`[${user.id}]`, `Kritická chyba detekována: ${errorDetails.type}`);

            const workflowResult = await handleFBError(user, fbBot, requireSpecificGroup, errorDetails);

            return {
              ready: false,
              reason: errorDetails.reason,
              critical: true,
              analysis: fullAnalysis,
              errorWorkflow: workflowResult
            };
          }

          return {
            ready: false,
            reason: errorDetails.reason,
            critical: true,
            analysis: fullAnalysis
          };
        }

        // VAROVÁNÍ - rychlý report ale pokračujeme
        if (fullAnalysis.status === 'warning') {
          const errorDetails = {
            type: fullAnalysis.errors.patterns.type || 'WARNING',
            reason: fullAnalysis.errors.patterns.reason || 'Detekováno varování'
          };

          if (enableErrorReporting) {
            await quickErrorReport(user, errorDetails.type, errorDetails.reason, currentUrl);
          }

          if (!allowWarnings) {
            return {
              ready: false,
              reason: errorDetails.reason,
              critical: false,
              analysis: fullAnalysis
            };
          }
        }

        // Kontrola posting capability
        if (requirePostingCapability && fullAnalysis.posting && !fullAnalysis.posting.canInteract) {
          const errorType = 'POSTING_ERROR';
          const reason = 'Stránka neumožňuje interakci';

          if (enableErrorReporting) {
            await quickErrorReport(user, errorType, reason, currentUrl);
          }

          return {
            ready: false,
            reason: reason,
            critical: true,
            analysis: fullAnalysis
          };
        }

        Log.success(`[${user.id}]`, '✅ Detailní analýza prošla úspěšně');
        return {
          ready: true,
          reason: 'Detailní analýza prošla úspěšně',
          analysis: fullAnalysis
        };

      } catch (analysisErr) {
        await Log.error(`[${user.id}]`, `Chyba při detailní analýze: ${analysisErr.message}`);

        if (enableErrorReporting) {
          await quickErrorReport(user, 'ANALYSIS_ERROR', `Chyba analýzy: ${analysisErr.message}`, currentUrl);
        }

        return {
          ready: false,
          reason: `Chyba při analýze: ${analysisErr.message}`,
          critical: true
        };
      }
    }

    // Základní ověření bez detailní analýzy
    const basicCheck = await performBasicReadinessCheck(user, requireSpecificGroup, fbBot);

    // I základní check může vyvolat error reporting
    if (!basicCheck.ready && basicCheck.critical && enableErrorReporting) {
      const errorType = basicCheck.reason.includes('zablokován') ? 'ACCOUNT_LOCKED' : 'BASIC_CHECK_FAILED';
      await quickErrorReport(user, errorType, basicCheck.reason, currentUrl);
    }

    return basicCheck;

  } catch (err) {
    await Log.error(`[${user.id}]`, `Chyba při ověřování připravenosti: ${err.message}`);

    if (enableErrorReporting) {
      await quickErrorReport(user, 'VERIFICATION_ERROR', `Chyba ověření: ${err.message}`, 'unknown');
    }

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
        reason: 'Uživatel není přihlášen na FB',
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

    Log.success(`[${user.id}]`, '✅ Základní kontroly FB prošly');
    return {
      ready: true,
      reason: 'Základní kontroly prošly úspěšně'
    };

  } catch (err) {
    await Log.error(`[${user.id}]`, `Chyba při základním ověření: ${err.message}`);
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
    await Log.error(`[${user.id}]`, `Chyba při ověřování posting capability: ${err.message}`);
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
    await Log.error(`[${user.id}]`, `Chyba při kontrole posting pole: ${err.message}`);
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
    await Log.error(`[${user.id}]`, `Chyba při kontrole responzivnosti: ${err.message}`);
    return {
      responsive: false,
      reason: `Chyba responzivnosti: ${err.message}`,
      responseTime: null
    };
  }
}

/**
 * Ověří stav FB stránky po návratu z UTIO
 */
export async function verifyStateAfterUtioReturn(user, group, fbBot, originalState) {
  try {
    Log.info(`[${user.id}]`, '🔄 Ověřuji stav FB po návratu z UTIO...');

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
      await Log.warn(`[${user.id}]`, 'Titul stránky se významně změnil');
    }

    // Rychlá kontrola dostupnosti FB funkcí
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

    Log.success(`[${user.id}]`, '✅ Stav FB stránky je v pořádku po návratu z UTIO');
    return {
      valid: true,
      reason: 'Stav je konzistentní'
    };

  } catch (err) {
    await Log.error(`[${user.id}]`, `Chyba při ověřování stavu: ${err.message}`);
    return {
      valid: false,
      reason: `Chyba při ověřování: ${err.message}`,
      shouldReload: true
    };
  }
}


/**
 * Ověří, zda je FB stránka připravená k použití
 */
export async function isFBReady(fbBot) {
  try {
    if (!fbBot || !fbBot.page) {
      return false;
    }

    if (fbBot.page.isClosed()) {
      return false;
    }

    const url = fbBot.page.url();
    if (!url.includes('FB.com')) {
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
    await Log.warn('[FB_SUPPORT]', `Chyba při kontrole FB stránky: ${err.message}`);
    return false;
  }
}

/**
 * NOVÁ FUNKCE - Verze s povoleným error reportingem
 * Použij místo verifyFBReadiness() když chceš plný error workflow
 */
export async function verifyFBWithErrorReporting(user, fbBot, options = {}) {
  return await verifyFBReadiness(user, fbBot, {
    ...options,
    enableErrorReporting: true,
    includeDetailedAnalysis: true
  });
}

/**
 * NOVÁ FUNKCE - Rozhodnutí kdy použít error reporting
 */
export function shouldUseErrorReporting(actionCode, user) {
  // Error reporting pro kritické akce
  const criticalActions = ['post_utio_G', 'post_utio_GV', 'login', 'account_check'];

  // Error reporting pro problematické účty
  const hasRecentLocks = user.locked !== null;

  // Error reporting pro nové účty (méně než 7 dní)
  const accountAge = user.created_at ? Date.now() - new Date(user.created_at).getTime() : 0;
  const isNewAccount = accountAge < 7 * 24 * 60 * 60 * 1000;

  // Error reporting v debug módu
  const isDebug = process.env.NODE_ENV === 'development';

  return criticalActions.includes(actionCode) || hasRecentLocks || isNewAccount || isDebug;
}

/**
 * NOVÁ FUNKCE - Pattern analysis pro účet
 */
export async function analyzeUserErrorHistory(user, days = 7) {
  try {
    Log.debug(`[${user.id}]`, `Analyzuji historii chyb za posledních ${days} dní...`);

    // Získej chyby pro konkrétního uživatele
    const { db } = await import('./iv_sql.js');
    const userErrors = await db.safeQueryAll('error_reports.getErrorReportsByUser', [user.id, 50]);

    if (!userErrors || userErrors.length === 0) {
      return {
        hasHistory: false,
        errorCount: 0,
        recommendation: 'Žádná historie chyb'
      };
    }

    // Základní statistiky
    const recentErrors = userErrors.filter(error => {
      const errorDate = new Date(error.created);
      const daysDiff = (Date.now() - errorDate.getTime()) / (1000 * 60 * 60 * 24);
      return daysDiff <= days;
    });

    const errorTypes = new Set(recentErrors.map(e => e.error_type));
    const resolvedCount = recentErrors.filter(e => e.resolved).length;
    const resolutionRate = recentErrors.length > 0 ? (resolvedCount / recentErrors.length * 100) : 0;

    const analysis = {
      hasHistory: recentErrors.length > 0,
      errorCount: recentErrors.length,
      uniqueErrorTypes: errorTypes.size,
      resolutionRate: resolutionRate.toFixed(1),
      mostRecentError: recentErrors[0]?.created,
      recommendation: ''
    };

    // Doporučení podle analýzy
    if (analysis.errorCount === 0) {
      analysis.recommendation = 'Účet bez problémů';
    } else if (analysis.errorCount >= 5 && resolutionRate < 50) {
      analysis.recommendation = 'Problematický účet - zvýšená pozornost';
    } else if (analysis.uniqueErrorTypes >= 3) {
      analysis.recommendation = 'Různorodé problémy - možná systémová chyba';
    } else if (resolutionRate >= 80) {
      analysis.recommendation = 'Problémy většinou vyřešeny - v pořádku';
    } else {
      analysis.recommendation = 'Běžná historie chyb';
    }

    Log.debug(`[${user.id}]`, `Analýza historie: ${analysis.errorCount} chyb, ${analysis.resolutionRate}% vyřešeno`);

    return analysis;

  } catch (err) {
    await Log.error(`[${user.id}]`, `Chyba při analýze historie: ${err.message}`);
    return {
      hasHistory: false,
      errorCount: 0,
      error: err.message,
      recommendation: 'Analýza selhala'
    };
  }
}

/**
 * Specializované ověření připravenosti FB pro UTIO operace
 * Kontroluje specifické podmínky pro postování přes UTIO
 */
export async function verifyFBReadinessForUtio(user, group, fbBot) {
  try {
    Log.info(`[${user.id}]`, '🔍 Ověřuji připravenost FB pro UTIO operaci...');

    // Základní kontroly
    if (!fbBot || !fbBot.page || fbBot.page.isClosed()) {
      return {
        ready: false,
        reason: 'FBBot není dostupný',
        critical: true,
        shouldNavigate: false
      };
    }

    const currentUrl = fbBot.page.url();

    // Kontrola na základní FB doménu
    if (!currentUrl.includes('facebook.com')) {
      return {
        ready: false,
        reason: 'Stránka není na FB doméně',
        critical: true,
        shouldNavigate: false
      };
    }

    // Kontrola zda jsme ve správné skupině
    const expectedGroupUrl = `facebook.com/groups/${group.fb_id}`;
    if (!currentUrl.includes(group.fb_id)) {
      Log.info(`[${user.id}]`, `🔄 Nejsme ve správné skupině, je potřeba navigace`);
      return {
        ready: false,
        reason: `Nejsme ve skupině ${group.nazev}`,
        critical: false,
        shouldNavigate: true
      };
    }

    // Detailní analýza stránky skupiny
    if (fbBot.pageAnalyzer) {
      try {
        const analysis = await fbBot.pageAnalyzer.analyzeFullPage({
          includeGroupAnalysis: true
        });

        // Kontrola výsledku analýzy
        if (analysis.status === 'error') {
          return {
            ready: false,
            reason: `Analýza skupiny selhala: ${analysis.details?.join(', ') || 'Neznámá chyba'}`,
            critical: true,
            shouldNavigate: false,
            analysisDetails: analysis
          };
        }

        if (analysis.status === 'warning') {
          // Používej nové detailní warning informace
          const warningDetails = analysis.details || [];
          const errorPattern = analysis.errors?.patterns;
          
          // Kontrola na "přidat se ke skupině" tlačítko
          if (errorPattern?.type === 'JOIN_GROUP_REQUIRED' || 
              warningDetails.some(detail => detail.includes('join') || detail.includes('přidat'))) {
            await Log.warn(`[${user.id}]`, '⚠️ Vyžaduje členství ve skupině - detekováno "přidat se" tlačítko');
            
            // Automatické přidání ke skupině (s časovým omezením 6 hodin)
            Log.info(`[${user.id}]`, '🤖 Kontroluji možnost automatického přidání ke skupině...');
            
            // Kontrola časového omezení - lze použít pouze 1x za 6 hodin
            const lastJoinGroup = await db.getUserLastJoinGroup(user.id);
            if (lastJoinGroup) {
              const timeSinceLastJoin = Date.now() - new Date(lastJoinGroup.timestamp).getTime();
              const sixHoursInMs = 6 * 60 * 60 * 1000;
              
              if (timeSinceLastJoin < sixHoursInMs) {
                const hoursRemaining = Math.ceil((sixHoursInMs - timeSinceLastJoin) / (60 * 60 * 1000));
                await Log.warn(`[${user.id}]`, `⏰ Nelze použít "Přidat se ke skupině" - lze použít pouze 1x za 6h. Zbývá: ${hoursRemaining}h`);
                
                return {
                  ready: false,
                  reason: `Časové omezení pro přidání do skupiny (zbývá ${hoursRemaining}h)`,
                  critical: false,
                  shouldNavigate: false,
                  analysisDetails: analysis,
                  temporaryBlock: true,
                  blockUntil: new Date(new Date(lastJoinGroup.timestamp).getTime() + sixHoursInMs)
                };
              }
            }
            
            Log.info(`[${user.id}]`, '🤖 Pokus o automatické přidání ke skupině...');
            
            try {
              // Hledání pouze správného textu tlačítka
              const joinButtons = await fbBot._findByText("Přidat se ke skupině", { timeout: 3000 });
              
              if (joinButtons.length > 0) {
                Log.info('[FB]', `✅ Nalezeno tlačítko: "Přidat se ke skupině"`);
                await joinButtons[0].click();
                
                // Čekání na zpracování
                await wait.delay(5000);
                
                // Ověření zda tlačítko zmizelo
                const buttonsAfter = await fbBot._findByText("Přidat se ke skupině", { timeout: 1000 });
                if (buttonsAfter.length === 0) {
                  Log.success('[FB]', `✅ Úspěšně kliknuto na "Přidat se ke skupině" - tlačítko zmizelo`);
                  Log.success(`[${user.id}]`, `✅ Automatické přidání úspěšné: Úspěšně použito tlačítko: "Přidat se ke skupině"`);
                  
                  // Zaloguj akci do action_log pro budoucí časové omezení
                  try {
                    await db.logAction(user.id, 'join_group', group.fb_id, `Automaticky přidán do skupiny: ${group.nazev}`);
                    Log.info(`[${user.id}]`, '📝 Akce join_group zalogována pro časové omezení');
                  } catch (logErr) {
                    Log.warn(`[${user.id}]`, `⚠️ Nepodařilo se zalogovat join_group akci: ${logErr.message}`);
                  }
                  
                  // Vrátí ready: true s informací o úspěšném přidání
                  return {
                    ready: true,
                    reason: 'Úspěšně přidán do skupiny - může pokračovat',
                    critical: false,
                    shouldNavigate: false,
                    joinedAutomatically: true,
                    analysisDetails: analysis
                  };
                } else {
                  await Log.warn('[FB]', '⚠️ Tlačítko "Přidat se ke skupině" stále viditelné po kliknutí');
                  throw new Error('Tlačítko nezmizelo po kliknutí');
                }
              } else {
                await Log.warn('[FB]', '⚠️ Tlačítko "Přidat se ke skupině" nenalezeno');
                throw new Error('Tlačítko pro přidání nenalezeno');
              }
              
            } catch (joinErr) {
              await Log.warn(`[${user.id}]`, `⚠️ Automatické přidání selhalo: ${joinErr.message}`);
              
              // Vrátí původní stav requiresJoin
              return {
                ready: false,
                reason: errorPattern?.reason || 'Není člen skupiny - automatické přidání selhalo',
                critical: false,
                shouldNavigate: false,
                requiresJoin: true,
                hasActionButton: errorPattern?.hasActionButton || false,
                joinAttemptFailed: true,
                analysisDetails: analysis
                };
            }
          }
          
          // Kontrola na čekající žádost o členství
          if (errorPattern?.type === 'MEMBERSHIP_PENDING') {
            await Log.warn(`[${user.id}]`, '⚠️ Žádost o členství čeká na schválení');
            return {
              ready: false,
              reason: errorPattern.reason,
              critical: false,
              shouldNavigate: false,
              membershipPending: true,
              analysisDetails: analysis
            };
          }
          
          // Kontrola na nedostupnost pole pro psaní
          if (errorPattern?.type === 'NO_WRITE_FIELD' || 
              warningDetails.some(detail => detail.includes('pole pro psaní'))) {
            await Log.warn(`[${user.id}]`, '⚠️ Pole pro psaní není dostupné');
            return {
              ready: false,
              reason: errorPattern?.reason || 'Není k dispozici pole pro psaní příspěvku',
              critical: false,
              shouldNavigate: false,
              analysisDetails: analysis
            };
          }
          
          // Kontrola na uzavřenou skupinu
          if (errorPattern?.type === 'GROUP_CLOSED') {
            await Log.warn(`[${user.id}]`, '⚠️ Skupina je uzavřená nebo soukromá');
            return {
              ready: false,
              reason: errorPattern.reason,
              critical: false,
              shouldNavigate: false,
              analysisDetails: analysis
            };
          }
          
          // Kontrola na odepřený přístup
          if (errorPattern?.type === 'ACCESS_DENIED') {
            await Log.warn(`[${user.id}]`, '⚠️ Přístup odepřen');
            return {
              ready: false,
              reason: errorPattern.reason,
              critical: true,
              shouldNavigate: false,
              analysisDetails: analysis
            };
          }

          // Obecné varování - pokračuj s opatrností
          const detailMessage = warningDetails.length > 0 ? warningDetails.join(', ') : 'Detekováno obecné varování';
          await Log.warn(`[${user.id}]`, `⚠️ Skupina má varování: ${detailMessage}`);
          return {
            ready: true,
            reason: 'Připraveno s varováním',
            critical: false,
            shouldNavigate: false,
            warning: true,
            warningDetails: warningDetails,
            analysisDetails: analysis
          };
        }

        // Status OK
        if (analysis.status === 'ok') {
          // Ověř možnost psaní příspěvku před potvrzením připravenosti
          Log.info(`[${user.id}]`, '🔍 Ověřuji možnost psaní příspěvku...');
          
          const canPost = await fbBot.newThing();
          if (!canPost) {
            return {
              ready: false,
              reason: 'Element pro psaní příspěvku nenalezen',
              critical: false,
              shouldNavigate: false,
              analysisDetails: analysis
            };
          }
          
          Log.success(`[${user.id}]`, '✅ Skupina je připravena pro UTIO postování - element pro psaní nalezen');
          return {
            ready: true,
            reason: 'Skupina připravena a možnost psaní ověřena',
            critical: false,
            shouldNavigate: false,
            analysisDetails: analysis
          };
        }
        
        // Status ready (pro zpětnou kompatibilitu)
        if (analysis.status === 'ready') {
          // Ověř možnost psaní příspěvku před potvrzením připravenosti
          Log.info(`[${user.id}]`, '🔍 Ověřuji možnost psaní příspěvku...');
          
          const canPost = await fbBot.newThing();
          if (!canPost) {
            return {
              ready: false,
              reason: 'Element pro psaní příspěvku nenalezen',
              critical: false,
              shouldNavigate: false,
              analysisDetails: analysis
            };
          }
          
          Log.success(`[${user.id}]`, '✅ Skupina je připravena pro UTIO postování - element pro psaní nalezen');
          return {
            ready: true,
            reason: 'Skupina připravena a možnost psaní ověřena',
            critical: false,
            shouldNavigate: false,
            analysisDetails: analysis
          };
        }

      } catch (analysisErr) {
        await Log.error(`[${user.id}]`, `Chyba analýzy skupiny: ${analysisErr.message}`);
        return {
          ready: false,
          reason: `Chyba při analýze skupiny: ${analysisErr.message}`,
          critical: true,
          shouldNavigate: false
        };
      }
    }

    // Fallback bez analýzy
    Log.info(`[${user.id}]`, '📋 PageAnalyzer není dostupný, používám základní kontrolu');
    return {
      ready: true,
      reason: 'Základní kontrola OK (bez detailní analýzy)',
      critical: false,
      shouldNavigate: false,
      warning: true,
      warningDetails: ['Bez detailní analýzy']
    };

  } catch (err) {
    await Log.error(`[${user.id}]`, `Chyba při ověřování UTIO připravenosti: ${err.message}`);
    return {
      ready: false,
      reason: `Chyba ověření: ${err.message}`,
      critical: true,
      shouldNavigate: false
    };
  }
}
