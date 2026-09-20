import numpy as np, base64, json, io
from PIL import Image

SS = 2                       # supersample
W, H = 1200 * SS, 120 * SS
CY = H / 2
BUTT, TIP = 25 * SS, 7.5 * SS  # setengah tebal (butt -> tip)

xs = np.arange(W)[None, :].astype(np.float64)
ys = np.arange(H)[:, None].astype(np.float64)
xn = xs / W                                   # 0 (butt) .. 1 (tip)
half = BUTT + (TIP - BUTT) * np.clip((xn - 0.03) / 0.94, 0, 1) ** 0.85
half = np.where(xn < 0.03, BUTT, half)
v = (ys - CY) / np.maximum(half, 1e-6)        # -1 (atas) .. 1 (bawah)
inside = np.abs(v) <= 1.0
edge_aa = np.clip((1 - np.abs(v)) * half + 0.5, 0, 1)

def rgb(hexs):
    hexs = hexs.lstrip('#'); return np.array([int(hexs[i:i+2], 16) for i in (0, 2, 4)], float)

def band(x0, x1, soft=0.002):
    return np.clip((xn - x0) / soft, 0, 1) * np.clip((x1 - xn) / soft, 0, 1)

def paint(layers):
    """layers: list (mask HxW/1xW, color(3,) atau array HxWx3) - layer akhir menimpa."""
    img = np.zeros((H, W, 3)); img[:] = layers[0][1]
    for mask, col in layers[1:]:
        m = np.broadcast_to(mask, (H, W))[..., None]
        c = np.broadcast_to(np.asarray(col, float), (H, W, 3)) if np.ndim(col) == 3 else np.asarray(col, float)
        img = img * (1 - m) + c * m
    return img

def shade(base, spec=0.32, rough=1.0):
    s = 0.50 + 0.62 * np.exp(-((v + 0.40) / 0.55) ** 2) - 0.28 * np.clip(v - 0.15, 0, 1) ** 1.2
    s = np.clip(s, 0.22, 1.25)[..., None]
    out = base * s
    hl = (np.exp(-((v + 0.46) / 0.085) ** 2) * spec)[..., None]
    out = out + 255 * hl
    rim = (np.exp(-((v - 0.93) / 0.06) ** 2) * 0.10)[..., None]   # pantulan tepi bawah
    return np.clip(out + 255 * rim * 0.6, 0, 255)

def finish(base, name, glow=None):
    col = shade(base)
    alpha = (inside * edge_aa)
    rgba = np.dstack([col, alpha * 255]).astype(np.uint8)
    im = Image.fromarray(rgba, 'RGBA')
    if glow:  # cahaya tipis di sekitar cue
        pass
    im = im.resize((1200, 120), Image.LANCZOS)
    im.save(f'assets/cues/{name}.png', optimize=True)

def rings(xs_, w=0.004, col='#d9b45a'):
    m = np.zeros((1, W))
    for x in xs_: m = np.maximum(m, band(x, x + w))
    return m, rgb(col)

def tip_and_ferrule(layers, tip_col='#79c8ee'):
    layers.append((band(0.985, 1.0), rgb(tip_col)))        # tip
    layers.append((band(0.955, 0.985), rgb('#f3efe6')))     # ferrule putih
    return layers

def diamonds(period, x0, x1, amp, col, y=0.0):
    ph = ((xn - x0) / period) % 1.0
    d = np.abs(ph - 0.5) * 2 * 0.5 + np.abs(v - y) * 0.9      # jarak ke pusat berlian
    return band(x0, x1) * np.clip((amp - d) / 0.05, 0, 1), rgb(col)

def chevrons(period, x0, x1, thick, col):
    ph = ((xn + np.abs(v) * 0.05 * (period * 20)) / period) % 1.0
    return band(x0, x1) * np.clip((thick - np.abs(ph - 0.5)) / 0.02, 0, 1), rgb(col)

def stitch(x0, x1, col='#2b2b2f', k=90):
    d = np.abs(((xn * k + v * 2.2) % 1.0) - 0.5)
    d2 = np.abs(((xn * k - v * 2.2) % 1.0) - 0.5)
    return band(x0, x1) * np.clip(np.minimum(d, d2) < 0.07, 0, 1).astype(float) * 0.55, rgb(col)

# ---------------- 1. Maple Klasik ----------------
L = [(np.ones((1, W)), rgb('#f0dcae'))]
L.append((band(0.0, 0.34), rgb('#141416')))                       # grip hitam
L.append(stitch(0.02, 0.34, '#3a3a40'))
L.append(rings([0.34, 0.352], 0.006, '#c8a24a'))
L.append((band(0.36, 0.70), rgb('#ecd29b')))                      # shaft maple terang
L.append(rings([0.70], 0.004, '#8a6a34'))
L.append((np.clip(1 - np.abs(np.sin((xn * 500 + v * 3))) * 3.2, 0, 1) * band(0.36, 0.955) * 0.10, rgb('#a5793a')))  # serat kayu
tip_and_ferrule(L); finish(paint(L), 'maple')

