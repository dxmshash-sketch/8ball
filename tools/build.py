"""Rakit satu file index.html dari src/ + PNG di assets/cues (di-embed sebagai data URI)."""
import base64, json, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
src = root / 'src'
order = ['01-config','02-core','03-physics','04-rules','05-net','06-bot','07-game','08-audio','__CUES__','09-store','10-render','11-ui','12-main']
imgs = {p.stem: 'data:image/png;base64,' + base64.b64encode(p.read_bytes()).decode() for p in sorted((root/'assets'/'cues').glob('*.png'))}
js = '\n'.join(('const CUE_IMAGES = ' + json.dumps(imgs) + ';') if f == '__CUES__' else (src/(f+'.js')).read_text() for f in order)
html = f'''<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Pantul — Billiard 8-Ball</title>
<meta name="theme-color" content="#222831">
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
</body>
</html>'''
(root/'index.html').write_text(html)
print('index.html', len(html)//1024, 'KB')
