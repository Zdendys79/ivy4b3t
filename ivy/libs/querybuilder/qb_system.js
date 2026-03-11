/**
 * QueryBuilder mixin: System
 * Systémové funkce - heartBeat, heartBeatExtended, UI commands, variables, etc.
 */

import os from 'node:os';

const hostname = os.hostname();

export const SystemMixin = {

  // ---- Variables ----

  async getVariable(name) {
    const result = await this.safeQueryFirst('system.getVariable', [name]);
    return result ? result.value : null;
  },

  async setVariable(name, value) {
    return await this.safeExecute('system.setVariable', [name, value]);
  },

  /**
   * Atomicky zvýší číselnou proměnnou v databázi
   * @param {string} name - Název proměnné
   * @param {number} amount - Hodnota o kterou zvýšit (default: 1)
   * @returns {Promise<number>} Nová hodnota po zvýšení
   */
  async incrementVariable(name, amount = 1) {
    // Atomická operace - INSERT/UPDATE s číselným přírůstkem
    await this.safeExecute('system.incrementVariable', [name, amount.toString()]);

    // Získej novou hodnotu
    const result = await this.safeQueryFirst('system.getVariableAfterIncrement', [name]);
    return result ? parseInt(result.new_value) : amount;
  },

  /**
   * Atomicky sníží číselnou proměnnou v databázi
   * @param {string} name - Název proměnné
   * @param {number} amount - Hodnota o kterou snížit (default: 1)
   * @returns {Promise<number>} Nová hodnota po snížení
   */
  async decrementVariable(name, amount = 1) {
    return await this.incrementVariable(name, -amount);
  },

  // ---- Heartbeat ----

  async heartBeat(userId = 0, groupId = 0, version = 'unknown') {
    return await this.safeExecute('system.heartBeat', [
      hostname, userId, groupId, version, userId, groupId, version
    ]);
  },

  async heartBeatExtended(params) {
    const { hostname, version, userId, action, actionStartedAt, systemVersions } = params;

    // Konvertovat timestamp na DATETIME nebo NULL
    let actionStartedAtFormatted = null;
    if (actionStartedAt) {
      actionStartedAtFormatted = new Date(actionStartedAt).toISOString().slice(0, 19).replace('T', ' ');
    }

    // Připravit system_versions JSON (pokud je poskytnut)
    let systemVersionsJson = null;
    if (systemVersions) {
      systemVersionsJson = JSON.stringify(systemVersions);
    }

    // Porovnat s předchozím stavem pro detekci změn
    const currentState = `${userId || 'null'}_${action || 'null'}_${actionStartedAtFormatted || 'null'}`;
    if (this._lastHeartbeatState !== currentState) {
      this._lastHeartbeatState = currentState;
      if (userId || action) {
        const { Log } = await import('../iv_log.class.js');
        await Log.info('[HEARTBEAT]', `State changed: User ${userId || 'none'}, Action: ${action || 'none'}`);
      }
    }

    // Aktualizovat heartbeat s možnými system_versions
    await this.safeExecute('system.heartBeatExtended', [
      hostname, userId, version, action, actionStartedAtFormatted, systemVersionsJson,
      userId, version, action, actionStartedAtFormatted, systemVersionsJson
    ]);

    // Získat UI příkaz a verzi z databáze
    const uiCommand = await this.getUICommand();
    const dbVersion = await this.getVersionCode();

    return {
      uiCommand,
      dbVersion: (dbVersion && dbVersion.code) ? dbVersion.code : null
    };
  },

  async getVersionCode() {
    return await this.safeQueryFirst('system.getVersionCode');
  },

  // ---- UI Commands ----

  async getUICommand() {
    const result = await this.safeQueryFirst('system.getUICommand', [hostname]);

    // Log pouze při změně UI příkazu (nový ID nebo změna stavu)
    const currentUICommand = result ? `${result.id}:${result.command}` : null;
    if (currentUICommand !== this._lastUICommand) {
      this._lastUICommand = currentUICommand;

      if (result) {
        const { Log } = await import('../iv_log.class.js');
        await Log.info('[UI_COMMAND]', `UI command found: ${result.command} (ID: ${result.id})`);
      } else if (this._lastUICommand !== null) {
        const { Log } = await import('../iv_log.class.js');
        await Log.info('[UI_COMMAND]', `No UI commands found`);
      }
    }

    return result;
  },

  async uiCommandSolved(id) {
    return await this.safeExecute('system.uiCommandSolved', [id]);
  },

  async uiCommandAccepted(id) {
    return await this.safeExecute('system.uiCommandAccepted', [id]);
  },

  // ---- URLs & Referers ----

  async loadUrl() {
    return await this.safeQueryFirst('system.loadUrl');
  },

  async useUrl(url) {
    return await this.safeExecute('system.useUrl', [url]);
  },

  async getRandomReferer() {
    return await this.safeQueryFirst('system.getRandomReferer');
  }

};
