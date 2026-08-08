const { test } = require('node:test');
const assert = require('node:assert');
const { isExpired, isDesktopOnlyQuest } = require('../src/core/quests');

const quest = (taskKeys, extra = {}) => ({
  userStatus: {},
  config: Object.assign({ expiresAt: new Date(2100, 0, 1).toISOString(), taskConfig: { tasks: Object.fromEntries(taskKeys.map((k) => [k, {}])) } }, extra),
});
const pastTs = () => new Date(2000, 0, 1).getTime();
const futureTs = () => new Date(2100, 0, 1).getTime();

test('isExpired: false when expiresAt in the future', () => {
  assert.equal(isExpired(quest([]), futureTs()), false);
});

test('isExpired: true when expiresAt past and not completed', () => {
  assert.equal(isExpired(quest([], { expiresAt: new Date(1900, 0, 1).toISOString() }), pastTs()), true);
});

test('isExpired: true when completed but past expiresAt (exp wins over done)', () => {
  const x = quest([], { expiresAt: new Date(1900, 0, 1).toISOString() });
  x.userStatus.completedAt = '2026-01-01T00:00:00.000Z';
  assert.equal(isExpired(x, pastTs()), true);
});

test('isExpired: false when completed and expiresAt still future', () => {
  const x = quest([]);
  x.userStatus.completedAt = '2026-01-01T00:00:00.000Z';
  assert.equal(isExpired(x, futureTs()), false);
});

test('isExpired: false when missing expiresAt', () => {
  const x = quest([]);
  delete x.config.expiresAt;
  assert.equal(isExpired(x, pastTs()), false);
});

test('isDesktopOnlyQuest: stream requires desktop', () => {
  assert.equal(isDesktopOnlyQuest(quest(['STREAM_ON_DESKTOP']), false), true);
  assert.equal(isDesktopOnlyQuest(quest(['STREAM_ON_DESKTOP']), true), false);
});

test('isDesktopOnlyQuest: xbox/playstation desktop-only', () => {
  assert.equal(isDesktopOnlyQuest(quest(['PLAY_ON_XBOX']), false), true);
  assert.equal(isDesktopOnlyQuest(quest(['PLAY_ON_PLAYSTATION']), false), true);
});

test('isDesktopOnlyQuest: PLAY_ON_DESKTOP is web-able (protect-the-king)', () => {
  assert.equal(isDesktopOnlyQuest(quest(['PLAY_ON_DESKTOP']), false), false);
});

test('isDesktopOnlyQuest: watch/activity web-able', () => {
  assert.equal(isDesktopOnlyQuest(quest(['WATCH_VIDEO']), false), false);
  assert.equal(isDesktopOnlyQuest(quest(['PLAY_ACTIVITY']), false), false);
  assert.equal(isDesktopOnlyQuest(quest(['WATCH_VIDEO_ON_MOBILE']), false), false);
});

test('isDesktopOnlyQuest: mixed web + stream -> web-able', () => {
  assert.equal(isDesktopOnlyQuest(quest(['STREAM_ON_DESKTOP', 'WATCH_VIDEO']), false), false);
});