/* =====================================================================
   12 · RENDER — meja bertema, bola, cue, kamera.
   Portrait: meja diputar 90° agar sisi panjang mengisi layar. Saat membidik kamera
   mendekat (zoom) ke area bola putih → target. Geometri meja = geometri collision.
   ===================================================================== */
class BallSprites {
  constructor() { this.sprites = []; this.size = 0; this.ppu = 1; this.digits = []; this.colors = []; this.Lx = -0.46; this.Ly = -0.56; }
  build(ppu, rot) {
    const R = CONFIG.table.ballRadius; this.ppu = ppu; this.size = Math.ceil(2 * R * ppu) + 2; this.sprites = [];
    const c = Math.cos(rot), s = Math.sin(rot);                          // cahaya layar (kiri-atas) → koordinat dunia
    this.Lx = -0.46 * c + -0.56 * s; this.Ly = 0.46 * s + -0.56 * c;
    for (let i = 0; i < 16; i++) { const cv = document.createElement('canvas'); cv.width = cv.height = this.size; const ctx = cv.getContext('2d'); this.sprites.push({ cv, ctx, img: ctx.createImageData(this.size, this.size) }); }
    this.colors = CONFIG.colors.balls.map((h) => (h ? Util.hexToRgb(h) : null));
    for (let i = 1; i <= 15; i++) {
      const cv = document.createElement('canvas'); cv.width = cv.height = 32;
      const x = cv.getContext('2d'); x.fillStyle = '#000'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.font = 'bold ' + (i < 10 ? 25 : 19) + 'px Arial, Helvetica, sans-serif'; x.fillText(String(i), 16, 17);
      const d = x.getImageData(0, 0, 32, 32).data, a = new Uint8Array(1024); for (let k = 0; k < 1024; k++) a[k] = d[k * 4 + 3]; this.digits[i] = a;
    }
  }
  render(ball) {
    const sp = this.sprites[ball.id], S = this.size, data = sp.img.data, m = ball.orient, id = ball.id, half = S / 2, Rp = half - 1;
    const base = id === 0 ? [246, 246, 240] : this.colors[id <= 8 ? id : id - 8], stripe = id > 8, cueBall = id === 0;
    const Lx = this.Lx, Ly = this.Ly, Lz = -0.69, hl = Math.sqrt(Lx * Lx + Ly * Ly + (Lz - 1) * (Lz - 1)), Hx = Lx / hl, Hy = Ly / hl, Hz = (Lz - 1) / hl, dig = this.digits[id];
    for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) {
      const o = (py * S + px) * 4, nx0 = (px + 0.5 - half) / Rp, ny0 = (py + 0.5 - half) / Rp, d2 = nx0 * nx0 + ny0 * ny0, dist = Math.sqrt(d2);
      const alpha = Util.clamp((1 - dist) * Rp + 0.5, 0, 1);
      if (alpha <= 0) { data[o + 3] = 0; continue; }
      let nx = nx0, ny = ny0; if (d2 > 1) { nx /= dist; ny /= dist; }
      const nz = -Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      const bx = m[0] * nx + m[3] * ny + m[6] * nz, by = m[1] * nx + m[4] * ny + m[7] * nz, bz = m[2] * nx + m[5] * ny + m[8] * nz;
      let r, g, b;
      if (cueBall) { r = 246; g = 246; b = 240; const dot = Math.max(Math.abs(bx), Math.abs(by)); if (dot > 0.965) { const k = Util.smooth((dot - 0.965) / 0.02); r += (196 - r) * k; g += (52 - g) * k; b += (48 - b) * k; } }
      else {
        const white = 246;
        if (stripe) { const k = Util.smooth((0.52 - Math.abs(by)) / 0.05); r = white + (base[0] - white) * k; g = white + (base[1] - white) * k; b = white + (base[2] - white) * k; }
        else { r = base[0]; g = base[1]; b = base[2]; }
        const ax = Math.abs(bx);
        if (ax > 0.84) {
          const k = Util.smooth((ax - 0.84) / 0.02); r += (white - r) * k; g += (white - g) * k; b += (white - b) * k;
          const u = (bx > 0 ? bz : -bz) / 0.54, v = by / 0.54, tx = Math.floor((0.5 + u * 0.6) * 32), ty = Math.floor((0.5 + v * 0.6) * 32);
          if (tx >= 0 && tx < 32 && ty >= 0 && ty < 32) { const a = dig[ty * 32 + tx] / 255 * k; r *= 1 - a; g *= 1 - a; b *= 1 - a; }
        }
      }
      const diff = Math.max(0, nx * Lx + ny * Ly + nz * Lz), rim = 1 - Math.abs(nz);
      let shade = 0.36 + 0.78 * diff; shade *= 1 - 0.42 * rim * rim;
      const sh = Math.max(0, nx * Hx + ny * Hy + nz * Hz); let s2 = sh * sh; s2 *= s2; s2 *= s2; s2 *= s2; s2 *= sh * sh;
      const spec = s2 * 0.85 + Math.pow(sh, 6) * 0.08, bounce = Math.max(0, ny) * 0.05;
      data[o] = Util.clamp(r * shade + 255 * spec + 20 * bounce, 0, 255); data[o + 1] = Util.clamp(g * shade + 255 * spec + 60 * bounce, 0, 255); data[o + 2] = Util.clamp(b * shade + 255 * spec + 90 * bounce, 0, 255); data[o + 3] = alpha * 255;
    }
    sp.ctx.putImageData(sp.img, 0, 0); ball.dirty = false;
  }
}

