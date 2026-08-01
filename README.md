<p align="center">
  <img src="assets/Questku.png" alt="Questku" width="140" />
</p>

<h1 align="center">Questku</h1>
<h3 align="center">Discord Quest Automation</h3>

<p align="center"><em style="font-family: Georgia, serif; font-size: 1.2em; color: #777;">Automatically enroll, complete, and claim Discord quests.</em></p>

<p align="center">
  <img src="https://img.shields.io/badge/license-GPL--3.0-545ded?style=flat-square" alt="License">
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20Web%20%7C%20Android-80848e?style=flat-square" alt="Platform">
  <img src="https://img.shields.io/badge/chrome-extension-545ded?style=flat-square" alt="Chrome Extension">
  <img src="https://img.shields.io/github/v/release/norvramis/questku?style=flat-square" alt="Release">
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> <text>•</text>
  <a href="#security">Security</a> <text>•</text>
  <a href="#screenshots">Screenshots</a> <text>•</text>
  <a href="#highlights">Highlights</a> <text>•</text>
  <a href="#features">Features</a> <text>•</text>
  <a href="#compatibility">Compatibility</a> <text>•</text>
  <a href="#comparison">Comparison</a> <text>•</text>
  <a href="#how-it-works">How It Works</a> <text>•</text>
  <a href="#installation">Installation</a> <text>•</text>
  <a href="#dashboard">Dashboard</a> <text>•</text>
  <a href="#faq">FAQ</a> <text>•</text>
  <a href="#troubleshooting">Troubleshooting</a>
</p>

---

> [!CAUTION]
> As of April 2026, Discord has expressed their intent to crack down on automating quest completion. Some users have received a warning system message.
>
> ![system message](assets/system-message.png)

---

## Quick Start

