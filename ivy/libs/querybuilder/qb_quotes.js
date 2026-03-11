/**
 * QueryBuilder mixin: Quotes
 * Správa citátů a zpráv - getRandomQuote, markQuoteAsUsed, verify/store, etc.
 */

export const QuotesMixin = {

  async getRandomQuote(userId) {
    return await this.safeQueryFirst('quotes.getRandomForUser', [userId]);
  },

  // updateQuoteNextSeen je duplicitní s quotes.markAsUsed - použij markQuoteAsUsed() místo toho

  async markQuoteAsUsed(quoteId, userId, days = 30) {
    // Zaznamenat použití citátu uživatelem do action_log
    const logResult = await this.logAction(userId, 'quote_post', quoteId.toString(), `Quote ${quoteId} used by user ${userId}`);

    // Nastavit globální cooldown na 30 dnů (aby se citáty neopakovaly)
    const cooldownResult = await this.safeExecute('quotes.markAsUsed', [days, quoteId]);

    return logResult && cooldownResult;
  },

  async verifyMessage(groupId, messageHash) {
    return await this.safeQueryFirst('quotes.findByHash', [messageHash]);
  },

  async verifyMsg(groupId, messageHash) {
    return await this.verifyMessage(groupId, messageHash);
  },

  async storeMessage(userId, text, author = null) {
    return await this.safeExecute('quotes.insertQuote', [userId, text, author]);
  }

};
