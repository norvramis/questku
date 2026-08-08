# Questku - AGENTS.md

Bahasa Indonesia untuk balasan.

Vanilla JS script otomatis enroll & complete Discord quests via webpack hooking (`webpackChunkdiscord_app`). Dual delivery: paste-to-DevTools + Chrome MV3 extension.

Read `questku.md` (AI playbook, gitignored) for full workflow detail. This file covers only what agents commonly miss.

## Build & test (minimal, no runtime deps)

- No runtime dependencies. `package.json` cuma buat build + test scripts (Node built-in, tidak perlu npm install).
- **EDIT DI `src/`, JANGAN edit `questku.js` langsung.** Build inject `src/core/*.js` ke `src/questku.js` (marker `/*__CORE__*/`) → output `questku.js` + `extension/questku.js`:
```powershell
npm run build
```
- Syntax check (hasil build):
```powershell
node --check questku.js
node --check extension/questku.js
```
- Paste ke DevTools, manual verify untuk behavior Discord.

- Test (core rewards + relay/security boundary — SSRF, CORS, rate-limit, 413):
```powershell
npm test
```
Core test: require langsung `src/core/rewards.js` (pure, tanpa Discord). Relay test menjalankan relay.ps1 beneran (spawn), kirim raw-TCP dari Node; kalau relay udah jalan, dipakai tanpa spawn. Hermetic, zero net keluar.

- CI: `.github/workflows/ci.yml` (Windows) = `npm run build` → syntax → `fc /b` sync → `npm test`. `.github/workflows/release.yml` jalan pas tag `v*` (zip `extension/` + attach `questku-<tag>.js`).

## Sync rule

`extension/questku.js` = copy of `questku.js`, KEDUANYA hasil `npm run build` (jangan edit manual — `fc /b` di CI nangkep drift).

Verify drift lokal:
```powershell
npm run build; cmd /c "fc D:\questku\questku.js D:\questku\extension\questku.js"
```
Files can drift kalau edit langsung tanpa build. Common diffs: `progStatusLabels` entries, CSS values, stray comments. Kerjaan `questku.js` cuma di working tree (uncommitted) gampang ilang pas revert/reset — commit di milestone, atau jadiin backup manual. (Sempat kejadian: semua fitur hilang dr `questku.js` krn revert, `extension/` + `relay/` selamat.)

## Structure

- `src/` — sumber asli. `src/questku.js` = IIFE utama (baris 3-14 webpack discovery, lalu dashboard + queue + render). `src/core/*.js` = pure helpers (di-inject build). `window.questkuKill()` cleanup. TASKS: WATCH_VIDEO, PLAY_ON_DESKTOP, STREAM_ON_DESKTOP, PLAY_ACTIVITY, ACHIEVEMENT_IN_ACTIVITY, WATCH_VIDEO_ON_MOBILE, PLAY_ON_XBOX, PLAY_ON_PLAYSTATION.
- `questku.js` + `extension/questku.js` — BUILD OUTPUT (hasil `npm run build`), jangan diedit manual.
- `scripts/` — `build.js` (inject core → 2 output) + `migrate.js` (one-time: questku.js → src/, sudah dipakai).
- `extension/` - Chrome MV3. `manifest.json` + `rules.json` (UA spoof) + `popup.html` + `popup.js` + `background.js` (service worker relay discordsays) + `content.js` (bridge MAIN->SW) + `questku.js` (copy of root).
- `relay/` - `relay.ps1` (TcpListener raw) + `start-relay.cmd` (double-click) + `enable-pna.ps1`/`start-pna.cmd` (Chrome policy web).
- `tools/` - `enable-devtools.ps1` + `enable-devtools.cmd` (double-click) enable Discord Desktop DevTools.
- `docs/fallback.md` - rediscover webpack paths when modules break.
- `README.md` + `README.id.md` - no embedded script copy. Distribution via Releases; `.github/workflows/release.yml` zips `extension/` + script on git tag.
- `.github/workflows/release.yml` - auto-build GitHub Release pas tag `v*` di-push. Asset: `questku-<tag>.js` + `questku-extension.zip`.

## Dashboard tabs

3 tabs: All Quests (quest list + queue), Progress (running queue status), HypeSquad (badge management). Tab switching = DOM class toggling (`D.tabs` + `.qk-body.act`, fungsi `switchTab()`), BUKAN `history.pushState`. HypeSquad tab has `hsState` for profile/badge state, `renderHypeSquad()` renders house cards, `hsUI()` manages button states.

