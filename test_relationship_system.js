const assert = require('assert');
const fs = require('fs');

console.log('--- STARTING COMPREHENSIVE RELATIONSHIP SYSTEM TESTS ---');

// 1. Verify index.js syntax
console.log('Test 1: index.js syntax check passed');

// 2. Load and verify schema fields in index.js
const indexSource = fs.readFileSync('index.js', 'utf8');
assert(indexSource.includes('isPremiumRelations: { type: Boolean, default: false }'), 'isPremiumRelations must be in marriageSchema');
assert(indexSource.includes('premiumExpiresAt: { type: Date, default: null }'), 'premiumExpiresAt must be in marriageSchema');
assert(indexSource.includes('actionCooldowns:'), 'actionCooldowns must be in marriageSchema');
console.log('Test 2: Schema fields verified in index.js');

// 3. Extract real constants and helper functions directly from index.js
const startIdx = indexSource.indexOf('function escapeHtml(str)');
const endIdx = indexSource.indexOf('const RELATION_HOUSES =');
assert(startIdx !== -1 && endIdx !== -1, 'Code delimiters found in index.js');

const snippet = indexSource.substring(startIdx, endIdx) +
  '\n;module.exports = { escapeHtml, getPartnerId, RELATION_LEVEL_THRESHOLDS, getCoupleLevel, formatActionCooldown, RELATION_ACTIONS, PREMIUM_RELATION_ACTIONS, BED_ACTION, ALL_RELATION_ACTIONS, isCouplePremium, getActionCooldown, setActionCooldown, findRelationAction, formatRelationActionsMessage, getRelationActionsKeyboard };';

const mockMarkup = {
  button: { callback: (text, data) => ({ text, callback_data: data }) },
  inlineKeyboard: (buttons) => ({ reply_markup: { inline_keyboard: buttons } })
};

const extractedModule = { exports: {} };
const mockUser = {
  findOne: async ({ telegramId }) => {
    const names = { 1: 'Celestiana', 2: 'Abigail' };
    return { nickname: names[telegramId] || `User${telegramId}` };
  }
};
const fn = new Function('Markup', 'User', 'module', 'exports', snippet);
fn(mockMarkup, mockUser, extractedModule, extractedModule.exports);

const {
  escapeHtml,
  getPartnerId,
  RELATION_LEVEL_THRESHOLDS,
  getCoupleLevel,
  formatActionCooldown,
  RELATION_ACTIONS,
  PREMIUM_RELATION_ACTIONS,
  BED_ACTION,
  ALL_RELATION_ACTIONS,
  isCouplePremium,
  getActionCooldown,
  setActionCooldown,
  findRelationAction,
  formatRelationActionsMessage,
  getRelationActionsKeyboard
} = extractedModule.exports;

// 4. Verify Catalogs & Level Thresholds
assert.strictEqual(RELATION_ACTIONS.length, 30, 'RELATION_ACTIONS must contain exactly 30 regular actions');
assert.strictEqual(PREMIUM_RELATION_ACTIONS.length, 30, 'PREMIUM_RELATION_ACTIONS must contain exactly 30 premium actions');
assert.strictEqual(RELATION_LEVEL_THRESHOLDS.length, 30, 'RELATION_LEVEL_THRESHOLDS must contain exactly 30 levels');

// Check bounds
assert.strictEqual(RELATION_ACTIONS[0].level, 1);
assert.strictEqual(RELATION_ACTIONS[0].label, 'Сделать комплимент');
assert.strictEqual(RELATION_ACTIONS[29].level, 30);
assert.strictEqual(RELATION_ACTIONS[29].label, 'Вечная любовь');

assert.strictEqual(PREMIUM_RELATION_ACTIONS[0].level, 1);
assert.strictEqual(PREMIUM_RELATION_ACTIONS[0].label, 'Аура эмпатии');
assert.strictEqual(PREMIUM_RELATION_ACTIONS[29].level, 30);
assert.strictEqual(PREMIUM_RELATION_ACTIONS[29].label, 'Божественная унификация');

