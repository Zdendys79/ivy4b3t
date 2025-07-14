/**
 * Název souboru: iv_support.js
 * Umístění: ~/ivy/iv_support.js
 *
 * Popis: Obecné pomocné funkce pro práci s uživateli, skupinami a UTIO
 * Moderní ESM modul s inline exporty
 * FB funkce přesunuty do iv_fb_support.js
 */

// NPM packages - default imports
import md5 from 'md5';

// Local modules - named imports (UPDATED)
import * as wait from './iv_wait.js';
import { db } from './iv_sql.js';
import { Log } from './libs/iv_log.class.js';

// FB support module - namespace import (specific case)
// Keeping namespace import as iv_fb_support.js contains many specialized functions
// that are used conditionally and don't justify individual named imports
import * as fbSupport from './iv_fb_support.js';

import { exec } from 'child_process';
import path from 'path';

/**
 * Získá informace o aktuálním stavu Git repozitáře
 * @returns {Promise<Object>}
 */
export async function getGitInfo() {
  return new Promise((resolve) => {
    const repoDir = path.resolve(process.cwd(), '..'); // Předpokládáme, že skript běží z /ivy, takže repo je o úroveň výš
    const scriptPath = path.resolve(process.cwd(), 'git-common.sh');
    // Správný způsob volání: spustit bash, v něm sourcnout skript a pak zavolat funkci s cestou k repu
    const command = `bash -c "source ${scriptPath} && get_git_info_json ${repoDir}"`;
    
    exec(command, (error, stdout, stderr) => {
      if (error) {
        Log.error('[GIT]', `Chyba při získávání Git informací: ${stderr}`);
        return resolve({ branch: 'unknown' }); // Vracíme defaultní objekt
      }
      try {
        if (!stdout) {
          throw new Error('Git script returned empty output.');
        }
        const info = JSON.parse(stdout);
        resolve(info);
      } catch (parseError) {
        Log.error('[GIT]', `Chyba při parsování Git informací: ${parseError.message}`);
        Log.debug('[GIT]', `Raw output from script: ${stdout}`);
        resolve({ branch: 'unknown' }); // Vracíme defaultní objekt
      }
    });
  });
}

/**
 * Přidání uživatele do skupiny
 */
export async function addMeToGroup(user, group, fbBot) {
  const today = new Date().toISOString().split('T')[0];
  if (user.last_add_group === today) return false;

  const success = await fbBot.addMeToGroup();
  if (success) {
    await db.updateUserAddGroup(user, group.id);
    Log.success(`[${user.id}]`, `Úspěšné přidání do skupiny ${group.fb_id}`);
    return true;
  }

  await Log.warn(`[${user.id}]`, `Nepodařilo se přidat do skupiny ${group.fb_id}`);
  return false;
}

/**
 * Zvýšení denního limitu uživatele
 */
export async function increaseUserLimit(user) {
  let nowDate = new Date();
  const tzoffset = nowDate.getTimezoneOffset();
  nowDate = new Date(nowDate.getTime() + (tzoffset * 60 * 1000));

  if (user.day_limit_updated === nowDate.toISOString().split('T')[0]) return false;

  let new_limit = 1 + user.day_limit;
  if (new_limit > user.max_limit) new_limit = user.max_limit;
  if (new_limit === user.day_limit) return false;

  await db.setUserLimit(user, new_limit, user.day_limit);
  Log.success(`[${user.id}]`, `Denní limit navýšen na ${new_limit}`);
  return true;
}

/**
 * Snížení denního limitu uživatele
 */
export async function decreaseUserLimit(user) {
  let new_limit = Math.floor(2 * user.day_limit / 3);
  if (new_limit < 3) new_limit = 3;

  await db.setUserLimit(user, new_limit, user.day_limit);
  await Log.warn(`[${user.id}]`, `Denní limit snížen na ${new_limit}`);
}

/**
 * Získání náhodného refereru z databáze
 */
export async function randomReferer() {
  try {
    const result = await db.getRandomReferer();
    const selected = result.url;
    Log.db('[REFERER]', `Použit referer z DB: ${selected}`);
    return selected;
  } catch (err) {
    await Log.error('[REFERER]', err);
    return "https://www.google.cz";
  }
}

/**
 * Získá zprávu z UTIO a vloží ji do FBu pomocí schránky (Ctrl+V)
 * S předběžným ověřením připravenosti FB stránky
 */
