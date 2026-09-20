/* =====================================================================
   10 · RENDER — kamera fixed top-down, tanpa rotasi.
   Meja digambar dari geometri yang SAMA dengan collision (buildTableGeometry).
   ===================================================================== */
class BallSprites {
  constructor() { this.sprites = []; this.size = 0; this.ppu = 1; this.digits = []; this.colors = []; }
  build(ppu) {
    const R = CONFIG.table.ballRadius; this.ppu = ppu;
    this.size = Math.ceil(2 * R * ppu) + 2;
    this.sprites = [];
    for (let i = 0; i < 16; i++) {
      const cv = document.createElement('canvas'); cv.width = cv.height = this.size;
      const ctx = cv.getContext('2d'); this.sprites.push({ cv, ctx, img: ctx.createImageData(this.size, this.size) });
    }
    this.colors = CONFIG.colors.balls.map((h) => (h ? Util.hexToRgb(h) : null));
    for (let i = 1; i <= 15; i++) {
      const c = document.createElement('canvas'); c.width = c.height = 32;
      const x = c.getContext('2d'); x.fillStyle = '#000'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.font = 'bold ' + (i < 10 ? 25 : 19) + 'px Arial, Helvetica, sans-serif'; x.fillText(String(i), 16, 17);
      const d = x.getImageData(0, 0, 32, 32).data, a = new Uint8Array(1024);
      for (let k = 0; k < 1024; k++) a[k] = d[k * 4 + 3];
      this.digits[i] = a;
    }
    for (const b of this.dirtyAll || []) b.dirty = true;
  }
  render(ball) {
    const sp = this.sprites[ball.id], S = this.size, data = sp.img.data, m = ball.orient, id = ball.id;
    const half = S / 2, Rp = half - 1;
    const base = id === 0 ? [246, 246, 240] : this.colors[id <= 8 ? id : id - 8], stripe = id > 8, cueBall = id === 0;
    const Lx = -0.46, Ly = -0.56, Lz = -0.69, hl = Math.sqrt(Lx * Lx + Ly * Ly + (Lz - 1) * (Lz - 1));
    const Hx = Lx / hl, Hy = Ly / hl, Hz = (Lz - 1) / hl, dig = this.digits[id];
    for (let py = 0; py < S; py++) {
      for (let px = 0; px < S; px++) {
        const o = (py * S + px) * 4;
        const nx0 = (px + 0.5 - half) / Rp, ny0 = (py + 0.5 - half) / Rp;
        const d2 = nx0 * nx0 + ny0 * ny0, dist = Math.sqrt(d2);
        const alpha = Util.clamp((1 - dist) * Rp + 0.5, 0, 1);
        if (alpha <= 0) { data[o + 3] = 0; continue; }
        let nx = nx0, ny = ny0;
        if (d2 > 1) { nx /= dist; ny /= dist; }
        const nz = -Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
        const bx = m[0] * nx + m[3] * ny + m[6] * nz, by = m[1] * nx + m[4] * ny + m[7] * nz, bz = m[2] * nx + m[5] * ny + m[8] * nz;
        let r, g, b;
        if (cueBall) {
          r = 246; g = 246; b = 240;
          const dot = Math.max(Math.abs(bx), Math.abs(by)); if (dot > 0.965) { const k = Util.smooth((dot - 0.965) / 0.02); r += (196 - r) * k; g += (52 - g) * k; b += (48 - b) * k; }
        } else {
          const white = 246;
          if (stripe) { const k = Util.smooth((0.52 - Math.abs(by)) / 0.05); r = white + (base[0] - white) * k; g = white + (base[1] - white) * k; b = white + (base[2] - white) * k; }
          else { r = base[0]; g = base[1]; b = base[2]; }
          const ax = Math.abs(bx);
          if (ax > 0.84) {
            const k = Util.smooth((ax - 0.84) / 0.02);
            r += (white - r) * k; g += (white - g) * k; b += (white - b) * k;
            const u = (bx > 0 ? bz : -bz) / 0.54, v = by / 0.54;
            const tx = Math.floor((0.5 + u * 0.6) * 32), ty = Math.floor((0.5 + v * 0.6) * 32);
            if (tx >= 0 && tx < 32 && ty >= 0 && ty < 32) { const a = dig[ty * 32 + tx] / 255 * k; r *= 1 - a; g *= 1 - a; b *= 1 - a; }
          }
        }
        const diff = Math.max(0, nx * Lx + ny * Ly + nz * Lz);
        const rim = 1 - Math.abs(nz);
        let shade = 0.36 + 0.78 * diff; shade *= 1 - 0.42 * rim * rim;
        const sh = Math.max(0, nx * Hx + ny * Hy + nz * Hz);
        let s2 = sh * sh; s2 *= s2; s2 *= s2; s2 *= s2; s2 *= sh * sh;       // ~ sh^18
        const spec = s2 * 0.85 + Math.pow(sh, 6) * 0.08;
        const bounce = Math.max(0, ny) * 0.05;
        data[o] = Util.clamp(r * shade + 255 * spec + 20 * bounce, 0, 255);
        data[o + 1] = Util.clamp(g * shade + 255 * spec + 60 * bounce, 0, 255);
        data[o + 2] = Util.clamp(b * shade + 255 * spec + 90 * bounce, 0, 255);
        data[o + 3] = alpha * 255;
      }
    }
    sp.ctx.putImageData(sp.img, 0, 0); ball.dirty = false;
  }
}

