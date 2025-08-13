/**
 * Název souboru: iv_wheel.js
 * Umístění: ~/ivy/iv_wheel.js
 *
 * Popis: Zjednodušené kolo štěstí - pouze losování a orchestrace
 * - Losuje akce podle vah a limitů
 * - Spravuje invasive lock
 * - Iniciuje FBBot pro běžné akce
 * - Deleguje provedení na ActionRouter
 * - Kontroluje consecutive failures
 */

import { db } from './iv_sql.js';
import { Log } from './libs/iv_log.class.js';
import { getIvyConfig } from './libs/iv_config.class.js';
import { InvasiveLock } from './libs/iv_invasive_lock.class.js';
import { ActionRouter } from './libs/action_router.class.js';
import { FBBot } from './libs/iv_fb.class.js';
import { UtioBot } from './libs/iv_utio.class.js';
import { UIBot } from './libs/iv_ui.class.js';
import { IvMath } from './libs/iv_math.class.js';
import { Wait } from './libs/iv_wait.class.js';

const config = getIvyConfig();

/**
 * Třída pro weighted random selection
 */
class Wheel {
  constructor(activities) {
    this.activities = activities;
    this.totalWeight = activities.reduce((sum, a) => sum + (a.effective_weight || 0), 0);
  }

  pick() {
    if (this.totalWeight === 0) return null;

    let r = Math.random() * this.totalWeight;
    for (const a of this.activities) {
      const weight = a.effective_weight || 0;
      if (weight > 0 && r < weight) return a;
      r -= weight;
    }
    return null;
  }
}

/**
 * Hlavní funkce kola štěstí
 */
