/**
 * Název souboru: iv_support.js
 * Umístění: ~/ivy/iv_support.js
 *
 * Popis: Obsahuje pomocné funkce pro práci s uživateli, skupinami, postování zpráv,
 *         zvyšování denních limitů a získávání dat z UTIO portálu.
 *         Aktualizováno pro použití nové UtioBot třídy.
 */

import * as wait from './iv_wait.js';
import * as db from './iv_sql.js';
import md5 from 'md5';
import { Log } from './iv_log.class.js';

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

export async function decrease_user_limit(user) {
  let new_limit = Math.floor(2 * user.day_limit / 3);
  if (new_limit < 3) new_limit = 3;

  await db.setUserLimit(user, new_limit, user.day_limit);
  Log.warn(`[${user.id}]`, `Denní limit snížen na ${new_limit}`);
}

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
 * Získá zprávu z UTIO a vloží ji do Facebooku
 * @param {Object} user - Uživatelské data
 * @param {Object} group - Data skupiny
 * @param {Object} fbBot - FacebookBot instance
 * @param {Object} utioBot - UtioBot instance (optional pro zpětnou kompatibilitu)
 * @returns {string|false} Text zprávy nebo false při chybě
 */
export async function pasteMsg(user, group, fbBot, utioBot = null) {
  let message = false;
  let cnt = 0;

  try {
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

    Log.info(`[${user.id}]`, 'Získávám zprávu z UTIO...');

    // Zkus získat zprávu z UTIO (max 5 pokusů)
    do {
      Log.info(`[${user.id}]`, `Pokus ${cnt + 1}/5 - získávám zprávu z UTIO...`);

      const m = await utioBot.getMessage(user.portal_id, group.region_id, group.district_id);

      if (!m || !Array.isArray(m) || m.length === 0) {
        Log.warn(`[${user.id}]`, `Pokus ${cnt + 1}: Žádná zpráva z UTIO`);
        cnt++;
        await wait.delay(2000); // Počkej před dalším pokusem
        continue;
      }

      // Kontrola, že první řádek zprávy není prázdný
      if (!m[0] || typeof m[0] !== 'string' || m[0].trim().length === 0) {
        Log.warn(`[${user.id}]`, `Pokus ${cnt + 1}: První řádek zprávy je prázdný`);
        cnt++;
        continue;
      }

      Log.info(`[${user.id}]`, `Pokus ${cnt + 1}: Zpráva získána, ověřuji duplicitu...`);

      // Ověř, že zpráva nebyla už použita (kontrola MD5)
      try {
        const messageText = m[0].trim();
        const messageHash = md5(messageText);

        Log.info(`[${user.id}]`, `Kontroluji duplicitu pro hash: ${messageHash.substring(0, 8)}...`);

        const isDuplicate = await db.verifyMsg(group.id, messageHash);
        if (!isDuplicate || isDuplicate.c === 0) {
          message = m;
          Log.success(`[${user.id}]`, `Zpráva prošla kontrolou duplicity`);
          break;
        } else {
          Log.warn(`[${user.id}]`, `Pokus ${cnt + 1}: Zpráva už byla použita (duplicita)`);
        }

      } catch (hashErr) {
        Log.error(`[${user.id}]`, `Chyba při vytváření MD5 hash: ${hashErr}`);
        // Pokud se MD5 nepodaří, použij zprávu stejně (lepší než selhání)
        message = m;
        break;
      }

      cnt++;

      if (cnt < 5) {
        await wait.delay(1000); // Krátká pauza před dalším pokusem
      }

    } while (!message && cnt < 5);

    if (!message) {
      Log.error(`[${user.id}]`, 'Nepodařilo se získat platnou zprávu z UTIO po 5 pokusech');
      return false;
    }

  } catch (err) {
    Log.error(`[${user.id}] UTIO`, err);
    return false;
  }

  // Vložení zprávy do Facebooku
  try {
    Log.info(`[${user.id}]`, 'Vkládám zprávu do Facebooku...');

    if (!await fbBot.clickNewThing()) {
      Log.error(`[${user.id}]`, 'Nepodařilo se kliknout na pole pro psaní');
      return false;
    }

    const messageText = message[0].trim();
    const paste = await fbBot.pasteStatement(messageText);

    if (paste) {
      Log.success(`[${user.id}]`, `Zpráva vložena do skupiny ${group.fb_id}`);
      Log.info(`[${user.id}]`, `Text zprávy: "${messageText.substring(0, 100)}..."`);
      return messageText;
    } else {
      Log.error(`[${user.id}]`, 'Nepodařilo se vložit zprávu do pole');
      return false;
    }

  } catch (pasteErr) {
    Log.error(`[${user.id}]`, `Chyba při vkládání zprávy: ${pasteErr}`);
    return false;
  }
}

export async function closeBlankTabs(context) {
  const pages = await context.pages();

  for (const page of pages) {
    try {
      const title = await page.title();
      const url = page.url();

      if ((title === '' || title === 'about:blank') && url === 'about:blank') {
        if (pages.length > 1) {
          Log.info('[BROWSER]', 'Zavírám prázdnou výchozí záložku.');
          await page.close();
        } else {
          Log.warn('[BROWSER]', 'Nelze zavřít jedinou záložku.');
        }
      }
    } catch (err) {
      Log.error('[BROWSER]', err);
    }
  }
}
