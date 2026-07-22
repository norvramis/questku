# Questku — AGENTS.md

Bahasa Indonesia untuk balasan.

Vanilla JS script otomatis enroll & complete Discord quests via webpack hooking (`webpackChunkdiscord_app`). Dual delivery: paste-to-DevTools + Chrome MV3 extension.

## Zero build

No `package.json`, no npm, no test runner, no linter, no CI. Edit langsung, paste ke DevTools, manual verify.

## Sync rule

`extension/questku.js` = copy of `questku.js`. Edit both; same changes.

## Structure

- `questku.js` — IIFE. Webpack module discovery (line 3-12), drag dashboard, quest automation. 3 tabs: All Quests, Progress, HypeSquad. `window.questkuKill()` cleanup. TASKS array includes: WATCH_VIDEO, PLAY_ON_DESKTOP, STREAM_ON_DESKTOP, PLAY_ACTIVITY, WATCH_VIDEO_ON_MOBILE, PLAY_ON_XBOX, PLAY_ON_PLAYSTATION.
- `extension/` — Chrome MV3. `popup.html` + `popup.js`. Manifest uses `declarativeNetRequest` to spoof Electron UA. `background.js` injects script on Discord tab.
- `fallback.md` — guide to rediscover webpack paths when modules break.
- `enable-devtools.ps1` — re-enable DevTools in Discord desktop.
- `README.md` + `README.id.md` — user docs. **Embed older copy of script** — ignore discrepancy.

## Reward data structure (Discord)

Reward items in `q.config.rewardsConfig.rewards[]` use `r.type` field:
- `type: 4` → Orb (has `orbQuantity`, `premiumOrbQuantity`, `messages.name`)
- `type: 3` → Avatar Decoration (has `asset`, `messages.name`)
- Unknown types → fallback to legacy field detection: `r.avatarDecoration`, `r.profileEffect`, `r.profileEffectId`
- Fallback if none match → "In-Game Reward"

Key functions:
- `getRewardTypes(q)` — returns `['orb']`, `['avatardeco']`, etc. Used by filter.
- `getRewardHtml(q)` — returns HTML string for `.qk-rw` display. Reads `r.messages.name`.
- `getOrbValue(rewards)` — reads `orbQuantity` / `premiumOrbQuantity` (Nitro multiplier). Used by sort.
- `icoHtml` — quest card icon: type 3 shows `{r.asset}` thumbnail, type 4 shows generic orb webm, fallback to app icon.

## Claim removed

Claim button dihapus. Quest completed nampilin "Done" (disabled). Gak ada urusan claim API. Kode `_claimed`, `claimedStore`, `saveClaimed` — semuanya dihapus.

## Toolbar & dropdowns

**All Quests tab:** Sort (radio) + Filter (checkbox sections). Dropdown toggle. Filter popup `right:0;left:auto`. Both 320px max-height.

Sort: Suggested, Most Recent, Expiring Soon, Started, Highest Reward, Alphabetical (A–Z).
Filter sections: **Reward** (Orbs, Avatar Decoration, Profile Effect, In-Game Rewards), **Quest Type** (Play, Watch, Stream, Activity), **Status** (Available, In Progress, Completed, Expired). Clear button disables when inactive.

**Progress tab toolbar:** `[Select All] [Filter ▼] N Active [Kill] [↻]`. Filter dropdown merges sort + status. Clear resets both.

## HypeSquad tab

House cards from `BADGES` const (base64 PNGs). Current house from `public_flags`. Auto-selects owned badge on tab open. Colors: Bravery `#9b59b6`, Brilliance `#e74c3c`, Balance `#1abc9c`.

## Queue flow

Enroll → Start Queue. Sorted by estimated duration ascending on queue start. Pause/Stop targets running/paused quest. Stop marks "Stopped", resets progress, continues. Terminal states disable card buttons.

## Key gotchas

- **Webpack paths** (line 3-12) break every few Discord updates. Update both `questku.js` + `extension/questku.js`.
- Browser vs desktop: script checks `navigator.userAgent.includes('Electron')`. Extension `rules.json` UA string may need updating.
- Kill restores original Discord module props + dispatches `RUNNING_GAMES_CHANGE`.
- View Quest: uses `history.pushState` + `PopStateEvent` for SPA routing.
- **Nitro orb detection** — `getOrbValue()` prefers `premiumOrbQuantity` when `userPremiumType >= 2`. `fetchPremiumType()` hits `/users/@me` API (not webpack). Called in `refreshQuests()`.
- **1.2x badge** — `NITRO_BADGE` const (base64 inline from `assets/1.2x.png`). Shown next to orb text when Nitro user + quest has `premiumOrbQuantity`. CSS: `.qk-nitro-badge{height:22px;vertical-align:middle;margin-left:6px}`.
- **API call pattern** — `directPost(url, body)` (raw fetch + token) tried first; falls back to `apiReq(method, url, body)` (Discord webpack API module) when `directPost` returns null or 4xx. Both functions exist in script.
- **Reward types** — Discord may add new `r.type` values. Update `getRewardTypes()` + `getRewardHtml()` when new types appear.