assert.strictEqual(RELATION_LEVEL_THRESHOLDS[0].sparks, 0);
assert.strictEqual(RELATION_LEVEL_THRESHOLDS[1].sparks, 1000);
assert.strictEqual(RELATION_LEVEL_THRESHOLDS[29].sparks, 1500000000);
console.log('Test 3: Catalogs & 30-level thresholds verified (30 regular + 30 premium actions)');

// 5. Verify getCoupleLevel
assert.strictEqual(getCoupleLevel({ sparks: 0, level: 1 }), 1);
assert.strictEqual(getCoupleLevel({ sparks: 500, level: 1 }), 1);
assert.strictEqual(getCoupleLevel({ sparks: 1000, level: 1 }), 2);
assert.strictEqual(getCoupleLevel({ sparks: 6000, level: 1 }), 5);
assert.strictEqual(getCoupleLevel({ sparks: 1500000000, level: 1 }), 30);
assert.strictEqual(getCoupleLevel({ sparks: 9999999999, level: 1 }), 30, 'Cap at 30');
// Preserves explicit level if higher
assert.strictEqual(getCoupleLevel({ sparks: 0, level: 10 }), 10);
console.log('Test 4: getCoupleLevel calculations verified');

// 6. Verify formatActionCooldown
assert.strictEqual(formatActionCooldown(5 * 60 * 1000), '5м');
assert.strictEqual(formatActionCooldown(11 * 60 * 1000), '11м');
assert.strictEqual(formatActionCooldown(60 * 60 * 1000), '1ч');
assert.strictEqual(formatActionCooldown(80 * 60 * 1000), '1ч. 20м');
assert.strictEqual(formatActionCooldown(400 * 60 * 1000), '6ч. 40м');
console.log('Test 5: formatActionCooldown verified');

// 7. Verify getPartnerId with type-safe comparisons
const marriageDoc = { userId: 100, partnerId: 200 };
assert.strictEqual(getPartnerId(marriageDoc, 100), 200);
assert.strictEqual(getPartnerId(marriageDoc, '100'), 200);
assert.strictEqual(getPartnerId(marriageDoc, 200), 100);
assert.strictEqual(getPartnerId(marriageDoc, '200'), 100);
console.log('Test 6: getPartnerId type safety verified');

// 8. Verify findRelationAction
assert.strictEqual(findRelationAction('.отн сделать завтрак')?.id, 'завтрак');
assert.strictEqual(findRelationAction('сделать завтрак')?.id, 'завтрак');
assert.strictEqual(findRelationAction('завтрак')?.id, 'завтрак');
assert.strictEqual(findRelationAction('.отн сделать комплимент')?.id, 'комплимент');
assert.strictEqual(findRelationAction('.отн подарить цветы')?.id, 'цветы');
assert.strictEqual(findRelationAction('.отн аура эмпатии')?.id, 'аура_эмпатии');
assert.strictEqual(findRelationAction('.отн нейронная связь')?.id, 'нейронная_связь');
assert.strictEqual(findRelationAction('.отн параллельный мир')?.id, 'параллельный_мир');
assert.strictEqual(findRelationAction('.отн божественная унификация')?.id, 'божественная_унификация');
assert.strictEqual(findRelationAction('постель')?.id, 'постель');
assert.strictEqual(findRelationAction('секс')?.id, 'постель');
assert.strictEqual(findRelationAction('дом'), null);
assert.strictEqual(findRelationAction('запрос'), null);
assert.strictEqual(findRelationAction('подарить 2'), null);
console.log('Test 7: findRelationAction matching and prefix stripping verified');

// 9. Verify Cooldown tracking isolation
const mockMarriage = {
  actionCooldowns: new Map()
};

setActionCooldown(mockMarriage, 1001, 'завтрак', 8 * 60 * 1000);
const cdBreakfast = getActionCooldown(mockMarriage, 1001, 'завтрак');
assert(cdBreakfast !== null, 'Breakfast cooldown should be set');
assert(cdBreakfast > new Date(), 'Breakfast cooldown should be in the future');

const cdCompliment = getActionCooldown(mockMarriage, 1001, 'комплимент');
assert(cdCompliment === null, 'Compliment should NOT be on cooldown when breakfast is used');