export async function runWheelOfFortune(user, browser, context) {
  const invasiveLock = new InvasiveLock();
  const actionRouter = new ActionRouter();
  let consecutiveFailures = 0;
  let actionCount = 0;
  let fbBot = null;
  
  // Načíst max počet akcí pro wheel z databáze
  const maxActions = config.get('wheel_max_actions', 10);
  let utioBot = null;

  // Inicializace
  invasiveLock.init();
  await db.initUserActionPlan(user.id);
  
  // Zajistit kompletní action plan pro uživatele
  await ensureCompleteActionPlan(user.id);
  
  // Nastavit globální stav - wheel aktivní
  global.systemState.currentUserId = user.id;
  
  const initResult = await actionRouter.init();
  if (!initResult) {
    throw new Error('Nepodařilo se inicializovat ActionRouter');
  }

  // Iniciuj FBBot pro všechny akce (kromě ukončovacích)
  try {
    fbBot = new FBBot(browser, user.id);
    await fbBot.init();
    Log.info(`[${user.id}]`, 'FBBot úspěšně inicializován');
  } catch (err) {
    await Log.error(`[${user.id}]`, `Chyba při inicializaci FBBot: ${err.message}`);
    throw err;
  }

  // UtioBot se inicializuje až když je potřeba (podmíněně)

  try {
    // Hlavní smyčka
    while (true) {
      // 0. Kontrola restart_needed
      if (global.systemState.restart_needed) {
        Log.info(`[${user.id}]`, 'Heartbeat detekoval změnu verze. Ukončuji wheel.');
        return { stoppedByRestart: true };
      }
      
      // 1. Kontrola consecutive failures
      if (consecutiveFailures >= config.consecutive_failures_limit) {
        await Log.error(`[${user.id}]`, `${consecutiveFailures} neúspěšných akcí za sebou`);
        
        // Načíst account_delay akci z databáze pro získání min/max_minutes
        const delayActionData = await db.getDefinitionByCode('account_delay');
        
        // Pro ukončovací akce nepotřebujeme FBBot
        const endingContext = { browser, ...context };
        await actionRouter.executeAction('account_delay', user, endingContext, delayActionData);
        
        break;
      }

      // 2. Kontrola action limitu - ukončit wheel při dosažení max počtu akcí
      if (actionCount >= maxActions) {
        Log.info(`[${user.id}]`, `Dosažen limit akcí (${actionCount}/${maxActions}) - ukončuji wheel`);
        
        // Získat ukončovací akce přímo z databáze
        let endingActions = await db.safeQueryAll('actions.getEndingActions', [user.id]);
        
        if (!endingActions || endingActions.length === 0) {
          Log.info(`[${user.id}]`, 'Vytvářím chybějící ukončovací akce pro action limit');
          await db.safeExecute('actions.createUserAction', [user.id, 'account_sleep']);
          await db.safeExecute('actions.createUserAction', [user.id, 'account_delay']);
          endingActions = await db.safeQueryAll('actions.getEndingActions', [user.id]);
        }
        
        if (endingActions && endingActions.length > 0) {
          const wheel = new Wheel(endingActions);
          const endingAction = wheel.pick();
          
          if (endingAction) {
            Log.info(`[${user.id}]`, `Vylosována ukončovací akce po limitu: ${endingAction.code}`);
            const endingContext = { browser, ...context };
            await actionRouter.executeAction(endingAction.code, user, endingContext, endingAction);
          }
        }
        break;
      }

      // 3. Zajistit existence všech aktivních akcí v plánu
      await ensureAllActiveActionsExist(user.id);
      
      // 4. Získání dostupných akcí
      const availableActions = await getAvailableActions(user.id, invasiveLock);
      
      
      // 5. Kontrola prázdného kola (kromě test módu)
      if (!global.isTestBranch && isWheelEmpty(availableActions)) {
        // Zkontroluj, zda nejsou v plánu invazivní akce čekající na invasive_lock
        const hasPendingInvasiveActions = await checkPendingInvasiveActions(user.id);
        
        if (hasPendingInvasiveActions && invasiveLock.isActive()) {
          Log.info(`[${user.id}]`, `Čekám na ukončení invasive lock (zbývá ${invasiveLock.getRemainingSeconds()}s) - v plánu jsou invazivní akce`);
          // Čekej a pokračuj v dalším kole místo ukončení
          await Wait.toSeconds(Math.min(invasiveLock.getRemainingSeconds() + 1, 30), 'Čekání na invasive lock');
          continue;
        }
        
        const endingAction = await handleEmptyWheel(user, availableActions);
        if (endingAction) {
          // Pro ukončovací akce nepotřebujeme FBBot
          const endingContext = { browser, ...context };
          await actionRouter.executeAction(endingAction.code, user, endingContext, {});
          
        }
        break;
      }

      // 5. Losování akce
      const pickedAction = pickAction(availableActions);
      if (!pickedAction) {
        // Žádné dostupné akce - zkusit ukončovací akce
        Log.info(`[${user.id}]`, 'Nejsou dostupné žádné akce - zkouším ukončovací akce');
        
        // Získat ukončovací akce z databáze
        let endingActions = await db.safeQueryAll('actions.getEndingActions', [user.id]);
        
        // Pokud nejsou, vytvořit je
        if (!endingActions || endingActions.length === 0) {
          Log.info(`[${user.id}]`, 'Vytvářím chybějící ukončovací akce');
          await db.safeExecute('actions.createUserAction', [user.id, 'account_sleep']);
          await db.safeExecute('actions.createUserAction', [user.id, 'account_delay']);
          
          // Znovu načíst
          endingActions = await db.safeQueryAll('actions.getEndingActions', [user.id]);
        }
        
        if (endingActions && endingActions.length > 0) {
          // Použít Wheel pro losování podle vah
          const wheel = new Wheel(endingActions);
          const endingAction = wheel.pick();
          
          if (endingAction) {
            Log.info(`[${user.id}]`, `Vylosována ukončovací akce: ${endingAction.code}`);
            const endingContext = { browser, ...context };
            await actionRouter.executeAction(endingAction.code, user, endingContext, endingAction);
          }
        } else {
          await Log.error(`[${user.id}]`, 'KRITICKÁ CHYBA: Nelze vytvořit ukončovací akce!');
        }
        break;
      }

      Log.info(`[${user.id}]`, `Vylosována akce #${actionCount + 1}: ${pickedAction.code}`);

      // 5.5. Podmíněná inicializace UtioBot pro vylosovanou akci
      if (!utioBot) {
        const requirements = await actionRouter.getActionRequirements(pickedAction.code);
        if (requirements.needsUtio) {
          try {
            Log.info(`[${user.id}]`, `Akce ${pickedAction.code} potřebuje UTIO - inicializuji UtioBot`);
            utioBot = new UtioBot(context);
            await utioBot.init();
            Log.info(`[${user.id}]`, 'UtioBot úspěšně inicializován pro vylosovanou akci');
            
            // Přihlásit uživatele do UTIO
            const utioLoginSuccess = await utioBot.openUtio(user);
            if (utioLoginSuccess) {
              Log.info(`[${user.id}]`, 'Uživatel úspěšně přihlášen do UTIO');
            } else {
              Log.warn(`[${user.id}]`, 'Přihlášení do UTIO se nezdařilo - akce může selhat');
            }
          } catch (err) {
            await Log.warn(`[${user.id}]`, `Chyba při inicializaci UtioBot: ${err.message}`);
            // UTIO není kritické - pokračuji bez něj, ale akce pravděpodobně selže
          }
        }
      }

      // 6. Provedení akce
      const actionContext = {
        browser,
        fbBot,
        utioBot,
        ...context
      };
      
      // Nastavit globální stav před spuštěním akce
      global.systemState.currentAction = pickedAction.code;
      global.systemState.actionStartTime = Date.now();
      
      const success = await actionRouter.executeAction(pickedAction.code, user, actionContext, pickedAction);
      
      // Vyčistit stav po dokončení akce
      global.systemState.currentAction = null;
      global.systemState.actionStartTime = null;
      
      if (!success) {
        consecutiveFailures++;
        await Log.warn(`[${user.id}]`, `Akce ${pickedAction.code} NEPROVEDENA`);
        
        // Kontrola FB checkpointu - pokud cache má málo elementů, ukončit wheel
        if (fbBot?.pageAnalyzer?.elementCache?.size < 5) {
          Log.info(`[${user.id}]`, `Facebook checkpoint detekován - blokuji uživatele a ukončuji wheel`);
          
          // Zablokovat uživatele - nastav locked = NOW() a lock_reason
          const lockReason = `Facebook checkpoint detected - cache size: ${fbBot.pageAnalyzer.elementCache.size}`;
          await db.lockAccountWithReason(user.id, lockReason, 'CHECKPOINT');
          
          // Zapsat do system logu
          await Log.systemLog('ACCOUNT_LOCKED', `User ${user.id} locked due to Facebook checkpoint`);
          
          break;
        }
      } else {
        consecutiveFailures = 0;
        Log.success(`[${user.id}]`, `Akce ${pickedAction.code} úspěšně dokončena`);
        
        // Zpracování opakování akcí - opakovatelné akce zůstávají dostupné (next_time = NULL)
        if (!pickedAction.repeatable) {
          // Pro neopakovatelné akce nastav next_time podle min/max_minutes
          const minutes = pickedAction.min_minutes + Math.random() * (pickedAction.max_minutes - pickedAction.min_minutes);
          const validatedMinutes = Math.min(Math.max(Math.round(minutes), 1), 43200);
          
          await db.safeExecute('actions.scheduleNext', [validatedMinutes, user.id, pickedAction.code]);
          Log.info(`[${user.id}]`, `Neopakovatelná akce ${pickedAction.code} naplánována za ${Math.round(validatedMinutes/60)}h`);
        } else {
          Log.info(`[${user.id}]`, `Opakovatelná akce ${pickedAction.code} zůstává dostupná pro další kolo`);
        }
        
        // Nastavení invasive lock po úspěšné invazivní akci
        if (pickedAction.is_invasive) {
          const cooldownMs = calculateInvasiveCooldown();
          invasiveLock.set(cooldownMs);
          Log.info(`[${user.id}]`, `Invasive lock nastaven na ${invasiveLock.getRemainingSeconds()}s`);
        }
      }

      actionCount++;

      // 7. Kontrola UI příkazů (nejprve cache, pak databáze)
      const uiCommand = global.uiCommandCache || await UIBot.quickCheck();
      
      if (uiCommand) {
        Log.info(`[${user.id}]`, 'Detekován UI příkaz - ukončuji kolo štěstí');
        
        return { stoppedByUI: true };
      }
      
      // 7b. restart_needed check is now handled by Wait.toSecondsInterruptible

      // 8. Pauza mezi akcemi (přerušitelná při restart_needed)
      await Wait.toSecondsInterruptible(config.getWheelActionDelaySeconds().max, 'Pauza mezi akcemi');
    }

    Log.success(`[${user.id}]`, `Kolo štěstí dokončeno. Provedeno ${actionCount} akcí`);
    return { stoppedByUI: false };

  } catch (err) {
    await Log.error(`[${user.id}]`, `Chyba v kole štěstí: ${err.message}`);
    throw err;
  } finally {
    // Vyčistit globální stav systému
    global.systemState.currentUserId = null;
    global.systemState.currentAction = null;
    global.systemState.actionStartTime = null;
    
    // Ukončení botů
    if (fbBot) {
      try {
        await fbBot.close();
        Log.info(`[${user.id}]`, 'FBBot ukončen');
      } catch (err) {
        await Log.warn(`[${user.id}]`, `Chyba při ukončování FBBot: ${err.message}`);
      }
    }
    
    if (utioBot) {
      try {
        await utioBot.close();
        Log.info(`[${user.id}]`, 'UtioBot ukončen');
      } catch (err) {
        await Log.warn(`[${user.id}]`, `Chyba při ukončování UtioBot: ${err.message}`);
      }
    }
  }
}

