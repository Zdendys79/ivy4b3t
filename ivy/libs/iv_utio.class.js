/**
 * Název souboru: iv_utio.class.js
 * Umístění: ~/ivy/iv_utio.class.js
 *
 * Popis: Třída UtioBot pro automatickou interakci s UTIO systémem pomocí Puppeteer.
 *        Ovládá přihlášení, získávání zpráv a správu UTIO záložky.
 *        Navržena podle vzoru FBBot pro konzistentní architekturu.
 */

import { Log } from './iv_log.class.js';
import { Wait } from './iv_wait.class.js';

export class UtioBot {
  constructor(context) {
    this.context = context;
    this.page = null;
    this.isLoggedIn = false;
    this.currentUser = null;
  }

  /**
   * Inicializuje UTIO stránku
   * @returns {Promise<boolean>} True pokud bylo úspěšné
   */
  async init() {
    try {
      if (!this.context) {
        await Log.error('[UTIO]', 'Context není k dispozici pro inicializaci');
        return false;
      }

      Log.info('[UTIO]', 'Inicializuji UTIO stránku...');
      this.page = await this.context.newPage();

      if (!this.page) {
        await Log.error('[UTIO]', 'Nepodařilo se vytvořit novou stránku');
        return false;
      }

      // Nastavení timeoutu pro navigaci
      this.page.setDefaultNavigationTimeout(30000);

      Log.info('[UTIO]', 'Načítám UTIO přihlašovací stránku...');
      await this.page.goto('https://utio.b3group.cz/site/login', {
        waitUntil: "domcontentloaded",
        timeout: 30000
      });

      await Wait.toSeconds(2);
      Log.success('[UTIO]', 'UTIO stránka inicializována');
      return true;

    } catch (err) {
      await Log.error('[UTIO] init', err);
      this.page = null;
      return false;
    }
  }

  /**
   * Přivede UTIO záložku do popředí
   * @returns {Promise<boolean>} True pokud bylo úspěšné
   */
  async bringToFront() {
    try {
      if (!this._isPageReady()) {
        await Log.error('[UTIO]', 'Stránka není připravena pro bringToFront');
        return false;
      }

      await this.page.bringToFront();
      return true;
    } catch (err) {
      await Log.error('[UTIO] bringToFront', err);
      return false;
    }
  }

  /**
   * Uloží screenshot s daným názvem
   * @param {string} name - Název screenshotu
   * @returns {Promise<boolean>} True pokud bylo úspěšné
   */
  async screenshot(name) {
    try {
      if (!this._isPageReady()) {
        await Log.warn('[UTIO]', 'Nelze pořídit screenshot - stránka není připravena');
        return false;
      }

      const filename = `errors/utio_${name}_${Date.now()}.png`;
      await this.page.screenshot({ path: filename });
      Log.info(`[UTIO]`, `Screenshot uložen: ${filename}`);
      return true;
    } catch (err) {
      await Log.error('[UTIO] screenshot', err);
      return false;
    }
  }

  /**
   * Přihlásí uživatele do UTIO
   * @param {Object} user - Objekt s u_login a u_pass
   * @returns {Promise<boolean>} True pokud bylo úspěšné
   */
  async openUtio(user) {
    try {
      if (!this._isPageReady()) {
        await Log.error('[UTIO]', 'Stránka není připravena pro přihlášení');
        return false;
      }

      if (!user || !user.u_login || !user.u_pass) {
        await Log.error('[UTIO]', 'Chybí přihlašovací údaje uživatele');
        return false;
      }

      Log.info('[UTIO]', `Přihlašuji uživatele ${user.u_login}...`);

      // Kontrola zda už není přihlášen
      if (await this._checkIfLoggedIn()) {
        Log.info('[UTIO]', 'Uživatel je již přihlášen');
        this.isLoggedIn = true;
        this.currentUser = user;
        return true;
      }

      // Provedení přihlášení
      const loginSuccess = await this._performLogin(user.u_login, user.u_pass);

      if (loginSuccess) {
        this.isLoggedIn = true;
        this.currentUser = user;
        Log.success('[UTIO]', `Uživatel ${user.u_login} úspěšně přihlášen`);
        return true;
      } else {
        await Log.error('[UTIO]', `Přihlášení uživatele ${user.u_login} se nezdařilo`);
        return false;
      }

    } catch (err) {
      await Log.error('[UTIO] openUtio', err);
      return false;
    }
  }

