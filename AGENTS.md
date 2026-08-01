# Questku — AGENTS.md

Bahasa Indonesia untuk balasan.

Vanilla JS script otomatis enroll & complete Discord quests via webpack hooking (`webpackChunkdiscord_app`). Dual delivery: paste-to-DevTools + Chrome MV3 extension.

Read `questku.md` (AI playbook, gitignored) for full workflow detail. This file covers only what agents commonly miss.

## Zero build

No `package.json`, no npm, no test runner, no linter, no CI. Edit langsung, paste ke DevTools, manual verify.

Syntax check:
```powershell
node --check questku.js
node --check extension/questku.js
```

## Sync rule

`extension/questku.js` = copy of `questku.js`. Edit both; same changes.

Verify drift:
```powershell
cmd /c "fc D:\questku\questku.js D:\questku\extension\questku.js"
```
Files can drift. Common diffs: `progStatusLabels` entries, CSS values, stray comments.

## Structure

- `questku.js` — IIFE (baris 3-14 webpack discovery, lalu dashboard + queue + render). `window.questkuKill()` cleanup. TASKS: WATCH_VIDEO, PLAY_ON_DESKTOP, STREAM_ON_DESKTOP, PLAY_ACTIVITY, WATCH_VIDEO_ON_MOBILE, PLAY_ON_XBOX, PLAY_ON_PLAYSTATION.
- `extension/` — Chrome MV3. `manifest.json` + `rules.json` (UA spoof) + `popup.html` + `popup.js`.
- `fallback.md` — rediscover webpack paths when modules break.
- `enable-devtools.ps1` — enable DevTools for Discord Desktop on Windows (registry tweak, restart Discord).
- `README.md` + `README.id.md` — no embedded script copy. Distribution via Releases; `.github/workflows/release.yml` zips `extension/` + script on git tag.

## Dashboard tabs

3 tabs: All Quests (quest list + queue), Progress (running queue status), HypeSquad (badge management). Tab switching via `history.pushState` + `PopStateEvent`. HypeSquad tab has `hsState` for profile/badge state, `renderHypeSquad()` renders house cards, `hsUI()` manages button states.

## Reward data structure

Reward items in `q.config.rewardsConfig.rewards[]`:
- `r.type === 4` or `r.orbQuantity` or `r.amount` → Orb (`orbQuantity`, `premiumOrbQuantity`, `messages.name`)
- `r.type === 3` or `r.avatarDecoration` or `r.avatarDecorationDecoration` → Avatar Decoration
- `r.profileEffect` or `r.profileEffectId` → Profile Effect
- None of above → "In-Game Reward"

`premiumOrbQuantity`: used for Nitro 1.2x multiplier display. `getOrbValue()` prefers it when `userPremiumType >= 2`.

Functions: `getRewardTypes(q)` (filter → `['orb','avatardeco','profileeffect','ingame']`), `getRewardHtml(q)` (display `.qk-rw`), `getOrbValue(rewards)` (sort). `icoHtml`: type 3 shows `{r.asset}` thumbnail, type 4 shows orb webm, else app icon.

Quest selesai & belum di-claim (`userStatus.completedAt && !userStatus.claimedAt`) nampilin badge "Unclaimed" (`.uc`, orange) + button "Claim" — klick tetap `gotoQuest` (claim native di UI Discord). Keempat lokasi badge: renderAllQuests, renderProgress, updateProgTick, plus CSS `.qk-tg.uc`. Sort suggested: unclaimed paling atas (0). No `_claimed`/`claimedStore`/`saveClaimed`.

## API call pattern

```js
let res = await directPost(url, body);
if (!res || res.status >= 400) res = await apiReq(method, url, body);
```
`directPost` = delegasi ke `directFetch('POST', ...)`. `directFetch(method, url, body)` = raw `window.fetch` + token, handle any HTTP method & empty response (204). `apiReq` = Discord webpack API module (`Q.api.get`/`.post`/`.del`). Fallback penting karena `directFetch` bisa gagal (CORS, token mismatch, 4xx). `getTok()` cari string >40 chars di `Q.api` (fallback kalo format `MT...` berubah).

`apiReq` uses `Q.api.get`/`.post`/`.del`. Note: `Q.api.del` may not exist in all Discord builds; use `directFetch('DELETE', ...)` as primary for DELETE operations. HypeSquad remove currently uses `apiReq('DEL')` via `Q.api` first (proven 204 in current build), `directFetch` as backup.

## Key gotchas

- **Webpack paths** (questku.js baris 3-12) break every few Discord updates. Update both files.
- **Browser vs desktop** — script checks `navigator.userAgent.includes('Electron')`. Extension `rules.json` UA string may need updating.
- **Nitro orb detection** — `getOrbValue()` prefers `premiumOrbQuantity` when `userPremiumType >= 2`. `fetchPremiumType()` hits `/users/@me` API (not webpack). Called in `refreshQuests()`.
- **1.2x badge** — `NITRO_BADGE` const (base64). CSS `.qk-nitro-badge`.
- **Kill** restores original Discord module props + dispatches `RUNNING_GAMES_CHANGE`.
- **View Quest** uses `history.pushState` + `PopStateEvent` for SPA routing.
- **Reward types** — Discord may add new `r.type` values. Update `getRewardTypes()` + `getRewardHtml()`. Code also detects by fields (`r.orbQuantity`, `r.avatarDecoration`, `r.profileEffect`) not just `r.type`.
- **progStatusLabels drift** — both files must have same entries (`failed:'Failed'` easy to miss). Sync breaks if one file missing an entry.
- **All Quests queue sync** — `renderAllQuests()` must be called from `processQueue()` alongside `renderProgress()` so All Quests tab shows real-time queue status (Running/Pending/Done), not stale data. Easy to forget.
- **Object reference vs ID** — `st.queue` items hold references to old quest objects. After `refreshQuests()`, `st.allQuests` gets new objects. Always compare by `x.q.id === q.id`, not `x.q === q`.
- **Enroll success** — Jangan deteksi pake `res?.body?.userStatus?.enrolledAt`. Discord bisa ubah response format. Pake `res?.status >= 200 && res?.status < 300` trus set manual `q.userStatus`.
- **HypeSquad remove** — `hsRemove()` primary: `apiReq('DEL', '/hypesquad/online')` via `Q.api` (proven 204). Fallback: `wreq.m` + `"HTTPUtils"` string search → `httpApi.del({url})`. Catatan: `httpApi.del` bisa return 500 setelah join house — pake `apiReq('DEL')` dulu.
- **Quest completion (PLAY/STREAM)** — Discord removed `QUESTS_SEND_HEARTBEAT_SUCCESS` Flux event. Completion polls heartbeat response every 5s: `res.body.progress[t].value` (fallback `userStatus.progress`). Jangan subscribe Flux events buat progress.
- **appId location** — `q.config.application` udah gak dipake. Extract dari `taskConfigV2.tasks.*.applications[0].id` (`getAppId()` di `refreshQuests`, inline di `processQuest`). Pass appName eksplisit ke `setFakeGame(q, pid, appId, exe, qName)` — `q.config.application.name` undefined.

## Git workflow

Commit format (dari history): `new:`, `fix:`, `feat:`, `chore:`. Singkat, deskriptif.
Branch nyasar (`feat/*`, `fix-*`) yang gak terpakai bikin graph merah. Hapus pake `git branch -D` + `git fetch --prune`.

## Referensi

- `questku.md` — playbook lengkap (excluded from git)
- `fallback.md` — webpack recovery guide
- `CLAUDE.md` — system agent instructions (caveman style, principles)
