// fb_post_verification.js – Post verification mixin for FBBot

import { Log } from '../iv_log.class.js';

export const PostVerificationMixin = {

  async stillSendButton() {
    if (!this.pageAnalyzer) {
      throw new Error('PageAnalyzer není inicializován');
    }

    const exists = await this.pageAnalyzer.elementExists("Zveřejnit", {
      matchType: 'exact',
      refreshCache: true
    });

    if (exists) {
      Log.info(`[FB] Tlačítko "Zveřejnit" stále nalezeno!`);
      return true;
    }
    return false;
  },

  async spamDetected() {
    return await this._checkTexts("Zveřejnit", "před spamem");
  },

  async tryAgainLater() {
    return await this._checkTexts("Zveřejnit", "Můžete to zkusit později");
  },

  async problemWithURL() {
    return await this._checkTexts("Zveřejnit", "problém se zadanou adresou");
  },

  async loginFailedEn() {
    if (!this.pageAnalyzer) {
      throw new Error('PageAnalyzer není inicializován');
    }

    const found = await this.pageAnalyzer.elementExists("Forgot Account?", {
      matchType: 'exact',
      refreshCache: true
    });
    if (found) {
      Log.info(`[FB] Text "Forgot Account?" nalezen.`);
      return true;
    }
    return false;
  },

  async loginFailedCs() {
    if (!this.pageAnalyzer) {
      throw new Error('PageAnalyzer není inicializován');
    }

    const found = await this.pageAnalyzer.elementExists("Nepamatujete si svůj účet?", {
      matchType: 'exact',
      refreshCache: true
    });
    if (found) {
      Log.info(`[FB] Text "Nepamatujete si svůj účet?" nalezen.`);
      return true;
    }
    return false;
  }
};
