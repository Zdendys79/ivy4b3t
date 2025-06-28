/**
 * Název souboru: iv_utio.js (opravená verze)
 * Umístění: ~/ivy/iv_utio.js
 *
 * Popis: Opravená verze UTIO modulu s robustním error handlingem a logováním
 */

import * as wait from './iv_wait.js';
import { Log } from './iv_log.class.js';

let utio = null; // Změna z false na null pro lepší kontrolu

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

/**
 * Vytvoří novou UTIO záložku v prohlížeči
 * @param {Object} context - Browser context
 * @returns {boolean} True pokud bylo úspěšné
 */
export async function newUtioTab(context) {
  try {
    if (!context) {
      Log.error('[UTIO]', 'Context není k dispozici pro vytvoření záložky');
      return false;
    }

    Log.info('[UTIO]', 'Vytvářím novou záložku...');
    utio = await context.newPage();

    if (!utio) {
      Log.error('[UTIO]', 'Nepodařilo se vytvořit novou stránku');
      return false;
    }

    // Nastavení timeoutu pro navigaci
    utio.setDefaultNavigationTimeout(30000);

    Log.info('[UTIO]', 'Načítám UTIO stránku...');
    await utio.goto('https://utio.b3group.cz/site/login', {
      waitUntil: "domcontentloaded",
      timeout: 30000
    });

    await wait.delay(2000, false);
    Log.success('[UTIO]', 'Záložka vytvořena a stránka načtena.');
    return true;

  } catch (err) {
    Log.error('[UTIO] newUtioTab', err);
    utio = null;
    return false;
  }
}

/**
 * Přihlásí uživatele do UTIO
 * @param {string} login - Přihlašovací jméno
 * @param {string} pass - Heslo
 * @returns {boolean} True pokud bylo úspěšné
 */
export async function openUtio(login, pass) {
  try {
    if (!utio) {
      Log.error('[UTIO]', 'UTIO záložka není k dispozici');
      return false;
    }

    if (!login || !pass) {
      Log.error('[UTIO]', 'Chybí přihlašovací údaje');
      return false;
    }

    Log.info('[UTIO]', 'Kontroluji stav přihlášení...');

    // Kontrola zda už není přihlášen
    try {
      const logoutLink = await utio.$('a[href="/site/logout"]');
      if (logoutLink) {
        Log.info('[UTIO]', 'Uživatel je již přihlášen.');
        return true;
      }
    } catch (err) {
      // Není přihlášen, pokračujeme
      Log.info('[UTIO]', 'Uživatel není přihlášen, provádím login...');
    }

    // Přihlašovací proces
    try {
      Log.info('[UTIO]', 'Hledám přihlašovací formulář...');

      await utio.waitForSelector("#loginform-username", { timeout: 10000 });
      await utio.focus("#loginform-username");
      await utio.click("#loginform-username");
      await utio.type("#loginform-username", login, { delay: 100 });
      Log.info('[UTIO]', 'Uživatelské jméno vyplněno');

      await utio.waitForSelector("#loginform-password", { timeout: 10000 });
      await utio.focus("#loginform-password");
      await utio.type("#loginform-password", pass, { delay: 100 });
      Log.info('[UTIO]', 'Heslo vyplněno');

      // Zaškrtni "Remember me" pokud existuje
      try {
        const checkbox = await utio.$("#loginform-rememberme");
        if (checkbox) {
          const isChecked = await (await checkbox.getProperty("checked")).jsonValue();
          if (!isChecked) {
            await checkbox.click({ delay: 300 });
            Log.info('[UTIO]', 'Remember me zaškrtnuto');
          }
        }
      } catch (err) {
        Log.warn('[UTIO]', 'Remember me checkbox nenalezen:', err.message);
      }

      // Klikni na login tlačítko
      await utio.waitForSelector('button[name="login-button"]', { timeout: 10000 });
      await utio.focus('button[name="login-button"]');
      await wait.delay(1000);

      Log.info('[UTIO]', 'Klikám na tlačítko přihlášení...');
      await utio.click('button[name="login-button"]', { delay: 300 });

      // Čekej na navigaci
      await utio.waitForNavigation({
        waitUntil: "domcontentloaded",
        timeout: 15000
      });
      await wait.delay(3000);

    } catch (err) {
      Log.error('[UTIO] login form', err);
      return false;
    }

    // Ověř úspěšné přihlášení
    try {
      await utio.waitForSelector('a[href="/site/logout"]', { timeout: 10000 });
      await wait.delay(2000);
      Log.success('[UTIO]', 'Přihlášení proběhlo úspěšně');
      return true;

    } catch (err) {
      Log.error('[UTIO]', 'Nepodařilo se ověřit úspěšné přihlášení:', err);
      return false;
    }

  } catch (err) {
    Log.error('[UTIO] openUtio', err);
    return false;
  }
}

/**
 * Odhlásí uživatele z UTIO
 * @returns {boolean} True pokud bylo úspěšné
 */
