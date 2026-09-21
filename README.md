# Pantul — Billiard 8-Ball

Game billiard 8-ball berbasis Canvas 2D, satu file HTML tanpa dependensi: aturan 8-ball lengkap, physics spin
(top/back/side), bot 3 tingkat, mode dua pemain, lapisan multiplayer siap sambung, dan koleksi cue.

## Main
Buka `www/index.html` di browser (atau lewat GitHub Pages setelah rilis).
Mouse: arahkan untuk membidik, seret power bar di kanan lalu lepas untuk menembak.
Keyboard: ←/→ bidik (Shift = halus), Space tahan/lepas = power, Enter = tembak, Esc = jeda.

## Fitur
- **Tiga permainan:** 8 Ball, **9 Ball standar**, dan **9 Ball · Pilih Kantong** (lihat aturan di bawah).
- **Gameplay:** physics spin (top/back/side), 3 tingkat bot, dua pemain satu layar, mode online (simulasi lokal, siap disambung server).
- **Layout:** landscape lebar, landscape ponsel, dan **portrait** (meja diputar 90° agar mengisi layar). Kamera zoom halus ke area bidik (Setelan → Zoom saat membidik).
- **Ekonomi BCPOOL:** akun baru 30.000 koin; taruhan 100 hingga 5.000.000; menang = 2× taruhan dikurangi biaya 5%; keluar di tengah = kalah. Hadiah harian 7 hari, bantuan koin saat hampir bangkrut.
- **Level & hadiah:** kurva XP, animasi naik level, klaim hadiah (koin, cue, tema meja, avatar, bingkai).
- **Profil:** avatar, warna, bingkai, dan badge pencapaian. **Peringkat:** simulasi lokal (antarmuka `MockLeaderboard` siap diganti server).
- **Toko meja:** 8 tema bawaan (kayu, neon, ornamen, logam) dibeli dengan koin. **12 cue** dengan level & statistik yang memengaruhi permainan.
- **Developer (Setelan → Halaman Developer):** buat skin cue dan meja dari gambar sendiri, pratinjau langsung, template panduan, ekspor/impor JSON. Skin hanya kosmetik dan tersimpan di perangkat.

## Aturan 9 Ball
- Bola 1–9 di rack diamond (bola 1 di apex, bola 9 di tengah). Wajib menyentuh **bola bernomor terkecil** lebih dulu; setelah kontak harus ada bola masuk atau ada bola menyentuh cushion.
- Foul (bola putih masuk, salah bola pertama, tidak kena apa pun, tidak ada cushion): lawan mendapat **ball-in-hand** di mana saja.
- Bola 9 masuk secara sah (termasuk kombinasi) = **menang**; saat break = *golden break*. Bola 9 yang masuk saat foul **dikembalikan** ke foot spot.
- **Pilih Kantong:** sebelum setiap tembakan (kecuali break) pilih kantong tujuan dengan mengetuk kantongnya. Bola apa pun yang masuk **kantong lain** = foul. Tembakan tanpa memilih kantong tidak bisa dilakukan. Kamera tidak zoom di varian ini agar semua kantong terlihat.
- Belum ada: push-out, aturan 3 foul beruntun, dan opsi terima/re-rack pada break tidak sah (break tidak sah = foul biasa).

## Audio
Efek suara dimuat dari `assets/audio/*.mp3` (di-embed saat build) dan dipetakan ke event game di `src/08-audio.js` (`fileMap`):
`ball_collision` (bola×bola), `cushion_collision`, `cue_collision_strong/weak` (pukulan, dipilih menurut power), `pocket`, `impact` (break),
`rack` (bola disusun), `foul`, `levelUpStar` (naik level), `clock` (5 detik terakhir giliran). Jeda senyap encoder MP3 dipangkas otomatis
dan berkas yang sangat pelan dinormalkan. Bila folder `assets/audio` kosong/tidak ada, game memakai suara sintetis bawaan.
**Pastikan Anda memegang hak/lisensi atas berkas audio yang Anda letakkan di sana** sebelum merilis publik.

## Spesifikasi gambar skin
| Aset | Ukuran | Catatan |
|---|---|---|
| Cue | PNG transparan, horizontal | pangkal kiri, ujung kanan; dipangkas & diskalakan ke 1200×120 |
| Kain meja | 1648×776 | di-crop *cover*; playfield 1600×728 + area cushion 24 px |
| Frame/rail meja | 1760×888 | bagian tengah tertutup kain; rail terlihat 80 px |

Gunakan hanya gambar milik sendiri atau yang berlisensi; repo ini tidak menyertakan aset pihak lain.

## Install di Android
**Cara 1 — APK (dibangun otomatis oleh GitHub Actions)**
1. Push repo ini ke GitHub, lalu push tag: `git push origin main --tags`.
2. Buka tab **Actions → Build APK Android**. Setelah hijau, unduh artifact `pantul-apk` (zip berisi `pantul.apk`).
   Untuk tag `v*`, APK yang sama juga otomatis terlampir di halaman **Releases**.
3. Salin `pantul.apk` ke HP, buka, dan izinkan *Install unknown apps* untuk aplikasi pembuka (Files/Chrome) bila diminta.
Jalankan manual kapan saja: Actions → Build APK Android → **Run workflow**.
APK ini bertanda tangan *debug* — cukup untuk dipasang sendiri; untuk Play Store perlu keystore rilis.

**Cara 2 — PWA (tanpa APK)**: setelah GitHub Pages aktif, buka URL-nya di Chrome Android → menu ⋮ → **Install app** / *Add to Home screen*. Berjalan layar penuh dan landscape.

## Pengembangan
```
python3 tools/build.py   # rakit index.html dari src/ + assets/
npm test                 # uji geometri, physics, aturan, validator, dan pertandingan bot vs bot
```

## Struktur `src/`
| Berkas | Isi |
|---|---|
| 01-config | konstanta & util |
| 02-core | state machine tervalidasi, event bus |
| 03-physics | geometri meja (dipakai collision & render), physics, aim raycast |
| 04-rules | aturan 8-ball |
| 05-net | Transport + ShotValidator (ganti MockTransport dengan WebSocket) |
| 06-bot | AI bot |
| 07-game | orkestrator match (tanpa DOM) |
| 08-audio | abstraksi audio |
| 09-store | profil, pengaturan, katalog cue |
| 10-render, 11-ui, 12-main | renderer, HUD & input, bootstrap |

`tools/`: `build.py` (rakit `www/`), `gen_cues.py`, `gen_icons.py`, `android_patch.py` (dipakai CI), `test.js`.

## Aset
Gambar cue di `assets/cues/` dibuat oleh `tools/gen_cues.py` (original). Ganti field `image` di `src/09-store.js`
atau timpa PNG (1200×120, transparan) dengan aset yang Anda punya lisensinya. Proyek ini tidak memakai aset pihak lain.
