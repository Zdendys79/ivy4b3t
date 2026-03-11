/**
 * Název souboru: analyzer/analyzer_errors.js
 * Účel: Error detection methods pro PageAnalyzer
 *       _detectErrorPatterns, _checkAccountLocked, _checkCheckpoint,
 *       _quickErrorCheck, _checkLoginStatus, _checkPageResponsiveness
 */

import { Log } from '../iv_log.class.js';
import * as fbSupport from '../../iv_fb_support.js';

export const ErrorDetectionMixin = {

  async _detectErrorPatterns(groupAnalysis = null, hasCookieButton = false) {
    const patterns = [
      {
        texts: ['videoselfie', 'video selfie', 'Please take a video selfie', 'Potvrďte svou totožnost pomocí videoselfie'],
        reason: 'Požadavek na videoselfie', type: 'VIDEOSELFIE'
      },
      {
        texts: ['váš účet jsme uzamkli', 'Account restricted', 'temporarily restricted', 'Účet máte zablokovaný'],
        reason: 'Účet je zablokován', type: 'ACCOUNT_LOCKED'
      },
      {
        texts: ['Verify your identity', 'ověření identity', 'identity verification'],
        reason: 'Požadavek na ověření identity', type: 'IDENTITY_VERIFICATION'
      },
      {
        texts: ['suspicious activity', 'podezřelá aktivita', 'unusual activity'],
        reason: 'Detekována podezřelá aktivita', type: 'SUSPICIOUS_ACTIVITY'
      },
      {
        texts: ['nemáte oprávnění', 'not authorized', 'access denied', 'přístup zamítnut'],
        reason: 'Nemáte oprávnění pro tuto akci', type: 'ACCESS_DENIED'
      },
      {
        texts: ['Zkontrolujte nastavení reklam', 'Review how we use data for ads', 'Zkontrolujte, jestli můžeme'],
        reason: 'Vyžadován souhlas se zpracováním dat pro reklamy', type: 'AD_CONSENT_REQUIRED'
      }
    ];

    try {
      const pageData = await this.page.evaluate(() => {
        const bodyText = document.body.textContent.toLowerCase();
        return { bodyText };
      });

      const detectedPatterns = [];

      // Speciální detekce pro cookie banner
      if (hasCookieButton) {
        detectedPatterns.push({
            detected: true,
            reason: 'Vyžadován souhlas s cookies', type: 'COOKIE_CONSENT_REQUIRED'
        });
      }

      // Speciální detekce pro přihlašovací stránku
      const loginButton = await fbSupport.findByText(this.page, 'Přihlásit se', { match: 'exact' });
      if (loginButton.length > 0) {
        detectedPatterns.push({
            detected: true,
            reason: 'Nalezen přihlašovací formulář v neočekávaném kroku.', type: 'UNEXPECTED_LOGIN_PAGE'
        });
      }

      for (const pattern of patterns) {
        const textFound = pattern.texts.some(text =>
          pageData.bodyText.includes(text.toLowerCase())
        );
        if (textFound) {
          detectedPatterns.push({
            detected: true,
            pattern: pattern,
            reason: pattern.reason, type: pattern.type
          });
        }
      }

      if (detectedPatterns.length > 0) {
        // Vrátit nejzávažnější problém
        const criticalPattern = detectedPatterns.find(p =>
          ['ACCOUNT_LOCKED', 'IDENTITY_VERIFICATION', 'VIDEOSELFIE', 'UNEXPECTED_LOGIN_PAGE'].includes(p.type)
        );
        if (criticalPattern) return criticalPattern;

        // Vrátit první vyžadující akci
        const actionPattern = detectedPatterns.find(p => ['AD_CONSENT_REQUIRED', 'COOKIE_CONSENT_REQUIRED'].includes(p.type));
        if (actionPattern) return actionPattern;

        // Vrátit první warning pattern
        return detectedPatterns[0];
      }

      return { detected: false };

    } catch (err) {
      return { detected: false, error: err.message };
    }
  },

  async _checkAccountLocked() {
    try {
      const lockIndicators = await this.page.evaluate(() => {
        const lockTexts = [
          'váš účet jsme uzamkli',
          'account restricted',
          'temporarily restricted',
          'account locked'
        ];

        const bodyText = document.body.textContent.toLowerCase();
        return lockTexts.some(text => bodyText.includes(text));
      });

      return lockIndicators;
    } catch (err) {
      return false;
    }
  },

  async _checkCheckpoint() {
    try {
      const checkpointIndicators = await this.page.evaluate(() => {
        const checkpointTexts = [
          'security check required',
          'bezpečnostní kontrola vyžadována',
          'verify your identity',
          'ověření identity',
          'confirm your identity',
          'potvrdit vaši identitu'
        ];

        const bodyText = document.body.textContent.toLowerCase();
        const hasCheckpointText = checkpointTexts.some(text => bodyText.includes(text));

        // Další indikátory checkpoint
        const hasVerificationForm = document.querySelector('input[type="file"]') !== null;
        const hasPhoneVerification = bodyText.includes('phone') && bodyText.includes('verification');

        return {
          detected: hasCheckpointText || hasVerificationForm || hasPhoneVerification,
          hasVerificationForm: hasVerificationForm,
          hasPhoneVerification: hasPhoneVerification
        };
      });

      return checkpointIndicators;
    } catch (err) {
      return { detected: false };
    }
  },

  async _quickErrorCheck() {
    try {
      const hasErrors = await this.page.evaluate(() => {
        const errorTexts = [
          'váš účet jsme uzamkli',
          'account restricted',
          'temporarily restricted',
          'security check',
          'bezpečnostní kontrola',
          'videoselfie',
          'verify your identity'
        ];

        const bodyText = document.body.textContent.toLowerCase();
        return errorTexts.some(text => bodyText.includes(text));
      });

      return hasErrors;
    } catch (err) {
      return true; // Při chybě předpokládáme problém
    }
  },

  async _checkLoginStatus() {
    try {
      const loginIndicators = await this.page.evaluate(() => {
        const indicators = [
          document.querySelector('[aria-label="Váš profil"]') !== null,
          document.querySelector('[data-testid="blue_bar_profile"]') !== null,
          document.querySelector('#email') === null, // Absence login formu
          document.querySelector('#pass') === null
        ];
        return indicators.some(Boolean);
      });

      return loginIndicators;
    } catch (err) {
      return false;
    }
  },

  async _checkPageResponsiveness() {
    try {
      // Test responsiveness - zkusíme kliknout na nějaký element
      await this.page.evaluate(() => {
        const testElement = document.querySelector('body');
        if (testElement) {
          testElement.scrollTop = testElement.scrollTop + 1;
          testElement.scrollTop = testElement.scrollTop - 1;
        }
      });

      return true;
    } catch (err) {
      return false;
    }
  }
};