/**
 * Získá dostupné akce z databáze s aplikovanými limity
 */
async function getAvailableActions(userId, invasiveLock) {
  // Načti akce s limity z DB
  const actionsWithLimits = await db.getUserActionsWithLimits(userId);
  
  if (!actionsWithLimits || !actionsWithLimits.length) {
    return [];
  }

  // Mapuj na wheel items
  let wheelItems = actionsWithLimits.map(def => ({
    code: def.action_code,
    weight: def.weight,
    effective_weight: def.effective_weight,
    min_minutes: def.min_minutes,
    max_minutes: def.max_minutes,
    repeatable: def.repeatable,
    is_invasive: def.invasive === 1 || def.invasive === true
  }));

  // Filtruj invazivní akce během invasive lock
  if (invasiveLock.isActive()) {
    const originalCount = wheelItems.length;
    wheelItems = wheelItems.filter(item => !item.is_invasive);
    
    const filtered = originalCount - wheelItems.length;
    if (filtered > 0) {
      Log.info('[WHEEL]', `Odstraněno ${filtered} invazivních akcí kvůli aktivnímu locku (zbývá ${invasiveLock.getRemainingSeconds()}s)`);
    }
  }

  return wheelItems;
}

/**
 * Kontroluje, zda je kolo prázdné (pouze ending akce)
 */
