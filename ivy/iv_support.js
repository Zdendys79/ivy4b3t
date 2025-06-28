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
 * Získá zprávu z UTIO a vloží ji do Facebooku pomocí schránky (Ctrl+V)
 * @param {Object} user - Uživatelské data
 * @param {Object} group - Data skupiny
 * @param {Object} fbBot - FacebookBot instance
 * @param {Object} utioBot - UtioBot instance
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
        if (cnt < 5) {
          await wait.delay(2000);
        }
        continue;
      }

      // UTIO zkopíruje celou zprávu do schránky - použijeme celý obsah
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

  } catch (err) {
    Log.error(`[${user.id}] UTIO`, err);
    return false;
  }

  // Vložení zprávy do Facebooku ze schránky
  try {
    Log.info(`[${user.id}]`, 'Vkládám zprávu do Facebooku...');

    // Lidské chování - krátká pauza před začátkem
    await wait.delay(500 + Math.random() * 1000);

    // Najdi pole pro psaní nového příspěvku
    if (!await fbBot.newThing()) {
      Log.error(`[${user.id}]`, 'Nepodařilo se najít pole pro psaní příspěvku');
      return false;
    }

    await wait.delay(wait.timeout());

    if (!await fbBot.clickNewThing()) {
      Log.error(`[${user.id}]`, 'Nepodařilo se kliknout na pole pro psaní');
      return false;
    }

    await wait.delay(wait.timeout());

    const messageText = message[0].trim();
    Log.info(`[${user.id}]`, `Vkládám zprávu ze schránky (${messageText.length} znaků)...`);

    // VLOŽENÍ ZE SCHRÁNKY pomocí Ctrl+V
    const paste = await fbBot.pasteFromClipboard();

    if (!paste) {
      Log.error(`[${user.id}]`, 'Nepodařilo se vložit zprávu ze schránky');
      return false;
    }

    // Lidské chování - přečteme si co jsme vložili
    Log.info(`[${user.id}]`, 'Kontroluji vložený text...');
    await wait.delay(2000 + Math.random() * 3000);

    // Občas si rozmyslíme a chvíli váhám před odesláním
    if (Math.random() < 0.2) {
      Log.info(`[${user.id}]`, 'Chvíli váhám před odesláním...');
      await wait.delay(3000 + Math.random() * 5000);
    }

    Log.info(`[${user.id}]`, 'Odesílám příspěvek...');

    // Odeslání příspěvku
    const sent = await fbBot.clickSendButton();

    if (!sent) {
      Log.error(`[${user.id}]`, 'Nepodařilo se odeslat příspěvek');
      return false;
    }

    // Lidské chování - krátká pauza po odeslání
    await wait.delay(1000 + Math.random() * 2000);

    Log.success(`[${user.id}]`, `Zpráva úspěšně publikována do skupiny ${group.fb_id}`);
    Log.info(`[${user.id}]`, `Text zprávy: "${messageText.substring(0, 100)}${messageText.length > 100 ? '...' : ''}"`);

    // Uložíme hash zprávy do databáze pro zabránění duplicit
    try {
      const messageHash = md5(messageText);
      if (typeof db.saveMessageHash === 'function') {
        await db.saveMessageHash(group.id, messageHash, messageText.substring(0, 50));
      }
    } catch (hashSaveErr) {
      Log.warn(`[${user.id}]`, `Nepodařilo se uložit hash zprávy: ${hashSaveErr.message}`);
    }

    return messageText;

  } catch (pasteErr) {
    Log.error(`[${user.id}]`, `Chyba při vkládání zprávy: ${pasteErr.message}`);
    return false;
  }
}

// Přidání do iv_support.js
/**
 * Napíše vlastní text na Facebook (pro citáty, komentáře atd.)
 * @param {Object} user - Uživatelské data
 * @param {string} text - Text k napsání
 * @param {Object} fbBot - FacebookBot instance
 * @returns {string|false} Text zprávy nebo false při chybě
 */
export async function writeMsg(user, text, fbBot) {
  try {
    // Kontrola vstupních parametrů
    if (!user || !text || !fbBot) {
      Log.error('[SUPPORT]', 'writeMsg: Chybí povinné parametry');
      return false;
    }

    if (!text.trim()) {
      Log.error('[SUPPORT]', 'writeMsg: Prázdný text');
      return false;
    }

    Log.info(`[${user.id}]`, `Píšu zprávu (${text.length} znaků)...`);

    // Najdi pole pro psaní nového příspěvku
    if (!await fbBot.newThing()) {
      Log.error(`[${user.id}]`, 'Nepodařilo se najít pole pro psaní příspěvku');
      return false;
    }

    await wait.delay(wait.timeout());

    if (!await fbBot.clickNewThing()) {
      Log.error(`[${user.id}]`, 'Nepodařilo se kliknout na pole pro psaní');
      return false;
    }

    await wait.delay(wait.timeout());

    // PÍŠEME text znak po znaku (lidské chování)
    const written = await fbBot.pasteStatement(text);

    if (!written) {
      Log.error(`[${user.id}]`, 'Nepodařilo se napsat text');
      return false;
    }

    // Lidské chování - přečteme si co jsme napsali
    Log.info(`[${user.id}]`, 'Kontroluji napsaný text...');
    await wait.delay(2000 + Math.random() * 3000);

    // Občas si rozmyslíme a chvíli váhám před odesláním
    if (Math.random() < 0.2) {
      Log.info(`[${user.id}]`, 'Chvíli váhám před odesláním...');
      await wait.delay(3000 + Math.random() * 5000);
    }

    Log.info(`[${user.id}]`, 'Odesílám příspěvek...');

    // Odeslání příspěvku
    const sent = await fbBot.clickSendButton();

    if (!sent) {
      Log.error(`[${user.id}]`, 'Nepodařilo se odeslat příspěvek');
      return false;
    }

    await wait.delay(1000 + Math.random() * 2000);

    Log.success(`[${user.id}]`, `Zpráva úspěšně napsána a publikována`);
    Log.info(`[${user.id}]`, `Text zprávy: "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"`);

    return text;

  } catch (err) {
    Log.error(`[${user.id}] writeMsg`, err);
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
          } else {
            Log.warn('[BROWSER]', 'Nelze zavřít jedinou záložku.');
          }
        }
      } catch (err) {
        Log.warn('[BROWSER]', `Chyba při kontrole záložky: ${err.message}`);
      }
    }

    if (closedCount > 0) {
      Log.info('[BROWSER]', `Zavřeno ${closedCount} prázdných záložek`);
    }

  } catch (err) {
    Log.error('[BROWSER]', `Chyba při zavírání prázdných záložek: ${err.message}`);
  }
}