# ---------------- 2. Jade Nusantara (Epic) ----------------
L = [(np.ones((1, W)), rgb('#1f8f74'))]
L.append((band(0.0, 0.05), rgb('#c9a24a')))
L.append((band(0.05, 0.30), rgb('#0f5c4b')))
L.append(diamonds(0.05, 0.05, 0.30, 0.30, '#e2c46a'))
L.append(rings([0.30, 0.31, 0.32], 0.004, '#e2c46a'))
L.append((band(0.32, 0.62), rgb('#2bb08f')))
L.append(chevrons(0.022, 0.32, 0.62, 0.22, '#0f5c4b'))
L.append(rings([0.62, 0.635], 0.006, '#e2c46a'))
L.append((band(0.64, 0.74), rgb('#5b3a1e')))
L.append((band(0.74, 0.955), rgb('#38b899')))
L.append(rings([0.74], 0.004, '#e2c46a'))
tip_and_ferrule(L); finish(paint(L), 'jade')

# ---------------- 3. Garuda Emas (Legendary) ----------------
L = [(np.ones((1, W)), rgb('#15151a'))]
L.append((band(0.0, 0.05), rgb('#e9b93a')))
L.append(chevrons(0.030, 0.06, 0.40, 0.20, '#f1c94f'))
L.append(rings([0.05, 0.41, 0.425], 0.007, '#f1c94f'))
L.append((band(0.43, 0.70), rgb('#101014')))
L.append(diamonds(0.09, 0.43, 0.70, 0.26, '#e9b93a'))
L.append(rings([0.70, 0.712], 0.005, '#f1c94f'))
L.append((band(0.72, 0.955), rgb('#1b1b21')))
L.append((band(0.80, 0.83), rgb('#e9b93a')))
tip_and_ferrule(L, '#e9c766'); finish(paint(L), 'garuda')

# ---------------- 4. Batik Senja (Epic) ----------------
L = [(np.ones((1, W)), rgb('#7d1f24'))]
L.append((band(0.0, 0.04), rgb('#d9b45a')))
L.append(diamonds(0.04, 0.04, 0.56, 0.28, '#f0dcae'))
L.append(diamonds(0.04, 0.06, 0.54, 0.28, '#5a1418', y=0.0))
L.append(rings([0.56, 0.57], 0.005, '#d9b45a'))
L.append((band(0.58, 0.80), rgb('#4a1116')))
L.append(chevrons(0.03, 0.58, 0.80, 0.18, '#c9803c'))
L.append((band(0.80, 0.955), rgb('#8e2a2c')))
L.append(rings([0.80], 0.005, '#d9b45a'))
tip_and_ferrule(L); finish(paint(L), 'batik')

# ---------------- 5. Kristal Es (Rare) ----------------
L = [(np.ones((1, W)), rgb('#a9d7ee'))]
L.append((band(0.0, 0.06), rgb('#5b7c98')))
tri = np.abs(((xn * 34 + np.abs(v) * 1.4) % 1.0) - 0.5)
L.append((band(0.06, 0.62) * np.clip((0.16 - tri) / 0.03, 0, 1), rgb('#eaf7ff')))
L.append(rings([0.62, 0.635], 0.005, '#cfd9e2'))
L.append((band(0.64, 0.955), rgb('#8cc4e0')))
L.append(chevrons(0.05, 0.64, 0.955, 0.10, '#e6f5fd'))
tip_and_ferrule(L); finish(paint(L), 'kristal')

# ---------------- 6. Bayangan Malam (Legendary) ----------------
L = [(np.ones((1, W)), rgb('#18181f'))]
L.append((band(0.0, 0.05), rgb('#9aa0b5')))
sw = np.abs(np.sin((xn * 46 + v * 1.6)))
L.append((band(0.05, 0.60) * np.clip((0.22 - sw) / 0.05, 0, 1), rgb('#b8bdd0')))
L.append(rings([0.60, 0.612], 0.006, '#9aa0b5'))
L.append((band(0.62, 0.955), rgb('#0f0f14')))
L.append(diamonds(0.11, 0.62, 0.955, 0.22, '#8f7cc9'))
tip_and_ferrule(L, '#9aa0b5'); finish(paint(L), 'malam')

# ---------------- data URI ----------------
out = {}
for n in ['maple', 'jade', 'garuda', 'batik', 'kristal', 'malam']:
    b = open(f'assets/cues/{n}.png', 'rb').read()
    out[n] = 'data:image/png;base64,' + base64.b64encode(b).decode()
    print(n, len(b) // 1024, 'KB')
json.dump(out, open('/tmp/_unused.json', 'w'))
