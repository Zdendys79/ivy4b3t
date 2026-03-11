/**
 * Název souboru: analyzer/analyzer_fb_checks.js
 * Účel: Unified FB check methods pro PageAnalyzer
 *       isProfileLoaded, detectAccountBlock, canUseNewThingElement,
 *       analyzeGroup, quickFBCheck, _categorizeBlockType, _checkGroupMembership
 */

import { Log } from '../iv_log.class.js';
import * as fbSupport from '../../iv_fb_support.js';
import { getIvyConfig } from '../iv_config.class.js';

const config = getIvyConfig();

export const FBChecksMixin = {

  /**
   * Sjednocený profil check - nahrazuje isProfileLoaded z FBBot
   * @param {Object} user - Uživatelské údaje
   * @returns {Promise<boolean>} True pokud je profil načten
   */
  async isProfileLoaded(user) {
    try {
      await this.page.waitForSelector('[aria-label="Váš profil"]', { timeout: config.fb_page_load_timeout });
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Detekuje blokování účtu - sjednocuje různé kontroly
   * @returns {Promise<Object>} Informace o blokaci
   */
  async detectAccountBlock() {
    try {
      const blockIndicators = await this.page.evaluate(() => {
        const blockTexts = [
          'váš účet jsme uzamkli',
          'account restricted',
          'temporarily restricted',
          'security check',
          'bezpečnostní kontrola',
          'videoselfie',
          'verify your identity',
          'confirm your identity',
          'potvrdit svou identitu',
          'checkpoint',
          'account suspended',
          'účet pozastaven',
          'review blocked',
          'temporarily blocked',
          'dočasně blokován',
          'suspicious activity',
          'podezřelá aktivita',
          'unusual activity'
        ];

        const bodyText = document.body.textContent.toLowerCase();
        const foundBlocks = blockTexts.filter(text => bodyText.includes(text));

        return {
          isBlocked: foundBlocks.length > 0,
          foundTexts: foundBlocks,
          pageTitle: document.title,
          currentUrl: window.location.href
        };
      });

      if (blockIndicators.isBlocked) {
        await Log.warn('[ANALYZER]', `Detekován blok účtu: ${blockIndicators.foundTexts.join(', ')}`);
        return {
          isBlocked: true,
          blockType: this._categorizeBlockType(blockIndicators.foundTexts),
          foundTexts: blockIndicators.foundTexts,
          pageTitle: blockIndicators.pageTitle,
          currentUrl: blockIndicators.currentUrl
        };
      }

      return {
        isBlocked: false,
        blockType: null,
        foundTexts: [],
        pageTitle: blockIndicators.pageTitle,
        currentUrl: blockIndicators.currentUrl
      };

    } catch (err) {
      await Log.error('[ANALYZER]', `Chyba při detekci bloku: ${err.message}`);
      return {
        isBlocked: false, // V případě chyby neblokujeme
        blockType: 'unknown',
        foundTexts: [],
        pageTitle: 'unknown',
        currentUrl: this.page.url()
      };
    }
  },

  /**
   * Kontroluje, zda je možné použít "Napsat něco" element
   * @returns {Promise<boolean>} True pokud je element dostupný
   */
  async canUseNewThingElement() {
    try {
      const newThingTexts = [
        'Napište něco',
        'Co se děje',
        'What\'s on your mind',
        'Write something',
        'Share something',
        'Start a post'
      ];

      for (const text of newThingTexts) {
        const element = await fbSupport.findByText(this.page, text, { timeout: 1000 });
        if (element) {
          // Zkontroluj, zda je element interaktivní
          const isClickable = await this.page.evaluate((el) => {
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0 &&
                   window.getComputedStyle(el).visibility !== 'hidden' &&
                   !el.disabled;
          }, element);

          if (isClickable) {
            return true;
          }
        }
      }

      return false;
    } catch (err) {
      await Log.error('[ANALYZER]', `Chyba při kontrole newThing elementu: ${err.message}`);
      return false;
    }
  },

  /**
   * Analyzuje skupinu a její schopnosti
   * @returns {Promise<Object>} Analýza skupiny
   */
  async analyzeGroup() {
    try {
      const url = this.page.url();
      const isGroupPage = url.includes('/groups/') || url.includes('/group/');

      if (!isGroupPage) {
        return {
          isGroup: false,
          canPost: false,
          reason: 'Není stránka skupiny'
        };
      }

      // Kontrola členství ve skupině
      const membershipStatus = await this._checkGroupMembership();

      // Kontrola schopnosti postovat
      const canPost = await this.canUseNewThingElement();

      return {
        isGroup: true,
        canPost: canPost && membershipStatus.isMember,
        membershipStatus: membershipStatus,
        reason: !canPost ? 'Nelze najít postovací element' :
                !membershipStatus.isMember ? 'Nejste členem skupiny' : 'OK'
      };

    } catch (err) {
      await Log.error('[ANALYZER]', `Chyba při analýze skupiny: ${err.message}`);
      return {
        isGroup: false,
        canPost: false,
        reason: `Chyba při analýze: ${err.message}`
      };
    }
  },

  /**
   * Rychlá kontrola FB funkcionality - nahrazuje quickFBCheck z workeru
   * @param {Object} user - Uživatelské údaje
   * @returns {Promise<boolean>} True pokud je FB funkční
   */
  async quickFBCheck(user) {
    try {
      // Kontrola přihlášení
      const isLoggedIn = await this.isProfileLoaded(user);
      if (!isLoggedIn) {
        await Log.warn(`[${user.id}]`, 'FB není funkční - uživatel není přihlášen');
        return false;
      }

      // Proveď základní analýzu stránky
      const basicAnalysis = await this.analyzeFullPage({ forceRefresh: true });

      // Pokud je stránka chudá, TEPRVE POTOM hledej příčinu
      if (basicAnalysis.severity === 'high' || basicAnalysis.severity === 'medium') {
        // Nyní můžeme hledat příčinu - checkpoint, blokace, atd.
        const blockStatus = await this.detectAccountBlock();
        if (blockStatus.isBlocked) {
          await Log.warn(`[${user.id}]`, `FB není funkční - ${blockStatus.blockType}: ${blockStatus.foundTexts.join(', ')}`);
          return false;
        }

        await Log.warn(`[${user.id}]`, `FB není funkční - stránka má problémy: ${basicAnalysis.reason}`);
        return false;
      }

      Log.success(`[${user.id}]`, 'FB je funkční a uživatel je přihlášen');
      return true;

    } catch (err) {
      await Log.error(`[${user.id}]`, `Chyba při kontrole FB: ${err.message}`);
      return false;
    }
  },

  /**
   * Kategorizes block type based on found texts
   * @param {Array} foundTexts - Array of found block texts
   * @returns {string} Block type
   */
  _categorizeBlockType(foundTexts) {
    if (foundTexts.some(text => text.includes('videoselfie') || text.includes('identity'))) {
      return 'identity_verification';
    }
    if (foundTexts.some(text => text.includes('security') || text.includes('checkpoint'))) {
      return 'security_check';
    }
    if (foundTexts.some(text => text.includes('restricted') || text.includes('suspended'))) {
      return 'account_restricted';
    }
    if (foundTexts.some(text => text.includes('temporarily') || text.includes('dočasně'))) {
      return 'temporary_block';
    }
    if (foundTexts.some(text => text.includes('suspicious') || text.includes('podezřelá'))) {
      return 'suspicious_activity';
    }
    return 'unknown_block';
  },

  /**
   * Checks group membership status
   * @returns {Promise<Object>} Membership status
   */
  async _checkGroupMembership() {
    try {
      const membershipInfo = await this.page.evaluate(() => {
        const joinButton = document.querySelector('[data-testid="join_group_button"]');
        const requestSent = document.querySelector('[data-testid="pending_request_button"]');
        const leaveButton = document.querySelector('[data-testid="leave_group_button"]');

        return {
          hasJoinButton: !!joinButton,
          hasRequestSent: !!requestSent,
          hasLeaveButton: !!leaveButton
        };
      });

      if (membershipInfo.hasLeaveButton) {
        return { isMember: true, status: 'member' };
      }
      if (membershipInfo.hasRequestSent) {
        return { isMember: false, status: 'request_pending' };
      }
      if (membershipInfo.hasJoinButton) {
        return { isMember: false, status: 'not_member' };
      }

      return { isMember: true, status: 'unknown' }; // Assume member if no clear indicators
    } catch (err) {
      return { isMember: false, status: 'error' };
    }
  }
};