/**
 * Ověří, zda skupina splňuje podmínky pro postování
 * @param {Object} group - Data skupiny
 * @param {Object} user - Data uživatele
 * @returns {Promise<boolean>} True pokud lze do skupiny postovat
 */
export async function canPostToGroup(group, user) {
  try {
    // Kontrola základních parametrů
    if (!group || !group.fb_id || !user || !user.id) {
      Log.warn('[SUPPORT]', 'canPostToGroup: Chybí povinné parametry');
      return false;
    }

    // Kontrola, zda skupina není zablokována
    if (group.blocked || group.status === 'blocked') {
      Log.warn(`[${user.id}]`, `Skupina ${group.fb_id} je zablokována`);
      return false;
    }

    // Kontrola časového okna pro skupinu
    if (group.next_seen && new Date(group.next_seen) > new Date()) {
      Log.info(`[${user.id}]`, `Skupina ${group.fb_id} je v časovém okně (next_seen: ${group.next_seen})`);
      return false;
    }

    // Kontrola denních limitů uživatele
    if (user.day_count >= user.day_limit) {
      Log.info(`[${user.id}]`, `Dosažen denní limit uživatele (${user.day_count}/${user.day_limit})`);
      return false;
    }

    return true;

  } catch (err) {
    Log.error('[SUPPORT]', `Chyba při kontrole skupiny: ${err.message}`);
    return false;
  }
}

/**
 * Aktualizuje statistiky po úspěšném postování
 * @param {Object} group - Data skupiny
 * @param {Object} user - Data uživatele
 * @param {string} actionCode - Kód akce
 * @returns {Promise<boolean>} True pokud bylo úspěšné
 */
export async function updatePostStats(group, user, actionCode) {
  try {
    // Aktualizuj čas posledního použití skupiny
    if (typeof db.updateGroupLastSeen === 'function') {
      await db.updateGroupLastSeen(group.id);
    }

    // Nastav další možný čas použití skupiny
    if (typeof db.updateGroupNextSeen === 'function') {
      const nextSeenMinutes = 120 + Math.random() * 360; // 2-8 hodin
      await db.updateGroupNextSeen(group.id, nextSeenMinutes);
    }

    // Aktualizuj statistiky uživatele
    if (typeof db.updateUserDayCount === 'function') {
      await db.updateUserDayCount(user.id);
    }

    // Zaloguj akci
    await db.logUserAction(user.id, actionCode, group.id, `Post do skupiny: ${group.nazev || group.name || group.fb_id}`);

    Log.success(`[${user.id}]`, `Statistiky aktualizovány pro skupinu ${group.fb_id}`);
    return true;

  } catch (err) {
    Log.error('[SUPPORT]', `Chyba při aktualizaci statistik: ${err.message}`);
    return false;
  }
}

/**
 * Generuje náhodnou pauzu před akcí na základě typu akce
 * @param {string} actionType - Typ akce ('post', 'comment', 'like', 'browse')
 * @returns {Promise<void>}
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

/**
 * Ověří, zda je Facebook stránka připravená k použití
 * @param {Object} fbBot - FacebookBot instance
 * @returns {Promise<boolean>} True pokud je stránka připravená
 */
export async function isFacebookReady(fbBot) {
  try {
    if (!fbBot || !fbBot.page) {
      return false;
    }

    // Zkontroluj, zda stránka není zavřená
    if (fbBot.page.isClosed()) {
      return false;
    }

    // Zkontroluj URL
    const url = fbBot.page.url();
    if (!url.includes('facebook.com')) {
      return false;
    }

    // Zkontroluj, zda nejsme na error stránce
    const title = await fbBot.page.title();
    if (title.toLowerCase().includes('error') ||
      title.toLowerCase().includes('not found') ||
      title.toLowerCase().includes('blocked')) {
      return false;
    }

    return true;

  } catch (err) {
    Log.warn('[SUPPORT]', `Chyba při kontrole Facebook stránky: ${err.message}`);
    return false;
  }
}
