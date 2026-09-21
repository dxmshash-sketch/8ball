"""Rakit www/ (index.html + manifest + service worker + ikon) dari src/ dan assets/. PNG cue di-embed sebagai data URI."""
import base64, json, pathlib, shutil
root = pathlib.Path(__file__).resolve().parent.parent
src = root / 'src'
order = ['01-config','02-core','03-physics','04-rules','05-net','06-bot','07-game','__AUDIO__','08-audio','__CUES__','09-content','10-store','11-leaderboard','12-render','13-ui','14-pages','15-dev','16-main']
imgs = {p.stem: 'data:image/png;base64,' + base64.b64encode(p.read_bytes()).decode() for p in sorted((root/'assets'/'cues').glob('*.png'))}
aud_dir = root / 'assets' / 'audio'
audio = {p.stem: 'data:audio/mpeg;base64,' + base64.b64encode(p.read_bytes()).decode() for p in sorted(aud_dir.glob('*.mp3'))} if aud_dir.exists() else {}
def part(f):
    if f == '__CUES__': return 'const CUE_IMAGES = ' + json.dumps(imgs) + ';'
    if f == '__AUDIO__': return 'const AUDIO_DATA = ' + json.dumps(audio) + ';   // kosong → game memakai suara sintetis bawaan'
    return (src/(f+'.js')).read_text()
js = '\n'.join(part(f) for f in order)
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
<link rel="icon" href="icons/icon-192.png">
<link rel="apple-touch-icon" href="icons/icon-192.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600&family=Barlow+Semi+Condensed:wght@600;700&display=swap" rel="stylesheet">
<style>
{(src/'style.css').read_text()}
</style>
</head>
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
www = root / 'www'
if www.exists(): shutil.rmtree(www)
(www / 'icons').mkdir(parents=True)
(www / 'index.html').write_text(html)
for f in ('manifest.webmanifest', 'sw.js'): shutil.copy(src / f, www / f)
for f in ('icon-192.png', 'icon-512.png', 'icon-512-maskable.png'): shutil.copy(root / 'assets' / 'icons' / f, www / 'icons' / f)
print('www/index.html', len(html) // 1024, 'KB')