export async function pasteMsg(user, group, fbBot, utioBot = null) {
  let message = false;
  let cnt = 0;

  try {
    // Ověření připravenosti před začátkem pomocí FB modulu
    Log.info(`[${user.id}]`, '🔍 Ověřuji připravenost před získáním zprávy z UTIO...');

    const readinessCheck = await fbSupport.verifyFBReadinessForUtio(user, group, fbBot);

    if (!readinessCheck.ready) {
      await Log.error(`[${user.id}]`, `❌ FB není připraven: ${readinessCheck.reason}`);
      // Vždy ukončit, pokud FB není připraven
      return false;
    }

    // Kontrola vstupních parametrů
    if (!user || !group || !fbBot) {
      await Log.error('[SUPPORT]', 'pasteMsg: Chybí povinné parametry');
      return false;
    }

    if (!user.portal_id || !group.region_id || !group.district_id) {
      await Log.error('[SUPPORT]', `pasteMsg: Chybí ID parametry - portal: ${user.portal_id}, region: ${group.region_id}, okres: ${group.district_id}`);
      return false;
    }

    // Zkontroluj dostupnost UTIO
    if (!utioBot || !utioBot.isReady()) {
      await Log.error('[SUPPORT]', 'pasteMsg: UtioBot není k dispozici nebo není připraven');
      return false;
    }

    Log.success(`[${user.id}]`, '✅ Všechny předpoklady splněny, získávám zprávu z UTIO...');

    // Zapamatuj si aktuální stav před přepnutím na UTIO
    const FBState = {
      url: fbBot.page.url(),
      title: await fbBot.page.title().catch(() => 'Unknown')
    };

    // Zkus získat zprávu z UTIO (max 5 pokusů)
    do {
      Log.info(`[${user.id}]`, `Pokus ${cnt + 1}/5 - získávám zprávu z UTIO...`);

      const m = await utioBot.getMessage(user.portal_id, group.region_id, group.district_id);

      if (!m || !Array.isArray(m) || m.length === 0) {
        await Log.warn(`[${user.id}]`, `Pokus ${cnt + 1}: Žádná zpráva z UTIO`);
        cnt++;
        if (cnt < 5) {
          await wait.delay(2000);
        }
        continue;
      }

      const fullMessage = m.join('\n').trim() + ' ';

      if (!fullMessage || fullMessage.length === 0) {
        await Log.warn(`[${user.id}]`, `Pokus ${cnt + 1}: Prázdná zpráva z UTIO`);
        cnt++;
        if (cnt < 5) {
          await wait.delay(2000);
        }
        continue;
      }

      Log.info(`[${user.id}]`, `Pokus ${cnt + 1}: Zpráva získána, ověřuji duplicitu...`);

      // Ověř, že zpráva nebyla už použita (kontrola MD5)
      try {
        const messageHash = md5(fullMessage);
        Log.info(`[${user.id}]`, `Kontroluji duplicitu pro hash: ${messageHash.substring(0, 8)}...`);

        const isDuplicate = await db.verifyMsg(group.id, messageHash);
        if (!isDuplicate || isDuplicate.c === 0) {
          message = [fullMessage]; // Celá zpráva jako jeden řetězec
          Log.success(`[${user.id}]`, `Zpráva prošla kontrolou duplicity`);
          break;
        } else {
          await Log.warn(`[${user.id}]`, `Pokus ${cnt + 1}: Zpráva už byla použita (duplicita)`);
        }

      } catch (hashErr) {
        await Log.error(`[${user.id}]`, `Chyba při vytváření MD5 hash: ${hashErr.message}`);
        message = [fullMessage];
        break;
      }

      cnt++;
      if (cnt < 5) {
        await wait.delay(1000);
      }

    } while (!message && cnt < 5);

    if (!message) {
      await Log.error(`[${user.id}]`, 'Nepodařilo se získat platnou zprávu z UTIO po 5 pokusech');
      return false;
    }

    // Ověření FB stavu po návratu z UTIO
    try {
      Log.info(`[${user.id}]`, '🔄 Přepínám zpět na FB záložku...');

      if (!await fbBot.bringToFront()) {
        await Log.error(`[${user.id}]`, 'Nepodařilo se přepnout na FB záložku');
        return false;
      }

      await wait.delay(1500 + Math.random() * 1500); // Stabilizace

      // Ověř že jsme stále ve správném stavu
      const postReturnCheck = await fbSupport.verifyStateAfterUtioReturn(user, group, fbBot, FBState);
      if (!postReturnCheck.valid) {
        await Log.error(`[${user.id}]`, `Problém po návratu z UTIO: ${postReturnCheck.reason}`);

        if (postReturnCheck.shouldReload) {
          Log.info(`[${user.id}]`, 'Pokusím se obnovit stránku...');
          await fbBot.page.reload();
          await wait.delay(3000);
        }

        return false;
      }

    } catch (returnErr) {
      await Log.error(`[${user.id}]`, `Chyba při návratu z UTIO: ${returnErr.message}`);
      return false;
    }

    // Vložení zprávy do FBu
    Log.info(`[${user.id}]`, '📝 Vkládám zprávu do FB...');

    // Dodatečná stabilizace po návratu z UTIO
    Log.info(`[${user.id}]`, '⏱️ Dodatečná stabilizace před otevřením dialogu...');
    await wait.delay(3000 + Math.random() * 2000); // 3-5 sekund

    // 1. Použij již nalezený element pro psaní příspěvku nebo fallback elementy
    let postingMethod = 'direct'; // direct, discussion, join
    
    // Zkus použít primární element "Napište něco"
    if (fbBot.newThingElement) {
      try {
        const elementExists = await fbBot.page.evaluate((el) => {
          return el && el.isConnected && el.offsetParent !== null;
        }, fbBot.newThingElement);
        
        if (!elementExists) {
          Log.warn(`[${user.id}]`, 'Element pro psaní příspěvku již není platný, hledám znovu...');
          if (!await fbBot.newThing()) {
            Log.info(`[${user.id}]`, 'Přepínám na fallback metodu...');
            postingMethod = 'fallback';
          }
        }
      } catch (err) {
        Log.warn(`[${user.id}]`, `Chyba při ověřování elementu: ${err.message}, přepínám na fallback...`);
        postingMethod = 'fallback';
      }
    } else {
      // Pokud nebyl nalezen "Napište něco", použij fallback
      postingMethod = 'fallback';
    }
    
    // Fallback metoda - použij "Diskuze" nebo "Přidat se ke skupině"
    if (postingMethod === 'fallback') {
      Log.info(`[${user.id}]`, '🔄 Používám fallback metodu pro posting...');
      
      // Zkus kliknout na "Diskuze" pokud existuje
      if (fbBot.discussionElement) {
        Log.info(`[${user.id}]`, '🔄 Pokouším se kliknout na "Diskuze"...');
        if (await fbBot.clickDiscus()) {
          await wait.delay(3000 + Math.random() * 2000); // Čekání na načtení
          // Po kliknutí na diskuze zkus najít "Napište něco" znovu
          if (await fbBot.newThing()) {
            postingMethod = 'discussion';
          }
        }
      }
      
      // Pokud diskuze nefunguje, zkus "Přidat se ke skupině"
      if (postingMethod === 'fallback' && fbBot.joinGroupElement) {
        Log.info(`[${user.id}]`, '🔄 Pokouším se kliknout na "Přidat se ke skupině"...');
        if (await fbBot.joinToGroup()) {
          await wait.delay(5000 + Math.random() * 3000); // Čekání na přidání
          // Po přidání do skupiny zkus najít "Napište něco" znovu
          if (await fbBot.newThing()) {
            postingMethod = 'join';
          }
        }
      }
      
      // Pokud žádná fallback metoda nefunguje
      if (postingMethod === 'fallback') {
        await Log.error(`[${user.id}]`, 'Žádná metoda pro posting není k dispozici');
        return false;
      }
      
      Log.success(`[${user.id}]`, `✅ Fallback metoda "${postingMethod}" úspěšná`);
    }
    
    // Ověř, že máme element pro psaní
    if (!fbBot.newThingElement) {
      await Log.error(`[${user.id}]`, 'Element pro psaní příspěvku není k dispozici ani po fallback metodách');
      return false;
    }

    if (!await fbBot.clickNewThing()) {
      await Log.error(`[${user.id}]`, 'Nepodařilo se kliknout na pole pro psaní příspěvku');
      return false;
    }

    // Pauza po otevření dialogu
    await wait.delay(2000 + Math.random() * 1000); // 2-3 sekundy

    // 2. Vloži text příspěvku pomocí schránky
    if (!await fbBot.pasteStatement(message[0], true)) { // true = použij schránku pro UTIO
      await Log.error(`[${user.id}]`, 'Nepodařilo se vložit zprávu do FB');
      return false;
    }

    // 3. Odešli příspěvek
    if (!await fbBot.clickSendButton()) {
      throw new Error('Nepodařilo se odeslat příspěvek (clickSendButton selhalo)');
    }

    Log.success(`[${user.id}]`, '✅ Zpráva úspěšně vložena a publikována!');
    return message;

  } catch (err) {
    await Log.error(`[${user.id}] pasteMsg`, err);
    return false;
  }
}

