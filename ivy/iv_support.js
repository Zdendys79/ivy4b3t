/**
 * Název souboru: iv_support.js
 * Umístění: ~/ivy/iv_support.js
 *
 * Popis: Obecné pomocné funkce pro práci s uživateli, skupinami a UTIO
 * Moderní ESM modul s inline exporty
 * Facebook funkce přesunuty do iv_facebook_support.js
 */

import * as wait from './iv_wait.js';
import { db } from './iv_sql.js';
import md5 from 'md5';
import { Log } from './iv_log.class.js';
import * as fbSupport from './iv_facebook_support.js';

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

  Log.warn(`[${user.id}]`, `Nepodařilo se přidat do skupiny ${group.fb_id}`);
  return false;
}

/**
 * Zvýšení denního limitu uživatele
 */
export async function increase_user_limit(user) {
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
export async function decrease_user_limit(user) {
  let new_limit = Math.floor(2 * user.day_limit / 3);
  if (new_limit < 3) new_limit = 3;

  await db.setUserLimit(user, new_limit, user.day_limit);
  Log.warn(`[${user.id}]`, `Denní limit snížen na ${new_limit}`);
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
    Log.error('[REFERER]', err);
    return "https://www.google.cz";
  }
}

/**
 * Získá zprávu z UTIO a vloží ji do Facebooku pomocí schránky (Ctrl+V)
 * S předběžným ověřením připravenosti Facebook stránky
 */
export async function pasteMsg(user, group, fbBot, utioBot = null) {
  let message = false;
  let cnt = 0;

  try {
    // Ověření připravenosti před začátkem pomocí Facebook modulu
    Log.info(`[${user.id}]`, '🔍 Ověřuji připravenost před získáním zprávy z UTIO...');

    const readinessCheck = await fbSupport.verifyFacebookReadinessForUtio(user, group, fbBot);

    if (!readinessCheck.ready) {
      Log.error(`[${user.id}]`, `❌ Facebook není připraven: ${readinessCheck.reason}`);

      if (readinessCheck.critical) {
        return false; // Kritická chyba - ukončit
      }

      if (readinessCheck.shouldNavigate) {
        Log.info(`[${user.id}]`, 'Pokusím se přejít do správné skupiny...');
        const navigated = await fbBot.openGroup(group);
        if (!navigated) {
          Log.error(`[${user.id}]`, 'Nepodařilo se přejít do skupiny');
          return false;
        }

        // Znovu ověř po navigaci
        const recheckResult = await fbSupport.verifyFacebookReadinessForUtio(user, group, fbBot);
        if (!recheckResult.ready) {
          Log.error(`[${user.id}]`, `Ani po navigaci není připraveno: ${recheckResult.reason}`);
          return false;
        }
      } else {
        Log.warn(`[${user.id}]`, '⚠️ Pokračuji přes varování...');
      }
    }

    // Kontrola vstupních parametrů
    if (!user || !group || !fbBot) {
      Log.error('[SUPPORT]', 'pasteMsg: Chybí povinné parametry');
      return false;
    }

    if (!user.portal_id || !group.region_id || !group.district_id) {
      Log.error('[SUPPORT]', `pasteMsg: Chybí ID parametry - portal: ${user.portal_id}, region: ${group.region_id}, okres: ${group.district_id}`);
      return false;
    }

    // Zkontroluj dostupnost UTIO
    if (!utioBot || !utioBot.isReady()) {
      Log.error('[SUPPORT]', 'pasteMsg: UtioBot není k dispozici nebo není připraven');
      return false;
    }

    Log.success(`[${user.id}]`, '✅ Všechny předpoklady splněny, získávám zprávu z UTIO...');

    // Zapamatuj si aktuální stav před přepnutím na UTIO
    const facebookState = {
      url: fbBot.page.url(),
      title: await fbBot.page.title().catch(() => 'Unknown')
    };

    // Zkus získat zprávu z UTIO (max 5 pokusů)
    do {
      Log.info(`[${user.id}]`, `Pokus ${cnt + 1}/5 - získávám zprávu z UTIO...`);

      const m = await utioBot.getMessage(user.portal_id, group.region_id, group.district_id);

      if (!m || !Array.isArray(m) || m.length === 0) {
        Log.warn(`[${user.id}]`, `Pokus ${cnt + 1}: Žádná zpráva z UTIO`);
        cnt++;
        if (cnt < 5) {
          await wait.delay(2000);
        }
        continue;
      }

      const fullMessage = m.join('\n').trim();

      if (!fullMessage || fullMessage.length === 0) {
        Log.warn(`[${user.id}]`, `Pokus ${cnt + 1}: Prázdná zpráva z UTIO`);
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
          Log.warn(`[${user.id}]`, `Pokus ${cnt + 1}: Zpráva už byla použita (duplicita)`);
        }

      } catch (hashErr) {
        Log.error(`[${user.id}]`, `Chyba při vytváření MD5 hash: ${hashErr.message}`);
        message = [fullMessage];
        break;
      }

      cnt++;
      if (cnt < 5) {
        await wait.delay(1000);
      }

    } while (!message && cnt < 5);

    if (!message) {
      Log.error(`[${user.id}]`, 'Nepodařilo se získat platnou zprávu z UTIO po 5 pokusech');
      return false;
    }

    // Ověření Facebook stavu po návratu z UTIO
    try {
      Log.info(`[${user.id}]`, '🔄 Přepínám zpět na Facebook záložku...');

      if (!await fbBot.bringToFront()) {
        Log.error(`[${user.id}]`, 'Nepodařilo se přepnout na Facebook záložku');
        return false;
      }

      await wait.delay(1500 + Math.random() * 1500); // Stabilizace

      // Ověř že jsme stále ve správném stavu
      const postReturnCheck = await fbSupport.verifyStateAfterUtioReturn(user, group, fbBot, facebookState);
      if (!postReturnCheck.valid) {
        Log.error(`[${user.id}]`, `Problém po návratu z UTIO: ${postReturnCheck.reason}`);
        
        if (postReturnCheck.shouldReload) {
          Log.info(`[${user.id}]`, 'Pokusím se obnovit stránku...');
          await fbBot.page.reload();
          await wait.delay(3000);
        }
        
        return false;
      }

    } catch (returnErr) {
      Log.error(`[${user.id}]`, `Chyba při návratu z UTIO: ${returnErr.message}`);
      return false;
    }

    // Vložení zprávy do Facebooku
    Log.info(`[${user.id}]`, '📝 Vkládám zprávu do Facebook...');

    if (!await fbBot.pasteMessage(message[0])) {
      Log.error(`[${user.id}]`, 'Nepodařilo se vložit zprávu do Facebook');
      return false;
    }

    Log.success(`[${user.id}]`, '✅ Zpráva úspěšně vložena a publikována!');
    return message;

  } catch (err) {
    Log.error(`[${user.id}] UTIO`, err);
    return false;
  }
}