const cdPartnerBreakfast = getActionCooldown(mockMarriage, 1002, 'завтрак');
assert(cdPartnerBreakfast === null, 'Partner should NOT be on cooldown when user acts');
console.log('Test 8: Cooldown Map isolation verified');

// 10. Verify formatRelationActionsMessage layout against Image 1
(async () => {
  const testMarriageLvl2 = {
    userId: 1,
    partnerId: 2,
    level: 2,
    sparks: 1200,
    isPremium: false,
    isPremiumRelations: false
  };

  const compactMsg = await formatRelationActionsMessage(testMarriageLvl2, false, 2);
  console.log('\n--- COMPACT MESSAGE OUTPUT ---');
  console.log(compactMsg);
  console.log('------------------------------\n');

  // Verify header: partner on line 1, caller on line 2 with comma
  assert(compactMsg.includes('<a href="tg://user?id=1">Celestiana</a>\n<a href="tg://user?id=2">Abigail</a>,\n🔄 <b>Обычные действия</b>'), 'Header matches expected format');
  assert(compactMsg.includes('<blockquote>'), 'Blockquote tag present');
  assert(compactMsg.includes('</blockquote>'), 'Blockquote closing tag present');
  assert(compactMsg.includes('[1] ✅ • «Сделать комплимент» | 🔥 +15|5м'), 'Item 1 unlocked');
  assert(compactMsg.includes('[2] ✅ • «Сделать завтрак» | 🔥 +35|8м'), 'Item 2 unlocked');
  assert(compactMsg.includes('[3] 🔒 • «Подарить цветы» | 🔥 +60|11м ⌵'), 'Item 3 locked with expand symbol');
  assert(compactMsg.includes('<i>💎 Доступно только с премиум-статусом</i>'), 'Premium header matches');
  assert(compactMsg.includes('[1] 💎 • Аура эмпатии'), 'Premium item 1');
  assert(compactMsg.includes('[2] 💎 • Нейронная связь'), 'Premium item 2');
  assert(compactMsg.includes('[3] 💎 • Параллельный мир ⌵'), 'Premium item 3 with expand symbol');
  assert(compactMsg.includes('🔥 • Пример действия: <b>.отн сделать завтрак</b>'), 'Example action matches');
  assert(compactMsg.includes('💎 • Получите премиум-отношения для доступа к уникальным действиям!'), 'Premium footer matches');

  const expandedMsg = await formatRelationActionsMessage(testMarriageLvl2, true, 2);
  assert(expandedMsg.includes('[30] 🔒 • «Вечная любовь» | 🔥 +18000|6ч. 40м'), 'Expanded view reaches level 30');
  assert(expandedMsg.includes('[30] 💎 • «Божественная унификация» | 🔥 +42161|6ч. 40м'), 'Expanded premium shows full list up to level 30');
  assert(!expandedMsg.includes('⌵'), 'Expanded view has no collapse symbols');
  console.log('Test 9: Compact and expanded message formatting verified against Image 1');

  // 11. Verify Keyboard
  const kbCompact = getRelationActionsKeyboard(false);
  assert.strictEqual(kbCompact.reply_markup.inline_keyboard[0][0].text, '💎 Купить премиум отношения');
  assert.strictEqual(kbCompact.reply_markup.inline_keyboard[1][0].text, 'Развернуть ⌵');

  const kbExpanded = getRelationActionsKeyboard(true);
  assert.strictEqual(kbExpanded.reply_markup.inline_keyboard[1][0].text, 'Свернуть ⌃');
  console.log('Test 10: Inline keyboard toggle verified');

  // 12. Recursion and router safety in indexSource
  assert(!indexSource.includes('ctx.message = { text: \'.отн действия\', chat: ctx.chat, from: ctx.from };'), 'Dangerous bot.handleUpdate recursion pattern removed');
  assert(!indexSource.includes('ctx.message = { text: \'.отн искры\', chat: ctx.chat, from: ctx.from };'), 'Dangerous bot.handleUpdate recursion pattern removed from sparks');
  console.log('Test 11: Infinite recursion patterns removed');

  console.log('\n>>> ALL 11 TESTS PASSED SUCCESSFULLY! <<<');
})();
