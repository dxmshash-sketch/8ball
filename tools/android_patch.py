"""Dijalankan di CI setelah `npx cap add android`: ikon, splash gelap, layar penuh, orientasi landscape,
dan Gradle plugin google-services untuk Firebase Native."""
import pathlib, re, sys
from PIL import Image

root = pathlib.Path(__file__).resolve().parent.parent
app = root / 'android' / 'app' / 'src' / 'main'
res = app / 'res'
if not app.exists():
    sys.exit('android/ belum dibuat: jalankan `npx cap add android` dulu')

# 1) Ikon peluncur
adaptive = res / 'mipmap-anydpi-v26'
if adaptive.exists():
    for f in adaptive.iterdir():
        f.unlink()
    adaptive.rmdir()

sq_path = root / 'assets/icons/icon-1024.png'
if not sq_path.exists():
    sq_path = root / 'assets/icons/icon-512.png'
sq = Image.open(sq_path).convert('RGBA')

rd_path = root / 'assets/icons/icon-round-1024.png'
if not rd_path.exists():
    rd_path = sq_path
rd = Image.open(rd_path).convert('RGBA')

for dens, px in {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}.items():
    d = res / f'mipmap-{dens}'
    d.mkdir(parents=True, exist_ok=True)
    sq.resize((px, px), Image.LANCZOS).save(d / 'ic_launcher.png')
    rd.resize((px, px), Image.LANCZOS).save(d / 'ic_launcher_round.png')
    sq.resize((px, px), Image.LANCZOS).save(d / 'ic_launcher_foreground.png')

# 2) Splash
n = 0
for p in res.rglob('splash.png'):
    w, h = Image.open(p).size
    bg = Image.new('RGB', (w, h), (34, 40, 49))
    s = int(min(w, h) * 0.34)
    ic = sq.resize((s, s), Image.LANCZOS)
    bg.paste(ic, ((w - s) // 2, (h - s) // 2), ic)
    bg.save(p)
    n += 1

# 3) Orientasi landscape
mf = app / 'AndroidManifest.xml'
t = mf.read_text()
if 'screenOrientation' not in t:
    t = re.sub(r'(<activity\b)', r'\1 android:screenOrientation="fullSensor"', t, count=1)
mf.write_text(t)

# 4) Layar penuh (tanpa status bar)
st = res / 'values' / 'styles.xml'
t = st.read_text()
if 'windowFullscreen' not in t:
    t = re.sub(
        r'(<style name="AppTheme\.NoActionBar"[^>]*>)',
        r'\1\n        <item name="android:windowFullscreen">true</item>',
        t, count=1
    )
st.write_text(t)

# 5) Gradle plugin google-services (WAJIB untuk Firebase Native)
# Project-level
proj_build = root / 'android' / 'build.gradle'
t = proj_build.read_text()
if 'com.google.gms:google-services' not in t:
    t = re.sub(
        r"(classpath\s+['\"]com\.android\.tools\.build:gradle[^'\"]*['\"])",
        r"classpath 'com.google.gms:google-services:4.4.2'\n        \1",
        t, count=1
    )
    proj_build.write_text(t)
    print('  + android/build.gradle: classpath google-services')

# App-level
app_build = root / 'android' / 'app' / 'build.gradle'
t = app_build.read_text()
if 'com.google.gms.google-services' not in t:
    t = t.replace(
        "apply plugin: 'com.android.application'",
        "apply plugin: 'com.android.application'\napply plugin: 'com.google.gms.google-services'",
        1
    )
    app_build.write_text(t)
    print('  + android/app/build.gradle: apply plugin google-services')

print('patch selesai; splash diganti:', n)