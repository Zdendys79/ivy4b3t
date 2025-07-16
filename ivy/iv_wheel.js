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
import { UIBot } from './libs/iv_ui.class.js';
import { IvMath } from './libs/iv_math.class.js';
import * as wait from './iv_wait.js';

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

  // Inicializace
  invasiveLock.init();
  await db.initUserActionPlan(user.id);
  
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
    Log.error(`[${user.id}]`, `Chyba při inicializaci FBBot: ${err.message}`);
    throw err;
  }

  try {
    // Hlavní smyčka
    while (true) {
      // 1. Kontrola consecutive failures
      if (consecutiveFailures >= config.consecutive_failures_limit) {
        await Log.error(`[${user.id}]`, `🚨 ${consecutiveFailures} neúspěšných akcí za sebou`);
        
        // Pro ukončovací akce nepotřebujeme FBBot
        const endingContext = { browser, ...context };
        await actionRouter.executeAction('account_delay', user, endingContext, {});
        break;
      }

      // 2. Získání dostupných akcí
      const availableActions = await getAvailableActions(user.id, invasiveLock);
      
      // 3. Kontrola prázdného kola
      if (isWheelEmpty(availableActions)) {
        const endingAction = await handleEmptyWheel(user, availableActions);
        if (endingAction) {
          // Pro ukončovací akce nepotřebujeme FBBot
          const endingContext = { browser, ...context };
          await actionRouter.executeAction(endingAction.code, user, endingContext, {});
        }
        break;
      }

      // 4. Losování akce
      const pickedAction = pickAction(availableActions);
      if (!pickedAction) {
        await handleNoAction(user, invasiveLock);
        continue;
      }

      Log.info(`[${user.id}]`, `Vylosována akce #${actionCount + 1}: ${pickedAction.code}`);

      // 5. Provedení akce
      const actionContext = {
        browser,
        fbBot,
        ...context
      };
      const success = await actionRouter.executeAction(pickedAction.code, user, actionContext, pickedAction);
      
      if (!success) {
        consecutiveFailures++;
        await Log.warn(`[${user.id}]`, `Akce ${pickedAction.code} NEPROVEDENA`);
      } else {
        consecutiveFailures = 0;
        Log.success(`[${user.id}]`, `Akce ${pickedAction.code} úspěšně dokončena`);
        
        // Nastavení invasive lock po úspěšné invazivní akci
        if (pickedAction.is_invasive) {
          const cooldownMs = calculateInvasiveCooldown();
          invasiveLock.set(cooldownMs);
          Log.info(`[${user.id}]`, `🔒 Invasive lock nastaven na ${invasiveLock.getRemainingSeconds()}s`);
        }
      }

      actionCount++;

      // 6. Kontrola UI příkazů
      const uiBot = new UIBot();
      const uiCommand = await uiBot.checkForCommand();
      await uiBot.close();
      
      if (uiCommand) {
        Log.info(`[${user.id}]`, 'Detekován UI příkaz - ukončuji kolo štěstí');
        // FBBot se ukončí v finally bloku
        return { stoppedByUI: true };
      }

      // 7. Pauza mezi akcemi
      await wait.delay(IvMath.randInterval(config.wheel_action_delay_min, config.wheel_action_delay_max));
    }

    Log.success(`[${user.id}]`, `Kolo štěstí dokončeno. Provedeno ${actionCount} akcí`);
    return { stoppedByUI: false };

  } catch (err) {
    await Log.error(`[${user.id}]`, `Chyba v kole štěstí: ${err.message}`);
    throw err;
  } finally {
    // Ukončení FBBot na konci práce s uživatelem
    if (fbBot) {
      try {
        await fbBot.close();
        Log.info(`[${user.id}]`, 'FBBot úspěšně ukončen');
      } catch (err) {
        Log.warn(`[${user.id}]`, `Chyba při ukončování FBBot: ${err.message}`);
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
  //return wheel.pick();
  // Z důvodu testování volíme právě jednu akci:
  const quotePostAction = normalActions.find(a => a.code === 'quote_post');
  return quotePostAction;
}

/**
 * Zpracuje situaci kdy není k dispozici žádná akce
 */
async function handleNoAction(user, invasiveLock) {
  if (invasiveLock.isActive()) {
    Log.info(`[${user.id}]`, `Čekání na invasive lock (${invasiveLock.getRemainingSeconds()}s)`);
    // Zde by mohla být neškodná aktivita, ale neděláme fallbacky
  } else {
    Log.info(`[${user.id}]`, 'Nejsou dostupné žádné akce');
  }
  
  await wait.delay(IvMath.randInterval(5000, 10000));
}

/**
 * Vypočítá cooldown pro invasive lock
 */
function calculateInvasiveCooldown() {
  const cooldownConfig = config.get('cfg_posting_cooldown', { 
    min_seconds: 120, 
    max_seconds: 240 
  });
  
  return (cooldownConfig.min_seconds + 
          Math.random() * (cooldownConfig.max_seconds - cooldownConfig.min_seconds)) * 1000;
}

// Export pro kompatibilitu
export { InvasiveLock };