class Renderer {
  constructor(canvas, game, store) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.game = game; this.store = store;
    this.geo = game.world.geo; this.sprites = new BallSprites();
    this.dpr = 1; this.vw = 0; this.vh = 0; this.scale = 1; this.ox = 0; this.oy = 0; this.headerH = 64;
    this.cueImgs = new Map(); this.pred = { kind: 0, t: 0, hitId: -1, x: 0, y: 0, objX: 0, objY: 0, cueX: 0, cueY: 0, cueLen: 0 };
    this.pred2 = { kind: 0, t: 0, hitId: -1, x: 0, y: 0, objX: 0, objY: 0, cueX: 0, cueY: 0, cueLen: 0 };
    this.tmp = { x: 0, y: 0 }; this.time = 0;
    for (const c of CUE_CATALOG) { const im = new Image(); im.src = c.image; this.cueImgs.set(c.id, im); }
    this.resize();
  }

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    this.vw = window.innerWidth; this.vh = window.innerHeight;
    this.canvas.width = Math.round(this.vw * this.dpr); this.canvas.height = Math.round(this.vh * this.dpr);
    this.canvas.style.width = this.vw + 'px'; this.canvas.style.height = this.vh + 'px';
    const T = CONFIG.table, ext = T.rail + T.cushion, OW = T.width + 2 * ext, OH = T.height + 2 * ext;
    const availH = this.vh - this.headerH - 12;
    const narrow = this.vw < 700;                      // ponsel portrait: sisakan ruang untuk power bar di kanan
    const leftM = narrow ? 8 : this.vw * 0.08, rightM = narrow ? 64 : this.vw * 0.08, availW = this.vw - leftM - rightM;
    this.scale = Math.min(availW / OW, availH / OH);
    this.ox = leftM + availW / 2 - T.width / 2 * this.scale;
    this.oy = this.headerH + (availH + 12) / 2 - T.height / 2 * this.scale;
    this._buildBackground(); this._buildTable();
    this.sprites.build(this.scale * this.dpr);
    for (const b of this.game.world.balls) b.dirty = true;
  }

  screenToWorld(px, py) { this.tmp.x = (px - this.ox) / this.scale; this.tmp.y = (py - this.oy) / this.scale; return this.tmp; }

  /* ------------------------------ statis: latar ------------------------------ */
  _buildBackground() {
    const cv = this.bg = document.createElement('canvas'); cv.width = this.canvas.width; cv.height = this.canvas.height;
    const c = cv.getContext('2d'), w = cv.width, h = cv.height;
    const g = c.createRadialGradient(w / 2, h * 0.52, h * 0.1, w / 2, h * 0.52, Math.max(w, h) * 0.75);
    g.addColorStop(0, '#2b3340'); g.addColorStop(0.55, '#222831'); g.addColorStop(1, '#14181e');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  }

  /* ------------------------------ statis: meja ------------------------------ */
  _buildTable() {
    const T = CONFIG.table, W = T.width, H = T.height, ct = T.cushion, rail = T.rail, ext = ct + rail, pad = 46;
    const s = this.scale * this.dpr;
    this.tableExt = ext + pad;
    const cv = this.tableLayer = document.createElement('canvas');
    cv.width = Math.ceil((W + 2 * this.tableExt) * s); cv.height = Math.ceil((H + 2 * this.tableExt) * s);
    const c = cv.getContext('2d'); c.scale(s, s); c.translate(this.tableExt, this.tableExt);
    const rng = new Rng(20260920), G = this.geo;
    const rrect = (x, y, w, h, r) => { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };

    // bayangan meja (terangkat dari lantai)
    c.save(); c.shadowColor = 'rgba(0,0,0,0.6)'; c.shadowBlur = 30 * s; c.shadowOffsetY = 12 * s; c.fillStyle = '#3a0d10';
    rrect(-ext, -ext, W + 2 * ext, H + 2 * ext, 30); c.fill(); c.restore();

    // rangka kayu mahogany: gloss di sisi atas, bayangan di sisi bawah
    let g = c.createLinearGradient(0, -ext, 0, H + ext);
    g.addColorStop(0, '#a83232'); g.addColorStop(0.07, '#c04545'); g.addColorStop(0.16, '#8a2426'); g.addColorStop(0.55, '#671719'); g.addColorStop(1, '#3d0c0f');
    c.fillStyle = g; rrect(-ext, -ext, W + 2 * ext, H + 2 * ext, 30); c.fill();
    c.save(); rrect(-ext, -ext, W + 2 * ext, H + 2 * ext, 30); c.clip();
    c.beginPath(); c.rect(-ct, -ct, W + 2 * ct, H + 2 * ct); c.rect(-ext - 5, -ext - 5, W + 2 * ext + 10, H + 2 * ext + 10); c.clip('evenodd');
    for (let i = 0; i < 320; i++) {                                         // serat kayu
      const horizontal = rng.next() < 0.6, lightStreak = rng.next() < 0.4;
      c.strokeStyle = lightStreak ? 'rgba(255,170,150,0.07)' : 'rgba(30,0,0,0.10)'; c.lineWidth = rng.range(0.4, 1.6);
      c.beginPath();
      if (horizontal) { const y = rng.range(-ext, H + ext), x0 = rng.range(-ext, W), l = rng.range(60, 380); c.moveTo(x0, y); c.lineTo(x0 + l, y + rng.range(-2, 2)); }
      else { const x = rng.range(-ext, W + ext), y0 = rng.range(-ext, H), l = rng.range(40, 200); c.moveTo(x, y0); c.lineTo(x + rng.range(-2, 2), y0 + l); }
      c.stroke();
    }
    c.restore();
    g = c.createLinearGradient(-ext, -ext, W + ext, H + ext);                // bevel luar
    g.addColorStop(0, 'rgba(255,205,190,0.65)'); g.addColorStop(0.5, 'rgba(255,255,255,0.05)'); g.addColorStop(1, 'rgba(0,0,0,0.65)');
    c.strokeStyle = g; c.lineWidth = 3; rrect(-ext + 1.5, -ext + 1.5, W + 2 * ext - 3, H + 2 * ext - 3, 29); c.stroke();
    g = c.createLinearGradient(0, -ext, 0, -ext + 18);                        // gloss atas
    g.addColorStop(0, 'rgba(255,225,215,0.38)'); g.addColorStop(1, 'rgba(255,225,215,0)');
    c.fillStyle = g; c.save(); rrect(-ext, -ext, W + 2 * ext, H + 2 * ext, 30); c.clip(); c.fillRect(-ext, -ext, W + 2 * ext, 18); c.restore();

    // kain biru: gradient halus dari tengah + vignette + tekstur lembut
    g = c.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, W * 0.62);
    g.addColorStop(0, '#86d9f6'); g.addColorStop(0.5, '#57BFEA'); g.addColorStop(1, '#2d8dbd');
    c.fillStyle = g; c.fillRect(-ct, -ct, W + 2 * ct, H + 2 * ct);
    for (let i = 0; i < 9000; i++) { c.fillStyle = rng.next() < 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,50,90,0.045)'; c.fillRect(rng.range(0, W), rng.range(0, H), 1.1, 1.1); }
    const inner = (x0, y0, x1, y1, col) => { const gr = c.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(180,235,255,0)'); return gr; };
    c.fillStyle = inner(0, 0, 0, 70, 'rgba(190,240,255,0.16)'); c.fillRect(0, 0, W, 70);         // inner glow tipis
    c.fillStyle = inner(0, H, 0, H - 70, 'rgba(190,240,255,0.16)'); c.fillRect(0, H - 70, W, 70);
    c.fillStyle = inner(0, 0, 70, 0, 'rgba(190,240,255,0.14)'); c.fillRect(0, 0, 70, H);
    c.fillStyle = inner(W, 0, W - 70, 0, 'rgba(190,240,255,0.14)'); c.fillRect(W - 70, 0, 70, H);

    // bayangan nose cushion di atas kain
    for (const P of G.cushions) {
      const ex = P[1][0] - P[0][0], ey = P[1][1] - P[0][1], el = Math.hypot(ex, ey);
      let nx = -ey / el, ny = ex / el; if (nx * (W / 2 - P[0][0]) + ny * (H / 2 - P[0][1]) < 0) { nx = -nx; ny = -ny; }
      const gr = c.createLinearGradient(P[0][0], P[0][1], P[0][0] + nx * 16, P[0][1] + ny * 16);
      gr.addColorStop(0, 'rgba(8,55,95,0.38)'); gr.addColorStop(1, 'rgba(8,55,95,0)');
      c.fillStyle = gr; c.beginPath(); c.moveTo(P[0][0], P[0][1]); c.lineTo(P[1][0], P[1][1]); c.lineTo(P[1][0] + nx * 16, P[1][1] + ny * 16); c.lineTo(P[0][0] + nx * 16, P[0][1] + ny * 16); c.closePath(); c.fill();
    }

    // garis kepala & spot
    c.strokeStyle = 'rgba(255,255,255,0.28)'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(T.headStringX, 2); c.lineTo(T.headStringX, H - 2); c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.32)';
    for (const x of [T.headStringX, W / 2, T.footSpotX]) { c.beginPath(); c.arc(x, H / 2, 3.2, 0, 7); c.fill(); }

    // pocket: corong (mulut lebar → leher sempit → ujung membulat) menyatu dengan rahang cushion
    for (const sh of G.pocketShapes) this._pocketPath(c, sh, sh.corner ? 40 : 36);
    // cushion trapesium dengan bevel 3D; cahaya dari kiri atas
    const LX = -0.6, LY = -0.8;
    for (const P of G.cushions) {
      const ex = P[1][0] - P[0][0], ey = P[1][1] - P[0][1], el = Math.hypot(ex, ey);
      let nx = -ey / el, ny = ex / el; if (nx * (W / 2 - P[0][0]) + ny * (H / 2 - P[0][1]) < 0) { nx = -nx; ny = -ny; }
      const bx = (P[3][0] + P[2][0]) / 2, by = (P[3][1] + P[2][1]) / 2;
      const gr = c.createLinearGradient(bx, by, (P[0][0] + P[1][0]) / 2, (P[0][1] + P[1][1]) / 2);
      gr.addColorStop(0, '#2a86b8'); gr.addColorStop(0.55, '#3fa5d6'); gr.addColorStop(1, '#63c6f0');
      c.fillStyle = gr; c.beginPath(); c.moveTo(P[0][0], P[0][1]); c.lineTo(P[1][0], P[1][1]); c.lineTo(P[2][0], P[2][1]); c.lineTo(P[3][0], P[3][1]); c.closePath(); c.fill();
      const edge = (p, q, en) => {
        const lit = en[0] * LX + en[1] * LY;
        c.strokeStyle = lit > 0 ? 'rgba(235,250,255,' + (0.35 + 0.5 * lit).toFixed(2) + ')' : 'rgba(8,50,90,' + (0.25 - 0.4 * lit).toFixed(2) + ')';
        c.lineWidth = 2.2; c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(q[0], q[1]); c.stroke();
      };
      edge(P[0], P[1], [nx, ny]);
      for (const [a, b] of [[1, 2], [3, 0]]) { const dx = P[b][0] - P[a][0], dy = P[b][1] - P[a][1], dl = Math.hypot(dx, dy); let jx = -dy / dl, jy = dx / dl; const mx2 = (P[0][0] + P[1][0] + P[2][0] + P[3][0]) / 4 - (P[a][0] + P[b][0]) / 2, my2 = (P[0][1] + P[1][1] + P[2][1] + P[3][1]) / 4 - (P[a][1] + P[b][1]) / 2; if (jx * mx2 + jy * my2 > 0) { jx = -jx; jy = -jy; } edge(P[a], P[b], [jx, jy]); }
      c.strokeStyle = 'rgba(5,30,55,0.5)'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(P[3][0], P[3][1]); c.lineTo(P[2][0], P[2][1]); c.stroke();
    }
    // bevel dalam rangka (tepi menghadap cahaya di kanan-bawah lebih terang)
    g = c.createLinearGradient(-ct, -ct, W + ct, H + ct); g.addColorStop(0, 'rgba(20,0,0,0.65)'); g.addColorStop(1, 'rgba(255,190,170,0.35)');
    c.strokeStyle = g; c.lineWidth = 2.4; c.strokeRect(-ct - 1, -ct - 1, W + 2 * ct + 2, H + 2 * ct + 2);
    for (const sh of G.pocketShapes) this._pocketRim(c, sh, sh.corner ? 40 : 36);

    // sight logam kecil dengan jarak konsisten
    const sight = (x, y) => {
      c.fillStyle = 'rgba(30,0,0,0.5)'; c.beginPath(); c.arc(x + 0.8, y + 1.2, 3.6, 0, 7); c.fill();
      const rg = c.createRadialGradient(x - 1, y - 1, 0.4, x, y, 3.6); rg.addColorStop(0, '#ffffff'); rg.addColorStop(0.6, '#cfd6dc'); rg.addColorStop(1, '#7c858c');
      c.fillStyle = rg; c.beginPath(); c.arc(x, y, 3.4, 0, 7); c.fill();
    };
    const off = ct + rail / 2;
    for (const k of [1, 2, 3, 5, 6, 7]) { sight(W * k / 8, -off); sight(W * k / 8, H + off); }
    for (const k of [1, 2, 3]) { sight(-off, H * k / 4); sight(W + off, H * k / 4); }
  }

  _pocketGeom(sh, len) {
    const mid = [(sh.baseA[0] + sh.baseB[0]) / 2, (sh.baseA[1] + sh.baseB[1]) / 2], ax = sh.axis;
    const end = [mid[0] + ax[0] * len, mid[1] + ax[1] * len];
    const k = 0.9;
    return {
      mid, end,
      c1: [sh.baseA[0] + ax[0] * len * 0.9 + (mid[0] - sh.baseA[0]) * 0.1, sh.baseA[1] + ax[1] * len * 0.9 + (mid[1] - sh.baseA[1]) * 0.1],
      c2: [end[0] + (sh.baseA[0] - mid[0]) * k, end[1] + (sh.baseA[1] - mid[1]) * k],
      c3: [end[0] + (sh.baseB[0] - mid[0]) * k, end[1] + (sh.baseB[1] - mid[1]) * k],
      c4: [sh.baseB[0] + ax[0] * len * 0.9 + (mid[0] - sh.baseB[0]) * 0.1, sh.baseB[1] + ax[1] * len * 0.9 + (mid[1] - sh.baseB[1]) * 0.1],
    };
  }
  _pocketPath(c, sh, len) {
    const p = this._pocketGeom(sh, len);
    const mouth = [(sh.tipA[0] + sh.tipB[0]) / 2, (sh.tipA[1] + sh.tipB[1]) / 2];
    c.beginPath(); c.moveTo(sh.tipA[0], sh.tipA[1]); c.lineTo(sh.baseA[0], sh.baseA[1]);
    c.bezierCurveTo(p.c1[0], p.c1[1], p.c2[0], p.c2[1], p.end[0], p.end[1]);
    c.bezierCurveTo(p.c3[0], p.c3[1], p.c4[0], p.c4[1], sh.baseB[0], sh.baseB[1]);
    c.lineTo(sh.tipB[0], sh.tipB[1]); c.closePath();
    const g = c.createLinearGradient(mouth[0], mouth[1], p.end[0], p.end[1]);
    g.addColorStop(0, 'rgba(4,22,42,0.0)'); g.addColorStop(0.18, 'rgba(4,20,38,0.72)'); g.addColorStop(0.42, '#05090f'); g.addColorStop(1, '#000');
    c.fillStyle = g; c.fill();
  }
  _pocketRim(c, sh, len) {
    const p = this._pocketGeom(sh, len);
    const path = () => { c.beginPath(); c.moveTo(sh.baseA[0], sh.baseA[1]); c.bezierCurveTo(p.c1[0], p.c1[1], p.c2[0], p.c2[1], p.end[0], p.end[1]); c.bezierCurveTo(p.c3[0], p.c3[1], p.c4[0], p.c4[1], sh.baseB[0], sh.baseB[1]); };
    c.lineJoin = 'round'; path(); c.strokeStyle = '#2b0709'; c.lineWidth = 5; c.stroke();
    c.save(); c.translate(-sh.axis[0] * 0.9, -sh.axis[1] * 0.9); path(); c.strokeStyle = 'rgba(255,175,155,0.22)'; c.lineWidth = 1.4; c.stroke(); c.restore();
  }

  /* ------------------------------ per-frame ------------------------------ */
  render(dt) {
    this.time += dt;
    const g = this.game, c = this.ctx, s = this.scale * this.dpr, world = g.world, R = CONFIG.table.ballRadius;
    c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(this.bg, 0, 0);
    const sh = g.shake > 0 ? g.shake * g.shake * 3.2 * this.dpr : 0;
    const shx = sh ? (Math.random() - 0.5) * sh : 0, shy = sh ? (Math.random() - 0.5) * sh : 0;
    c.setTransform(s, 0, 0, s, this.ox * this.dpr + shx, this.oy * this.dpr + shy);
    c.drawImage(this.tableLayer, -this.tableExt, -this.tableExt, this.tableLayer.width / s, this.tableLayer.height / s);
    const inMatch = g.state !== GameState.MENU && g.state !== GameState.MATCHMAKING;

    if (g.canPlace() && g.ballInHandZone === 'head') { c.fillStyle = 'rgba(255,255,255,0.07)'; c.fillRect(0, 0, CONFIG.table.headStringX, CONFIG.table.height); }

    // bayangan bola
    const sp = this.sprites, half = sp.size / (2 * sp.ppu);
    c.fillStyle = 'rgba(6,40,70,0.34)';
    for (let i = 0; i < 16; i++) { const b = world.balls[i]; if (b.state !== BallState.ON_TABLE) continue; c.beginPath(); c.ellipse(b.x + R * 0.3, b.y + R * 0.42, R * 1.02, R * 0.92, 0, 0, 7); c.fill(); }

    // aim (di bawah bola) agar garis tampak menuju pusat bola putih
    if (inMatch && g.aimLineVisible() && !g.paused) this._drawAim(c);

    // bola
    for (let i = 15; i >= 0; i--) {
      const b = world.balls[i];
      if (b.state === BallState.ON_TABLE) { if (b.dirty) sp.render(b); c.drawImage(sp.sprites[i].cv, b.x - half, b.y - half, 2 * half, 2 * half); }
      else if (b.sinkT < 1) {
        const p = world.pockets[b.pocketIndex], t = Util.smooth(b.sinkT), k = 1 - 0.6 * t;
        if (b.dirty) sp.render(b);
        c.globalAlpha = 1 - t; c.drawImage(sp.sprites[i].cv, b.fallX + (p.x - b.fallX) * t - half * k, b.fallY + (p.y - b.fallY) * t - half * k, 2 * half * k, 2 * half * k); c.globalAlpha = 1;
      }
    }

    // cue (gambar PNG) dan cincin penempatan
    if (inMatch && g.cueVisible() && !g.paused) this._drawCue(c);
    if (g.canPlace()) { const cue = world.balls[0], pulse = 0.5 + 0.5 * Math.sin(this.time * 6); c.strokeStyle = 'rgba(244,197,66,' + (0.55 + 0.35 * pulse).toFixed(2) + ')'; c.lineWidth = 2 / this.scale; c.beginPath(); c.arc(cue.x, cue.y, R + 4 + pulse * 2, 0, 7); c.stroke(); }

    // partikel pocket
    const P = g.particles;
    for (let k = 0; k < P.n; k++) {
      if (P.life[k] <= 0) continue;
      const a = P.life[k] / P.max[k];
      c.fillStyle = P.tone[k] ? 'rgba(255,90,95,' + (a * 0.9).toFixed(2) + ')' : 'rgba(230,248,255,' + (a * 0.9).toFixed(2) + ')';
      c.beginPath(); c.arc(P.x[k], P.y[k], P.size[k] * (0.4 + 0.6 * a), 0, 7); c.fill();
    }
  }

  _cueImageFor(seat) {
    const g = this.game, st = this.store;
    let id = 'maple';
    if (g.mode === 'local') id = 'maple';
    else if (seat === 0) id = st.data.cues.equipped;
    else id = CUE_CATALOG[g.seed % CUE_CATALOG.length].id;
    return this.cueImgs.get(id);
  }

  _drawCue(c) {
    const g = this.game, cue = g.world.balls[0], R = CONFIG.table.ballRadius;
    const img = this._cueImageFor(g.rules.currentSeat); if (!img || !img.complete || !img.naturalWidth) return;
    const L = CONFIG.table.width * CONFIG.aim.cueLengthRatio, h = L * (img.naturalHeight / img.naturalWidth) * 0.62;
    const off = R + CONFIG.aim.cueGap + g.cuePullDistance();
    c.save(); c.translate(cue.x, cue.y); c.rotate(g.aim.angle);
    c.fillStyle = 'rgba(6,40,70,0.28)'; c.beginPath(); c.moveTo(-off, 5); c.lineTo(-off - L, 5 - 12); c.lineTo(-off - L, 5 + 12); c.closePath(); c.fill();
    c.drawImage(img, -off - L, -h / 2, L, h);
    c.restore();
  }

  _drawAim(c) {
    const g = this.game, world = g.world, cue = world.balls[0], R = CONFIG.table.ballRadius, px = 1 / this.scale;
    const dx = Math.cos(g.aim.angle), dy = Math.sin(g.aim.angle), pr = this.pred;
    AimPredictor.cast(world, cue.x, cue.y, dx, dy, 0, pr);
    const len = g.aimGuideLength(), assist = this.store.data.settings.aimAssist, bounce = this.store.data.settings.showBounce;
    c.lineCap = 'round';
    c.strokeStyle = 'rgba(255,255,255,0.88)'; c.lineWidth = 1.6 * px; c.setLineDash([]);
    c.beginPath(); c.moveTo(cue.x + dx * R, cue.y + dy * R); c.lineTo(pr.x, pr.y); c.stroke();
    if (pr.kind === 1) {
      const legal = g.rules.isLegalFirstContact(g.rules.currentSeat, pr.hitId) || g.rules.isBreak;
      c.fillStyle = 'rgba(255,255,255,0.22)'; c.strokeStyle = legal ? 'rgba(255,255,255,0.95)' : 'rgba(255,90,95,0.95)'; c.lineWidth = 1.5 * px;
      c.beginPath(); c.arc(pr.x, pr.y, R, 0, 7); c.fill(); c.stroke();
      if (assist) {
        const t = world.balls[pr.hitId];
        c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 1.3 * px; c.setLineDash([6 * px, 5 * px]);
        c.beginPath(); c.moveTo(t.x, t.y); c.lineTo(t.x + pr.objX * len, t.y + pr.objY * len); c.stroke();
        if (pr.cueLen > 0.05) { c.strokeStyle = 'rgba(255,255,255,0.45)'; c.beginPath(); c.moveTo(pr.x, pr.y); c.lineTo(pr.x + pr.cueX * len * 0.45 * pr.cueLen, pr.y + pr.cueY * len * 0.45 * pr.cueLen); c.stroke(); }
        c.setLineDash([]);
      }
    } else if (assist && bounce) {
      const p2 = this.pred2; AimPredictor.cast(world, pr.x, pr.y, pr.objX, pr.objY, 0, p2);
      const l2 = Math.min(len * 1.1, p2.t);
      c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 1.3 * px; c.setLineDash([6 * px, 5 * px]);
      c.beginPath(); c.moveTo(pr.x, pr.y); c.lineTo(pr.x + pr.objX * l2, pr.y + pr.objY * l2); c.stroke(); c.setLineDash([]);
      c.strokeStyle = 'rgba(255,255,255,0.7)'; c.beginPath(); c.arc(pr.x, pr.y, 3.2, 0, 7); c.stroke();
    }
  }
}
