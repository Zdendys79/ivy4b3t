/**
 * QueryBuilder mixin: Behavioral Profiles
 * Pokročilé lidské chování - getBehavioralProfile, updateBehavioralMood, etc.
 */

export const BehavioralMixin = {

  async getBehavioralProfile(userId) {
    const result = await this.safeQueryFirst('behavioralProfiles.getUserProfile', [userId]);
    if (!result) {
      // Vytvoř default profil pokud neexistuje
      await this.safeExecute('behavioralProfiles.createDefaultProfile', [userId]);
      return await this.safeQueryFirst('behavioralProfiles.getUserProfile', [userId]);
    }
    return result;
  },

  async updateBehavioralMood(userId, mood, energyLevel) {
    return await this.safeExecute('behavioralProfiles.updateMoodAndEnergy', [
      mood, energyLevel, userId
    ]);
  },

  // ODSTRANĚNO: logEmotionalState - emoce jsou v profilu, ne v logu

  // ODSTRANĚNO: getCurrentEmotion - emoce jsou v profilu

  // ODSTRANĚNO: saveBehaviorPattern - robot neukládá vlastní vzory
  // ODSTRANĚNO: getCachedBehaviorPattern - žádná cache vzorů

  async initializeBehavioralProfiles() {
    return await this.safeExecute('behavioralProfiles.initializeAllProfiles');
  }

};
