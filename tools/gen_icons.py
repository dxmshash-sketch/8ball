"""Ikon aplikasi original: bola 8 di atas kain biru. Menghasilkan assets/icons/*.png"""
import pathlib, numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
out = pathlib.Path(__file__).resolve().parent.parent / 'assets' / 'icons'; out.mkdir(parents=True, exist_ok=True)
N = 1024
yy, xx = np.mgrid[0:N, 0:N].astype(float)

# kain biru: gradient radial dari tengah + vignette
d = np.hypot(xx - N * 0.42, yy - N * 0.38) / (N * 0.85)
c0, c1 = np.array([134, 217, 246]), np.array([36, 122, 172])
bg = c0[None, None, :] * (1 - np.clip(d, 0, 1))[..., None] + c1[None, None, :] * np.clip(d, 0, 1)[..., None]

# bola hitam 3D
cx, cy, R = N / 2, N / 2 + 14, N * 0.335
nx, ny = (xx - cx) / R, (yy - cy) / R
r2 = nx ** 2 + ny ** 2; inside = r2 <= 1
nz = np.sqrt(np.clip(1 - r2, 0, 1))
L = np.array([-0.45, -0.55, 0.70]); L /= np.linalg.norm(L)
diff = np.clip(nx * L[0] + ny * L[1] + nz * L[2], 0, 1)
H = L + np.array([0, 0, 1.0]); H /= np.linalg.norm(H)
spec = np.clip(nx * H[0] + ny * H[1] + nz * H[2], 0, 1) ** 40
shade = (0.10 + 0.55 * diff)[..., None] * np.array([1, 1, 1.08])[None, None, :] * 255 * 0.55
ball = np.clip(shade + spec[..., None] * 255 * 0.9, 0, 255)
# bayangan
sh = np.hypot(xx - (cx + R * 0.25), (yy - (cy + R * 1.02)) * 2.6) / (R * 1.05)
bg = bg * (1 - 0.35 * np.clip(1 - sh, 0, 1))[..., None]
a = np.clip((1 - np.sqrt(r2)) * R * 0.5 + 0.5, 0, 1)[..., None]
img = bg * (1 - a) + ball * a
im = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8), 'RGB')

# cakram putih + angka 8
ov = Image.new('RGBA', (N, N), (0, 0, 0, 0)); dr = ImageDraw.Draw(ov)
pr = R * 0.5; dr.ellipse([cx - pr - 8, cy - R * 0.06 - pr, cx + pr - 8, cy - R * 0.06 + pr], fill=(245, 245, 240, 255))
try: font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', int(pr * 1.5))
except Exception: font = ImageFont.load_default()
dr.text((cx - 8, cy - R * 0.06 + 6), '8', font=font, fill=(20, 20, 26, 255), anchor='mm')
im = Image.alpha_composite(im.convert('RGBA'), ov.filter(ImageFilter.GaussianBlur(1.2)))
# highlight kaca di atas cakram
hl = Image.new('RGBA', (N, N), (0, 0, 0, 0)); ImageDraw.Draw(hl).ellipse([cx - R * 0.62, cy - R * 0.9, cx + R * 0.1, cy - R * 0.38], fill=(255, 255, 255, 46))
im = Image.alpha_composite(im, hl.filter(ImageFilter.GaussianBlur(14)))

def rounded(im, radius):
    m = Image.new('L', im.size, 0); ImageDraw.Draw(m).rounded_rectangle([0, 0, im.width - 1, im.height - 1], radius=radius, fill=255)
    o = im.copy(); o.putalpha(m); return o
def circle(im):
    m = Image.new('L', im.size, 0); ImageDraw.Draw(m).ellipse([0, 0, im.width - 1, im.height - 1], fill=255)
    o = im.copy(); o.putalpha(m); return o
full = im.convert('RGB')
full.resize((512, 512), Image.LANCZOS).save(out / 'icon-512-maskable.png')          # penuh, aman untuk maskable
rounded(im, 210).resize((512, 512), Image.LANCZOS).save(out / 'icon-512.png')
rounded(im, 210).resize((192, 192), Image.LANCZOS).save(out / 'icon-192.png')
rounded(im, 210).resize((1024, 1024), Image.LANCZOS).save(out / 'icon-1024.png')
circle(im).resize((1024, 1024), Image.LANCZOS).save(out / 'icon-round-1024.png')
print('ok', sorted(p.name for p in out.iterdir()))