/* ---------------- pembangun layer meja (dipakai game, toko, dan pratinjau Developer) ---------------- */
function loadThemeImages(theme, onLoad) {
  const imgs = { cloth: null, rail: null }; let pending = 0;
  for (const [k, src] of [['cloth', theme.clothImage], ['rail', theme.railImage]]) {
    if (!src) continue; pending++;
    const im = new Image(); im.onload = () => { imgs[k] = im; if (--pending === 0 && onLoad) onLoad(imgs); }; im.onerror = () => { if (--pending === 0 && onLoad) onLoad(imgs); }; im.src = src;
  }
  if (!pending && onLoad) onLoad(imgs);
  return imgs;
}
function pocketGeom(sh, len) {
  const mid = [(sh.baseA[0] + sh.baseB[0]) / 2, (sh.baseA[1] + sh.baseB[1]) / 2], ax = sh.axis, k = 0.9;
  const end = [mid[0] + ax[0] * len, mid[1] + ax[1] * len];
  return { mid, end,
    c1: [sh.baseA[0] + ax[0] * len * 0.9 + (mid[0] - sh.baseA[0]) * 0.1, sh.baseA[1] + ax[1] * len * 0.9 + (mid[1] - sh.baseA[1]) * 0.1],
    c2: [end[0] + (sh.baseA[0] - mid[0]) * k, end[1] + (sh.baseA[1] - mid[1]) * k], c3: [end[0] + (sh.baseB[0] - mid[0]) * k, end[1] + (sh.baseB[1] - mid[1]) * k],
    c4: [sh.baseB[0] + ax[0] * len * 0.9 + (mid[0] - sh.baseB[0]) * 0.1, sh.baseB[1] + ax[1] * len * 0.9 + (mid[1] - sh.baseB[1]) * 0.1] };
}
function drawCover(c, img, x, y, w, h) {
  const r = Math.max(w / img.width, h / img.height), iw = w / r, ih = h / r;
  c.drawImage(img, (img.width - iw) / 2, (img.height - ih) / 2, iw, ih, x, y, w, h);
}