## Reward data structure

Reward items in `q.config.rewardsConfig.rewards[]`:
- `r.type === 4` or `r.orbQuantity` or `r.amount` -> Orb (`orbQuantity`, `premiumOrbQuantity`, `messages.name`)
- `r.type === 3` or `r.avatarDecoration` or `r.avatarDecorationDecoration` -> Avatar Decoration
- `r.profileEffect` or `r.profileEffectId` -> Profile Effect
- None of above -> "In-Game Reward"

`premiumOrbQuantity`: used for Nitro 1.2x multiplier display. `getOrbValue()` prefers it when `userPremiumType >= 2`.

Functions: `getRewardTypes(q)` (filter -> `['orb','avatardeco','profileeffect','ingame']`), `getRewardHtml(q)` (display `.qk-rw`), `getOrbValue(rewards)` (sort). `icoHtml`: pilih non-orb dulu (avatar deco type3 / `profileEffect` / type1) > orb (type4) > `rewards[0]`; type 3 & type 1 pakai `{r.asset}` thumbnail. Avatar deco `r.avatarDecoration` -> spare key `r.type === 3`, In-Game Reward = type 1.

Quest kelar & belum di-claim -> badge "Unclaimed" (`.uc`, orange) + button "Claim". Auto-claim DI-GATE `set.autoClaim` (default false) - toggle checkbox `#qk-ac` di Settings ((menu)) popup Progress toolbar; `#qk-ae` = Auto Enroll (`set.autoEnroll`, default true). Keduanya persist via `qstore()` (jangan pake `localStorage` langsung). Auto-claim = claimAPI(q) dulu (POST /claim-reward + header x-super-properties dari getDesktopSuperProperties() + user-agent dari getDesktopUserAgent() + traffic_metadata_sealed), kalau fallback/captcha (400) -> claimViaUI(q) (gotoQuest -> auto-click tombol claim di container detail). Manual claim (klik tombol Claim) dan auto-claim SEKARANG SAMA FLOW: claimAPI(q) -> fallback claimViaUI(q). JANGAN revert ke manual-claim-API-saja (kondisi lama user harus claim sendiri). findClaimButton(qid) aman: scope ke container .contentSection_* di halaman detail quest sesuai qid (jangan semua tombol halaman), skip #questku-panel. Badge lokasi: renderAllQuests, renderProgress, updateProgTick + CSS `.qk-tg.uc`. Sort suggested: unclaimed paling atas (0), expired paling bawah (5). No `_claimed`/`claimedStore`/`saveClaimed`. `vqLabel` (tombol quest): done & !claimed → 'Claim'; done & claimed → 'View Reward'; else 'View Quest' (renderAllQuests pakai `done`, renderProgress pakai `item.status === 'done'`).

## API call pattern

```js
let res = await directPost(url, body);
if (!res || res.status >= 400) res = await apiReq(method, url, body);
```
`directPost` = delegasi ke `directFetch('POST', ...)`. `directFetch(method, url, body, extraHeaders)` = raw `window.fetch` + token + extra headers, handle any HTTP method & empty response (204). `apiReq` = Discord webpack API module (`Q.api.get`/`.post`/`.del`). Fallback penting karena `directFetch` bisa gagal (CORS, token mismatch, 4xx). `getTok()` cari string >40 chars di `Q.api` (fallback kalo format `MT...` berubah).

`apiReq` uses `Q.api.get`/`.post`/`.del`. Note: `Q.api.del` may not exist in all Discord builds; use `directFetch('DELETE', ...)` as primary for DELETE operations. HypeSquad remove currently uses `apiReq('DEL')` via `Q.api` first (proven 204 in current build), `directFetch` as backup.

## Key gotchas

