# Questku — AGENTS.md

Bahasa Indonesia untuk balasan.

Vanilla JS script otomatis enroll, complete, claim Discord quests via webpack hooking (`webpackChunkdiscord_app`). Dual delivery: paste-to-DevTools + Chrome MV3 extension.

## Zero build

No `package.json`, no npm, no test runner, no linter, no CI. Edit langsung, paste ke DevTools, manual verify.

## Sync rule

`extension/questku.js` = copy of `questku.js`. Edit both; same changes.

## Structure

- `questku.js` — IIFE. Webpack module discovery (line 3-12), drag dashboard, quest automation. 3 tabs: All Quests, Progress, HypeSquad. `window.questkuKill()` cleanup.
- `extension/` — Chrome MV3. `popup.html` + `popup.js`. `rules.json` (declarativeNetRequest) spoofs Electron UA.
- `fallback.md` — guide to rediscover webpack paths.
- `enable-devtools.ps1` — re-enable DevTools in Discord desktop.

## Toolbar & dropdowns

**All Quests tab:** Sort (radio) + Filter (checkbox sections). Dropdown button click = toggle (open if closed, close if open). Filter popup right-aligned (`right:0;left:auto`). Both popups scrollable at 320px max-height; scrollbar style matches `.qk-list`.

Sort order: Suggested, Most Recent, Expiring Soon, Started, Highest Reward, Alphabetical (A–Z).

Filter sections (Discord-like): **Reward** (Orbs, Avatar Decoration, Profile Effect, In-Game Rewards), **Quest Type** (Play, Watch, Stream, Activity), **Status** (Available, In Progress, Completed, Expired). Clear button at bottom.

Reward type detection: `getRewardTypes(q)` — checks `rewardsConfig.rewards` items for `orbQuantity`, `avatarDecoration`, `profileEffect`, fallback `ingame`. Also detects `premiumOrbQuantity` (Nitro multiplier) but no separate filter option — value auto-adjusts per user.

Filter button does NOT glow when active (no `.act` class). Clear button disables when no filter is active.

**Progress tab toolbar:** `[Select All] [Filter ▼]  N Active  [Kill]  [↻]`. Single Filter dropdown merges sort + status:
- Sort By (radio): Queue Position, Newest, Oldest, Alphabetical (A–Z)
- Status (checkbox): Running, Pending, Paused, Done, Failed, Stopped
- Clear resets both sort to Queue Position and all status filters

Active count (`#qk-prog-active`) — plain text indicator, no background/border, shows "N Active" or "No Active".

## HypeSquad tab

House selection cards (base64 PNGs from `BADGES` const). Apply/Remove buttons. Current house from `public_flags`. **Auto-selects owned badge when tab is opened** (resets `hsState.selected = null` before render). House colors: Bravery `#9b59b6`, Brilliance `#e74c3c`, Balance `#1abc9c`.

## Design tokens

Accent `#545ded` — nav indicator, checkboxes, progress fills, toasts. Panel body `rgba(10,11,13,.7)`. Cards `rgba(255,255,255,.05)`. Popup `#1e1f22` solid, accent border `#2596BE` (active phase only).

## Queue flow

Two-click: Enroll → Start Queue. Items sorted by estimated duration ascending on queue start: video watch (target seconds), activity (target seconds), play/stream (target × 60). Pause/Stop targets running/paused quest. Stop marks "Stopped" (not "Failed"), resets progress, continues to next. Terminal states (done/failed/stopped) disable card select buttons.

## Key gotchas

- **Webpack paths** (line 3-12) break every few Discord updates. Update both `questku.js` + `extension/questku.js`.
- Browser vs desktop: script checks `navigator.userAgent.includes('Electron')`. Extension `rules.json` UA string may need updating.
- README embeds older script copy — ignore discrepancy.
- Kill restores original Discord module props + dispatches `RUNNING_GAMES_CHANGE`.
- View Quest: uses `history.pushState` + `PopStateEvent` for SPA routing (no reload, no Discord app launch).
- `getRewardTypes()` detects reward by checking reward item fields. Update if Discord adds new reward types.
- **Nitro orb detection** — `getOrbValue()` prefers `premiumOrbQuantity` when `userPremiumType >= 2`. `fetchPremiumType()` hits `/users/@me` API (not webpack — `getCurrentUser` has no reliable module path). Called in `refreshQuests()`.
- **1.2x badge** — `NITRO_BADGE` const (base64 inline from `assets/1.2x.png`). Shown next to orb text when Nitro user + quest has `premiumOrbQuantity`. CSS: `.qk-nitro-badge{height:22px;vertical-align:middle;margin-left:6px}`.
