// fb_login.js – Login mixin for FBBot

import { Log } from '../iv_log.class.js';
import { Wait } from '../iv_wait.class.js';
import { db } from '../../iv_sql.js';
import * as fbSupport from '../../iv_fb_support.js';
import { getIvyConfig } from '../iv_config.class.js';

const config = getIvyConfig();

export const LoginMixin = {

  async login(user) {
    try {
      await this.acceptCookies();

      await this.page.waitForSelector('#email', { timeout: 5000 });
      await this.page.type('#email', user.fb_login, { delay: 30 + Math.random() * 30 });

      await this.page.waitForSelector('#pass', { timeout: 5000 });
      await this.page.type('#pass', user.fb_pass, { delay: 30 + Math.random() * 30 });

      const loginText = config.get('cfg_login_text', 'Přihlásit se');
      await this._clickByText(loginText);
      await Wait.toSeconds(15, 'Po přihlášení');

      if (await this.isProfileLoaded(user)) {
        Log.success(`[FB] Uživatel ${user.id} ${user.name} ${user.surname} je nyní přihlášen.`);

        // Posun času aktivity o +3 minuty pro rotaci účtů během testování
        try {
          await db.updateUserWorktime(user.id, 3);
          Log.info(`[FB] Čas aktivity uživatele ${user.id} posunut o +${Log.formatTime(3, 'm')} pro rotaci účtů`);
        } catch (err) {
          await Log.warn(`[FB] Nepodařilo se aktualizovat čas aktivity: ${err.message}`);
        }

        return 'now_loged';
      } else {
        await Log.warnInteractive(`[FB]`, `Uživatel není přihlášen na FB.`);
        return false;
      }
    } catch (err) {
      await Log.error(`[FB] Chyba při loginu: ${err}`);
      return false;
    }
  },

  async acceptCookies() {
    try {
      // Zkusíme najít tlačítko pro cookies z konfigurace (ALLOW = odmítáme volitelné!)
      const acceptText = config.get('cfg_cookies_allow', 'Odmítnout volitelné soubory cookie');
      Log.info(`[FB] Hledám tlačítko pro cookies: "${acceptText}"`);

      if (!this.pageAnalyzer) {
        throw new Error('PageAnalyzer není inicializován');
      }

      const success = await this.pageAnalyzer.clickElementWithText(acceptText, {
        matchType: 'contains',
        timeout: 5000,
        waitAfterClick: true,
        naturalDelay: true
      });

      if (success) {
        Log.info(`[FB] Cookie banner přijat pomocí PageAnalyzer: "${acceptText}".`);
        return true;
      } else {
        await Log.warn(`[FB] Cookie tlačítko "${acceptText}" nenalezeno.`);
        return false;
      }

    } catch (err) {
      await Log.error(`[FB] Cookie banner error: ${err.message}`);
      return false;
    }
  },

  /**
   * Řeší vícestránkový proces souhlasu se zpracováním dat pro reklamy.
   * @returns {Promise<boolean>} True pokud byl proces úspěšně dokončen.
   */
  async resolveAdConsentFlow() {
    Log.info('[FB]', 'Kontroluji obrazovku souhlasu s reklamami...');
    let inConsentFlow = true;
    let attempts = 0;
    const MAX_ATTEMPTS = 5; // Pojistka proti nekonečné smyčce

    while (inConsentFlow && attempts < MAX_ATTEMPTS) {
      attempts++;
      try {
        // Hledáme klíčový text, abychom věděli, že jsme stále v procesu
        const adSettingsText = config.get('cfg_ad_settings', 'Zkontrolujte nastavení reklam');
        const consentElement = await this.page.waitForSelector(`xpath///span[contains(., '${adSettingsText}') or contains(., 'Review how we use data for ads') or contains(., 'Zkontrolujte, jestli můžeme')]`, { timeout: 5000 });
        if (!consentElement) {
          inConsentFlow = false;
          continue;
        }

        Log.info(`[FB][AdConsent] Pokus ${attempts}/${MAX_ATTEMPTS}: Nalezena obrazovka souhlasu.`);

        // Hledáme jakékoliv akční tlačítko s konfigurovatelnými texty
        const nextText = config.cfg_next_text || 'Další';
        const acceptText = config.cfg_accept_text || 'Přijmout';
        const allowAllText = config.cfg_allow_all_text || 'Povolit vše';
        const saveText = config.cfg_save_text || 'Uložit';
        const confirmText = config.cfg_confirm_text || 'Potvrdit';
        const actionButton = await Promise.race([
          this.page.waitForSelector(`xpath///div[@role='button'][.//span[contains(., '${nextText}') or contains(., 'Next')]]`),
          this.page.waitForSelector(`xpath///div[@role='button'][.//span[contains(., '${acceptText}') or contains(., 'Accept')]]`),
          this.page.waitForSelector(`xpath///div[@role='button'][.//span[contains(., '${allowAllText}') or contains(., 'Allow all')]]`),
          this.page.waitForSelector(`xpath///div[@role='button'][.//span[contains(., '${saveText}') or contains(., 'Save')]]`),
          this.page.waitForSelector(`xpath///div[@role='button'][.//span[contains(., '${confirmText}') or contains(., 'Confirm')]]`)
        ]);

        if (actionButton) {
          const buttonText = await this.page.evaluate(el => el.textContent, actionButton);
          Log.info(`[FB][AdConsent] Klikám na tlačítko: "${buttonText}"`);
          await actionButton.click();
          await this.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
          await Wait.toSeconds(3, 'Počkat na stabilizaci stránky');
        } else {
          await Log.warn('[FB][AdConsent] Nenalezeno žádné pokračovací tlačítko, proces končí.');
          inConsentFlow = false;
        }
      } catch (error) {
        // Pokud nenajdeme žádný prvek, předpokládáme, že proces skončil
        Log.info('[FB][AdConsent] Proces souhlasu s reklamami pravděpodobně dokončen.');
        inConsentFlow = false;
      }
    }

    return true;
  },

  async defaultRange() {
    const t1 = config.get('cfg_privacy_audience', "Výchozí okruh uživatelů");
    const t2 = config.get('cfg_friends_text', "Přátelé");
    const doneText = config.get('cfg_done_text', "Hotovo");
    try {
      const rangeSelect = await fbSupport.findByText(this.page, t1, { timeout: 2000 });
      if (rangeSelect.length > 0) {
        const friends = await fbSupport.findByText(this.page, t2, { timeout: 2000 });
        if (friends.length) {
          await friends[friends.length - 2].click();
          const done = await fbSupport.findByText(this.page, doneText, { timeout: 5000 });
          if (!done || done.length === 0) throw `Tlačítko "${doneText}" nenalezeno.`;
          await Wait.toSeconds(3, 'Dlouhé čekání');
          await this.page.evaluate(el => { el.click({ clickCount: 2 }); }, done[0]);
          await Wait.toSeconds(15, 'Po přihlášení');
          Log.info(`[FB] Výchozí okruh uživatelů nastaven.`);
        } else {
          throw `SPAN "${t2}" nenalezen.`;
        }
      } else {
        throw `SPAN "${t1}" nenalezen.`;
      }
      return true;
    } catch (err) {
      await Log.error(`[FB] Chyba v defaultRange: ${err}`);
      return false;
    }
  }
};
