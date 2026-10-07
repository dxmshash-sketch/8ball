# tools/build.py

"""Rakit www/ (index.html + manifest + service worker + ikon) dari src/ dan assets/.
PNG cue, logo kain, dan ikon PWA di-embed sebagai data URI agar bebas CORS/path."""
import base64, json, pathlib, shutil

root = pathlib.Path(__file__).resolve().parent.parent
src = root / 'src'

# ── Urutan modul JS yang di-join jadi satu <script>. ──
# __LOGOS__ harus SEBELUM 01-config (dipakai di CONFIG.clothLogo).
# __CUES__ harus SEBELUM 09-content (dipakai di CUE_CATALOG).
# __AUDIO__ harus SEBELUM 08-audio (dipakai di Audio engine).
order = [
    '__LOGOS__',
    '01-config',
    '02-core',
    '03-physics',
    '04-rules',
    '05-net',
    '06-bot',
    '07-game',
    '__AUDIO__',
    '08-audio',
    '__CUES__',
    '09-content',
    '10-store',
    '11-leaderboard',
    '12-render',
    '13-ui',
    '14-pages',
    '15-dev',
    '16-cueballfx',
    '18-backend',
    '19-firebase-backend',
    '21-online',
    '22-main',
]


# ── Helper: baca file → data URI base64 ──
def to_data_uri(path, mime):
    if not path.exists():
        return ''
    return f'data:{mime};base64,' + base64.b64encode(path.read_bytes()).decode()


# ── Cue images (assets/cues/*.png) → data URI ──
cues_dir = root / 'assets' / 'cues'
imgs = {
    p.stem: to_data_uri(p, 'image/png')
    for p in sorted(cues_dir.glob('*.png'))
} if cues_dir.exists() else {}

# ── Logo kain (assets/logo/*.png) → data URI ──
logo_dir = root / 'assets' / 'logo'
logos = {}
if logo_dir.exists():
    for p in sorted(logo_dir.glob('*.png')):
        logos[p.stem] = to_data_uri(p, 'image/png')

# ── Audio (assets/audio/*.mp3) → data URI ──
aud_dir = root / 'assets' / 'audio'
audio = {
    p.stem: to_data_uri(p, 'audio/mpeg')
    for p in sorted(aud_dir.glob('*.mp3'))
} if aud_dir.exists() else {}

# ── Ikon PWA (assets/icons/*.png) → data URI (untuk favicon di HTML) ──
icons_dir = root / 'assets' / 'icons'
icon_192_uri = to_data_uri(icons_dir / 'icon-192.png', 'image/png')
icon_512_uri = to_data_uri(icons_dir / 'icon-512.png', 'image/png')
icon_maskable_uri = to_data_uri(icons_dir / 'icon-512-maskable.png', 'image/png')

# Fallback ke path relatif kalau file tidak ada (harus ada physical copy untuk manifest)
icon_192_href = icon_192_uri or 'icons/icon-192.png'

# ── Firebase config (opsional) ──
fb_cfg = json.loads((src / 'firebase-config.json').read_text())
fb_active = isinstance(fb_cfg, dict) and fb_cfg.get('apiKey')
fb_scripts = '' if not fb_active else (
    '<script src="https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js"></script>\n'
    '<script src="https://www.gstatic.com/firebasejs/10.13.0/firebase-auth-compat.js"></script>\n'
    '<script src="https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore-compat.js"></script>\n'
    '<script src="https://www.gstatic.com/firebasejs/10.13.0/firebase-storage-compat.js"></script>\n'
)


def part(f):
    """Ambil isi modul. Token `__X__` diganti dengan JS yang digenerate."""
    if f == '__CUES__':
        return 'const CUE_IMAGES = ' + json.dumps(imgs) + ';'
    if f == '__LOGOS__':
        return 'const CLOTH_LOGOS = ' + json.dumps(logos) + ';   // logo watermark di kain meja'
    if f == '__AUDIO__':
        return 'const AUDIO_DATA = ' + json.dumps(audio) + ';   // kosong → game memakai suara sintetis bawaan'

    txt = (src / (f + '.js')).read_text()

    if f == '19-firebase-backend' and fb_active:
        txt = txt.replace(
            'const FIREBASE_CONFIG = null;',
            'const FIREBASE_CONFIG = ' + json.dumps(fb_cfg) + ';'
        )

    return txt


js = '\n'.join(part(f) for f in order)


# ── HTML ──
# Favicon pakai data URI → selalu muncul, bahkan di file:// atau github.dev.
# Manifest tetap pakai path relatif karena manifest tidak bisa pakai data URI untuk icon di semua browser.
html = f'''<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Pantul — Billiard 8-Ball</title>
<meta name="theme-color" content="#222831">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" type="image/png" href="{icon_192_href}">
<link rel="apple-touch-icon" href="{icon_192_href}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600&family=Barlow+Semi+Condensed:wght@600;700&display=swap" rel="stylesheet">
<style>
{(src/'style.css').read_text()}
</style>
{fb_scripts}</head>
<body>
{(src/'body.html').read_text()}
<script>
{js}
</script>
<script>
if ('serviceWorker' in navigator && /^https?:/.test(location.protocol) && !window.Capacitor) navigator.serviceWorker.register('sw.js').catch(function () {{}});
</script>
</body>
</html>'''


# ── Tulis output ──
www = root / 'www'
if www.exists():
    shutil.rmtree(www)
(www / 'icons').mkdir(parents=True)
(www / 'index.html').write_text(html)

for f in ('manifest.webmanifest', 'sw.js'):
    shutil.copy(src / f, www / f)

# Copy icon fisik ke www/icons/ (dibutuhkan oleh manifest.webmanifest)
icon_files = ('icon-192.png', 'icon-512.png', 'icon-512-maskable.png')
missing_icons = []
for f in icon_files:
    src_icon = icons_dir / f
    if src_icon.exists():
        shutil.copy(src_icon, www / 'icons' / f)
    else:
        missing_icons.append(f)


# ── Log ──
print('www/index.html', len(html) // 1024, 'KB')
print(f'  cues:   {len(imgs)} images embedded')
print(f'  logos:  {len(logos)} images embedded' + (f' ({", ".join(logos.keys())})' if logos else ''))
print(f'  audio:  {len(audio)} clips embedded')
print(f'  icons:  {len(icon_files) - len(missing_icons)} embedded' + (f' (missing: {", ".join(missing_icons)})' if missing_icons else ''))