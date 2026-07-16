<p align="center">
  <img src="assets/banner.png" alt="Questku">
</p>

<p align="center">
  <a href="#cara-pakai">Cara Pakai</a> •
  <a href="#fitur">Fitur</a> •
  <a href="#aktifkan-devtools">Aktifkan DevTools</a> •
  <a href="#dashboard">Dashboard</a> •
  <a href="#extension">Extension</a> •
  <a href="#faq">FAQ</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-GPL--3.0-545ded" alt="Lisensi">
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20Web%20%7C%20Android-80848e" alt="Platform">
  <img src="https://img.shields.io/badge/chrome-extension-545ded" alt="Chrome Extension">
</p>

---

Selesaikan quest Discord secara otomatis — cukup paste script ke DevTools atau pakai Chrome Extension.

---

> [!CAUTION]
> Per April 2026, Discord menyatakan akan menindak pengguna yang mengotomatiskan quest. Beberapa pengguna sudah mendapat peringatan.
>
> ![system message](assets/system-message.png)

---

## Cara Pakai

1. Accept quest di tab **Quests**
2. Tekan `Ctrl+Shift+I` → **Console** → paste [`questku.js`](questku.js) → Enter
3. Dashboard muncul → klik **Start**

> [!TIP]
> Jika `Ctrl+Shift+I` tidak bekerja, lihat [Aktifkan DevTools](#aktifkan-devtools) di bawah.

> [!IMPORTANT]
> Kamu harus mengetik `allow pasting` sebelum paste script. Discord memblokir paste di Console demi keamanan.

> [!NOTE]
> Quest game dan streaming memerlukan aplikasi desktop Discord. Browser hanya mendukung quest video.

### Opsi A: DevTools (desktop)

1. Accept quest di tab Quests
2. Tekan `Ctrl+Shift+I` buka DevTools
3. Buka tab **Console**
4. Buka [`questku.js`](questku.js), copy semua isi
5. Paste ke Console tekan Enter
6. Dashboard Questku muncul di pojok kanan bawah
7. Di tab **All Quests**, pilih quest yang mau diproses
8. Klik **[>>] Add Selected to Queue**
9. Buka tab **Progress** untuk lihat status

### Opsi B: Chrome Extension

> [!NOTE]
> Kamu hanya perlu folder `extension/` — bukan seluruh repository.

**Download folder extension:**
- [`questku-extension.zip`](https://github.com/norvramis/questku/archive/refs/heads/main.zip) — extract, pakai folder `extension/`
- Atau clone repo: `git clone https://github.com/norvramis/questku.git`

**Install dan pakai:**

1. Buka Chrome → `chrome://extensions/`
2. Nyalakan **Developer mode**
3. Klik **Load unpacked** → pilih folder `extension/`
4. Buka `https://discord.com/quest-home`
5. Klik icon Questku di toolbar → klik tombol **Questku**

> [!TIP]
> Di Android, pakai Kiwi Browser atau Lemur Browser, lalu ikuti langkah yang sama dari dalam browser.

---

## Fitur

| Fitur | Deskripsi |
|-------|-----------|
| **Dashboard UI** | Panel mengambang — daftar quest, progress bar, start/stop |
| **Auto-enroll** | Menerima quest secara otomatis sebelum diproses |
| **Auto-claim** | Mengklaim reward saat quest selesai |
| **Antrian quest** | Pilih quest, tambah ke antrian, proses satu per satu |
| **Rate limit handling** | Backoff otomatis saat kena batas API |
| **Chrome Extension** | Bisa dipasang sebagai extension browser |
| **Tab All Quests** | Lihat semua quest, pilih, enroll dalam batch |
| **Tab Progress** | Progress live per quest dengan status antrian |
| **Collapsible log** | Output konsol rapi dengan group expand/collapse |
| **Anti-detection** | Delay opsional antar siklus quest |

---

## Aktifkan DevTools

Jika `Ctrl+Shift+I` tidak membuka Developer Tools di Discord:

### Opsi 1: Jalankan script (disarankan)

1. Klik kanan [`enable-devtools.ps1`](enable-devtools.ps1) → **Run with PowerShell**
2. Restart Discord
3. `Ctrl+Shift+I` akan berfungsi

> [!TIP]
> Script hanya mengubah nilai registry Windows. Tidak memodifikasi file Discord.

### Opsi 2: Discord PTB atau Canary

Download [Discord PTB](https://discord.com/download) — Developer Tools aktif secara default di PTB dan Canary.

### Opsi 3: Pakai Chrome Extension

Tidak perlu DevTools sama sekali jika pakai [Metode Extension](#opsi-b-chrome-extension). Load extension, klik icon, inject script — tanpa `Ctrl+Shift+I`.

---

## Dashboard

![dashboard questku](assets/popup-ui.png)

Dashboard memiliki dua tab:

**All Quests** — lihat semua quest yang tersedia, filter berdasarkan status enroll, pilih quest individu atau semua, enroll dalam batch, lalu tambahkan quest terpilih ke antrian pemrosesan.

**Progress** — lihat antrian pemrosesan, track progress per quest dengan persentase, pause/resume antrian, stop dan hapus semua quest tertunda.

Panel bisa di-drag dengan header.

---

## Tipe Quest

| Task | Metode | Yang perlu dilakukan |
|------|--------|---------------------|
| WATCH_VIDEO | Kirim timestamp progress palsu | Tidak ada |
| PLAY_ON_DESKTOP | Spooff proses game + heartbeat | Tidak ada |
| STREAM_ON_DESKTOP | Spooff metadata stream | Join VC + stream window |
| PLAY_ACTIVITY | Kirim heartbeat ke endpoint | Join voice channel |

---

## Extension

![extension popup](assets/popup-ext.png)

Extension menggunakan Manifest V3 dengan:
- `declarativeNetRequest` untuk spoof user-agent (biar web Discord mengira desktop app)
- Inject langsung via `chrome.scripting.executeScript` ke main world halaman
- Tanpa DevTools, tanpa copy-paste — cukup klik tombol

---

## FAQ

**T: Script tidak jalan atau muncul "undefined"**
J: Buka DevTools kadang ngebreak HTTP request sementara. Tunggu atau restart Discord.

**T: Bisa kena ban?**
J: Selalu ada risiko. Belum ada laporan ban, tapi akun bisa kena flag.

**T: Ctrl+Shift+I tidak bekerja**
J: Pakai PTB client, enable DevTools via registry, atau pakai Chrome Extension.

**T: Script jalan tapi tidak ada progress**
J: Mungkin quest perlu tipe task berbeda, atau quest belum di-accept.

**T: Bisa selesaikan quest expired?**
J: Tidak.

**T: Bisa auto-accept atau auto-claim?**
J: Ya — toggle "Auto-enroll" dan "Auto-claim" di dashboard.

**T: Script berhenti jalan — "Discord internals not found"**
J: Discord sering update module internal. Lihat [Fallback Guide](FALLBACK.md) buat cara cari path baru dan perbaiki script.

---

## Kredit

Berdasarkan [aamiaa/CompleteDiscordQuest](https://gist.github.com/aamiaa/204cd9d42013ded9faf646fae7f89fbb) — konsep original dan penemuan webpack module.

Terinspirasi dari [power0matin/discord-quest-auto-completer](https://github.com/power0matin/discord-quest-auto-completer) — dashboard QuestMaster dan fitur auto.  
Struktur extension terinspirasi dari [nvckai/Discord-Web-Auto-Quest-Extension](https://github.com/nvckai/Discord-Web-Auto-Quest-Extension).

---

## Lisensi

GPL-3.0. Lihat [LICENSE](LICENSE).

<details>
<summary>Teks lisensi lengkap</summary>

```
GNU GENERAL PUBLIC LICENSE
Version 3, 29 June 2007

Copyright (C) 2007 Free Software Foundation, Inc. <https://fsf.org/>
Everyone is permitted to copy and distribute verbatim copies
of this license document, but changing it is not allowed.

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
```

</details>

---

**AI Assistance.** Proyek ini dikembangkan dengan bantuan AI (LLM) untuk menyusun kode dan mengotomatiskan proses pengaturan.