export async function logoutUtio() {
  if (!utio) {
    Log.warn('[UTIO]', 'UTIO záložka není k dispozici pro odhlášení');
    return false;
  }

  try {
    await utio.bringToFront();
    const logoutLink = await utio.$('a[href="/site/logout"]');

    if (logoutLink) {
      await logoutLink.click();
      Log.success('[UTIO]', 'Odhlášení proběhlo.');
      return true;
    } else {
      Log.warn('[UTIO]', 'Logout odkaz nenalezen');
      return false;
    }

  } catch (err) {
    Log.error('[UTIO] logout', err);
    return false;
  }
}

/**
 * Získá zprávu z UTIO podle parametrů
 * @param {number} portal_id - ID portálu
 * @param {number} region_id - ID regionu (0 = náhodný)
 * @param {number} district_id - ID okresu (0 = náhodný)
 * @returns {Array|false} Pole s řádky zprávy nebo false při chybě
 */
export async function getMessage(portal_id, region_id, district_id) {
  if (!utio) {
    Log.error('[UTIO]', 'UTIO záložka není k dispozici pro getMessage');
    return false;
  }

  try {
    Log.info('[UTIO]', `Získávám zprávu pro portál ${portal_id}, region ${region_id}, okres ${district_id}`);

    await utio.bringToFront();

    // Jdi na stránku pro generování zpráv
    Log.info('[UTIO]', 'Naviguji na stránku pro generování zpráv...');
    await utio.goto('https://utio.b3group.cz/tags/index', {
      waitUntil: "domcontentloaded",
      timeout: 15000
    });
    await wait.delay(2000);

    // Vyber portál
    Log.info('[UTIO]', `Vybírám portál ${portal_id}...`);
    await utio.waitForSelector("#portalId", { timeout: 10000 });
    await utio.select("#portalId", portal_id.toString());
    await wait.delay(1000);

    // Vyber region
    if (region_id === 0) {
      region_id = getRandomRegion();
      Log.info('[UTIO]', `Použit náhodný region: ${region_id}`);
    }

    Log.info('[UTIO]', `Vybírám region ${region_id}...`);
    await utio.waitForSelector("#regionId", { timeout: 5000 });
    await utio.select("#regionId", region_id.toString());
    await wait.delay(1000);

    // Vyber okres
    if (district_id === 0) {
      district_id = getRandomDistrict(region_id);
      Log.info('[UTIO]', `Použit náhodný okres: ${district_id}`);
    }

    Log.info('[UTIO]', `Vybírám okres ${district_id}...`);
    await utio.waitForSelector("#districtId", { timeout: 5000 });
    await utio.select("#districtId", district_id.toString());
    await wait.delay(1000);

    // Klikni na "Získej URL"
    Log.info('[UTIO]', 'Generuji zprávu...');
    await utio.waitForSelector("#getUrl", { timeout: 5000 });
    await utio.click("#getUrl");
    await wait.delay(3000);

    // Klikni na "Kopíruj" tlačítko
    Log.info('[UTIO]', 'Kopíruji zprávu...');
    try {
      await utio.waitForSelector("#copy_btn", { timeout: 5000 });
      await utio.click("#copy_btn");
    } catch (err) {
      // Zkus alternativní selektor
      await utio.waitForSelector("#copy", { timeout: 5000 });
      await utio.click("#copy");
    }
    await wait.delay(1000);

    // Získej HTML obsah zprávy
    const html = await utio.$eval('#copy', el => el.innerHTML);
    if (!html || html.length === 0) {
      Log.warn('[UTIO]', 'Zpráva k zobrazení nenalezena nebo je prázdná');
      return false;
    }

    // Parsuj HTML na řádky
    const regex = /<br\s*[\/]?>/gi;
    const message = html.split(regex).filter(line => line.trim().length > 0);

    if (message.length === 0) {
      Log.warn('[UTIO]', 'Parsovaná zpráva je prázdná');
      return false;
    }

    Log.success('[UTIO]', `Zpráva úspěšně získána (${message.length} řádků)`);
    Log.info('[UTIO]', `První řádek: "${message[0].substring(0, 50)}..."`);

    return message;

  } catch (err) {
    Log.error('[UTIO] getMessage', err);
    return false;
  }
}

/**
 * Zkontroluje, zda je UTIO připraveno k použití
 * @returns {boolean} True pokud je UTIO dostupné
 */
export function isUtioReady() {
  return utio !== null && !utio.isClosed();
}

/**
 * Zavře UTIO záložku
 * @returns {boolean} True pokud bylo úspěšné
 */
export async function closeUtio() {
  if (utio && !utio.isClosed()) {
    try {
      await utio.close();
      utio = null;
      Log.info('[UTIO]', 'UTIO záložka zavřena');
      return true;
    } catch (err) {
      Log.error('[UTIO] closeUtio', err);
      return false;
    }
  }
  return true;
}
