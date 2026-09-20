"""Dijalankan di CI setelah `npx cap add android`: ikon, splash gelap, layar penuh, dan orientasi landscape."""
import pathlib, re, sys
from PIL import Image
root = pathlib.Path(__file__).resolve().parent.parent
app = root / 'android' / 'app' / 'src' / 'main'
res = app / 'res'
if not app.exists(): sys.exit('android/ belum dibuat: jalankan `npx cap add android` dulu')

# 1) ikon peluncur: hapus adaptive-icon bawaan Capacitor lalu isi PNG biasa di semua densitas
adaptive = res / 'mipmap-anydpi-v26'
if adaptive.exists():
    for f in adaptive.iterdir(): f.unlink()
    adaptive.rmdir()
sq, rd = Image.open(root / 'assets/icons/icon-1024.png').convert('RGBA'), Image.open(root / 'assets/icons/icon-round-1024.png').convert('RGBA')
for dens, px in {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}.items():
    d = res / f'mipmap-{dens}'; d.mkdir(parents=True, exist_ok=True)
    sq.resize((px, px), Image.LANCZOS).save(d / 'ic_launcher.png')
    rd.resize((px, px), Image.LANCZOS).save(d / 'ic_launcher_round.png')
    sq.resize((px, px), Image.LANCZOS).save(d / 'ic_launcher_foreground.png')

# 2) splash: ganti logo Capacitor dengan latar gelap + ikon game
n = 0
for p in res.rglob('splash.png'):
    w, h = Image.open(p).size
    bg = Image.new('RGB', (w, h), (34, 40, 49)); s = int(min(w, h) * 0.34)
    ic = sq.resize((s, s), Image.LANCZOS); bg.paste(ic, ((w - s) // 2, (h - s) // 2), ic); bg.save(p); n += 1

# 3) orientasi landscape
mf = app / 'AndroidManifest.xml'; t = mf.read_text()
if 'screenOrientation' not in t: t = re.sub(r'(<activity\b)', r'\1 android:screenOrientation="sensorLandscape"', t, count=1)
mf.write_text(t)

# 4) layar penuh (tanpa status bar)
st = res / 'values' / 'styles.xml'; t = st.read_text()
if 'windowFullscreen' not in t:
    t = re.sub(r'(<style name="AppTheme\.NoActionBar"[^>]*>)', r'\1\n        <item name="android:windowFullscreen">true</item>', t, count=1)
st.write_text(t)
print('patch selesai; splash diganti:', n)
