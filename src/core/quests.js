// Core quest logic - single source of truth, injected by scripts/build.js.
// Requirable directly by node:test.
//
// Legacy-compatible wrappers in the build preserve the old call sites:
//   isExpired(q)                    (wrapper passes Date.now())
//   isDesktopOnlyQuest(q)           (wrapper passes isDesktop)

function isExpired(q, now) {
    if (!q || !q.config?.expiresAt) return false;
    return new Date(q.config.expiresAt).getTime() < now;
}

function isDesktopOnlyQuest(q, isDesktop) {
    let cfg = q.config.taskConfig ?? q.config.taskConfigV2;
    let tasks = cfg?.tasks || {};
    let hasWeb = ['WATCH_VIDEO', 'PLAY_ACTIVITY', 'PLAY_ON_DESKTOP', 'WATCH_VIDEO_ON_MOBILE'].some(y => tasks[y] != null);
    if (isDesktop || hasWeb) return false;
    return ['STREAM_ON_DESKTOP', 'PLAY_ON_XBOX', 'PLAY_ON_PLAYSTATION'].some(y => tasks[y] != null);
}

module.exports = { isExpired, isDesktopOnlyQuest };