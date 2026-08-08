const { test } = require('node:test');
const assert = require('node:assert');
const { getRewardTypes, getOrbValue, getRewardHtml } = require('../src/core/rewards');

const q = (rewards) => ({ userStatus: {}, config: { rewardsConfig: { rewards } } });

const orb = (extra = {}) => ({ type: 4, orbQuantity: 100, ...extra });
const premiumOrb = (extra = {}) => ({ type: 4, orbQuantity: 100, premiumOrbQuantity: 120, ...extra });
const avatarDeco = (extra = {}) => ({ type: 3, avatarDecoration: true, ...extra });
const profileEff = (extra = {}) => ({ type: 2, profileEffect: { id: 'x', name: 'Cool Effect' }, ...extra });

test('getRewardTypes: orb', () => {
  assert.deepEqual(getRewardTypes(q([orb()])), ['orb']);
});

test('getRewardTypes: avatar deco (type 3 + field-detected)', () => {
  assert.deepEqual(getRewardTypes(q([avatarDeco()])), ['avatardeco']);
  assert.deepEqual(getRewardTypes(q([{ avatarDecorationDecoration: {} }])), ['avatardeco']);
});

test('getRewardTypes: profile effect (field-detected)', () => {
  assert.deepEqual(getRewardTypes(q([{ profileEffectId: 'x' }])), ['profileeffect']);
});

test('getRewardTypes: unknown -> ingame', () => {
  assert.deepEqual(getRewardTypes(q([{ type: 999 }])), ['ingame']);
});

test('getRewardTypes: multiple types de-duped + ordered', () => {
  const types = getRewardTypes(q([orb(), avatarDeco(), profileEff()]));
  assert.deepEqual(types, ['orb', 'avatardeco', 'profileeffect']);
});

test('getOrbValue: free tier uses orbQuantity', () => {
  assert.equal(getOrbValue([orb()], 0), 100);
  assert.equal(getOrbValue([orb()], 1), 100);
});

test('getOrbValue: nitro tier uses premiumOrbQuantity', () => {
  assert.equal(getOrbValue([premiumOrb()], 2), 120);
  assert.equal(getOrbValue([premiumOrb()], 3), 120);
});

test('getOrbValue: empty rewards -> 0', () => {
  assert.equal(getOrbValue([], 2), 0);
  assert.equal(getOrbValue(null, 2), 0);
});

test('getOrbValue: falls back to amount', () => {
  assert.equal(getOrbValue([{ amount: 42 }], 0), 42);
});

test('getOrbValue: premium tier without premium field falls back', () => {
  assert.equal(getOrbValue([orb()], 2), 100);
});

test('getRewardHtml: orb non-nitro shows messages.name or N orbs', () => {
  const html = getRewardHtml(q([orb()]), { premiumType: 0 });
  assert.ok(html.includes('100 Orbs'));
  const named = getRewardHtml(q([orb({ messages: { name: '100 Nitro Orbs' } }) ]), { premiumType: 0 });
  assert.ok(named.includes('100 Nitro Orbs'));
});

test('getRewardHtml: nitro orb adds badge img', () => {
  const html = getRewardHtml(q([premiumOrb()]), { premiumType: 2, nitroBadge: 'data:png' });
  assert.ok(html.includes('qk-nitro-badge'));
  assert.ok(html.includes('120 Orbs'));
  const plain = getRewardHtml(q([premiumOrb()]), { premiumType: 0 });
  assert.ok(!plain.includes('qk-nitro-badge'));
});

test('getRewardHtml: multi-reward joined with plus', () => {
  const html = getRewardHtml(q([orb(), avatarDeco()]), { premiumType: 0 });
  assert.ok(html.includes('qk-rw-plus'));
  assert.ok(html.includes('Avatar Decoration'));
});

test('getRewardHtml: unknown reward -> In-Game Reward', () => {
  const html = getRewardHtml(q([{ type: 999 }]), { premiumType: 0 });
  assert.ok(html.includes('In-Game Reward'));
});