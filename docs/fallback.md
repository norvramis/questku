# Questku — Fallback Guide

When Discord updates its internal modules, questku may stop working with the error `Discord internals not found`. This guide shows how to find the new module paths and fix the script.

---

## How to detect new module paths

### Step 1: Open DevTools

Press `Ctrl+Shift+I` → **Console** tab.

### Step 2: Load webpack

Run these two lines:

```js
let wpRequire = webpackChunkdiscord_app.push([[Symbol()], {}, r => r]);
webpackChunkdiscord_app.pop();
```

You should see `undefined` or a module object. If you get an error, webpack is not accessible (Discord may have changed their module loader).

### Step 3: Find each module

Use these commands one by one to find the correct path:

**Q.Quest — quest store**
```js
// Try these patterns:
Object.values(wpRequire.c).find(x => x?.exports?.A?.__proto__?.getQuest)?.exports?.A
Object.values(wpRequire.c).find(x => x?.exports?.Z?.getQuest)?.exports?.Z
Object.values(wpRequire.c).find(x => x?.exports?.getQuest)?.exports
Object.values(wpRequire.c).find(x => x?.exports?.Z?.getQuests)?.exports?.Z
Object.values(wpRequire.c).find(x => x?.exports?.quests?.get)?.exports
```

**Q.Game — running game store**
```js
Object.values(wpRequire.c).find(x => x?.exports?.Ay?.getRunningGames)?.exports?.Ay
Object.values(wpRequire.c).find(x => x?.exports?.Z?.getRunningGames)?.exports?.Z
Object.values(wpRequire.c).find(x => x?.exports?.getRunningGames)?.exports
```

**Q.api — HTTP client**
```js
Object.values(wpRequire.c).find(x => x?.exports?.Bo?.get)?.exports?.Bo
Object.values(wpRequire.c).find(x => x?.exports?.Z?.get)?.exports?.Z
Object.values(wpRequire.c).find(x => x?.exports?.get)?.exports
```

**Q.Flux — dispatcher**
```js
Object.values(wpRequire.c).find(x => x?.exports?.h?.__proto__?.flushWaitQueue)?.exports?.h
Object.values(wpRequire.c).find(x => x?.exports?.Z?.__proto__?.flushWaitQueue)?.exports?.Z
Object.values(wpRequire.c).find(x => x?.exports?.dispatch)?.exports
```

**Q.Streaming — stream store**
```js
Object.values(wpRequire.c).find(x => x?.exports?.A?.__proto__?.getStreamerActiveStreamMetadata)?.exports?.A
Object.values(wpRequire.c).find(x => x?.exports?.Z?.__proto__?.getStreamerActiveStreamMetadata)?.exports?.Z
```

**Q.Channel — channel store**
```js
Object.values(wpRequire.c).find(x => x?.exports?.A?.__proto__?.getAllThreadsForParent)?.exports?.A
Object.values(wpRequire.c).find(x => x?.exports?.Z?.__proto__?.getAllThreadsForParent)?.exports?.Z
```

**Q.Guild — guild store**
```js
Object.values(wpRequire.c).find(x => x?.exports?.Ay?.getSFWDefaultChannel)?.exports?.Ay
Object.values(wpRequire.c).find(x => x?.exports?.Z?.getSFWDefaultChannel)?.exports?.Z
```

### Step 4: Test if it works

After updating the paths in questku.js, paste the full script into the Console and test with a quest.

---

## Alternative method: search by name

If the specific function names changed, search by related keywords:

```js
// List all exports with "quest" in their name
Object.values(wpRequire.c).forEach(m => {
    if (m?.exports) Object.keys(m.exports).forEach(k => {
        if (k.toLowerCase().includes('quest')) console.log(k, m.exports[k]);
    });
});
```

```js
// List all exports with "running" or "game" in their name
Object.values(wpRequire.c).forEach(m => {
    if (m?.exports) Object.keys(m.exports).forEach(k => {
        if (k.toLowerCase().includes('running') || k.toLowerCase().includes('game')) console.log(k, m.exports[k]);
    });
});
```

---

## Reporting

If you find a new working path:

1. Update `questku.js` locally
2. Test that it works
3. Open a [GitHub Issue](https://github.com/norvramis/questku/issues) with the new paths

---

## Known working patterns (history)

| Date | Q.Quest | Q.api | Q.Game | Q.Flux |
|------|---------|-------|--------|--------|
| 2026-07 | `A?.__proto__?.getQuest` | `Bo?.get` | `Ay?.getRunningGames` | `h?.__proto__?.flushWaitQueue` |

---

## Need help?

Open a [GitHub Issue](https://github.com/norvramis/questku/issues) or contact the maintainer.