function renderTableLayer(theme, T, geo, s, rot, imgs) {
  imgs = imgs || {};
  const W = T.width, H = T.height, ct = T.cushion, rail = T.rail, ext = ct + rail, pad = 46, tx = ext + pad, u = rail / 56, wu = W / 1600;   // u, wu: skala hiasan untuk meja berukuran lain
  const cv = document.createElement('canvas'); cv.width = Math.ceil((W + 2 * tx) * s); cv.height = Math.ceil((H + 2 * tx) * s);
  const c = cv.getContext('2d'); c.scale(s, s); c.translate(tx, tx);
  const cr = Math.cos(-rot), sr = Math.sin(-rot), rv = (x, y) => [x * cr - y * sr, x * sr + y * cr];
  const [LX, LY] = rv(-0.6, -0.8), [GX, GY] = rv(0, 1);                       // arah cahaya & "bawah layar" di koordinat dunia
  const rng = new Rng(20260920), rt = theme.rail, cl = theme.cloth, cu = theme.cushion, cxw = W / 2, cyw = H / 2;
  const half = Math.abs(GX) * (W / 2 + ext) + Math.abs(GY) * (H / 2 + ext);
  const rrect = (x, y, w, h, r) => { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
  const along = (stops) => { const g = c.createLinearGradient(cxw - GX * half, cyw - GY * half, cxw + GX * half, cyw + GY * half); for (const [o, col] of stops) g.addColorStop(o, col); return g; };
  const outer = () => rrect(-ext, -ext, W + 2 * ext, H + 2 * ext, 30 * u);
  const ringClip = () => { c.beginPath(); c.rect(-ct, -ct, W + 2 * ct, H + 2 * ct); c.rect(-ext - 5, -ext - 5, W + 2 * ext + 10, H + 2 * ext + 10); c.clip('evenodd'); };

  c.save(); c.shadowColor = 'rgba(0,0,0,0.6)'; c.shadowBlur = 30 * u * s; c.shadowOffsetX = GX * 12 * u * s; c.shadowOffsetY = GY * 12 * u * s; c.fillStyle = '#20080a'; outer(); c.fill(); c.restore();

  if (imgs.rail) { c.save(); outer(); c.clip(); c.drawImage(imgs.rail, -ext, -ext, W + 2 * ext, H + 2 * ext); c.restore(); }
  else if (rt.style === 'neon') {
    c.fillStyle = along([[0, '#231733'], [1, rt.bg || '#160f1f']]); outer(); c.fill();
    c.save(); outer(); c.clip(); ringClip(); c.shadowColor = rt.glow; c.shadowBlur = 16 * s; c.strokeStyle = rt.glow; c.lineWidth = 3.4;
    const o1 = 12 * u, o2 = 9 * u; rrect(-ext + o1, -ext + o1, W + 2 * ext - 2 * o1, H + 2 * ext - 2 * o1, 20 * u); c.stroke(); c.lineWidth = 2.2 * Math.max(u, 0.6); c.strokeRect(-ct - o2, -ct - o2, W + 2 * ct + 2 * o2, H + 2 * ct + 2 * o2);
    c.shadowBlur = 0; c.fillStyle = 'rgba(255,255,255,0.05)'; for (let i = 0; i < 90; i++) c.fillRect(rng.range(-ext, W + ext), rng.range(-ext, H + ext), 24, 1.3); c.restore();
  } else if (rt.style === 'ornate') {
    c.fillStyle = along([[0, rt.bg], [1, rt.bg]]); outer(); c.fill();
    const pc = document.createElement('canvas'); pc.width = pc.height = 28; const p = pc.getContext('2d');
    p.strokeStyle = rt.ink; p.lineWidth = 2; p.beginPath(); p.moveTo(14, 1); p.lineTo(27, 14); p.lineTo(14, 27); p.lineTo(1, 14); p.closePath(); p.stroke();
    p.fillStyle = rt.spot; p.beginPath(); p.arc(14, 14, 3.6, 0, 7); p.fill(); p.fillStyle = rt.ink; for (const [x, y] of [[0, 0], [28, 0], [0, 28], [28, 28]]) { p.beginPath(); p.arc(x, y, 3, 0, 7); p.fill(); }
    const pat = c.createPattern(pc, 'repeat'); if (pat.setTransform && typeof DOMMatrix !== 'undefined') pat.setTransform(new DOMMatrix([u, 0, 0, u, 0, 0]));
    c.save(); outer(); c.clip(); ringClip(); c.fillStyle = pat; c.fillRect(-ext, -ext, W + 2 * ext, H + 2 * ext);
    const o7 = 7 * u; c.strokeStyle = rt.edge || rt.ink; c.lineWidth = 4 * Math.max(u, 0.6); rrect(-ext + o7, -ext + o7, W + 2 * ext - 2 * o7, H + 2 * ext - 2 * o7, 24 * u); c.stroke(); c.strokeRect(-ct - o7, -ct - o7, W + 2 * ct + 2 * o7, H + 2 * ct + 2 * o7);
    c.fillStyle = along([[0, 'rgba(255,255,255,0.28)'], [0.5, 'rgba(255,255,255,0)'], [1, 'rgba(0,0,0,0.38)']]); c.fillRect(-ext, -ext, W + 2 * ext, H + 2 * ext); c.restore();
  } else if (rt.style === 'metal') {
    c.fillStyle = along([[0, rt.a], [0.5, rt.b], [1, rt.c]]); outer(); c.fill();
    c.save(); outer(); c.clip(); ringClip(); for (let i = 0; i < 260; i++) { c.strokeStyle = rng.next() < 0.5 ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'; c.lineWidth = rng.range(0.4, 1.2); c.beginPath(); const y = rng.range(-ext, H + ext), x = rng.range(-ext, W); c.moveTo(x, y); c.lineTo(x + rng.range(80, 500) * wu, y); c.stroke(); } c.restore();
  } else {                                                                     // wood
    c.fillStyle = along([[0, rt.a], [0.07, rt.accent || rt.a], [0.16, rt.b], [0.55, rt.c], [1, rt.d]]); outer(); c.fill();
    c.save(); outer(); c.clip(); ringClip();
    for (let i = 0; i < 320; i++) {
      c.strokeStyle = rng.next() < 0.4 ? 'rgba(255,190,170,0.07)' : 'rgba(30,0,0,0.10)'; c.lineWidth = rng.range(0.4, 1.6); c.beginPath();
      if (rng.next() < 0.6) { const y = rng.range(-ext, H + ext), x0 = rng.range(-ext, W), l = rng.range(60, 380) * wu; c.moveTo(x0, y); c.lineTo(x0 + l, y + rng.range(-2, 2)); }
      else { const x = rng.range(-ext, W + ext), y0 = rng.range(-ext, H), l = rng.range(40, 200) * wu; c.moveTo(x, y0); c.lineTo(x + rng.range(-2, 2), y0 + l); }
      c.stroke();
    }
    c.restore();
  }
  let g = c.createLinearGradient(cxw + LX * half, cyw + LY * half, cxw - LX * half, cyw - LY * half);   // bevel luar
  g.addColorStop(0, 'rgba(255,235,225,0.6)'); g.addColorStop(0.5, 'rgba(255,255,255,0.04)'); g.addColorStop(1, 'rgba(0,0,0,0.65)');
  c.strokeStyle = g; c.lineWidth = 3 * u; rrect(-ext + 1.5 * u, -ext + 1.5 * u, W + 2 * ext - 3 * u, H + 2 * ext - 3 * u, 29 * u); c.stroke();

  // kain: gradient dari tengah + vignette; gambar kustom di-cover lalu diberi pencahayaan
  if (imgs.cloth) {
    c.save(); c.beginPath(); c.rect(-ct, -ct, W + 2 * ct, H + 2 * ct); c.clip(); drawCover(c, imgs.cloth, -ct, -ct, W + 2 * ct, H + 2 * ct);
    g = c.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, W * 0.62); g.addColorStop(0, 'rgba(255,255,255,0.14)'); g.addColorStop(1, 'rgba(0,0,0,0.30)'); c.fillStyle = g; c.fillRect(-ct, -ct, W + 2 * ct, H + 2 * ct); c.restore();
  } else {
    g = c.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, W * 0.62); g.addColorStop(0, cl.a); g.addColorStop(0.5, cl.b); g.addColorStop(1, cl.c);
    c.fillStyle = g; c.fillRect(-ct, -ct, W + 2 * ct, H + 2 * ct);
    for (let i = 0, n = Math.round(9000 * wu * (H / 728)); i < n; i++) { c.fillStyle = rng.next() < 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,30,60,0.05)'; c.fillRect(rng.range(0, W), rng.range(0, H), 1.1, 1.1); }
  }
  const glow = (x0, y0, x1, y1, rx, ry, rw, rh) => { const gr = c.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, 'rgba(255,255,255,0.15)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(rx, ry, rw, rh); };
  const gl = 70 * u; glow(0, 0, 0, gl, 0, 0, W, gl); glow(0, H, 0, H - gl, 0, H - gl, W, gl); glow(0, 0, gl, 0, 0, 0, gl, H); glow(W, 0, W - gl, 0, W - gl, 0, gl, H);
  for (const P of geo.cushions) {
    const ex = P[1][0] - P[0][0], ey = P[1][1] - P[0][1], el = Math.hypot(ex, ey); let nx = -ey / el, ny = ex / el; if (nx * (W / 2 - P[0][0]) + ny * (H / 2 - P[0][1]) < 0) { nx = -nx; ny = -ny; }
    const sw = 16 * u, gr = c.createLinearGradient(P[0][0], P[0][1], P[0][0] + nx * sw, P[0][1] + ny * sw); gr.addColorStop(0, 'rgba(0,25,50,0.38)'); gr.addColorStop(1, 'rgba(0,25,50,0)');
    c.fillStyle = gr; c.beginPath(); c.moveTo(P[0][0], P[0][1]); c.lineTo(P[1][0], P[1][1]); c.lineTo(P[1][0] + nx * sw, P[1][1] + ny * sw); c.lineTo(P[0][0] + nx * sw, P[0][1] + ny * sw); c.closePath(); c.fill();
  }
  c.strokeStyle = 'rgba(255,255,255,0.28)'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(T.headStringX, 2); c.lineTo(T.headStringX, H - 2); c.stroke();
  c.fillStyle = 'rgba(255,255,255,0.32)'; for (const x of [T.headStringX, W / 2, T.footSpotX]) { c.beginPath(); c.arc(x, H / 2, 3.2, 0, 7); c.fill(); }

  // pocket: corong (mulut lebar → leher sempit → ujung membulat), menyatu dengan rahang cushion
  for (const sh of geo.pocketShapes) {
    const len = rail * (sh.corner ? 0.72 : 0.64), p = pocketGeom(sh, len), mouth = [(sh.tipA[0] + sh.tipB[0]) / 2, (sh.tipA[1] + sh.tipB[1]) / 2];
    c.beginPath(); c.moveTo(sh.tipA[0], sh.tipA[1]); c.lineTo(sh.baseA[0], sh.baseA[1]); c.bezierCurveTo(p.c1[0], p.c1[1], p.c2[0], p.c2[1], p.end[0], p.end[1]);
    c.bezierCurveTo(p.c3[0], p.c3[1], p.c4[0], p.c4[1], sh.baseB[0], sh.baseB[1]); c.lineTo(sh.tipB[0], sh.tipB[1]); c.closePath();
    g = c.createLinearGradient(mouth[0], mouth[1], p.end[0], p.end[1]); g.addColorStop(0, 'rgba(4,10,20,0)'); g.addColorStop(0.18, 'rgba(4,10,20,0.72)'); g.addColorStop(0.42, '#05070c'); g.addColorStop(1, '#000'); c.fillStyle = g; c.fill();
  }
  // cushion trapesium bertepi 3D; cahaya dari kiri-atas layar
  for (const P of geo.cushions) {
    const ex = P[1][0] - P[0][0], ey = P[1][1] - P[0][1], el = Math.hypot(ex, ey); let nx = -ey / el, ny = ex / el; if (nx * (W / 2 - P[0][0]) + ny * (H / 2 - P[0][1]) < 0) { nx = -nx; ny = -ny; }
    const bx = (P[3][0] + P[2][0]) / 2, by = (P[3][1] + P[2][1]) / 2;
    const gr = c.createLinearGradient(bx, by, (P[0][0] + P[1][0]) / 2, (P[0][1] + P[1][1]) / 2); gr.addColorStop(0, cu.base); gr.addColorStop(0.55, cu.mid); gr.addColorStop(1, cu.nose);
    c.fillStyle = gr; c.beginPath(); c.moveTo(P[0][0], P[0][1]); c.lineTo(P[1][0], P[1][1]); c.lineTo(P[2][0], P[2][1]); c.lineTo(P[3][0], P[3][1]); c.closePath(); c.fill();
    const edge = (p, q, en) => { const lit = en[0] * LX + en[1] * LY; c.strokeStyle = lit > 0 ? 'rgba(245,252,255,' + (0.3 + 0.5 * lit).toFixed(2) + ')' : 'rgba(0,25,50,' + (0.25 - 0.4 * lit).toFixed(2) + ')'; c.lineWidth = 2.2; c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(q[0], q[1]); c.stroke(); };
    edge(P[0], P[1], [nx, ny]);
    for (const [a, b] of [[1, 2], [3, 0]]) { const dx = P[b][0] - P[a][0], dy = P[b][1] - P[a][1], dl = Math.hypot(dx, dy); let jx = -dy / dl, jy = dx / dl; const mx = (P[0][0] + P[1][0] + P[2][0] + P[3][0]) / 4 - (P[a][0] + P[b][0]) / 2, my = (P[0][1] + P[1][1] + P[2][1] + P[3][1]) / 4 - (P[a][1] + P[b][1]) / 2; if (jx * mx + jy * my > 0) { jx = -jx; jy = -jy; } edge(P[a], P[b], [jx, jy]); }
    c.strokeStyle = 'rgba(0,20,40,0.5)'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(P[3][0], P[3][1]); c.lineTo(P[2][0], P[2][1]); c.stroke();
    if (rt.style === 'neon' && !imgs.rail) { c.save(); c.shadowColor = rt.glow; c.shadowBlur = 10 * s; c.strokeStyle = rt.glow; c.lineWidth = 1.6; c.beginPath(); c.moveTo(P[0][0], P[0][1]); c.lineTo(P[1][0], P[1][1]); c.stroke(); c.restore(); }
  }
  g = c.createLinearGradient(cxw + LX * half, cyw + LY * half, cxw - LX * half, cyw - LY * half); g.addColorStop(0, 'rgba(15,0,0,0.6)'); g.addColorStop(1, 'rgba(255,225,210,0.35)');
  c.strokeStyle = g; c.lineWidth = 2.4; c.strokeRect(-ct - 1, -ct - 1, W + 2 * ct + 2, H + 2 * ct + 2);
  for (const sh of geo.pocketShapes) {                                        // rim pocket
    const p = pocketGeom(sh, rail * (sh.corner ? 0.72 : 0.64)), path = () => { c.beginPath(); c.moveTo(sh.baseA[0], sh.baseA[1]); c.bezierCurveTo(p.c1[0], p.c1[1], p.c2[0], p.c2[1], p.end[0], p.end[1]); c.bezierCurveTo(p.c3[0], p.c3[1], p.c4[0], p.c4[1], sh.baseB[0], sh.baseB[1]); };
    c.lineJoin = 'round'; path(); c.strokeStyle = theme.rim || '#2b0709'; c.lineWidth = 5 * Math.max(u, 0.6); c.stroke();
    c.save(); c.translate(-sh.axis[0] * 0.9, -sh.axis[1] * 0.9); path(); c.strokeStyle = 'rgba(255,225,205,0.22)'; c.lineWidth = 1.4 * Math.max(u, 0.6); c.stroke(); c.restore();
  }
  // sight logam / neon dengan jarak konsisten
  const sight = (x, y) => {
    if (rt.style === 'neon' && !imgs.rail) { c.save(); c.shadowColor = rt.glow; c.shadowBlur = 10 * s; c.strokeStyle = theme.sight; c.lineWidth = 2.2; c.beginPath(); c.arc(x, y, 6, 0, 7); c.stroke(); c.fillStyle = theme.sight; c.beginPath(); c.arc(x, y, 2.2, 0, 7); c.fill(); c.restore(); return; }
    c.fillStyle = 'rgba(0,0,0,0.42)'; c.beginPath(); c.arc(x + 0.8, y + 1.2, 3.6, 0, 7); c.fill();
    c.fillStyle = theme.sight; c.beginPath(); c.arc(x, y, 3.4, 0, 7); c.fill();
    const rg = c.createRadialGradient(x - 1, y - 1, 0.3, x, y, 3.6); rg.addColorStop(0, 'rgba(255,255,255,0.95)'); rg.addColorStop(0.6, 'rgba(255,255,255,0)'); rg.addColorStop(1, 'rgba(0,0,0,0.35)'); c.fillStyle = rg; c.beginPath(); c.arc(x, y, 3.4, 0, 7); c.fill();
  };
  const off = ct + rail / 2;
  for (const k of [1, 2, 3, 5, 6, 7]) { sight(W * k / 8, -off); sight(W * k / 8, H + off); }
  for (const k of [1, 2, 3]) { sight(-off, H * k / 4); sight(W + off, H * k / 4); }
  return { canvas: cv, pad: tx, s };
}

const PREVIEW_GEO = {};
/** Pratinjau meja (toko & halaman Developer); `kind` = 'standard' | 'american'. */
function renderTablePreview(theme, widthPx, imgs, kind) {
  const T = TABLE_PROFILES[kind || 'standard'].table; PREVIEW_GEO[T.width] = PREVIEW_GEO[T.width] || buildTableGeometry(T);
  const tx = T.rail + T.cushion + 46;
  return renderTableLayer(theme, T, PREVIEW_GEO[T.width], widthPx / (T.width + 2 * tx), 0, imgs).canvas;
}

/* ---------------- renderer ---------------- */
class Renderer {
  constructor(canvas, game, store) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.game = game; this.store = store;
    this.geo = game.world.geo; this.sprites = new BallSprites(); this.dpr = 1; this.vw = 0; this.vh = 0;
    this.scale = 1; this.rot = 0; this.maxZoom = 1.7; this.cam = { zoom: 1, cx: CONFIG.table.width / 2, cy: CONFIG.table.height / 2 };
    this.pred = { kind: 0, t: 0, hitId: -1, x: 0, y: 0, objX: 0, objY: 0, cueX: 0, cueY: 0, cueLen: 0 };
    this.pred2 = { kind: 0, t: 0, hitId: -1, x: 0, y: 0, objX: 0, objY: 0, cueX: 0, cueY: 0, cueLen: 0 };
    this.tmp = { x: 0, y: 0 }; this.time = 0; this.themeImgs = {}; this.theme = null;
    this.applyTheme(true); this.resize();
  }
  /** Margin (px) yang dicadangkan HUD per layout; disamakan dengan CSS. */
  static layoutFor(vw, vh) {
    if (vh > vw * 1.05) return { mode: 'portrait', top: 58, bottom: 100, left: 6, right: 58, rot: -Math.PI / 2 };
    if (vh < 520) return { mode: 'compact', top: 50, bottom: 6, left: 74, right: 62, rot: 0 };
    return { mode: 'wide', top: 62, bottom: 62, left: 10, right: 62, rot: 0 };
  }
  /** Dipanggil Game saat ukuran meja berganti: geometri, kamera, layer meja, dan sprite bola dibangun ulang. */
  onTableChanged() {
    this.geo = this.game.world.geo; const T = CONFIG.table; this.cam.zoom = 1; this.cam.cx = T.width / 2; this.cam.cy = T.height / 2; this.resize();
  }
  applyTheme(skipBuild) {
    this.theme = this.store.themeDef(this.store.data.tables.equipped);

    this.themeImgs = loadThemeImages(this.theme, (imgs) => { this.themeImgs = imgs; if (this.vw) this._buildTable(); });
    if (!skipBuild && this.vw) this._buildTable();
  }
  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2.5); this.vw = window.innerWidth; this.vh = window.innerHeight;
    this.canvas.width = Math.round(this.vw * this.dpr); this.canvas.height = Math.round(this.vh * this.dpr);
    this.canvas.style.width = this.vw + 'px'; this.canvas.style.height = this.vh + 'px';
    const L = this.layout = Renderer.layoutFor(this.vw, this.vh); this.rot = L.rot; document.body.dataset.layout = L.mode;
    this.rw = this.vw - L.left - L.right; this.rh = this.vh - L.top - L.bottom; this.rcx = L.left + this.rw / 2; this.rcy = L.top + this.rh / 2;
    const T = CONFIG.table, ext = T.rail + T.cushion, OW = T.width + 2 * ext, OH = T.height + 2 * ext, ew = this.rot ? OH : OW, eh = this.rot ? OW : OH;
    this.scale = Math.min(this.rw / ew, this.rh / eh);
    this.bg = document.createElement('canvas'); this.bg.width = this.canvas.width; this.bg.height = this.canvas.height;
    const c = this.bg.getContext('2d'), w = this.bg.width, h = this.bg.height, g = c.createRadialGradient(w / 2, h * 0.52, h * 0.1, w / 2, h * 0.52, Math.max(w, h) * 0.75);
    g.addColorStop(0, '#2b3340'); g.addColorStop(0.55, '#222831'); g.addColorStop(1, '#14181e'); c.fillStyle = g; c.fillRect(0, 0, w, h);
    this._buildTable(); this.sprites.build(this.scale * this.dpr * this.maxZoom, this.rot);
    for (const b of this.game.world.balls) b.dirty = true;
  }
  _buildTable() {
    const T = CONFIG.table, tx = T.rail + T.cushion + 46;
    let s = this.scale * this.dpr * this.maxZoom; s = Math.min(s, 4096 / (T.width + 2 * tx));
    const r = renderTableLayer(this.theme, T, this.geo, s, this.rot, this.themeImgs);
    this.tableLayer = r.canvas; this.tablePad = r.pad; this.tableS = r.s;
  }

  _visible(zoom) { const k = this.scale * zoom; return this.rot ? { wx: this.rh / k, wy: this.rw / k } : { wx: this.rw / k, wy: this.rh / k }; }
  _clamp(cam) {
    const T = CONFIG.table, ext = T.rail + T.cushion, v = this._visible(cam.zoom), lo = -ext * 0.9, hiX = T.width + ext * 0.9, hiY = T.height + ext * 0.9;
    cam.cx = v.wx >= hiX - lo ? T.width / 2 : Util.clamp(cam.cx, lo + v.wx / 2, hiX - v.wx / 2);
    cam.cy = v.wy >= hiY - lo ? T.height / 2 : Util.clamp(cam.cy, lo + v.wy / 2, hiY - v.wy / 2);
  }
  _updateCamera(dt) {
    const g = this.game, T = CONFIG.table, wide = this.layout.mode === 'wide', zs = [1, wide ? 1.15 : 1.4, wide ? 1.4 : 1.75][this.store.data.settings.aimZoom | 0] || 1;   // layar lebar sudah besar → zoom lebih halus
    let tz = 1, tx = T.width / 2, ty = T.height / 2;
    if (zs > 1 && g.isTurnState() && !g.paused && g.gameType !== '9call') {   // kantong pilihan: seluruh kantong harus terlihat → tanpa zoom
      const cue = g.world.balls[0]; AimPredictor.cast(g.world, cue.x, cue.y, Math.cos(g.aim.angle), Math.sin(g.aim.angle), 0, this.pred);
      tz = zs; tx = cue.x + (this.pred.x - cue.x) * 0.42; ty = cue.y + (this.pred.y - cue.y) * 0.42;
    }
    const k = 1 - Math.exp(-dt * 5), c = this.cam; c.zoom += (tz - c.zoom) * k; c.cx += (tx - c.cx) * k; c.cy += (ty - c.cy) * k; this._clamp(c);
  }
  _transform(shx, shy) {
    const k = this.scale * this.cam.zoom, cs = Math.cos(this.rot), sn = Math.sin(this.rot), a = k * cs, b = k * sn, c = -k * sn, d = k * cs, D = this.dpr;
    this.k = k; this.ctx.setTransform(a * D, b * D, c * D, d * D, (this.rcx + shx - a * this.cam.cx - c * this.cam.cy) * D, (this.rcy + shy - b * this.cam.cx - d * this.cam.cy) * D);
  }
  screenToWorld(px, py) {
    const k = this.scale * this.cam.zoom, cs = Math.cos(this.rot), sn = Math.sin(this.rot), dx = px - this.rcx, dy = py - this.rcy;
    this.tmp.x = this.cam.cx + (dx * cs + dy * sn) / k; this.tmp.y = this.cam.cy + (-dx * sn + dy * cs) / k; return this.tmp;
  }

  render(dt) {
    this.time += dt; this._updateCamera(dt);
    const g = this.game, c = this.ctx, world = g.world, R = CONFIG.table.ballRadius, D = this.dpr;
    c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(this.bg, 0, 0);
    const sh = g.shake > 0 ? g.shake * g.shake * 3.2 : 0;
    this._transform(sh ? (Math.random() - 0.5) * sh : 0, sh ? (Math.random() - 0.5) * sh : 0);
    const pad = this.tablePad, s = this.tableS;
    c.drawImage(this.tableLayer, -pad, -pad, this.tableLayer.width / s, this.tableLayer.height / s);
    const inMatch = g.state !== GameState.MENU && g.state !== GameState.MATCHMAKING;
    if (g.canPlace() && g.ballInHandZone === 'head') { c.fillStyle = 'rgba(255,255,255,0.07)'; c.fillRect(0, 0, CONFIG.table.headStringX, CONFIG.table.height); }

    const sp = this.sprites, half = sp.size / (2 * sp.ppu), cs = Math.cos(this.rot), sn = Math.sin(this.rot);
    const ox = (R * 0.3) * cs + (R * 0.42) * sn, oy = -(R * 0.3) * sn + (R * 0.42) * cs;     // bayangan jatuh ke kanan-bawah LAYAR
    c.fillStyle = 'rgba(0,25,50,0.34)';
    for (let i = 0; i < 16; i++) { const b = world.balls[i]; if (b.state !== BallState.ON_TABLE) continue; c.beginPath(); c.ellipse(b.x + ox, b.y + oy, R * 1.02, R * 0.92, this.rot, 0, 7); c.fill(); }
    if (inMatch && g.aimLineVisible() && !g.paused) this._drawAim(c);
    if (inMatch && g.gameType === '9call' && g.rules.callRequired() && (g.isTurnState() || g.state === GameState.SHOT_RESOLVING)) this._drawCall(c);
    for (let i = 15; i >= 0; i--) {
      const b = world.balls[i];
      if (b.state === BallState.ON_TABLE) { if (b.dirty) sp.render(b); c.drawImage(sp.sprites[i].cv, b.x - half, b.y - half, 2 * half, 2 * half); }
      else if (b.sinkT < 1) {
        const p = world.pockets[b.pocketIndex], t = Util.smooth(b.sinkT), k = 1 - 0.6 * t; if (b.dirty) sp.render(b);
        c.globalAlpha = 1 - t; c.drawImage(sp.sprites[i].cv, b.fallX + (p.x - b.fallX) * t - half * k, b.fallY + (p.y - b.fallY) * t - half * k, 2 * half * k, 2 * half * k); c.globalAlpha = 1;
      }
    }
    if (inMatch && g.cueVisible() && !g.paused) this._drawCue(c);
    if (g.canPlace()) { const cue = world.balls[0], pulse = 0.5 + 0.5 * Math.sin(this.time * 6); c.strokeStyle = 'rgba(244,197,66,' + (0.55 + 0.35 * pulse).toFixed(2) + ')'; c.lineWidth = 2 / this.k; c.beginPath(); c.arc(cue.x, cue.y, R + 4 + pulse * 2, 0, 7); c.stroke(); }
    const P = g.particles;
    for (let k = 0; k < P.n; k++) { if (P.life[k] <= 0) continue; const a = P.life[k] / P.max[k]; c.fillStyle = P.tone[k] ? 'rgba(255,90,95,' + (a * 0.9).toFixed(2) + ')' : 'rgba(230,248,255,' + (a * 0.9).toFixed(2) + ')'; c.beginPath(); c.arc(P.x[k], P.y[k], P.size[k] * (0.4 + 0.6 * a), 0, 7); c.fill(); }
  }

  _cueIdFor(seat) {
    const g = this.game;
    if (g.mode === 'local') return 'maple';
    if (seat === 0) return this.store.data.cues.equipped;
    return CUE_CATALOG[g.seed % CUE_CATALOG.length].id;
  }
  _drawCue(c) {
    const g = this.game, cue = g.world.balls[0], R = CONFIG.table.ballRadius, img = this.store.cueImage(this._cueIdFor(g.rules.currentSeat));
    if (!img || !img.complete || !img.naturalWidth) return;
    const L = CONFIG.table.width * CONFIG.aim.cueLengthRatio, h = L * (img.naturalHeight / img.naturalWidth) * 0.62, off = R + CONFIG.aim.cueGap + g.cuePullDistance();
    c.save(); c.translate(cue.x, cue.y); c.rotate(g.aim.angle);
    c.fillStyle = 'rgba(0,25,50,0.28)'; c.beginPath(); c.moveTo(-off, 5); c.lineTo(-off - L, 5 - 12); c.lineTo(-off - L, 5 + 12); c.closePath(); c.fill();
    c.drawImage(img, -off - L, -h / 2, L, h); c.restore();
  }
  /** Penanda kantong (varian kantong pilihan): cincin putus-putus = bisa diketuk, cincin emas berdenyut = kantong yang dipilih. */
  _drawCall(c) {
    const g = this.game, px = 1 / this.k, pulse = 0.5 + 0.5 * Math.sin(this.time * 5), pick = g.canControl();
    for (let i = 0; i < 6; i++) {
      const sh = this.geo.pocketShapes[i], mx = (sh.tipA[0] + sh.tipB[0]) / 2, my = (sh.tipA[1] + sh.tipB[1]) / 2, r = CONFIG.table.ballRadius * (sh.corner ? 1.8 : 1.55), sel = i === g.aim.call;
      if (sel) {
        c.fillStyle = 'rgba(244,197,66,' + (0.16 + 0.14 * pulse).toFixed(2) + ')'; c.strokeStyle = '#F4C542'; c.lineWidth = 3 * px; c.beginPath(); c.arc(mx, my, r + pulse * 3, 0, 7); c.fill(); c.stroke();
        c.fillStyle = '#F4C542'; c.beginPath(); c.arc(mx, my, 3.2, 0, 7); c.fill();
      } else if (pick) {
        c.strokeStyle = 'rgba(255,255,255,' + (0.28 + 0.2 * pulse).toFixed(2) + ')'; c.lineWidth = 1.8 * px; c.setLineDash([5 * px, 5 * px]); c.beginPath(); c.arc(mx, my, r, 0, 7); c.stroke(); c.setLineDash([]);
      }
    }
  }
  _drawAim(c) {
    const g = this.game, world = g.world, cue = world.balls[0], R = CONFIG.table.ballRadius, px = 1 / this.k;
    const dx = Math.cos(g.aim.angle), dy = Math.sin(g.aim.angle), pr = this.pred; AimPredictor.cast(world, cue.x, cue.y, dx, dy, 0, pr);
    const len = g.aimGuideLength(), assist = this.store.data.settings.aimAssist, bounce = this.store.data.settings.showBounce;
    c.lineCap = 'round'; c.strokeStyle = 'rgba(255,255,255,0.88)'; c.lineWidth = 1.6 * px; c.setLineDash([]);
    c.beginPath(); c.moveTo(cue.x + dx * R, cue.y + dy * R); c.lineTo(pr.x, pr.y); c.stroke();
    if (pr.kind === 1) {
      const legal = g.rules.isLegalFirstContact(g.rules.currentSeat, pr.hitId) || g.rules.isBreak;
      c.fillStyle = 'rgba(255,255,255,0.22)'; c.strokeStyle = legal ? 'rgba(255,255,255,0.95)' : 'rgba(255,90,95,0.95)'; c.lineWidth = 1.5 * px; c.beginPath(); c.arc(pr.x, pr.y, R, 0, 7); c.fill(); c.stroke();
      if (assist) {
        const t = world.balls[pr.hitId]; c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 1.3 * px; c.setLineDash([6 * px, 5 * px]);
        c.beginPath(); c.moveTo(t.x, t.y); c.lineTo(t.x + pr.objX * len, t.y + pr.objY * len); c.stroke();
        if (pr.cueLen > 0.05) { c.strokeStyle = 'rgba(255,255,255,0.45)'; c.beginPath(); c.moveTo(pr.x, pr.y); c.lineTo(pr.x + pr.cueX * len * 0.45 * pr.cueLen, pr.y + pr.cueY * len * 0.45 * pr.cueLen); c.stroke(); }
        c.setLineDash([]);
      }
    } else if (assist && bounce) {
      const p2 = this.pred2; AimPredictor.cast(world, pr.x, pr.y, pr.objX, pr.objY, 0, p2); const l2 = Math.min(len * 1.1, p2.t);
      c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 1.3 * px; c.setLineDash([6 * px, 5 * px]); c.beginPath(); c.moveTo(pr.x, pr.y); c.lineTo(pr.x + pr.objX * l2, pr.y + pr.objY * l2); c.stroke(); c.setLineDash([]);
      c.strokeStyle = 'rgba(255,255,255,0.7)'; c.beginPath(); c.arc(pr.x, pr.y, 3.2, 0, 7); c.stroke();
    }
  }
}
