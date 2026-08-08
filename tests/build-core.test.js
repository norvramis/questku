const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

// Guards the core-injection contract of scripts/build.js: the built questku.js
// must carry a `__core` object exposing the extracted pure helpers. This is the
// exact regression that shipped as `__core = {}` (merged never assigned).
test('built questku.js exposes the full core module to the IIFE', () => {
  const built = fs.readFileSync(path.join(__dirname, '..', 'questku.js'), 'utf8');
  const start = built.indexOf('var __core = ');
  assert.ok(start > 0, '__core block missing from built questku.js');
  const end = built.indexOf('    var getRewardTypes', start);
  assert.ok(end > start, 'core wrapper terminator missing');
  const src = built.slice(start, end);
  const __core = new Function(src + '; return __core;')();
  assert.equal(typeof __core.getRewardTypes, 'function', 'getRewardTypes');
  assert.equal(typeof __core.getOrbValue, 'function', 'getOrbValue');
  assert.equal(typeof __core.getRewardHtml, 'function', 'getRewardHtml');
  assert.equal(typeof __core.isExpired, 'function', 'isExpired');
  assert.equal(typeof __core.isDesktopOnlyQuest, 'function', 'isDesktopOnlyQuest');
});

test('built __core functions behave like the pure module', async () => {
  const { getRewardTypes, getOrbValue, getRewardHtml } = require('../src/core/rewards');
  const built = fs.readFileSync(path.join(__dirname, '..', 'questku.js'), 'utf8');
  const start = built.indexOf('var __core = ');
  const end = built.indexOf('/* core */', start) > 0 ? built.indexOf('/* core */', start) : built.indexOf('    var getRewardTypes', start);
  const __core = new Function(built.slice(start, end) + '; return __core;')();
  const quest = { config: { rewardsConfig: { rewards: [{ type: 4, orbQuantity: 5, messages: { name: 'x' } }] } } };
  assert.deepEqual(__core.getRewardTypes(quest), getRewardTypes(quest));
  assert.equal(__core.getOrbValue([{ orbQuantity: 5 }], 0), getOrbValue([{ orbQuantity: 5 }], 0));
  assert.equal(__core.getRewardHtml(quest, {}), getRewardHtml(quest, {}));
});