/**
 * Napsání zprávy místo vkládání ze schránky
 */
export async function writeMsg(user, messageText, fbBot) {
  try {
    Log.info(`[${user.id}]`, '✍️ Píšu zprávu do FB...');

    if (!messageText || messageText.trim().length === 0) {
      await Log.error(`[${user.id}]`, 'writeMsg: Prázdná zpráva');
      return false;
    }

    // Použij FBBot funkci pro psaní
    if (!await fbBot.writeMessage(messageText)) {
      await Log.error(`[${user.id}]`, 'Nepodařilo se napsat zprávu');
      return false;
    }

    Log.success(`[${user.id}]`, '✅ Zpráva úspěšně napsána a publikována!');
    return true;

  } catch (err) {
    await Log.error(`[${user.id}] writeMsg`, err);
    return false;
  }
}

/**
 * Aktualizace statistik po úspěšném příspěvku
 */
export async function updatePostStats(group, user, actionCode) {
  try {
    // Aktualizuj čas posledního použití skupiny
    if (group) {
      await db.updateGroupLastSeen(group.id);
    }

    // Nastav další možný čas použití skupiny
    if (group) {
      const nextSeenMinutes = Math.round(120 + Math.random() * 360); // 2-8 hodin
      await db.updateGroupNextSeen(group.id, nextSeenMinutes);
    }

    // Aktualizuj statistiky uživatele
    await db.updateUserDayCount(user.id);

    // Zaloguj akci
    const referenceId = group ? group.id : '0';
    const actionText = group ?
      `Post do skupiny: ${group.name || group.name || group.fb_id}` :
      `Akce: ${actionCode}`;

    await db.logUserAction(user.id, actionCode, referenceId, actionText);

    const groupInfo = group ? group.fb_id : 'timeline';
    Log.success(`[${user.id}]`, `Statistiky aktualizovány pro ${groupInfo}`);
    return true;

  } catch (err) {
    await Log.error('[SUPPORT]', `Chyba při aktualizaci statistik: ${err.message}`);
    return false;
  }
}

