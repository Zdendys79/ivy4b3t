/**
 * Název souboru: iv_support.js
 * Umístění: ~/ivy/iv_support.js
 *
 * Popis: Obsahuje pomocné funkce pro práci s uživateli, skupinami, postování zpráv,
 *         zvyšování denních limitů a získávání dat z UTIO portálu.
 *         Také se stará o simulaci lidské aktivity na Facebooku.
 */

import * as utio from './iv_utio.js';
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

export async function raise(user, fbBot) {
  const now = new Date();
  const is_raising_time = user.next_statement < now;
  let log_type = 0;

  if (!is_raising_time) {
    Log.warn(`[${user.id}]`, `Není čas pro raiser.`);
    return false;
  }

  let result = false;
  try {
    if (Math.random() < 0.5) {
      result = await raise_url(fbBot);
      log_type = 6;
    } else {
      result = await raise_citation(fbBot);
      log_type = 5;
    }

    if (result) {
      await db.updateUserNextStatement(user, 30, log_type);
    }

    await wait.delay(20000, false);
  } catch (err) {
    Log.error(`[${user.id}] raise`, err);
  }

  return result;
}

export async function raise_url(fbBot) {
  try {
    const url = await db.loadUrl();
    if (!url) throw new Error("URL not obtained!");
    db.useUrl(url.url);

    if (await fbBot.newThing(2)) {
      await fbBot.clickNewThing();
      await fbBot.pasteStatement(url.url);
    } else {
      throw new Error(`Element pro zadání příspěvku nenalezen.`);
    }

    Log.success('[RAISE_URL]', `Příspěvek s URL vložen.`);
    return true;
  } catch (err) {
    Log.error('[RAISE_URL]', err);
    return false;
  }
}

export async function raise_citation(fbBot) {
  try {
    const statement = await db.getStatement();
    if (!statement) throw new Error(`Žádné nové sdělení.`);

    if (await fbBot.newThing(2)) {
      await fbBot.clickNewThing();
      await fbBot.pasteStatement(statement.statement);
    } else {
      throw new Error(`Element pro zadání příspěvku nenalezen.`);
    }

    Log.success('[RAISE_CITATION]', `Citace vložena.`);
    return true;
  } catch (err) {
    Log.error('[RAISE_CITATION]', err);
    return false;
  }
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

export async function pasteMsg(user, group, fbBot) {
  let message = false;
  let cnt = 0;

  try {
    do {
      const m = await utio.getMessage(user.portal_id, group.region_id, group.district_id);
      if (await db.verifyMsg(group.id, md5(m[0]).toString())) {
        message = m;
      }
      cnt++;
    } while (!message && cnt < 5);
  } catch (err) {
    Log.error(`[${user.id}] UTIO`, err);
    return false;
  }

  if (message && await fbBot.clickNewThing()) {
    const paste = await fbBot.pasteStatement(message[0]);
    if (paste) {
      Log.success(`[${user.id}]`, `Zpráva vložena do skupiny ${group.fb_id}`);
      return message[0];
    } else {
      Log.error(`[${user.id}]`, `Nepodařilo se vložit zprávu.`);
    }
  } else {
    Log.warn(`[${user.id}]`, `Nepodařilo se získat zprávu nebo kliknout na vstup.`);
  }

  return false;
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