- **Webpack paths** (questku.js discovery di awal IIFE) break every few Discord updates. Update both files.
- **Build yang jalan** - questku.js log `[Questku] v1.1.0` di baris awal. Kalau gak muncul pas di-paste -> yang ke-inject STALE (bukan dari disk). Pakai ini buat bedain "extension lama" vs "file baru".
- **Browser vs desktop** - script checks `navigator.userAgent.includes('Electron')`. Extension `rules.json` UA string may need updating.
- **Nitro orb detection** - `getOrbValue()` prefers `premiumOrbQuantity` when `userPremiumType >= 2`. `fetchPremiumType()` hits `/users/@me` API (not webpack). Called in `refreshQuests()`.
- **Orb balance badge** - `.qk-ob` punya 2 child: `.qk-ob-num` (angka, di-refresh via `getUserOrbs()` -> `/users/@me/virtual-currency/balance` -> `totalBalance`) + `.qk-ob-tip` (tooltip glass "Total balance", CSS). Jangan set `textContent` di `.qk-ob` - ngehapus tooltip. Update `.qk-ob-num` doang.
- **1.2x badge** - `NITRO_BADGE` const (base64). CSS `.qk-nitro-badge`.
- **Kill** restores original Discord module props + dispatches `RUNNING_GAMES_CHANGE`.
- **View Quest / Claim** - `gotoQuest()` dua-tahap: `trans('/quest-home')` -> setTimeout 350ms -> `trans('/quest-home#qid')`. `trans` = `findTransitionTo()` (webpack search `'transitionTo - Transitioning to'`). Dua-tahap wajib: pindah dari detail quest A ke quest B, ganti `location.hash` langsung gak selalu ke-trigger Discord. Fallback: `location.hash` (udah di quest-home) / `location.href = '/quest-home#qid'`.
- **Reward types** - Discord may add new `r.type` values. Update `getRewardTypes()` + `getRewardHtml()`. Code also detects by fields (`r.orbQuantity`, `r.avatarDecoration`, `r.profileEffect`) not just `r.type`.
- **progStatusLabels drift** - both files must have same entries (`failed:'Failed'` easy to miss). Sync breaks if one file missing an entry.
- **All Quests queue sync** - `renderAllQuests()` must be called from `processQueue()` alongside `renderProgress()` so All Quests tab shows real-time queue status (Running/Pending/Done), not stale data. Easy to forget.
- **Object reference vs ID** - `st.queue` items hold references to old quest objects. After `refreshQuests()`, `st.allQuests` gets new objects. Always compare by `x.q.id === q.id`, not `x.q === q`.
- **Enroll success** - Jangan deteksi pake `res?.body?.userStatus?.enrolledAt`. Discord bisa ubah response format. Pake `res?.status >= 200 && res?.status < 300` trus set manual `q.userStatus`.
- **Auto-enroll on load** - `autoEnrollAll()` (di akhir `refreshQuests`, guard `st._autoEnrolling` + `st.running`) enroll semua quest eligible (filter sama dgn select-all: `!exp` + `hasTask` + `!completedAt` + `!enrolledAt` + `!qActive`) tiap refresh (30s timer). Abort via `st._autoEnrollAbort` (set di `questkuKill`). JANGAN enroll saat queue jalan - JIT enroll di `processQueue` yang handle.
- **HypeSquad remove** - `hsRemove()` primary: `apiReq('DEL', '/hypesquad/online')` via `Q.api` (proven 204). Fallback: `wreq.m` + `"HTTPUtils"` string search -> `httpApi.del({url})`. Catatan: `httpApi.del` bisa return 500 setelah join house - pake `apiReq('DEL')` dulu.
- **Quest completion (PLAY/STREAM)** - Discord removed `QUESTS_SEND_HEARTBEAT_SUCCESS` Flux event. Completion polls heartbeat response every 5s: `res.body.progress[t].value` (fallback `userStatus.progress`). Jangan subscribe Flux events buat progress.
- **appId location** - `q.config.application` udah gak dipake. Extract dari `taskConfigV2.tasks.*.applications[0].id` (inline di `processQuest` buat `setFakeGame`). Di `refreshQuests` GAK ada filter appId - tampil semua quest store. Pass appName eksplisit ke `setFakeGame(q, pid, appId, exe, qName)` - `q.config.application.name` undefined.
- **Heartbeat body** - semua heartbeat (`/quests/:id/heartbeat`) harus bawa `application_id` (dari appId task) + `stream_key` format Discord: `call:<channelId>:<ownerId>` / `guild:<guildId>:<channelId>:<ownerId>`. Owner = user snowflake asli (`ME_ID`, fetch dari `/users/@me`), JANGAN angka acak - itu fingerprint bot. `ME_ID` di-set di `fetchPremiumType()` (satu call `/users/@me` buat keduanya).
- **Enrollment block** - baca `quest_enrollment_blocked_until` dari store (`Q.Quest`/`getState`) di awal `processQueue()`. Kalau future -> stop engine, jangan spam enroll endpoint. `enrollmentBlocked()` helper.
- **ACHIEVEMENT_IN_ACTIVITY** - jadi via OAuth bypass ke `discordsays.com`. Alur (di `bypassAchievement`): alert appId numeric -> heartbeat spoof dulu (beberapa quest jadi) -> consent `window.confirm` (default decline) -> snapshot `/oauth2/tokens` (pre, abort kalau gagal) -> `POST /oauth2/authorize` (code dari `location`) -> `POST /applications/{appId}/proxy-tickets` (ticket) -> referrer `https://{appId}.discordsays.com/?instance_id=example-cl-instance&platform=desktop&discord_proxy_ticket={ticket}` -> 2 POST `.proxy/acf/authorize` + `.proxy/acf/quest/progress` -> `finally` revoke grant app yg TIDAK ada di snapshot. Discord renderer CSP blok `*.discordsays.com` -> pakai `relay.ps1` (localhost `127.0.0.1:43210`, `GET /health` + `POST /proxy`), fallback `directFetch` cuma di web. `!isBrowser` tanpa relay -> fail "start relay.ps1". SSRF guard: appId wajib `/^\d+$/`. 50165 = age-gated/delisted. Risiko ban tertinggi. Files relay di `relay/` (`relay.ps1` + `start-relay.cmd` untuk double-click + `enable-pna.ps1`/`start-pna.cmd` untuk Chrome policy web), bukan extension. Transport di `bypassAchievement` (urutan): `qkRelayPost` (`relay.ps1`, desktop - page bisa) -> `qkExtPost` (web, CustomEvent `qk-ds`/`qk-ds-res` <-> `content.js` -> `background.js` SW) -> `qkDsDirect`. **Alur web floor**: page gak bisa fetch `127.0.0.1` (PNA), jadi extension SW yang fetch `http://127.0.0.1:43210/proxy` (context extension dikecualikan PNA), relay yang set `Referer` ke discordsays. Manifest butuh host_permission `http://127.0.0.1:43210/*`; relay reflect CORS `https://*.discord.com` + `chrome-extension://*`. SW + relay sama-sama pin host `^[0-9]+\.discordsays\.com$`, path 2 acf, `redirect:error`. **KRITIS**: authorize `.proxy/acf/authorize` butuh header `Referer` (bawa `discord_proxy_ticket`) - cuma relay yang bisa set; browser/extension `fetch` langsung gak (forbidden header) -> discords balas `{"message":"Env data not found"}`. Jadi achievement ANDAL cuma via `relay\start-relay.cmd` (desktop page->relay; web page->SW->relay). `content.js` jawab `ping` cuma kalau `chrome.runtime.sendMessage` ada (anti spoof copy MAIN-world), idempotent `window.__qkContentBound`. **RELAY = TcpListener raw, JANGAN kembali ke HttpListener**: Http.sys nge-drop `Access-Control-Allow-Private-Network`, yang wajib biar Chrome boleh nembus `127.0.0.1`. `Fetch failed`/`Failed to fetch` web-langsung-ke-relay = expected PNA (bukan bug); pakai extension. Relay gak listening -> `Test-NetConnection 127.0.0.1 -Port 43210` = False. **WEB (Chromium: Chrome/Edge) PNA**: flag `block-insecure-private-network-requests` DICABUT di Chrome 149 - satu-satunya lewat = Chrome policy, dan itu **ORIGIN-based** (bukan target). `relay\start-pna.cmd` (double-click, self-elevate UAC) -> `enable-pna.ps1` nulis `HKLM\SOFTWARE\Policies\Google\Chrome` + `HKLM\SOFTWARE\Policies\Microsoft\Edge` -> `LocalNetworkAccessAllowedForUrls` (REG_SZ JSON `["https://discord.com","https://*.discord.com","http://127.0.0.1:43210"]`). `InsecurePrivateNetworkRequestsAllowedForUrls` = deprecated (Unknown policy) - JANGAN pakai. Restart Chrome biar policy ke-baca. Firefox: gak bisa tembus relay dari page web -> pake desktop buat Achievement. Gak kesyah -> web achievement gak bisa (desktop gak butuh - Electron no PNA).
- **Stable webpack** - `webpackChunkdiscord_app.push` bisa berhenti expose live module cache di Discord Stable (kejadian 2026). `questku.js` baris 3-14 butuh fallback: deteksi Vencord `Webpack` API kalau ada, else sarankan Canary/PTB. Catat di questku.js & cek saat update besar.
- **Store setting (qstore)** - `localStorage` TIDAK defined di environment Discord (`ReferenceError`). JANGAN pake `localStorage` langsung. `qstore(k)` (read) / `qstore(k, v)` (write) di questku.js: fallback ke `localStorage` kalau ada, else `window.__questkuSettings` (persist lintas kill/re-inject tanpa reload). Key: `questku_autoClaim`/`questku_autoEnroll` ('1'/'0').
- **Status badge hierarchy** (renderAllQuests) - pakai `expBadge(q)` = `completed && !claimed ? false : isExpired(q)`. Prioritas: `expBadge`#1 (cok `.brn` = quest lewat `expiresAt` KECUALI done-unclaimed yang tetap claimable) -> `done`#2 (`!claimed`->'Unclaimed'/`uc`, else 'Done'/`dn`) -> failed/stopped -> qActive -> `unsupported` -> enrolled -> not-enrolled. Quest `completed && !claimed` SELALU 'Unclaimed' + Claim enabled walau expired (Discord izinkan claim quest selesai lewat `expiresAt`); quest completed+claimed+expired -> 'Expired' (bukan Done). `isExpired` = murni `expiresAt<now`. `done` pakai `!claimed`, JANGAN `completedAt &&` (store gak selalu sync). Filter/sort ikut `expBadge`. Progress (renderProgress + updateProgTick) pakai status queue, tapi quest `expBadge` ditandai `Expired` (`brn`) & dikeluarkan saat filter status aktif.
- **Quest listing** - `refreshQuests()` GAK filter: tampil semua di `Q.Quest.quests` (termasuk expired). Expired = `new Date(config.expiresAt).getTime() < Date.now()` -> badge 'Expired' cok, `cantSel` + `vqDisabled`, gak masuk select-all. Select-all (`isSelectable()` = `!isExp`+`hasTask`+`!completedAt`+`!qActive`+`!isDesktopOnlyQuest`) gak pernah milih exp/unsupported/done/unclaimed/desktop-only. `isDesktopOnlyQuest(q)` = GAK berlaku kalo punya web-task (`WATCH_VIDEO`/`PLAY_ACTIVITY`/`PLAY_ON_DESKTOP`/`WATCH_VIDEO_ON_MOBILE`) atau `isDesktop`; hard-block cuma `{STREAM_ON_DESKTOP,PLAY_ON_XBOX,PLAY_ON_PLAYSTATION}` - CATATAN: `PLAY_ON_DESKTOP` BUKAN desktop-only (game Discord kayak "Protect the King" bisa di-web), jangan masuk hard-set. Desktop-only card: overlay `.qk-desk-hint` "Use the desktop app to make progress!" (link `discord://-/quest-home#id`), select/view disabled.
- **Reward icon** - `icoHtml` pilih non-orb dulu (avatar deco type3 / profileEffect) > orb (type4) > `rewards[0]`. Type 1 & type 3 pakai `{r.asset}` URL thumbnail.
- **Settings popup (Progress toolbar, `(menu)`)** - Auto Enroll `#qk-ae` + Auto Claim `#qk-ac` = checkbox `<label class="qk-tl-opt"><input type="checkbox">` (filter-style, `.checked` state). Kill pindah ke header #qk-close dua-step. Tooltip `.qk-tip` (glass, di bawah opsi, `white-space:normal` - JANGAN nowrap, inherit dari `.qk-tl-opt`).
- **Progress hover (`.qk-hp`)** — progress bar muncul via `.qk-hp{position:absolute;bottom:0}` overlay di `.qk-if` (relative), `.qk-sb` cuma fade opacity. JANGAN balikin ke `max-height:0`/`margin-top` collapse — itu nge-refresh layout (card goyang ngecil-ngebesar). Select-all (`#qk-sel-toggle`) cuma flip label tombol yang `!sBtn.disabled` — kartu non-selectable (Unclaimed/expired/done) tombolnya disabled, label jangan diubah.

