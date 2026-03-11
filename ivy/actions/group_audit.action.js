/**
 * Název souboru: group_audit.action.js
 * Umístění: ~/ivy/actions/group_audit.action.js
 *
 * Popis: Audit existujících G/GV skupin z databáze.
 * - Neinvazivní, opakovatelná akce
 * - Navštíví max 5 skupin za jedno spuštění
 * - Aktualizuje: name, member_count, category, last_seen
 * - Kontroluje dostupnost skupiny (content_not_available → trvalý blok uživatel↔skupina)
 * - Vybírá skupiny s nejstarším last_seen
 */

import { BaseAction } from '../libs/base_action.class.js';
import { Log } from '../libs/iv_log.class.js';
import { Wait } from '../libs/iv_wait.class.js';
import { FBGroupAnalyzer } from '../iv_fb_group_analyzer.js';
import { db } from '../iv_sql.js';
import { QueryUtils } from '../sql/queries/index.js';

const MAX_GROUPS_PER_RUN = 5;

export class GroupAuditAction extends BaseAction {
  constructor() {
    super('group_audit');
  }

  getRequirements() {
    return {
      needsFB: true,
      needsUtio: false
    };
  }

  async verifyReadiness(user, context) {
    const { fbBot } = context;

    if (!fbBot) {
      return { ready: false, reason: 'Chybí FBBot instance', critical: true };
    }

    return { ready: true, reason: 'Akce je připravena' };
  }

  async execute(user, context, pickedAction) {
    const { fbBot } = context;

    try {
      Log.info(`[${user.id}]`, 'Spouštím group_audit...');
      await fbBot.bringToFront();

      // Načti skupiny k auditu (nejstarší last_seen)
      const query = QueryUtils.getQuery('groups.getGroupsForAudit');
      const [groups] = await db.pool.query(query, [user.id, MAX_GROUPS_PER_RUN]);

      if (!groups || groups.length === 0) {
        Log.info(`[${user.id}]`, 'Žádné skupiny k auditu');
        return true;
      }

      Log.info(`[${user.id}]`, `Audit ${groups.length} skupin (G/GV)`);

      const analyzer = new FBGroupAnalyzer(fbBot.page, fbBot);
      let audited = 0;
      let inaccessible = 0;

      for (const group of groups) {
        try {
          const result = await this.auditSingleGroup(user, fbBot, analyzer, group);
          if (result.success) {
            audited++;
          }
          if (result.inaccessible) {
            inaccessible++;
          }
        } catch (err) {
          await Log.warn(`[${user.id}]`, `Audit skupiny ${group.name} (${group.id}) selhal: ${err.message}`);
        }

        // Lidská pauza mezi skupinami (8-20s)
        if (group !== groups[groups.length - 1]) {
          const pause = 8 + Math.random() * 12;
          await Wait.toSeconds(pause, 'Pauza mezi skupinami');
        }
      }

      const summary = `Audit: ${audited}/${groups.length} OK, ${inaccessible} nedostupných`;
      Log.success(`[${user.id}]`, summary);
      await this.logAction(user, null, summary);

      return true;

    } catch (err) {
      await Log.error(`[${user.id}]`, `Chyba v group_audit: ${err.message}`);
      return false;
    }
  }

  /**
   * Audit jedné skupiny — navigace, kontrola dostupnosti, extrakce dat, update DB
   */
  async auditSingleGroup(user, fbBot, analyzer, group) {
    Log.info(`[${user.id}]`, `Audit: ${group.name} (${group.type}, id=${group.id})`);

    // Navigace na skupinu
    await fbBot.navigateToGroup(group.fb_id, group.is_buy_sell_group === 1);
    await Wait.toSeconds(3 + Math.random() * 3, 'Načtení skupiny');

    // Kontrola dostupnosti — "Obsah teď není dostupný"
    const notAvailable = await fbBot.contentNotAvailable();
    if (notAvailable) {
      Log.warn(`[${user.id}]`, `Skupina ${group.name} (${group.id}) je nedostupná pro tohoto uživatele`);
      await this.blockUserGroup(user.id, group.id, 'content_not_available');
      return { success: true, inaccessible: true };
    }

    // Analýza skupiny (PageAnalyzer)
    let membershipStatus = 'unknown';
    if (fbBot.pageAnalyzer) {
      try {
        const groupAnalysis = await fbBot.pageAnalyzer.analyzeGroup();
        if (!groupAnalysis.isGroup) {
          Log.warn(`[${user.id}]`, `${group.name} (${group.id}) — stránka není skupina pro tohoto uživatele`);
          await this.blockUserGroup(user.id, group.id, 'not_a_group_page');
          return { success: true, inaccessible: true };
        }
        membershipStatus = groupAnalysis.membershipStatus?.status || 'unknown';
      } catch (err) {
        Log.warn(`[${user.id}]`, `PageAnalyzer chyba pro ${group.name}: ${err.message}`);
      }
    }

    // Extrakce informací (FBGroupAnalyzer)
    const groupInfo = await analyzer.extractGroupInfo();

    if (groupInfo) {
      // Aktualizace DB — cooldown 2-8h aby se stejná skupina neauditovala brzy znovu
      const cooldownMinutes = 120 + Math.floor(Math.random() * 360);
      const updateQuery = QueryUtils.getQuery('groups.updateGroupAudit');
      await db.pool.query(updateQuery, [
        groupInfo.name || group.name,
        groupInfo.member_count,
        groupInfo.category || group.category,
        cooldownMinutes,
        group.id
      ]);

      const memberInfo = groupInfo.member_count ? ` (${groupInfo.member_count} členů)` : '';
      Log.info(`[${user.id}]`, `  → ${groupInfo.name}${memberInfo}, členství: ${membershipStatus}`);
    } else {
      // Alespoň aktualizuj last_seen
      await db.updateGroupLastSeen(group.id);
      Log.warn(`[${user.id}]`, `  → Nepodařilo se extrahovat info pro ${group.name}`);
    }

    // Log akce
    await db.logAction(user.id, this.actionCode, group.id,
      `Audit ${group.type}: ${groupInfo?.name || group.name} [${membershipStatus}]`);

    return { success: true, inaccessible: false, membershipStatus };
  }

  /**
   * Trvale zablokuje skupinu pro daného uživatele (blocked_until = 2099-12-31)
   */
  async blockUserGroup(userId, groupId, reason) {
    try {
      const dateStr = new Date().toISOString().slice(0, 10);
      await db.pool.query(`
        INSERT INTO user_groups (user_id, group_id, type, blocked_until, block_count, last_block_reason, last_block_date, time)
        VALUES (?, ?, 0, '2099-12-31 00:00:00', 1, ?, NOW(), NOW())
        ON DUPLICATE KEY UPDATE
          blocked_until = '2099-12-31 00:00:00',
          block_count = block_count + 1,
          last_block_reason = ?,
          last_block_date = NOW()
      `, [userId, groupId, `${reason} (${dateStr})`, `${reason} (${dateStr})`]);
      Log.info(`[${userId}]`, `Skupina ${groupId} trvale zablokována: ${reason}`);
    } catch (err) {
      await Log.error(`[${userId}]`, `Chyba při blokování skupiny ${groupId}: ${err.message}`);
    }
  }
}