1. Accept quests under the Quests tab in Discord.
2. Press **Ctrl + Shift + I** to open DevTools.
3. Open the **Console** tab.
4. Type `allow pasting` and press Enter.
5. Download the latest `questku.js` from [Releases](https://github.com/norvramis/questku/releases/latest) — or use the [raw file](questku.js) for the very latest code — and copy it.
6. Paste the code into the console and press Enter.
7. The dashboard appears. Select quests and start the queue.

---

## Security

Your Discord token never leaves your browser.

- **No external server** — everything runs in your tab.
- **No analytics, no telemetry** — nothing is tracked or collected.
- **No account login** — you just paste the script; Questku uses Discord's own session.
- **Only Discord's official API** — every request goes to discord.com.
- **Runs locally** — close the tab and nothing remains.

---

## Screenshots

| | | |
|---|---|---|
| ![All Quests](assets/all_quest_tab.png) | ![Progress](assets/progress_tab.png) | ![HypeSquad](assets/tab_HypeSquad.png) |

---

## Highlights

Questku handles the tedious parts of Discord quests, so you only pick and start.

```
Pick quests
  → Select All (or one by one)
  → Start Queue — auto-enrolls
  → Watch → progress climbs on its own
  → Play / Stream → Discord sees you "playing"
  → Completed → Unclaimed badge → Claim
```

**Why Questku?**

- **Quest grinding is manual by default** — enroll, play, watch, claim, repeat. Questku batches it all in one click.
- **Play quests normally need the game running** — Questku makes Discord see you as playing without opening anything.
- **Rewards slip away unclaimed** — finished quests get an Unclaimed badge and a Claim button, so nothing expires forgotten.
- **Other scripts want your token on their server** — Questku runs locally and only talks to Discord.
- **Other tools break on every Discord update** — Questku is one paste; re-run and you're back.

---

## Features

| Feature | What it does for you |
|---------|----------------------|
| Auto Quest Flow | Enroll + complete in one batch — pick quests, click once, walk away. |
| Dual Delivery | Paste-to-DevTools script or Chrome extension. Same dashboard either way. |
| In-Page Dashboard | Floating panel: drag, minimize, close. Everything runs inline. |
| Filter & Sort | Filter by reward, quest type, or status. Sort by Suggested, Most Recent, Expiring Soon, Started, Highest Reward, or A-Z. |
| Queue Manager | Pause, resume, stop, or kill the whole queue. Finished/failed quests lock their controls automatically. |
| Progress Monitoring | Hover any card for a live progress bar. Active count at a glance. |
| HypeSquad | Set or remove your house badge. Auto-detects what you already own. |
| Nitro Orb Detection | Detects your Nitro tier and shows the right orb values. |
| View Quest / Claim | Open quest details without a reload. Finished unclaimed quests show a Claim button. |

---

## Compatibility

| | |
|---|---|
| **Quest types** | Watch · Play · Stream · Activity |
| **Platforms** | Windows · macOS · Linux · Android |
| **Browsers** | Chrome · Edge · Firefox |
| **Discord** | Web (any browser) · Desktop (Windows, via `enable-devtools.ps1`) |
| **Delivery** | Paste-to-DevTools script · Chrome extension |

---

## Comparison

| | Questku | Others |
|---|---|---|
| Queue automation | ✅ | ❌ |
| In-page dashboard | ✅ | ❌ |
| Chrome extension | ✅ | ❌ |
| Android support | ✅ | ❌ |
| Claim tracking | ✅ | ❌ |
| HypeSquad manager | ✅ | ❌ |

---

## How It Works

Questku runs as a script inside your Discord tab and talks to Discord's own APIs — no install, no server, nothing to trust.

**What happens under the hood:**

- **Discovery** — Questku finds Discord's quest, game, and streaming modules by their signatures and reads your active quests straight from Discord's own state.
- **Enrollment** — quests you haven't accepted are enrolled through Discord's official endpoint.
- **Completion** — each quest type is handled automatically:
  - **Watch** — progress is reported to Discord in the background until it hits 100%.
  - **Play / Stream** — Questku registers a running game with Discord, so it sees you as playing.
  - **Activity** — completes on its own.
- **Claim** — finished quests show an Unclaimed badge and a Claim button; one click opens the quest to claim.

> Everything runs in your tab. No data is sent anywhere except Discord's official API.

---

## Installation

Works on Discord **Web** (all browsers), **Desktop** (with DevTools enabled), **Chrome Extension**, and **Android** (Chrome/Kiwi/Firefox with Desktop site mode).

### Option 1: Script (DevTools)

1. Follow [Quick Start](#quick-start).
2. Works on Discord **Web** (browser) and **Desktop** (with DevTools enabled).

> [!IMPORTANT]
> If DevTools are disabled in Discord Desktop, run `enable-devtools.ps1` as Administrator first.

### Option 2: Chrome Extension

1. Open Chrome and go to `chrome://extensions`.
2. Enable **Developer mode** (top-right toggle).
3. Click **Load unpacked** and select the `extension/` folder.
4. Navigate to [Discord Web](https://discord.com/app) and open any quest page.
5. Click the Questku extension icon and press **ON**.

![extension popup](assets/extension-popup.png)

> [!NOTE]
> The extension uses `rules.json` to spoof an Electron User-Agent. If Discord updates its desktop version, you may need to update the UA string in `rules.json`.

### Option 3: Android (Mobile Browser)

Questku can also be used on Android devices via Chrome or any browser that supports DevTools.

1. Open **Chrome** (or Kiwi Browser, Firefox) on your Android device.
2. Navigate to [Discord Web](https://discord.com/app) and log in.
3. Tap the browser menu (three dots) and enable **Desktop site**.
4. Open Discord's quest page and wait for the quest list to load.
5. Open DevTools:
   - **Chrome:** Navigate to `chrome://inspect`, enable discovery, then use a desktop Chrome's dev tools remotely, or use the `View Source` approach with browser console shortcuts.
   - **Kiwi Browser:** Tap the three-dot menu -> **Developer tools** -> **Console**. This gives a full DevTools interface directly on mobile.
   - **Firefox:** Navigate to `about:debugging` -> **Inspect** to access the console.
6. Type `allow pasting` in the console and press Enter.
7. Copy the code from `questku.js` and paste it into the console.
8. The Questku dashboard will appear. Select quests and start the queue.

---

## Dashboard

Three tabs in one floating panel — quest list, running queue, and HypeSquad badge manager.

### All Quests Tab

![all quest tab](assets/all_quest_tab.png)

<details><summary>Toolbar & card reference</summary>

**Toolbar:**

![toolbar all quest](assets/toolbar_all_quest.png)

- **Select All** — toggle select/deselect all uncompleted quests
- **Sort** (radio) — Suggested, Most Recent, Expiring Soon, Started, Highest Reward, Alphabetical (A-Z)
- **Filter** (checkbox sections) — Discord-style layout:
  - **Reward:** Orbs, Avatar Decoration, Profile Effect, In-Game Rewards
  - **Quest Type:** Play, Watch, Stream, Activity
  - **Status:** Available, In Progress, Completed, Expired
  - **Clear** — resets all filters
- **Refresh** (arrow circle) — re-fetches quest list from Discord

**Quest Cards:**

![quest cards](assets/quest_cards.png)

- Banner image with hover video (when available)
- Game logo and name (blue `#545ded`)
- Orb reward (auto-adjusted for Nitro)
- Task description
- Status badge: Not Enrolled / Enrolled / Unclaimed / Done / Expired
- Select / Deselect button
- View Quest / Claim — opens quest details via SPA routing; completed unclaimed quests show Claim instead

</details>

### Progress Tab

![progress tab](assets/progress_tab.png)

<details><summary>Toolbar, card actions & footer reference</summary>

**Toolbar:**

![toolbar progress](assets/toolbar_progress.png)

- **Select All** — toggle select/deselect actionable quests
- **Filter** — single dropdown merging sort and status:
  - **Sort By** (radio): Queue Position, Newest, Oldest, Alphabetical (A-Z)
  - **Status** (checkbox): Running, Pending, Paused, Done, Failed, Stopped
  - **Clear** — resets both sort and status filters
- **N Active / No Active** — plain text indicator, no background/border
- **Kill** — stops all processes, restores Discord internals, closes dashboard
- **Refresh** — re-render progress panel

**Card Actions:**

- Hover to see progress bar
- Click top area to expand card details
- Select / Deselect for queue control

**Footer Controls:**

- **Pause / Resume** — toggles running quest's pause state
- **Stop** — marks quest as Stopped (not Failed), resets progress, continues to next quest
- **Done / Failed count** — tracks completed and failed quests

> [!WARNING]
> Stop marks the quest as "Stopped" (not "Failed"). The counter tracks stopped quests separately (`st.stopped`).

</details>

### HypeSquad Tab

![tab HypeSquad](assets/tab_HypeSquad.png)

- Three house cards: Bravery, Brilliance, Balance
- **Auto-selects owned badge** when tab is opened
- **Apply Badge** — sets selected house
- **Remove Badge** — removes current house

> [!TIP]
> If you already have a badge, it auto-selects when you open the tab. Click **Remove Badge** to clear it.

### Minimize & Close

- **Minimize (-)** — hides toolbar, list, and footer (nav tabs stay visible). Click any tab to restore.
- **Close (x)** — closes dashboard and restores Discord internals.

---

## Console Output

Questku logs its activity to the browser console for debugging and monitoring.

| Level | Prefix | Color | When |
|-------|--------|-------|------|
| Info | `[..]` | Orange | Enrolling, progress %, rate limits, retries, PID |
| OK | `[OK]` | Green | Enrolled, queue done summary |
| Done | `[Done]` | Green | Quest completion (with duration) |
| Error | `[!!]` | Red | Failed requests, quest/heartbeat errors |
| Header | `[!]` | Blue | Kill, startup |

---

## FAQ

Quick answers to the usual questions.

- **What does Kill do?** Stops everything, undoes Questku's changes to Discord (your real games list comes back), and closes the dashboard.
- **Why don't my quests show up?** Quests must be accepted in Discord's Quests tab first. Questku only lists active, unexpired quests with a supported task type.
- **Can I run Questku in the background?** Yes. The queue runs on its own — minimize the dashboard, switch tabs, or use other apps.
- **What's the difference between Stop and Kill?** Stop pauses the current quest (marked Stopped) and moves on. Kill cancels the whole queue and restores Discord to normal.
- **Nitro orb values look wrong?** Questku detects your Nitro tier automatically. After changing your subscription, refresh the quest list or reload the page.
- **Can I use the script and extension at the same time?** No — only one instance. Kill the script before switching to the extension.
- **Where's the Claim button?** For a completed quest you haven't claimed, the View Quest button turns into **Claim**. Clicking it opens the quest so you can claim the reward in Discord.
- **Why does a quest show "Unsupported"?** The quest uses a task type Questku doesn't recognize, so it can't process it automatically.
- **Does this work on mobile?** Yes — Android via Chrome, Kiwi, or Firefox with Desktop site mode.
- **Why does the extension ask me to join a server?** The extension only runs for members of the Questku server. Use the Join Server button, or just use the DevTools script instead.
- **Script does nothing after pasting?** Chrome blocks pasting by default. Type `allow pasting` in the console first, then paste again. Still nothing? Refresh the page and retry.

---

## Troubleshooting

Most problems come from a stale page. Before going deeper: refresh the Discord page, re-paste the latest script (or reload the extension), and try again.

| Problem | Fix |
|---------|-----|
| Enroll button does nothing | Refresh the page and paste the script again. Check the console for error logs. |
| Extension not injecting | Reload the extension in `chrome://extensions` and refresh the Discord tab. |
| Progress stuck at 0% | The quest usually needs re-enrolling. Stop it, remove it, and add it again. |
| Dashboard shows "No quests" | Accept quests in Discord's Quests tab first. Only active, unexpired quests appear. |
| "Rate limited" in the console | Normal. Questku waits and retries automatically. |
| Script error on paste | Type `allow pasting` and press Enter, then paste again. |
| Breaks after a Discord update | See `fallback.md` for webpack recovery. Update the webpack discovery section at the top of `questku.js` if paths changed. |

---

## License

GPL-3.0. See [LICENSE](LICENSE).

