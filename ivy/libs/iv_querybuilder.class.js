/**
 * Název souboru: iv_querybuilder.class.js
 * Umístění: ~/ivy/libs/iv_querybuilder.class.js
 *
 * Popis: QueryBuilder facade - thin wrapper assembling domain mixins.
 * Metody jsou rozděleny do domain-specific souborů v ./querybuilder/
 */

import { SQL } from '../sql/queries/index.js';

import { UsersMixin } from './querybuilder/qb_users.js';
import { ActionsMixin } from './querybuilder/qb_actions.js';
import { LimitsMixin } from './querybuilder/qb_limits.js';
import { BehavioralMixin } from './querybuilder/qb_behavioral.js';
import { GroupsMixin } from './querybuilder/qb_groups.js';
import { SystemMixin } from './querybuilder/qb_system.js';
import { QuotesMixin } from './querybuilder/qb_quotes.js';
import { LoggingMixin } from './querybuilder/qb_logging.js';
import { HostnameBlockMixin } from './querybuilder/qb_hostname_block.js';
import { UserGroupBlockMixin } from './querybuilder/qb_user_group_block.js';
import { CompositeMixin } from './querybuilder/qb_composite.js';

export class QueryBuilder {
  constructor(safeQueryFirst, safeQueryAll, safeExecute) {
    this.SQL = SQL;
    this.safeQueryFirst = safeQueryFirst;
    this.safeQueryAll = safeQueryAll;
    this.safeExecute = safeExecute;
    this._lastUICommand = null; // Pro tracking změn UI příkazů
  }
}

// Assemble all domain mixins onto the prototype
Object.assign(QueryBuilder.prototype, UsersMixin);
Object.assign(QueryBuilder.prototype, ActionsMixin);
Object.assign(QueryBuilder.prototype, LimitsMixin);
Object.assign(QueryBuilder.prototype, BehavioralMixin);
Object.assign(QueryBuilder.prototype, GroupsMixin);
Object.assign(QueryBuilder.prototype, SystemMixin);
Object.assign(QueryBuilder.prototype, QuotesMixin);
Object.assign(QueryBuilder.prototype, LoggingMixin);
Object.assign(QueryBuilder.prototype, HostnameBlockMixin);
Object.assign(QueryBuilder.prototype, UserGroupBlockMixin);
Object.assign(QueryBuilder.prototype, CompositeMixin);