function isWheelEmpty(actions) {
  return !actions.some(a => !['account_delay', 'account_sleep'].includes(a.code));
}

/**
 * Zajistí kompletní action plan pro uživatele
 */
async function ensureCompleteActionPlan(userId) {
  try {
    // Získat chybějící akce jedním SQL dotazem
    const missingActions = await db.safeQueryAll('actions.getMissingActionsForUser', [userId], true);
    
    if (missingActions && missingActions.length > 0) {
      // Vytvořit chybějící akce
      for (const action of missingActions) {
        await db.safeExecute('actions.createUserAction', [userId, action.action_code]);
      }
      
      Log.success(`[${userId}]`, `Vytvořeno ${missingActions.length} chybějících akcí v plánovači`);
    }
  } catch (err) {
    await Log.error(`[${userId}]`, `Chyba při vytváření action plan: ${err.message}`);
  }
}

/**
 * Zajistí že uživatel má ukončovací akce v plánovači
 */
async function ensureEndingActions(userId) {
  // Už není potřeba - ensureAllActionsForUser vytvoří všechny akce včetně ukončovacích
}

/**
 * Zpracuje prázdné kolo - vrátí ending akci
 */
async function handleEmptyWheel(user, actions) {
  Log.info(`[${user.id}]`, 'Kolo štěstí vyprázdněno');
  
  const endingActions = actions.filter(a => 
    ['account_delay', 'account_sleep'].includes(a.code) && a.effective_weight > 0
  );
  
  if (endingActions.length === 0) {
    Log.info(`[${user.id}]`, 'Žádné ukončující akce k dispozici');
    return null;
  }

  const wheel = new Wheel(endingActions);
  return wheel.pick();
}

/**
 * Losuje akci z dostupných
 */
function pickAction(actions) {
  const normalActions = actions.filter(a => 
    !['account_delay', 'account_sleep'].includes(a.code) && a.effective_weight > 0
  );
  
  if (normalActions.length === 0) return null;
  
  const wheel = new Wheel(normalActions);
  return wheel.pick();
}

/**
 * Zpracuje situaci kdy není k dispozici žádná akce
 * Sekvence podle uživatele: zavřít prohlížeč → losovat account_delay/account_sleep → ukončit wheel
 */
