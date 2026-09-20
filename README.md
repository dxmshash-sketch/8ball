# Pantul — Billiard 8-Ball

Game billiard 8-ball berbasis Canvas 2D, satu file HTML tanpa dependensi: aturan 8-ball lengkap, physics spin
(top/back/side), bot 3 tingkat, mode dua pemain, lapisan multiplayer siap sambung, dan koleksi cue.

## Main
Buka `index.html` di browser (atau lewat GitHub Pages setelah rilis).
Mouse: arahkan untuk membidik, seret power bar di kanan lalu lepas untuk menembak.
Keyboard: ←/→ bidik (Shift = halus), Space tahan/lepas = power, Enter = tembak, Esc = jeda.

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

## Aset
Gambar cue di `assets/cues/` dibuat oleh `tools/gen_cues.py` (original). Ganti field `image` di `src/09-store.js`
atau timpa PNG (1200×120, transparan) dengan aset yang Anda punya lisensinya. Proyek ini tidak memakai aset pihak lain.