  /**
   * Získá zprávu z UTIO podle parametrů
   * @param {number} portalId - ID portálu
   * @param {number} regionId - ID regionu (0 = náhodný)
   * @param {number} districtId - ID okresu (0 = náhodný)
   * @returns {Promise<Array|false>} Pole s řádky zprávy nebo false při chybě
   */
  async getMessage(portalId, regionId, districtId) {
    if (!this._isPageReady()) {
      await Log.error('[UTIO]', 'Stránka není připravena pro getMessage');
      return false;
    }

    if (!this.isLoggedIn) {
      await Log.error('[UTIO]', 'Uživatel není přihlášen pro getMessage');
      return false;
    }

    try {
      Log.info('[UTIO]', `Získávám zprávu pro portál ${portalId}, region ${regionId}, okres ${districtId}`);

      await this.bringToFront();

      // Navigace na stránku pro generování zpráv
      if (!await this._navigateToMessageGenerator()) {
        return false;
      }

      // Vyplnění formuláře
      if (!await this._fillMessageForm(portalId, regionId, districtId)) {
        return false;
      }

      // Generování zprávy
      if (!await this._generateMessage()) {
        return false;
      }

      // Získání obsahu zprávy
      const message = await this._extractMessage();

      if (message && message.length > 0) {
        Log.success('[UTIO]', `Zpráva úspěšně získána (${message.length} řádků)`);
        Log.info('[UTIO]', `První řádek: "${message[0].substring(0, 50)}..."`);
        return message;
      } else {
        await Log.warn('[UTIO]', 'Nepodařilo se získat validní zprávu');
        return false;
      }

    } catch (err) {
      await Log.error('[UTIO] getMessage', err);
      return false;
    }
  }

  /**
   * Odhlásí uživatele z UTIO
   * @returns {Promise<boolean>} True pokud bylo úspěšné
   */
  async logout() {
    try {
      if (!this._isPageReady()) {
        await Log.warn('[UTIO]', 'Stránka není připravena pro logout');
        return true; // Technicky úspěch, není co odhlašovat
      }

      if (!this.isLoggedIn) {
        Log.info('[UTIO]', 'Uživatel není přihlášen, logout není potřeba');
        return true;
      }

      await this.bringToFront();

      const logoutLinkExists = await this.page.evaluate(() => {
        const link = document.querySelector('a[href="/site/logout"]');
        return link !== null && link.offsetParent !== null;
      });
      
      if (logoutLinkExists) {
        await this.page.evaluate(() => {
          const link = document.querySelector('a[href="/site/logout"]');
          if (link && link.offsetParent !== null) {
            link.click();
          }
        });
        await Wait.toSeconds(2);

        this.isLoggedIn = false;
        this.currentUser = null;

        Log.info('[UTIO]', 'Uživatel úspěšně odhlášen');
        return true;
      } else {
        await Log.warn('[UTIO]', 'Logout odkaz nenalezen - uživatel možná není přihlášen');
        this.isLoggedIn = false;
        this.currentUser = null;
        return false;
      }

    } catch (err) {
      await Log.error('[UTIO] logout', err);
      return false;
    }
  }

  /**
   * Zkontroluje, zda je UTIO připraveno k použití
   * @returns {boolean} True pokud je UTIO dostupné
   */
  isReady() {
    return this._isPageReady() && this.isLoggedIn;
  }

  /**
   * Zavře UTIO záložku a vyčistí zdroje
   * @returns {Promise<boolean>} True pokud bylo úspěšné
   */
  async close() {
    try {
      if (this.page && !this.page.isClosed()) {
        await this.page.close();
        Log.info('[UTIO]', 'UTIO záložka zavřena');
      }

      this.page = null;
      this.isLoggedIn = false;
      this.currentUser = null;

      return true;
    } catch (err) {
      await Log.error('[UTIO] close', err);
      return false;
    }
  }

