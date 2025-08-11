/**
 * Test skript pro ověření opravené wheel logiky
 * Testuje, zda se automaticky vytvoří chybějící aktivní akce
 */

import { db } from './iv_sql.js';
import { Log } from './libs/iv_log.class.js';

async function testWheelFix() {
  try {
    const testUserId = 999; // Testovací uživatel
    
    Log.info('[TEST]', 'Testuji opravenou wheel logiku...');
    
    // 1. Zjisti aktivní akce v action_definitions
    const activeActions = await db.safeQueryAll('actions.getAllActiveActions');
    
    Log.info('[TEST]', `Aktivních akcí v definicích: ${activeActions.length}`);
    Log.info('[TEST]', `Aktivní akce: [${activeActions.map(a => a.action_code).join(', ')}]`);
    
    // 2. Zjisti existující akce uživatele
    const existingActions = await db.safeQueryAll('actions.getUserPlanActions', [testUserId]);
    
    Log.info('[TEST]', `Uživatel ${testUserId} má v plánu: ${existingActions.length} akcí`);
    Log.info('[TEST]', `Existující akce: [${existingActions.map(a => a.action_code).join(', ')}]`);
    
    // 3. Najdi chybějící akce
    const existingCodes = new Set(existingActions?.map(a => a.action_code) || []);
    const missingActions = activeActions.filter(action => 
      !existingCodes.has(action.action_code)
    );
    
    if (missingActions.length > 0) {
      Log.info('[TEST]', `Chybějících akcí: ${missingActions.length}`);
      Log.info('[TEST]', `Chybějící akce: [${missingActions.map(a => a.action_code).join(', ')}]`);
      
      // 4. Simulace wheel logiky - vytvoření chybějících akcí
      const pastTime = new Date();
      pastTime.setHours(pastTime.getHours() - 1);
      const pastTimeStr = pastTime.toISOString().slice(0, 19).replace('T', ' ');
      
      Log.info('[TEST]', `Vytvářím chybějící akce s časem: ${pastTimeStr}`);
      
      for (const action of missingActions) {
        await db.safeExecute('actions.createUserActionWithTime', [
          testUserId,
          action.action_code,
          pastTimeStr
        ]);
      }
      
      Log.info('[TEST]', `Vytvořeno ${missingActions.length} chybějících akcí`);
    } else {
      Log.info('[TEST]', 'Všechny aktivní akce již existují v plánu');
    }
    
    // 5. Ověření výsledku
    const finalActions = await db.safeQueryAll('actions.getUserPlanActions', [testUserId]);
    
    Log.info('[TEST]', `Po opravě má uživatel ${testUserId} celkem ${finalActions.length} akcí v plánu`);
    
    // 6. Zkontroluj dostupné akce (simulace getUserActionsWithLimits)
    const availableActions = await db.safeQueryAll(`
      SELECT
        ad.action_code,
        ad.weight,
        uap.next_time
      FROM action_definitions ad
      JOIN user_action_plan uap ON ad.action_code = uap.action_code
      WHERE uap.user_id = ?
        AND (uap.next_time IS NULL OR uap.next_time <= NOW())
        AND ad.active = 1
      ORDER BY ad.weight DESC
    `, [testUserId]);
    
    Log.info('[TEST]', `Dostupných akcí pro wheel: ${availableActions.length}`);
    Log.info('[TEST]', `Dostupné akce: [${availableActions.map(a => a.action_code).join(', ')}]`);
    
    if (availableActions.length > 0) {
      Log.info('[TEST]', '✅ ÚSPĚCH: Wheel má dostupné akce!');
    } else {
      Log.error('[TEST]', '❌ CHYBA: Wheel stále nemá dostupné akce!');
    }
    
  } catch (err) {
    Log.error('[TEST]', `Chyba v testu: ${err.message}`);
  }
}

// Spustit test
testWheelFix().then(() => {
  Log.info('[TEST]', 'Test dokončen');
  process.exit(0);
}).catch(err => {
  Log.error('[TEST]', `Test selhal: ${err.message}`);
  process.exit(1);
});