/**
 * Zavře prázdné záložky v browseru
 * @param {Object} context - Browser context
 * @returns {Promise<void>}
 */
export async function closeBlankTabs(context) {
  try {
    const pages = await context.pages();
    if (!pages || pages.length === 0) {
      Log.info('[BROWSER]', 'Žádné záložky k zavření');
      return;
    }
    let closedCount = 0;
    for (const page of pages) {
      try {
        const title = await page.title();
        const url = page.url();
        if ((title === '' || title === 'about:blank') && url === 'about:blank') {
          if (pages.length > 1) {
            Log.info('[BROWSER]', 'Zavírám prázdnou výchozí záložku.');
            await page.close();
            closedCount++;
          }
        }
      } catch (err) {
        await Log.warn('[BROWSER]', `Chyba při kontrole záložky: ${err.message}`);
      }
    }
    if (closedCount > 0) {
      Log.info('[BROWSER]', `Zavřeno ${closedCount} prázdných záložek`);
    }
  } catch (err) {
    await Log.error('[BROWSER]', `Chyba při zavírání prázdných záložek: ${err.message}`);
  }
}

/**
 * Generuje náhodnou pauzu před akcí na základě typu akce
 */
export async function humanPause(actionType = 'default') {
  let minDelay, maxDelay;

  switch (actionType) {
    case 'post':
      minDelay = 2000;
      maxDelay = 8000;
      break;
    case 'comment':
      minDelay = 1000;
      maxDelay = 4000;
      break;
    case 'like':
      minDelay = 500;
      maxDelay = 2000;
      break;
    case 'browse':
      minDelay = 1000;
      maxDelay = 5000;
      break;
    default:
      minDelay = 500;
      maxDelay = 2000;
      break;
  }

  const delay = minDelay + Math.random() * (maxDelay - minDelay);
  await wait.delay(delay, false);
}