- **Header hero (`.qk-hero-strip`)** — roll otomatis Questku ↔ avatar+nama (gesture `animation: qkHero`, gap sel 12px, offset translateY `-42px` = 30px sel + 12px gap; ubah gap/height → sesuaikan offset). **Deko** `avatar_decoration_data` dibaca dari `/users/{ME_ID}/profile` `user.avatar_decoration_data` — BUKAN `/users/@me` (false-positive, di-report ke banyak akun). Per-scan `refreshQuests` refetch → auto-ubah pas ganti-akun. `updateHero()` set avatar/nama/deco.
- **Orb popover (`.qk-ob`)** — click-to-open (`.open`), bukan hover; X SVG (`#qk-ob-x`) tutup; ESC + klik luar tutup; klik orb pas panel minimize → otomatis re-open panel. Background video malam `.qk-night` saat jam 18–06 lokal. Video asset yak: orb = `b8fe318002139f2fabd6255aef10a0a625bb10aa9f8394efd6575115c1dca19a.webm` (transparan); `fb761d...` = orb GELAP. SALIN hash exact, jangan ketik manual (mudah korup jaruh).
- **Banner video** — `banVid = buildAssetUrl(q.id, banVidUrl)` — WAJIB prefix `quests/{id}/`; `https://cdn.discordapp.com/{asset}` doang → 404 (bug nyata). Banner video tetap `preload="none"` (tidak di-hydrate) biar gak decode semua.
- **Perf scroll All Quests** — `.qk-cd{content-visibility:auto;contain-intrinsic-size:auto 210px}` biar kartu offscreen gak di-render. JANGAN hapus (scroll jadi berat).
- **Orb/reward-icon video** — `.qk-orb-card` & `.qk-rw-vid` dirender `preload="none"`, lalu `hydrateStaticFrames()` (dipanggil setelah `innerHTML` di renderAllQuests & renderProgress) set `preload="auto"` + snap frame-0 via `loadeddata` → **frame statis terlihat tanpa hover**; hover tetap play via `bindOrbHover`. Kalau orb blank sampe hover → cek `hydrateStaticFrames` gak ke-panggil. JANGAN taruh asset-video di `<img>` / append `?format=webp` (jadi statis/404). Reward non-video tetap `<img>`.
- **Quick minimize** — klik tab yang sedang aktif (`t.classList.contains('act')` di handler tab) → set `hidden=true`, sembunyikan `.qk-body,.qk-tl,.qk-list,.qk-ft`, `D.min.textContent='+'`. Klik tab saat minimize → buka (handler lama). JANGAN hapus.
- **Start Queue + footer hidden** — `updateAddqBtn()` sembunyikan `#qk-addq` + parent `.qk-ft` (`display:none`) saat 0 quest terpilih; muncul lagi saat ada pilihan. Path `D.addq.disabled=!has` sudah dihilangkan — jangan dibalikin.
- **Back to top `.qk-back`** — tombol bulat di atas Start Queue (`#qk-b-quests` `position:relative`, absolute `bottom:46px;left:50%`), muncul saat `scrollTop>120` (`.show`, animasi `qkBackBob`), klik → `D.ql.scrollTo({top:0,behavior:'smooth'})`. JANGAN taruh di dalam `#kq-ql` (innerHTML render wipe).
- **Profile popout** — `openProfile()` buka account popout via selector `[role="button"][class*="accountPopoutButton"]` + fallback avatar `ME_ID` di kiri-bawah; dispatch event mouse penuh (`.click()` aja sering gagal di React Discord). Tidak ada log debug.
- **Tooltip glass `.qk-hov-tip`** — helper `bindHoverTip(el, text, 700)` buat hero ("Open profile") & orb ("Total balance"); node ke `document.body` (`position:fixed`, flip/clamp viewport) → tidak kepotong panel; di-clear saat kill. JANGAN pakai `:hover` in-strip (kepotong roll) / `title` native.
- **Watch turbo + parallel** — WATCH post `{timestamp:need}` langsung (fallback loop kalau tidak `completed_at`); `processQueue` jalan 2 watch bareng (`isWatchQuest`/`runItem`/`Promise.all`). JANGAN revert ke slow-watch; PLAY/STREAM/ACTIVITY server-metered (tidak bisa kilat).

## Git workflow

Commit format (dari history): `new:`, `fix:`, `feat:`, `chore:`. Singkat, deskriptif.
Branch nyasar (`feat/*`, `fix-*`) yang gak terpakai bikin graph merah. Hapus pake `git branch -D` + `git fetch --prune`.

Rilis: `git tag vX.Y.Z` + `git push origin vX.Y.Z` -> workflow auto-bikin GitHub Release (asset: `questku-<tag>.js` + `questku-extension.zip`). Samain `extension/manifest.json` version sama tag.

Auth: HTTPS push ke GitHub nolak password - prompt "Password" diisi PAT, bukan password akun. Helper `credential.helper=manager` di mesin ini rusak (nge-print `-c: applet not found`) - bypass: `git -c credential.helper= push <url-with-token>`.

## Referensi

- `questku.md` - playbook lengkap (excluded from git)
- `docs/fallback.md` - webpack recovery guide
- `CLAUDE.md` - system agent instructions (caveman style, principles)