  // ==========================================
  // VNITŘNÍ HELPERY (PRIVATE METODY)
  // ==========================================

  /**
   * Kontrola zda je stránka připravena k použití
   * @returns {boolean} True pokud je stránka připravena
   * @private
   */
  _isPageReady() {
    return this.page && !this.page.isClosed();
  }

  /**
   * Kontrola zda je uživatel přihlášen
   * @returns {Promise<boolean>} True pokud je přihlášen
   * @private
   */
  async _checkIfLoggedIn() {
    try {
      return await this.page.evaluate(() => {
        const logoutLink = document.querySelector('a[href="/site/logout"]');
        return logoutLink !== null && logoutLink.offsetParent !== null;
      });
    } catch (err) {
      Log.debug('[UTIO]', 'Kontrola přihlášení selhala:', err);
      return false;
    }
  }

  /**
   * Provede přihlášení uživatele
   * @param {string} login - Přihlašovací jméno
   * @param {string} password - Heslo
   * @returns {Promise<boolean>} True pokud bylo úspěšné
   * @private
   */
  async _performLogin(login, password) {
    try {
      // Najdi a vyplň login pole
      await this.page.waitForSelector('#loginform-username', { timeout: 10000 });
      await this.page.type('#loginform-username', login);
      await Wait.toSeconds(0.5);

      // Najdi a vyplň heslo
      await this.page.waitForSelector('#loginform-password', { timeout: 5000 });
      await this.page.type('#loginform-password', password);
      await Wait.toSeconds(0.5);

      // Klikni na přihlášení
      await this.page.waitForSelector('button[type="submit"]', { timeout: 5000 });
      await this.page.click('button[type="submit"]');
      await Wait.toSeconds(3);

      // Ověř úspěšné přihlášení
      try {
        await this.page.waitForSelector('a[href="/site/logout"]', { timeout: 10000 });
        return true;
      } catch (loginErr) {
        await Log.error('[UTIO]', 'Přihlášení se nezdařilo - logout odkaz nenalezen');
        return false;
      }

    } catch (err) {
      await Log.error('[UTIO] _performLogin', err);
      return false;
    }
  }

  /**
   * Naviguje na stránku pro generování zpráv
   * @returns {Promise<boolean>} True pokud bylo úspěšné
   * @private
   */
  async _navigateToMessageGenerator() {
    try {
      Log.info('[UTIO]', 'Naviguji na stránku pro generování zpráv...');
      await this.page.goto('https://utio.b3group.cz/tags/index', {
        waitUntil: "domcontentloaded",
        timeout: 15000
      });
      await Wait.toSeconds(2);
      return true;
    } catch (err) {
      await Log.error('[UTIO] _navigateToMessageGenerator', err);
      return false;
    }
  }

  /**
   * Vyplní formulář pro generování zprávy
   * @param {number} portalId - ID portálu
   * @param {number} regionId - ID regionu
   * @param {number} districtId - ID okresu
   * @returns {Promise<boolean>} True pokud bylo úspěšné
   * @private
   */
  async _fillMessageForm(portalId, regionId, districtId) {
    try {
      // Vyber portál
      Log.info('[UTIO]', `Vybírám portál ${portalId}...`);
      await this.page.waitForSelector("#portalId", { timeout: 10000 });
      await this.page.select("#portalId", portalId.toString());
      await Wait.toSeconds(1);

      // Vyber region (náhodný pokud je 0)
      if (regionId === 0) {
        regionId = this._getRandomRegion();
        Log.info('[UTIO]', `Použit náhodný region: ${regionId}`);
      }

      Log.info('[UTIO]', `Vybírám region ${regionId}...`);
      await this.page.waitForSelector("#regionId", { timeout: 5000 });
      await this.page.select("#regionId", regionId.toString());
      await Wait.toSeconds(1);

      // Vždy použij okres 0 (všechny okresy)
      Log.info('[UTIO]', `Vybírám okres 0 (všechny okresy)...`);
      await this.page.waitForSelector("#districtId", { timeout: 5000 });
      await this.page.select("#districtId", "0");
      await Wait.toSeconds(1);

      return true;
    } catch (err) {
      await Log.error('[UTIO] _fillMessageForm', err);
      return false;
    }
  }

