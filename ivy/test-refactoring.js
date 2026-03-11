/**
 * test-refactoring.js
 * Smoke testy pro ověření strukturální integrity refaktorovaného projektu.
 * Spouštění: node test-refactoring.js
 *
 * Testuje:
 * 1. Import všech modulů (žádné chybějící soubory/exporty)
 * 2. Mixin metody jsou správně přiřazeny na prototypy
 * 3. Facade třídy se dají instancovat (bez DB/browser)
 * 4. Config API existuje
 * 5. Display detection modul
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let passed = 0;
let failed = 0;
const errors = [];

function assert(condition, testName) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${testName}`);
  } else {
    failed++;
    errors.push(testName);
    console.log(`  ✗ ${testName}`);
  }
}

function assertThrows(fn, testName) {
  try { fn(); failed++; errors.push(testName); console.log(`  ✗ ${testName} (nehodil výjimku)`); }
  catch { passed++; console.log(`  ✓ ${testName}`); }
}

// ============================================================
// TEST 1: QueryBuilder mixin imports & prototype methods
// ============================================================
console.log('\n=== TEST 1: QueryBuilder mixins ===');

try {
  const { UsersMixin } = await import('./libs/querybuilder/qb_users.js');
  const { ActionsMixin } = await import('./libs/querybuilder/qb_actions.js');
  const { LimitsMixin } = await import('./libs/querybuilder/qb_limits.js');
  const { BehavioralMixin } = await import('./libs/querybuilder/qb_behavioral.js');
  const { GroupsMixin } = await import('./libs/querybuilder/qb_groups.js');
  const { SystemMixin } = await import('./libs/querybuilder/qb_system.js');
  const { QuotesMixin } = await import('./libs/querybuilder/qb_quotes.js');
  const { LoggingMixin } = await import('./libs/querybuilder/qb_logging.js');
  const { HostnameBlockMixin } = await import('./libs/querybuilder/qb_hostname_block.js');
  const { UserGroupBlockMixin } = await import('./libs/querybuilder/qb_user_group_block.js');
  const { CompositeMixin } = await import('./libs/querybuilder/qb_composite.js');

  assert(typeof UsersMixin === 'object', 'UsersMixin exportován');
  assert(typeof ActionsMixin === 'object', 'ActionsMixin exportován');
  assert(typeof LimitsMixin === 'object', 'LimitsMixin exportován');
  assert(typeof BehavioralMixin === 'object', 'BehavioralMixin exportován');
  assert(typeof GroupsMixin === 'object', 'GroupsMixin exportován');
  assert(typeof SystemMixin === 'object', 'SystemMixin exportován');
  assert(typeof QuotesMixin === 'object', 'QuotesMixin exportován');
  assert(typeof LoggingMixin === 'object', 'LoggingMixin exportován');
  assert(typeof HostnameBlockMixin === 'object', 'HostnameBlockMixin exportován');
  assert(typeof UserGroupBlockMixin === 'object', 'UserGroupBlockMixin exportován');
  assert(typeof CompositeMixin === 'object', 'CompositeMixin exportován');

  // Klíčové metody v mixinech
  assert(typeof UsersMixin.getUser === 'function', 'UsersMixin.getUser()');
  assert(typeof UsersMixin.lockUser === 'function', 'UsersMixin.lockUser()');
  assert(typeof UsersMixin.unlockUser === 'function', 'UsersMixin.unlockUser()');
  assert(typeof UsersMixin.getUserById === 'function', 'UsersMixin.getUserById()');
  assert(typeof UsersMixin.lockAccountWithReason === 'function', 'UsersMixin.lockAccountWithReason()');

  assert(typeof ActionsMixin.getUserActions === 'function', 'ActionsMixin.getUserActions()');
  assert(typeof ActionsMixin.logAction === 'function', 'ActionsMixin.logAction()');
  assert(typeof ActionsMixin.initUserActionPlan === 'function', 'ActionsMixin.initUserActionPlan()');

  assert(typeof LimitsMixin.getUserLimit === 'function', 'LimitsMixin.getUserLimit()');
  assert(typeof LimitsMixin.canUserPost === 'function', 'LimitsMixin.canUserPost()');
  assert(typeof LimitsMixin.shouldRepeatUtioAction === 'function', 'LimitsMixin.shouldRepeatUtioAction()');

  assert(typeof GroupsMixin.getGroupById === 'function', 'GroupsMixin.getGroupById()');
  assert(typeof GroupsMixin.getAvailableGroups === 'function', 'GroupsMixin.getAvailableGroups()');

  assert(typeof SystemMixin.heartBeat === 'function', 'SystemMixin.heartBeat()');
  assert(typeof SystemMixin.heartBeatExtended === 'function', 'SystemMixin.heartBeatExtended()');
  assert(typeof SystemMixin.getVersionCode === 'function', 'SystemMixin.getVersionCode()');
  assert(typeof SystemMixin.getUICommand === 'function', 'SystemMixin.getUICommand()');

  assert(typeof QuotesMixin.getRandomQuote === 'function', 'QuotesMixin.getRandomQuote()');
  assert(typeof QuotesMixin.verifyMessage === 'function', 'QuotesMixin.verifyMessage()');

  assert(typeof LoggingMixin.systemLog === 'function', 'LoggingMixin.systemLog()');
  assert(typeof LoggingMixin.logSystemEvent === 'function', 'LoggingMixin.logSystemEvent()');

  assert(typeof HostnameBlockMixin.isHostnameBlocked === 'function', 'HostnameBlockMixin.isHostnameBlocked()');
  assert(typeof HostnameBlockMixin.blockHostname === 'function', 'HostnameBlockMixin.blockHostname()');

  assert(typeof UserGroupBlockMixin.isUserGroupBlocked === 'function', 'UserGroupBlockMixin.isUserGroupBlocked()');
  assert(typeof UserGroupBlockMixin.blockUserGroup === 'function', 'UserGroupBlockMixin.blockUserGroup()');

  assert(typeof CompositeMixin.getStats === 'function', 'CompositeMixin.getStats()');
  assert(typeof CompositeMixin.validateSQLModules === 'function', 'CompositeMixin.validateSQLModules()');
  assert(typeof CompositeMixin.extractFbIdFromUrl === 'function', 'CompositeMixin.extractFbIdFromUrl()');

} catch (e) {
  failed++;
  errors.push(`QueryBuilder mixin import FAILED: ${e.message}`);
  console.log(`  ✗ QueryBuilder mixin import: ${e.message}`);
}

// ============================================================
// TEST 2: QueryBuilder facade - prototyp po Object.assign
// ============================================================
console.log('\n=== TEST 2: QueryBuilder facade prototype ===');

try {
  const { QueryBuilder } = await import('./libs/iv_querybuilder.class.js');

  assert(typeof QueryBuilder === 'function', 'QueryBuilder je konstruktor');

  // Ověř že mixin metody jsou na prototypu
  const proto = QueryBuilder.prototype;
  const expectedMethods = [
    'getUser', 'getUserById', 'lockUser', 'unlockUser', 'lockAccountWithReason',
    'getUserActions', 'logAction', 'initUserActionPlan',
    'getUserLimit', 'canUserPost', 'shouldRepeatUtioAction',
    'getBehavioralProfile', 'updateBehavioralMood',
    'getGroupById', 'getAvailableGroups', 'getSingleAvailableGroup',
    'heartBeat', 'heartBeatExtended', 'getVersionCode', 'getUICommand',
    'getRandomQuote', 'verifyMessage', 'storeMessage',
    'systemLog', 'logSystemEvent', 'getSystemLogs',
    'isHostnameBlocked', 'blockHostname', 'unblockHostname',
    'isUserGroupBlocked', 'blockUserGroup',
    'getStats', 'validateSQLModules', 'extractFbIdFromUrl',
    'updateUserWorktimeWithLogging', 'userLog', 'debugUserSelectionIssue',
  ];

  for (const method of expectedMethods) {
    assert(typeof proto[method] === 'function', `QB.prototype.${method}()`);
  }

} catch (e) {
  failed++;
  errors.push(`QueryBuilder facade FAILED: ${e.message}`);
  console.log(`  ✗ QueryBuilder facade: ${e.message}`);
}

// ============================================================
// TEST 3: FBBot mixin imports
// ============================================================
console.log('\n=== TEST 3: FBBot mixins ===');

try {
  const { NavigationMixin } = await import('./libs/fb/fb_navigation.js');
  const { LoginMixin } = await import('./libs/fb/fb_login.js');
  const { ErrorDetectionMixin } = await import('./libs/fb/fb_error_detection.js');
  const { PostCreationMixin } = await import('./libs/fb/fb_post_creation.js');
  const { GroupOpsMixin } = await import('./libs/fb/fb_group_ops.js');
  const { PostVerificationMixin } = await import('./libs/fb/fb_post_verification.js');
  const { DebugMixin } = await import('./libs/fb/fb_debug.js');

  assert(typeof NavigationMixin === 'object', 'NavigationMixin exportován');
  assert(typeof LoginMixin === 'object', 'LoginMixin exportován');
  assert(typeof ErrorDetectionMixin === 'object', 'ErrorDetectionMixin exportován');
  assert(typeof PostCreationMixin === 'object', 'PostCreationMixin exportován');
  assert(typeof GroupOpsMixin === 'object', 'GroupOpsMixin exportován');
  assert(typeof PostVerificationMixin === 'object', 'PostVerificationMixin exportován');
  assert(typeof DebugMixin === 'object', 'DebugMixin exportován');

  // Klíčové metody
  assert(typeof NavigationMixin.navigateToGroup === 'function', 'NavigationMixin.navigateToGroup()');
  assert(typeof NavigationMixin.navigateToHome === 'function', 'NavigationMixin.navigateToHome()');
  assert(typeof NavigationMixin.openFB === 'function', 'NavigationMixin.openFB()');
  assert(typeof NavigationMixin.openGroup === 'function', 'NavigationMixin.openGroup()');

  assert(typeof LoginMixin.login === 'function', 'LoginMixin.login()');
  assert(typeof LoginMixin.acceptCookies === 'function', 'LoginMixin.acceptCookies()');

  assert(typeof ErrorDetectionMixin.isAccountLocked === 'function', 'ErrorDetectionMixin.isAccountLocked()');
  assert(typeof ErrorDetectionMixin.detectErrorPatterns === 'function', 'ErrorDetectionMixin.detectErrorPatterns()');
  assert(typeof ErrorDetectionMixin.handlePageIssues === 'function', 'ErrorDetectionMixin.handlePageIssues()');

  assert(typeof PostCreationMixin.writeMessage === 'function', 'PostCreationMixin.writeMessage()');
  assert(typeof PostCreationMixin.clickSendButton === 'function', 'PostCreationMixin.clickSendButton()');
  assert(typeof PostCreationMixin.newThing === 'function', 'PostCreationMixin.newThing()');

  assert(typeof GroupOpsMixin.joinToGroup === 'function', 'GroupOpsMixin.joinToGroup()');
  assert(typeof GroupOpsMixin.clickDiscus === 'function', 'GroupOpsMixin.clickDiscus()');
  assert(typeof GroupOpsMixin.isSellGroup === 'function', 'GroupOpsMixin.isSellGroup()');

  assert(typeof PostVerificationMixin.stillSendButton === 'function', 'PostVerificationMixin.stillSendButton()');
  assert(typeof PostVerificationMixin.spamDetected === 'function', 'PostVerificationMixin.spamDetected()');

  assert(typeof DebugMixin.debugPostCreationElements === 'function', 'DebugMixin.debugPostCreationElements()');
  assert(typeof DebugMixin.getScreenshot === 'function', 'DebugMixin.getScreenshot()');

} catch (e) {
  failed++;
  errors.push(`FBBot mixin import FAILED: ${e.message}`);
  console.log(`  ✗ FBBot mixin import: ${e.message}`);
}

// ============================================================
// TEST 4: PageAnalyzer mixin imports
// ============================================================
console.log('\n=== TEST 4: PageAnalyzer mixins ===');

try {
  const { CoreAnalysisMixin } = await import('./libs/analyzer/analyzer_core.js');
  const { ErrorDetectionMixin } = await import('./libs/analyzer/analyzer_errors.js');
  const { ScoringMixin } = await import('./libs/analyzer/analyzer_scoring.js');
  const { ElementsMixin } = await import('./libs/analyzer/analyzer_elements.js');
  const { TrackingMixin } = await import('./libs/analyzer/analyzer_tracking.js');
  const { FBChecksMixin } = await import('./libs/analyzer/analyzer_fb_checks.js');

  assert(typeof CoreAnalysisMixin === 'object', 'CoreAnalysisMixin exportován');
  assert(typeof ErrorDetectionMixin === 'object', 'ErrorDetectionMixin (analyzer) exportován');
  assert(typeof ScoringMixin === 'object', 'ScoringMixin exportován');
  assert(typeof ElementsMixin === 'object', 'ElementsMixin exportován');
  assert(typeof TrackingMixin === 'object', 'TrackingMixin exportován');
  assert(typeof FBChecksMixin === 'object', 'FBChecksMixin exportován');

  // Klíčové metody
  assert(typeof CoreAnalysisMixin._performBasicAnalysis === 'function', 'CoreAnalysisMixin._performBasicAnalysis()');
  assert(typeof CoreAnalysisMixin._performComplexityAnalysis === 'function', 'CoreAnalysisMixin._performComplexityAnalysis()');
  assert(typeof CoreAnalysisMixin._performGroupAnalysis === 'function', 'CoreAnalysisMixin._performGroupAnalysis()');

  assert(typeof ErrorDetectionMixin._detectErrorPatterns === 'function', 'ErrorDetectionMixin._detectErrorPatterns()');
  assert(typeof ErrorDetectionMixin._checkAccountLocked === 'function', 'ErrorDetectionMixin._checkAccountLocked()');
  assert(typeof ErrorDetectionMixin._quickErrorCheck === 'function', 'ErrorDetectionMixin._quickErrorCheck()');

  assert(typeof ScoringMixin._calculateComplexityScore === 'function', 'ScoringMixin._calculateComplexityScore()');
  assert(typeof ScoringMixin._determineOverallStatus === 'function', 'ScoringMixin._determineOverallStatus()');
  assert(typeof ScoringMixin._generateRecommendations === 'function', 'ScoringMixin._generateRecommendations()');

  assert(typeof ElementsMixin.clickElementWithText === 'function', 'ElementsMixin.clickElementWithText()');
  assert(typeof ElementsMixin.elementExists === 'function', 'ElementsMixin.elementExists()');
  assert(typeof ElementsMixin.waitForElement === 'function', 'ElementsMixin.waitForElement()');
  assert(typeof ElementsMixin.findElementsWithShortText === 'function', 'ElementsMixin.findElementsWithShortText()');

  assert(typeof TrackingMixin.startElementTracking === 'function', 'TrackingMixin.startElementTracking()');
  assert(typeof TrackingMixin.stopElementTracking === 'function', 'TrackingMixin.stopElementTracking()');
  assert(typeof TrackingMixin.clearCache === 'function', 'TrackingMixin.clearCache()');

  assert(typeof FBChecksMixin.isProfileLoaded === 'function', 'FBChecksMixin.isProfileLoaded()');
  assert(typeof FBChecksMixin.detectAccountBlock === 'function', 'FBChecksMixin.detectAccountBlock()');
  assert(typeof FBChecksMixin.quickFBCheck === 'function', 'FBChecksMixin.quickFBCheck()');
  assert(typeof FBChecksMixin.analyzeGroup === 'function', 'FBChecksMixin.analyzeGroup()');

} catch (e) {
  failed++;
  errors.push(`PageAnalyzer mixin import FAILED: ${e.message}`);
  console.log(`  ✗ PageAnalyzer mixin import: ${e.message}`);
}

// ============================================================
// TEST 5: Config API
// ============================================================
console.log('\n=== TEST 5: Config API ===');

try {
  const configModule = await import('./libs/iv_config.class.js');

  assert(typeof configModule.getIvyConfig === 'function', 'getIvyConfig exportováno');
  assert(typeof configModule.initIvyConfig === 'function', 'initIvyConfig exportováno');
  assert(typeof configModule.initIvyConfigSync === 'function', 'initIvyConfigSync exportováno');
  assert(typeof configModule.getWorkerConfig === 'function', 'getWorkerConfig alias exportováno');
  assert(typeof configModule.initWorkerConfig === 'function', 'initWorkerConfig alias exportováno');

  // IvyConfig třída
  const { IvyConfig } = configModule;
  assert(typeof IvyConfig === 'function', 'IvyConfig je konstruktor');
  assert(typeof IvyConfig.prototype.get === 'function', 'IvyConfig.prototype.get()');
  assert(typeof IvyConfig.prototype.init === 'function', 'IvyConfig.prototype.init()');
  assert(typeof IvyConfig.prototype.reload === 'function', 'IvyConfig.prototype.reload()');

} catch (e) {
  failed++;
  errors.push(`Config API FAILED: ${e.message}`);
  console.log(`  ✗ Config API: ${e.message}`);
}

// ============================================================
// TEST 6: Display detection
// ============================================================
console.log('\n=== TEST 6: Display detection ===');

try {
  const { getAvailableDisplay } = await import('./libs/iv_display.js');

  assert(typeof getAvailableDisplay === 'function', 'getAvailableDisplay exportováno');

  // Funkce by měla vrátit string nebo null
  const result = getAvailableDisplay();
  assert(result === null || typeof result === 'string', `getAvailableDisplay() vrací ${result === null ? 'null' : `"${result}"`}`);

} catch (e) {
  failed++;
  errors.push(`Display detection FAILED: ${e.message}`);
  console.log(`  ✗ Display detection: ${e.message}`);
}

// ============================================================
// TEST 7: Facade třídy se dají importovat z hlavních cest
// ============================================================
console.log('\n=== TEST 7: Facade imports ===');

try {
  const { QueryBuilder } = await import('./libs/iv_querybuilder.class.js');
  assert(QueryBuilder && typeof QueryBuilder === 'function', 'QueryBuilder named export');
} catch (e) {
  failed++; errors.push(`QB facade import: ${e.message}`);
  console.log(`  ✗ QB facade import: ${e.message}`);
}

try {
  const { FBBot } = await import('./libs/iv_fb.class.js');
  assert(FBBot && typeof FBBot === 'function', 'FBBot named export');
} catch (e) {
  failed++; errors.push(`FBBot facade import: ${e.message}`);
  console.log(`  ✗ FBBot facade import: ${e.message}`);
}

try {
  const { PageAnalyzer } = await import('./libs/iv_page_analyzer.class.js');
  assert(PageAnalyzer && typeof PageAnalyzer === 'function', 'PageAnalyzer named export');
} catch (e) {
  failed++; errors.push(`PageAnalyzer facade import: ${e.message}`);
  console.log(`  ✗ PageAnalyzer facade import: ${e.message}`);
}

// ============================================================
// TEST 8: package.json integrity
// ============================================================
console.log('\n=== TEST 8: package.json ===');

try {
  const pkg = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf-8'));
  assert(pkg.type === 'module', 'type === "module"');
  assert(typeof pkg.versionCode === 'string' && pkg.versionCode.length > 0, `versionCode = "${pkg.versionCode}"`);
  assert(pkg.dependencies?.mysql2, 'závislost mysql2');
  assert(pkg.dependencies?.puppeteer, 'závislost puppeteer');
} catch (e) {
  failed++; errors.push(`package.json: ${e.message}`);
  console.log(`  ✗ package.json: ${e.message}`);
}

// ============================================================
// TEST 9: CompositeMixin.extractFbIdFromUrl - unit test
// ============================================================
console.log('\n=== TEST 9: extractFbIdFromUrl unit test ===');

try {
  const { CompositeMixin } = await import('./libs/querybuilder/qb_composite.js');

  const extract = CompositeMixin.extractFbIdFromUrl;
  assert(extract('https://www.facebook.com/groups/123456/') === '123456', 'extrahuje group ID z URL');
  assert(extract('') === null || extract('') === undefined || extract('') === '', 'prázdný URL');
} catch (e) {
  failed++; errors.push(`extractFbIdFromUrl: ${e.message}`);
  console.log(`  ✗ extractFbIdFromUrl: ${e.message}`);
}

// ============================================================
// TEST 10: ScoringMixin - unit testy
// ============================================================
console.log('\n=== TEST 10: ScoringMixin unit tests ===');

try {
  const { ScoringMixin } = await import('./libs/analyzer/analyzer_scoring.js');

  // _calculateComplexityScore
  const score0 = ScoringMixin._calculateComplexityScore(null);
  assert(score0 === 0, '_calculateComplexityScore(null) === 0');

  const score1 = ScoringMixin._calculateComplexityScore({ elements: 500, images: 10, scripts: 15, links: 30 });
  assert(typeof score1 === 'number' && score1 > 0, `_calculateComplexityScore({...}) = ${score1} > 0`);

  // _calculateErrorSeverity
  const sev1 = ScoringMixin._calculateErrorSeverity({ detected: false }, true, { detected: false });
  assert(sev1 === 'critical', 'accountLocked => critical');

  const sev2 = ScoringMixin._calculateErrorSeverity({ detected: false }, false, { detected: true });
  assert(sev2 === 'high', 'checkpoint => high');

  const sev3 = ScoringMixin._calculateErrorSeverity({ detected: false }, false, { detected: false });
  assert(sev3 === 'none', 'nic => none');

} catch (e) {
  failed++; errors.push(`ScoringMixin unit tests: ${e.message}`);
  console.log(`  ✗ ScoringMixin: ${e.message}`);
}

// ============================================================
// TEST 11: Žádné duplicitní metody mezi mixiny
// ============================================================
console.log('\n=== TEST 11: No duplicate methods ===');

try {
  // QB mixins
  const qbMixins = [
    (await import('./libs/querybuilder/qb_users.js')).UsersMixin,
    (await import('./libs/querybuilder/qb_actions.js')).ActionsMixin,
    (await import('./libs/querybuilder/qb_limits.js')).LimitsMixin,
    (await import('./libs/querybuilder/qb_behavioral.js')).BehavioralMixin,
    (await import('./libs/querybuilder/qb_groups.js')).GroupsMixin,
    (await import('./libs/querybuilder/qb_system.js')).SystemMixin,
    (await import('./libs/querybuilder/qb_quotes.js')).QuotesMixin,
    (await import('./libs/querybuilder/qb_logging.js')).LoggingMixin,
    (await import('./libs/querybuilder/qb_hostname_block.js')).HostnameBlockMixin,
    (await import('./libs/querybuilder/qb_user_group_block.js')).UserGroupBlockMixin,
    (await import('./libs/querybuilder/qb_composite.js')).CompositeMixin,
  ];

  const qbMethodNames = new Map();
  let qbDuplicates = [];
  for (const mixin of qbMixins) {
    for (const key of Object.keys(mixin)) {
      if (qbMethodNames.has(key)) {
        qbDuplicates.push(key);
      }
      qbMethodNames.set(key, true);
    }
  }
  assert(qbDuplicates.length === 0, `QB: žádné duplicitní metody${qbDuplicates.length ? ' (duplikáty: ' + qbDuplicates.join(', ') + ')' : ''}`);

  // Analyzer mixins
  const anMixins = [
    (await import('./libs/analyzer/analyzer_core.js')).CoreAnalysisMixin,
    (await import('./libs/analyzer/analyzer_errors.js')).ErrorDetectionMixin,
    (await import('./libs/analyzer/analyzer_scoring.js')).ScoringMixin,
    (await import('./libs/analyzer/analyzer_elements.js')).ElementsMixin,
    (await import('./libs/analyzer/analyzer_tracking.js')).TrackingMixin,
    (await import('./libs/analyzer/analyzer_fb_checks.js')).FBChecksMixin,
  ];

  const anMethodNames = new Map();
  let anDuplicates = [];
  for (const mixin of anMixins) {
    for (const key of Object.keys(mixin)) {
      if (anMethodNames.has(key)) {
        anDuplicates.push(key);
      }
      anMethodNames.set(key, true);
    }
  }
  assert(anDuplicates.length === 0, `Analyzer: žádné duplicitní metody${anDuplicates.length ? ' (duplikáty: ' + anDuplicates.join(', ') + ')' : ''}`);

} catch (e) {
  failed++; errors.push(`Duplicate methods check: ${e.message}`);
  console.log(`  ✗ Duplicate methods: ${e.message}`);
}

// ============================================================
// TEST 12: Ověření existence SQL queries indexu
// ============================================================
console.log('\n=== TEST 12: SQL queries index ===');

try {
  const sqlModule = await import('./sql/queries/index.js');
  assert(sqlModule.default !== undefined || Object.keys(sqlModule).length > 0, 'SQL queries modul má exporty');
} catch (e) {
  failed++; errors.push(`SQL queries: ${e.message}`);
  console.log(`  ✗ SQL queries index: ${e.message}`);
}

// ============================================================
// TEST 13: Ověření, že iv_config.js (starý) NEEXISTUJE
// ============================================================
console.log('\n=== TEST 13: Deleted files ===');

try {
  await import('./iv_config.js');
  assert(false, 'iv_config.js by neměl existovat');
} catch (e) {
  assert(e.code === 'ERR_MODULE_NOT_FOUND' || e.message.includes('Cannot find'), 'iv_config.js smazán (očekávaná chyba importu)');
}

// ============================================================
// SOUHRN
// ============================================================
console.log('\n======================================================');
console.log(`VÝSLEDKY: ${passed} passed, ${failed} failed`);
console.log('======================================================');

if (errors.length > 0) {
  console.log('\nSelhání:');
  for (const e of errors) {
    console.log(`  - ${e}`);
  }
}

process.exit(failed > 0 ? 1 : 0);