/**
 * Napsání zprávy místo vkládání ze schránky
 */
export async function writeMsg(user, messageText, fbBot) {
  try {
    Log.info(`[${user.id}]`, '✍️ Píšu zprávu do Facebook...');

    if (!messageText || messageText.trim().length === 0) {
      Log.error(`[${user.id}]`, 'writeMsg: Prázdná zpráva');
      return false;
    }

    // Použij FacebookBot funkci pro psaní
    if (!await fbBot.writeMessage(messageText)) {
      Log.error(`[${user.id}]`, 'Nepodařilo se napsat zprávu');
      return false;
    }

    Log.success(`[${user.id}]`, '✅ Zpráva úspěšně napsána a publikována!');
    return true;

  } catch (err) {
    Log.error(`[${user.id}] writeMsg`, err);
    return false;
  }
}

/**
 * Aktualizace statistik po úspěšném příspěvku
 */
export async function updatePostStats(group, user, actionCode) {
  try {
    // Aktualizuj čas posledního použití skupiny
    if (group && typeof db.updateGroupLastSeen === 'function') {
      await db.updateGroupLastSeen(group.id);
    }

    // Nastav další možný čas použití skupiny
    if (group && typeof db.updateGroupNextSeen === 'function') {
      const nextSeenMinutes = 120 + Math.random() * 360; // 2-8 hodin
      await db.updateGroupNextSeen(group.id, nextSeenMinutes);
    }

    // Aktualizuj statistiky uživatele
    if (typeof db.updateUserDayCount === 'function') {
      await db.updateUserDayCount(user.id);
    }

    // Zaloguj akci
    const referenceId = group ? group.id : '0';
    const actionText = group ? 
      `Post do skupiny: ${group.nazev || group.name || group.fb_id}` : 
      `Akce: ${actionCode}`;
    
    await db.logUserAction(user.id, actionCode, referenceId, actionText);

    const groupInfo = group ? group.fb_id : 'timeline';
    Log.success(`[${user.id}]`, `Statistiky aktualizovány pro ${groupInfo}`);
    return true;

  } catch (err) {
    Log.error('[SUPPORT]', `Chyba při aktualizaci statistik: ${err.message}`);
    return false;
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