  /**
   * Spustí generování zprávy
   * @returns {Promise<boolean>} True pokud bylo úspěšné
   * @private
   */
  async _generateMessage() {
    try {
      // Klikni na "Získej URL"
      Log.info('[UTIO]', 'Generuji zprávu...');
      await this.page.waitForSelector("#getUrl", { timeout: 5000 });
      await this.page.click("#getUrl");
      await Wait.toSeconds(3);

      // Klikni na "Kopíruj" tlačítko
      Log.info('[UTIO]', 'Kopíruji zprávu...');
      try {
        await this.page.waitForSelector("#copy_btn", { timeout: 5000 });
        await this.page.click("#copy_btn");
      } catch (err) {
        // Zkus alternativní selektor
        await this.page.waitForSelector("#copy", { timeout: 5000 });
        await this.page.click("#copy");
      }
      await Wait.toSeconds(1);

      return true;
    } catch (err) {
      await Log.error('[UTIO] _generateMessage', err);
      return false;
    }
  }

  /**
   * Extrahuje obsah zprávy z DOM
   * @returns {Promise<Array|false>} Pole s řádky zprávy nebo false
   * @private
   */
  async _extractMessage() {
    try {
      // Získej HTML obsah zprávy
      const html = await this.page.$eval('#copy', el => el.innerHTML);
      if (!html || html.length === 0) {
        await Log.warn('[UTIO]', 'Zpráva k zobrazení nenalezena nebo je prázdná');
        return false;
      }

      // Parsuj HTML na řádky
      const regex = /<br\s*[\/]?>/gi;
      const message = html.split(regex).filter(line => line.trim().length > 0);

      if (message.length === 0) {
        await Log.warn('[UTIO]', 'Parsovaná zpráva je prázdná');
        return false;
      }

      return message;
    } catch (err) {
      await Log.error('[UTIO] _extractMessage', err);
      return false;
    }
  }

  /**
   * Generuje náhodné číslo regionu
   * @returns {number} Náhodný region
   * @private
   */
  _getRandomRegion() {
    return Math.floor(1 + Math.random() * 14);
  }

  /**
   * Generuje náhodné číslo okresu pro daný region
   * @param {number} region - Číslo regionu
   * @returns {number} Náhodný okres
   * @private
   */
  _getRandomDistrict(region) {
    if (region === 1) region = 15;
    const districts = [1, 2, 14, 21, 28, 31, 38, 42, 47, 51, 56, 63, 68, 74, 78, 89];
    const min = districts[region - 1];
    const max = districts[region];
    let rand = Math.floor(min + Math.random() * (max - min));
    if (rand === 88) rand = 1;
    return rand;
  }
}

// Exportované helper funkce pro zpětnou kompatibilitu
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

// Funkce pro zpětnou kompatibilitu - bude deprecated
let utioBot = null;

export async function newUtioTab(context) {
  utioBot = new UtioBot(context);
  return await utioBot.init();
}

export async function openUtio(login, pass) {
  if (!utioBot) {
    await Log.error('[UTIO]', 'UtioBot nebyl inicializován');
    return false;
  }
  return await utioBot.openUtio({ u_login: login, u_pass: pass });
}

export async function getMessage(portal_id, region_id, district_id) {
  if (!utioBot) {
    await Log.error('[UTIO]', 'UtioBot nebyl inicializován');
    return false;
  }
  return await utioBot.getMessage(portal_id, region_id, district_id);
}

export function isUtioReady() {
  if (!utioBot) return false;
  return utioBot.isReady();
}

export async function closeUtio() {
  if (!utioBot) return true;
  const result = await utioBot.close();
  utioBot = null;
  return result;
}

export async function bringToFront() {
  if (!utioBot) {
    await Log.error('[UTIO]', 'UtioBot nebyl inicializován');
    return false;
  }
  return await utioBot.bringToFront();
}
