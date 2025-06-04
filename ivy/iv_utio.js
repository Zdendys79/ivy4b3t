/**
 * Název souboru: iv_utio.js
 * Umístění: ~/ivy/iv_utio.js
 *
 * Popis: Poskytuje funkce pro ovládání webového portálu UTIO pomocí Puppeteer.
 *         Umožňuje login, získávání zpráv, výběr regionu a okresu, odhlášení a generování zpráv.
 */

import * as wait from './iv_wait.js';
import { Log } from './iv_log.class.js';

let utio = false; // browser page

export function getRandomRegion() {
  return Math.floor(1 + Math.random() * 14);
}

export function getRandomDistrict(region) {
  if (region === 1) region = 15;
  const districts = [1, 2, 14, 21, 28, 31, 38, 42, 47, 51, 56, 63, 68, 74, 78, 89];
  const min = districts[region - 1];
  const max = districts[region];
  let rand = Math.floor(min + Math.random() * (max - min));
  if (rand === 88) rand = 1;
  return rand;
}

export async function newUtioTab(context) {
  try {
    utio = await context.newPage();
    await wait.delay(1000, false);
    await utio.goto('https://utio.b3group.cz/site/login', { waitUntil: "domcontentloaded" });
    await wait.delay(1000, false);
    Log.info('[UTIO]', 'Záložka vytvořena a stránka načtena.');
  } catch (err) {
    Log.error('[UTIO] newUtioTab', err);
    utio = false;
  }
}

export async function openUtio(login, pass) {
  try {
    const logoutLink = await utio.$('a[href="/site/logout"]');
    if (logoutLink) {
      Log.info('[UTIO]', 'Uživatel je již přihlášen.');
      return true;
    }
  } catch (err) {
    Log.warn('[UTIO]', 'Kontrola přihlášení selhala:', err);
  }

  try {
    await utio.waitForSelector("#loginform-username", { timeout: 10000 });
    await utio.focus("#loginform-username");
    await utio.click("#loginform-username");
    await utio.type("#loginform-username", login);

    await utio.waitForSelector("#loginform-password", { timeout: 10000 });
    await utio.focus("#loginform-password");
    await utio.type("#loginform-password", pass);

    const checkbox = await utio.$("#loginform-rememberme");
    if (checkbox) {
      const isChecked = await (await checkbox.getProperty("checked")).jsonValue();
      if (!isChecked) await checkbox.click({ delay: 300 });
    }

    await utio.waitForSelector('button[name="login-button"]', { timeout: 10000 });
    await utio.focus('button[name="login-button"]');
    await wait.delay(wait.timeout());
    await utio.click('button[name="login-button"]', { delay: 300 });

    await utio.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15000 });
    await wait.delay(2 * wait.timeout());
  } catch (err) {
    Log.error('[UTIO] login form', err);
    return false;
  }

  try {
    await utio.waitForSelector('a[href="/site/logout"]', { timeout: 10000 });
    await wait.delay(2 * wait.timeout());
    Log.success('[UTIO]', 'Přihlášení proběhlo úspěšně.');
    return true;
  } catch (err) {
    Log.error('[UTIO] post-login check', err);
    return false;
  }
}

export async function logoutUtio() {
  if (!utio) return false;
  try {
    await utio.bringToFront();
    await utio.click('a[href="/site/logout"]');
    Log.info('[UTIO]', 'Odhlášení proběhlo.');
    return true;
  } catch (err) {
    Log.error('[UTIO] logout', err);
    return false;
  }
}

export async function getMessage(portal_id, region_id, district_id) {
  if (!utio) return false;
  try {
    await utio.bringToFront();
    const navigationPromise = utio.waitForNavigation({ waitUntil: "domcontentloaded" });
    await utio.goto('https://utio.b3group.cz/tags/index');
    await navigationPromise;

    await utio.waitForSelector("#portalId", { delay: 2000 });
    await utio.select("#portalId", portal_id.toString());
    await wait.delay(wait.timeout());

    await utio.waitForSelector("#regionId", { delay: 500 });
    if (region_id === 0) region_id = getRandomRegion();
    await utio.select("#regionId", region_id.toString());
    await wait.delay(wait.timeout());

    await utio.waitForSelector("#districtId", { delay: 500 });
    if (district_id === 0) district_id = getRandomDistrict(region_id);
    await utio.select("#districtId", district_id.toString());
    await wait.delay(wait.timeout());

    await utio.waitForSelector("#getUrl", { delay: 500 });
    await utio.click("#getUrl");
    await wait.delay(2 * wait.timeout());

    await utio.waitForSelector("#copy", { delay: 500 });
    await utio.click("#copy_btn");
    await wait.delay(wait.timeout());

    const html = await utio.$eval('#copy', el => el.innerHTML);
    if (!html || html.length === 0) {
      Log.warn('[UTIO]', 'Zpráva k zobrazení nenalezena.');
      return false;
    }

    const regex = /<br\s*[\/]?>/gi;
    const message = html.split(regex);
    await wait.delay(wait.timeout());
    return message;

  } catch (err) {
    Log.error('[UTIO] getMessage', err);
    return false;
  }
}