async function handleNoAction(user, invasiveLock, availableActions) {
  if (invasiveLock.isActive()) {
    Log.info(`[${user.id}]`, `Čekání na invasive lock (${invasiveLock.getRemainingSeconds()}s)`);
    await Wait.toSeconds(10, 'Pauza po selhání');
    return null; // Pokračovat v wheel
  } 
  
  Log.info(`[${user.id}]`, 'Nejsou dostupné žádné akce - získávám ukončovací akce');
  
  // Získat ukončovací akce přímo z databáze
  const endingActions = await db.safeQueryAll('actions.getEndingActions', [user.id]);
  
  if (!endingActions || endingActions.length === 0) {
    await Log.error(`[${user.id}]`, 'CHYBA: Žádné ukončující akce (account_sleep/delay) v plánovači - ukončuji bez akce');
    return null;
  }

  // Losovat mezi account_delay a account_sleep
  const wheel = new Wheel(endingActions);
  const endingAction = wheel.pick();
  
  if (endingAction) {
    Log.info(`[${user.id}]`, `Vylosována ukončovací akce: ${endingAction.code}`);
    return endingAction;
  }
  
  return null;
}

/**
 * Vypočítá cooldown pro invasive lock
 */
function calculateInvasiveCooldown() {
  const cooldownConfig = config.get('cfg_posting_cooldown', { 
    min_seconds: 150, 
    max_seconds: 300 
  });
  
  // Fallback pro neplatné konfigurace
  const minSeconds = cooldownConfig?.min_seconds || 150;
  const maxSeconds = cooldownConfig?.max_seconds || 300;
  
  const cooldownMs = (minSeconds + Math.random() * (maxSeconds - minSeconds)) * 1000;
  
  Log.debug('[INVASIVE_LOCK]', `Vypočítán cooldown: ${Math.round(cooldownMs/1000)}s (${minSeconds}-${maxSeconds}s range)`);
  
  return cooldownMs;
}

/**
 * Zajistí že všechny aktivní akce existují v user_action_plan
 * Chybějící akce vytvoří s next_time = now() - 1 hour pro okamžitou dostupnost
 */
async function ensureAllActiveActionsExist(userId) {
  try {
    // Získej všechny aktivní akce z action_definitions
    const activeActions = await db.safeQueryAll('actions.getAllActiveActions');
    
    if (!activeActions || activeActions.length === 0) {
      Log.warn('[WHEEL]', `Žádné aktivní akce nalezeny v action_definitions`);
      return;
    }
    
    // Získej existující akce uživatele v plánu  
    const existingActions = await db.safeQueryAll('actions.getUserPlanActions', [userId]);
    
    const existingCodes = new Set(existingActions?.map(a => a.action_code) || []);
    
    // Najdi chybějící akce
    const missingActions = activeActions.filter(action => 
      !existingCodes.has(action.action_code)
    );
    
    if (missingActions.length > 0) {
      Log.info('[WHEEL]', `Vytvářím ${missingActions.length} chybějících akcí pro uživatele ${userId}: [${missingActions.map(a => a.action_code).join(', ')}]`);
      
      // Vytvoř chybějící akce s next_time = now() - 1 hour (okamžitě dostupné)
      const pastTime = new Date();
      pastTime.setHours(pastTime.getHours() - 1);
      const pastTimeStr = pastTime.toISOString().slice(0, 19).replace('T', ' ');
      
      for (const action of missingActions) {
        await db.safeExecute('actions.createUserActionWithTime', [
          userId,
          action.action_code,
          pastTimeStr
        ]);
      }
      
      Log.info('[WHEEL]', `Úspěšně vytvořeno ${missingActions.length} chybějících akcí`);
    }
    
  } catch (err) {
    Log.error('[WHEEL]', `Chyba při zajišťování existence aktivních akcí: ${err.message}`);
  }
}

/**
 * Zkontroluje, zda má uživatel v plánu invazivní akce
 * @param {number} userId - ID uživatele
 * @returns {Promise<boolean>}
 */
async function checkPendingInvasiveActions(userId) {
  try {
    const invasiveActions = await db.safeQueryAll('actions.getInvasiveActionsInPlan', [userId]);
    return invasiveActions && invasiveActions.length > 0;
  } catch (err) {
    Log.error('[WHEEL]', `Chyba při kontrole invazivních akcí: ${err.message}`);
    return false;
  }
}