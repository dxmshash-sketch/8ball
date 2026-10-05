/* =====================================================================
   03 · PHYSICS
   Kerangka: x ke kanan, y ke bawah, z masuk ke meja (tangan-kanan).
   Setiap bola menyimpan kecepatan pusat (vx,vy), "roll vector" (rvx,rvy)
   = kecepatan yang seharusnya dimiliki jika menggelinding murni dengan
   spin saat ini, dan side spin wz. Selisih u = v - rv adalah kecepatan
   slip di titik kontak kain: gesekan meluncur menekan u menuju nol
   (fase sliding), lalu bola menggelinding. Top/back spin muncul otomatis
   dari model ini (follow & draw).
   ===================================================================== */
const BallState = Object.freeze({ ON_TABLE: 0, POCKETED: 1 });
const PhysicsEvent = Object.freeze({ BALL: 1, CUSHION: 2, POCKET: 3 });

function rotateOrientation(m, wx, wy, wz, h) {
  const mag = Math.sqrt(wx * wx + wy * wy + wz * wz);
  const ang = mag * h;
  if (ang < 1e-7) return;
  const ax = wx / mag, ay = wy / mag, az = wz / mag;
  const c = Math.cos(ang), s = Math.sin(ang), t = 1 - c;
  const r00 = t * ax * ax + c,      r01 = t * ax * ay - s * az, r02 = t * ax * az + s * ay;
  const r10 = t * ax * ay + s * az, r11 = t * ay * ay + c,      r12 = t * ay * az - s * ax;
  const r20 = t * ax * az - s * ay, r21 = t * ay * az + s * ax, r22 = t * az * az + c;
  for (let j = 0; j < 3; j++) {
    const a = m[j], b = m[3 + j], d = m[6 + j];
    m[j] = r00 * a + r01 * b + r02 * d;
    m[3 + j] = r10 * a + r11 * b + r12 * d;
    m[6 + j] = r20 * a + r21 * b + r22 * d;
  }
}

class Ball {
  constructor(id) {
    this.id = id; this.state = BallState.ON_TABLE;
    this.x = 0; this.y = 0; this.vx = 0; this.vy = 0;
    this.rvx = 0; this.rvy = 0; this.wz = 0;
    this.orient = new Float32Array(9);
    this.dirty = true; this.pocketIndex = -1; this.sinkT = 0; this.fallX = 0; this.fallY = 0; this.fallVx = 0; this.fallVy = 0; this.pocketSeq = 0; this.wallHits = 0; this.sx = 0; this.sy = 0; this.svx = 0; this.svy = 0; this.sz = 0; this.sHit = false;
    // === TAMBAHAN: kontrol animasi jatuh ===
    this.sDownV = 0;       // kecepatan turun (z) — untuk drop yang lebih natural
    this.sOrbit = 0;       // sudut orbit di dalam lubang (ngguling di dinding)
    this.sOrbitV = 0;      // kecepatan orbit
    this.sTilt = 0;        // sudut miring saat jatuh (bukan cuma lurus ke pusat)
    // === END ===
    this.resetOrientation(null);
  }
  /** Bola objek: nomor menghadap kamera dengan putaran acak. Bola putih: identitas. */
  resetOrientation(rng) {
    const m = this.orient;
    if (this.id === 0 || !rng) { m.set([1, 0, 0, 0, 1, 0, 0, 0, 1]); }
    else {
      m.set([0, 0, 1, 0, 1, 0, -1, 0, 0]);
      rotateOrientation(m, 0, 0, 1, rng.range(0, Math.PI * 2));
      const tilt = rng.range(0, Math.PI * 2);
      rotateOrientation(m, Math.cos(tilt), Math.sin(tilt), 0, rng.range(0, 0.5));
    }
    this.dirty = true;
  }
  isMoving() { return this.vx !== 0 || this.vy !== 0 || this.rvx !== 0 || this.rvy !== 0 || this.wz !== 0; }
  stop() { this.vx = this.vy = this.rvx = this.rvy = this.wz = 0; }
}

class EventQueue {
  constructor(capacity) {
    this.items = [];
    for (let i = 0; i < capacity; i++) this.items.push({ type: 0, a: 0, b: 0, speed: 0, x: 0, y: 0 });
    this.count = 0;
  }
  push(type, a, b, speed, x, y) {
    if (this.count >= this.items.length) return;
    const e = this.items[this.count++];
    e.type = type; e.a = a; e.b = b; e.speed = speed; e.x = x; e.y = y;
  }
  clear() { this.count = 0; }
}


/** Satu sumber kebenaran geometri meja: dipakai untuk collision DAN untuk digambar. */
function buildTableGeometry(T) {
  const W = T.width, H = T.height, ct = T.cushion, S2 = Math.SQRT2;
  const tc = T.cornerMouth / S2, cb = T.cornerThroat / S2 - ct;    // ujung nose & ujung dasar cushion di dekat corner
  const sn = T.sideMouth / 2, sb = T.sideThroat / 2;
  const mx = (p) => [W - p[0], p[1]], my = (p) => [p[0], H - p[1]];
  // urutan titik: nose-awal, nose-akhir, dasar-akhir, dasar-awal  (dasar lebih panjang dari nose → trapezoid)
  const top = [[tc, 0], [W / 2 - sn, 0], [W / 2 - sb, -ct], [cb, -ct]];
  const left = [[0, tc], [0, H - tc], [-ct, H - cb], [-ct, cb]];
  const cushions = [top, top.map(mx), top.map(my), top.map(mx).map(my), left, left.map(mx)];
  const segs = [];
  for (const P of cushions) for (const [a, b] of [[0, 1], [1, 2], [3, 0]]) segs.push(P[a][0], P[a][1], P[b][0], P[b][1]);
  const n = segs.length / 4, segLen2 = new Float64Array(n);
  for (let i = 0; i < n; i++) { const ex = segs[4 * i + 2] - segs[4 * i], ey = segs[4 * i + 3] - segs[4 * i + 1]; segLen2[i] = ex * ex + ey * ey; }
  const shapes = [], pockets = [];
  const corner = (sx, sy_) => {
    const f = (p) => [sx < 0 ? W - p[0] : p[0], sy_ < 0 ? H - p[1] : p[1]];
    shapes.push({ tipA: f([tc, 0]), baseA: f([cb, -ct]), tipB: f([0, tc]), baseB: f([-ct, cb]), axis: [sx < 0 ? 1 : -1, sy_ < 0 ? 1 : -1].map((v) => v / S2), corner: true });
  };
  const side = (down) => {
    const f = (p) => [p[0], down ? H - p[1] : p[1]];
    shapes.push({ tipA: f([W / 2 - sn, 0]), baseA: f([W / 2 - sb, -ct]), tipB: f([W / 2 + sn, 0]), baseB: f([W / 2 + sb, -ct]), axis: [0, down ? 1 : -1], corner: false });
  };
  corner(1, 1); side(false); corner(-1, 1); corner(1, -1); side(true); corner(-1, -1);
  // Kantong dirender & ditangkap sebagai LINGKARAN sejati: pusat = titik tengah baseA–baseB (leher cushion),
  // radius = setengah jarak baseA–baseB — karena baseA & baseB simetris terhadap axis, keduanya otomatis
  // tepat berada di lingkaran ini (diametrically opposite), sehingga corong terlihat benar-benar bulat.
  for (const sh of shapes) {
    const bax = sh.baseA[0], bay = sh.baseA[1];
    const bbx = sh.baseB[0], bby = sh.baseB[1];

    // Titik tengah asli mulut/leher pocket
    const baseCx = (bax + bbx) / 2;
    const baseCy = (bay + bby) / 2;

    // =========================================================
    // POSISI POCKET
    // 4 CORNER POCKET  -> jauh lebih dekat ke titik sudut
    // 2 SIDE POCKET    -> hanya bergeser sedikit
    // =========================================================
    const pocketShift = sh.corner
      ? T.ballRadius * 1   // 4 lubang pojok
      : T.ballRadius * 0.7;  // 2 lubang tengah

    // sh.axis menunjuk ke arah LUAR meja / arah sudut pocket
    const ccx = baseCx + sh.axis[0] * pocketShift;
    const ccy = baseCy + sh.axis[1] * pocketShift;

    const radius = Math.hypot(bax - bbx, bay - bby) / 2;

    const a1 = Math.atan2(
      bay - ccy,
      bax - ccx
    );

    const a2 = Math.atan2(
      bby - ccy,
      bbx - ccx
    );

    const aOut = Math.atan2(
      sh.axis[1],
      sh.axis[0]
    );

    const norm = (a) => {
      let d = a;
      while (d <= -Math.PI) d += 2 * Math.PI;
      while (d > Math.PI) d -= 2 * Math.PI;
      return d;
    };

    const ccwSpan =
      norm(a2 - a1) >= 0
        ? norm(a2 - a1)
        : norm(a2 - a1) + 2 * Math.PI;

    const ccwMid = norm(
      a1 + ccwSpan / 2
    );

    const anticlockwise =
      Math.abs(norm(ccwMid - aOut)) > Math.PI / 2;

    Object.assign(sh, {
      cx: ccx,
      cy: ccy,
      radius,
      a1,
      a2,
      anticlockwise
    });

    pockets.push({
      x: ccx,
      y: ccy,
      r: radius,
      corner: sh.corner,
      cx: ccx,
      cy: ccy,
      radius
    });
  }
  return { W, H, cushions, segs: new Float64Array(segs), segLen2, segCount: n, pockets, pocketShapes: shapes };
}

class PhysicsWorld {
  constructor(config) {
    this.cfg = config;
    const T = config.table;
    this.R = T.ballRadius; this.W = T.width; this.H = T.height;
    this.geo = buildTableGeometry(T);
    this.balls = [];
    for (let i = 0; i < 16; i++) this.balls.push(new Ball(i));
    this.events = new EventQueue(256);
    this.accumulator = 0; this.pocketCounter = 0;
    this.pockets = this.geo.pockets;
  }

  update(frameDt) {
    const P = this.cfg.physics;
    this.accumulator += Math.min(frameDt, 0.05);
    let steps = 0;
    while (this.accumulator >= P.fixedStep && steps < P.maxStepsPerFrame) {
      this._fixedStep(P.fixedStep); this.accumulator -= P.fixedStep; steps++;
    }
    if (this.accumulator > P.fixedStep) this.accumulator = 0;
  }

  allStopped() {
    for (let i = 0; i < 16; i++) { const b = this.balls[i]; if (b.state === BallState.ON_TABLE && b.isMoving()) return false; }
    return true;
  }
  stopAll() { for (let i = 0; i < 16; i++) this.balls[i].stop(); }

  /** Pukulan tongkat: kecepatan awal + spin dari titik kontak pada bola putih. */
  strike(dirX, dirY, power, spinX, spinY) {
    const P = this.cfg.physics, cue = this.balls[0], R = this.R;
    const V = power * P.maxShotSpeed;
    cue.vx = dirX * V; cue.vy = dirY * V;
    const off = P.maxSpinOffset;
    const rv = 2.5 * V * spinY * off;                       // top/back spin (rv sejajar arah tembak)
    cue.rvx = dirX * rv; cue.rvy = dirY * rv;
    const ah = spinX * off * R, rx = -dirY * ah, ry = dirX * ah;   // offset ke kanan arah tembak
    cue.wz = 2.5 * V / (R * R) * (rx * dirY - ry * dirX);
    cue.dirty = true;
  }

  _fixedStep(dt) {
    const P = this.cfg.physics;
    let maxSp2 = 0;
    for (let i = 0; i < 16; i++) {
      const b = this.balls[i];
      if (b.state !== BallState.ON_TABLE) continue;
      const s2 = b.vx * b.vx + b.vy * b.vy;
      if (s2 > maxSp2) maxSp2 = s2;
    }
    const n = Util.clamp(Math.ceil(Math.sqrt(maxSp2) * dt / (this.R * P.maxTravelFraction)), 1, P.maxSubsteps);
    const h = dt / n;
    for (let i = 0; i < n; i++) this._substep(h);
  }

  _substep(h) {
    const balls = this.balls, R = this.R;
    for (let i = 0; i < 16; i++) {
      const b = balls[i];
      if (b.state !== BallState.ON_TABLE || !b.isMoving()) continue;
      this._applyFriction(b, h);
      b.x += b.vx * h; b.y += b.vy * h;
      rotateOrientation(b.orient, b.rvy / R, -b.rvx / R, b.wz, h);
      b.dirty = true;
    }
    for (let i = 0; i < 16; i++) { const b = balls[i]; if (b.state === BallState.ON_TABLE && b.isMoving()) this._collideCushions(b); }
    this._collideBalls();
    for (let i = 0; i < 16; i++) { const b = balls[i]; if (b.state === BallState.ON_TABLE && b.isMoving()) this._collideCushions(b); }
    for (let i = 0; i < 16; i++) { const b = balls[i]; if (b.state === BallState.ON_TABLE && b.isMoving()) this._checkPockets(b); }
  }

  _applyFriction(b, h) {
    const P = this.cfg.physics;
    let remaining = h;
    const dux = b.vx - b.rvx, duy = b.vy - b.rvy;
    const um = Math.sqrt(dux * dux + duy * duy);
    let rolling = um <= P.slideEpsilon;
    if (!rolling) {
      const tFull = um / (3.5 * P.slidingAccel);
      const t = tFull < remaining ? tFull : remaining;
      const ux = dux / um, uy = duy / um;
      b.vx -= P.slidingAccel * ux * t; b.vy -= P.slidingAccel * uy * t;
      b.rvx += 2.5 * P.slidingAccel * ux * t; b.rvy += 2.5 * P.slidingAccel * uy * t;
      remaining -= t;
      if (tFull < h) { rolling = true; b.rvx = b.vx; b.rvy = b.vy; }
    } else { b.rvx = b.vx; b.rvy = b.vy; }

    if (rolling && remaining > 0) {
      const sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
      if (sp > 0) {
        const ns = sp - (P.rollingDecel + P.rollingDrag * sp) * remaining;
        if (ns <= P.stopSpeed) { b.vx = b.vy = b.rvx = b.rvy = 0; }
        else { const s = ns / sp; b.vx *= s; b.vy *= s; b.rvx = b.vx; b.rvy = b.vy; }
      } else { b.rvx = b.rvy = 0; }
    }

    if (b.wz !== 0) {
      const stationary = b.vx === 0 && b.vy === 0;
      const rate = stationary ? P.sideSpinStopped : P.sideSpinDecayRate;
      const aw = Math.abs(b.wz), dec = (P.sideSpinDecayConst + rate * aw) * h;
      if (aw <= dec || aw < P.sideSpinStop) b.wz = 0; else b.wz -= Math.sign(b.wz) * dec;
    }
  }

  /** Collision terhadap tepi poligon cushion (nose + rahang miring menuju pocket). */
  _collideCushions(b) {
    const G = this.geo, S = G.segs, L2 = G.segLen2, R = this.R, R2 = R * R;
    for (let i = 0, k = 0; i < G.segCount; i++, k += 4) {
      const ax = S[k], ay = S[k + 1], ex = S[k + 2] - ax, ey = S[k + 3] - ay;
      let t = ((b.x - ax) * ex + (b.y - ay) * ey) / L2[i];
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const dx = b.x - (ax + ex * t), dy = b.y - (ay + ey * t), d2 = dx * dx + dy * dy;
      if (d2 < R2) {
        const d = Math.sqrt(d2) || 0.0001;
        this._bounce(b, dx / d, dy / d, R - d);
      }
    }
  }

  /** Pantulan cushion: restitusi tergantung kecepatan, gesekan tangensial mengubah side spin. */
  _bounce(b, nx, ny, pen, eOverride) {
    const P = this.cfg.physics, R = this.R;
    b.x += nx * pen; b.y += ny * pen;
    const vn = b.vx * nx + b.vy * ny;
    if (vn >= 0) return;
    const sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
    const e = eOverride !== undefined ? eOverride : Math.max(P.cushionMinRestitution, P.cushionRestitution - P.cushionSpeedLoss * sp);
    const Jn = -(1 + e) * vn;
    b.vx += Jn * nx; b.vy += Jn * ny;
    const tx = -ny, ty = nx;
    const vt = b.vx * tx + b.vy * ty;
    const s = vt - R * b.wz;
    let Jt = -s / 3.5;
    const maxJ = P.cushionFriction * Jn;
    if (Jt > maxJ) Jt = maxJ; else if (Jt < -maxJ) Jt = -maxJ;
    b.vx += Jt * tx; b.vy += Jt * ty;
    b.wz += -2.5 * Jt / R;
    const rvn = b.rvx * nx + b.rvy * ny;
    const d = -P.cushionSpinKeep * rvn - rvn;
    b.rvx += d * nx; b.rvy += d * ny;
    this.events.push(PhysicsEvent.CUSHION, b.id, -1, -vn, b.x, b.y);
  }

  _collideBalls() {
    const P = this.cfg.physics, R = this.R, D = 2 * R, D2 = D * D, balls = this.balls;
    for (let i = 0; i < 16; i++) {
      const a = balls[i];
      if (a.state !== BallState.ON_TABLE) continue;
      for (let j = i + 1; j < 16; j++) {
        const b = balls[j];
        if (b.state !== BallState.ON_TABLE) continue;
        const dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy;
        if (d2 >= D2) continue;
        if (!a.isMoving() && !b.isMoving()) continue;
        let d = Math.sqrt(d2), nx, ny;
        if (d < 1e-6) { nx = 1; ny = 0; d = 0; } else { nx = dx / d; ny = dy / d; }
        const half = (D - d) * 0.5 + 0.01;
        a.x -= nx * half; a.y -= ny * half; b.x += nx * half; b.y += ny * half;
        const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (vn >= 0) continue;
        const J = -(1 + P.ballRestitution) * vn * 0.5;
        a.vx -= J * nx; a.vy -= J * ny; b.vx += J * nx; b.vy += J * ny;
        const tx = -ny, ty = nx;
        const slip = (b.vx * tx + b.vy * ty - R * b.wz) - (a.vx * tx + a.vy * ty + R * a.wz);
        let Jt = -slip / 7;
        const maxJ = P.ballFriction * J;
        if (Jt > maxJ) Jt = maxJ; else if (Jt < -maxJ) Jt = -maxJ;
        b.vx += Jt * tx; b.vy += Jt * ty; a.vx -= Jt * tx; a.vy -= Jt * ty;
        b.wz += -2.5 * Jt / R; a.wz += -2.5 * Jt / R;
        this.events.push(PhysicsEvent.BALL, a.id, b.id, -vn, (a.x + b.x) * 0.5, (a.y + b.y) * 0.5);
      }
    }
  }

  /** Kantong = rahang (segmen cushion, tabrakan nyata) + rongga bundar dengan DINDING BELAKANG di setengah lingkaran sisi luar.
   *  - Bola pelan (< 90 u/s) jatuh begitu pusatnya dekat bibir lubang.
   *  - Bola lain meluncur masuk ke rongga sampai menabrak dinding belakang. Di titik itu diputuskan:
   *      masuk  → _pocket (animasi "nabrak ujung lubang lalu menggelinding turun"),
   *      ditolak → memantul keras dari dinding belakang dan keluar lagi (rattle); rahang bisa menahannya lagi.
   *  - Keputusan memakai sudut masuk terhadap sumbu lubang, kecepatan, dan top/backspin (lihat _pocketAccepts).
   *  - Bola yang sudah memantul ≥ 2× dari dinding belakang pasti jatuh (rattle yang akhirnya masuk). */
  // _checkPockets(b) {
  //   const R = this.R, P = this.cfg.physics, v2 = b.vx * b.vx + b.vy * b.vy, slow = v2 < 8100;
  //   for (let p = 0; p < 6; p++) {
  //     const k = this.pockets[p], dx = b.x - k.cx, dy = b.y - k.cy, d2 = dx * dx + dy * dy, r = k.radius;
  //     if (slow) { const cap = r + 0.68 * R; if (d2 < cap * cap) { this._pocket(b, p); return; } continue; }
  //     if (d2 >= r * r) { if (b.wallHits && d2 > (r + 2 * R) * (r + 2 * R)) b.wallHits = 0; continue; }
  //     const sh = this.geo.pocketShapes[p];
  //     if (dx * sh.axis[0] + dy * sh.axis[1] <= 0) continue;                       // masih di setengah depan (sisi meja)
  //     const d = Math.sqrt(d2), rw = r * (P.pocketBackWall || 0.8);
  //     if (d < rw) continue;
  //     const nx = dx / d, ny = dy / d;
  //     if (b.vx * nx + b.vy * ny <= 0) continue;                                     // sedang menjauhi dinding belakang
  //     if (b.wallHits >= 2 || this._pocketAccepts(b, sh, Math.sqrt(v2))) { this._pocket(b, p, nx, ny); return; }
  //     b.wallHits++; this._bounce(b, -nx, -ny, d - rw, P.pocketJawRestitution || 0.62);   // rattle: mental dari dinding belakang
  //     return;
  //   }
  //   const m = this.R * 4;
  //   if (b.x < -m || b.x > this.W + m || b.y < -m || b.y > this.H + m) {
  //     let best = 0, bd = Infinity;
  //     for (let p = 0; p < 6; p++) { const k = this.pockets[p], d = (b.x - k.x) ** 2 + (b.y - k.y) ** 2; if (d < bd) { bd = d; best = p; } }
  //     this._pocket(b, best);
  //   }
  // }

// _checkPockets(b) {
//   const R = this.R, P = this.cfg.physics, v2 = b.vx * b.vx + b.vy * b.vy;
//   // slow threshold lebih ketat: hanya bola yang benar-benar pelan (< 50 u/s) yang langsung masuk
//   const slow = v2 < 2500;
//   for (let p = 0; p < 6; p++) {
//     const k = this.pockets[p], dx = b.x - k.cx, dy = b.y - k.cy, d2 = dx * dx + dy * dy, r = k.radius;

//     // === BOLA PELAN: langsung masuk, tapi hanya jika benar-benar di dekat pusat lubang ===
//     if (slow) {
//       const cap = r + 0.35 * R;                    // ↓ dari 0.68 → 0.35 (lebih ketat)
//       if (d2 < cap * cap) { this._pocket(b, p); return; }
//       continue;
//     }

//     // === BOLA CEPAT: hanya jika benar-benar di dalam lubang ===
//     if (d2 >= r * r) {
//       if (b.wallHits && d2 > (r + 2 * R) * (r + 2 * R)) b.wallHits = 0;
//       continue;
//     }

//     const sh = this.geo.pocketShapes[p];
//     if (dx * sh.axis[0] + dy * sh.axis[1] <= 0) continue;    // masih di setengah depan (sisi meja)

//     const d = Math.sqrt(d2);
//     const rw = r * (P.pocketBackWall || 0.92);              // ↑ dari 0.8 → 0.92 (dinding lebih dekat bibir)
//     if (d < rw) continue;
//     const nx = dx / d, ny = dy / d;
//     if (b.vx * nx + b.vy * ny <= 0) continue;                // sedang menjauhi dinding belakang

//     if (b.wallHits >= 2 || this._pocketAccepts(b, sh, Math.sqrt(v2))) {
//       this._pocket(b, p, nx, ny);
//       return;
//     }
//     b.wallHits++;
//     this._bounce(b, -nx, -ny, d - rw, P.pocketJawRestitution || 0.62);
//     return;
//   }

//   // Fallback: bola nyasar keluar meja
//   const m = this.R * 4;
//   if (b.x < -m || b.x > this.W + m || b.y < -m || b.y > this.H + m) {
//     let best = 0, bd = Infinity;
//     for (let p = 0; p < 6; p++) {
//       const k = this.pockets[p], d = (b.x - k.x) ** 2 + (b.y - k.y) ** 2;
//       if (d < bd) { bd = d; best = p; }
//     }
//     this._pocket(b, best);
//   }
// }
_checkPockets(b) {
  const R = this.R;
  const P = this.cfg.physics;

  const vx = b.vx;
  const vy = b.vy;

  const speed = Math.hypot(vx, vy);

  for (let p = 0; p < 6; p++) {
    const k = this.pockets[p];
    const sh = this.geo.pocketShapes[p];

    const dx = b.x - k.cx;
    const dy = b.y - k.cy;

    const dist2 = dx * dx + dy * dy;
    const dist = Math.sqrt(dist2);

    /*
     * Pocket radius berasal dari throat.
     * Bola tidak langsung dianggap masuk hanya karena
     * menyentuh lingkaran pocket.
     */
    const captureRadius = k.radius - R * 0.12;

    if (dist > captureRadius) continue;

    /*
     * Arah bola menuju pocket.
     */
    const towardPocket =
      speed > 0
        ? (vx * (k.cx - b.x) + vy * (k.cy - b.y)) / speed
        : 0;

    /*
     * Bola yang sudah sangat dekat dan hampir berhenti
     * boleh jatuh.
     */
    if (speed < 55) {
      if (dist < k.radius + R * 0.25) {
        this._pocket(b, p);
        return;
      }

      continue;
    }

    /*
     * Bola harus benar-benar bergerak menuju pocket.
     */
    if (towardPocket <= 0) continue;

    /*
     * Arah masuk terhadap axis pocket.
     */
    const axisDot =
      (vx * sh.axis[0] + vy * sh.axis[1]) / speed;

    /*
     * Semakin lurus masuk, semakin mudah diterima.
     * Untuk bola yang sangat dekat, sudut sedikit miring
     * tetap boleh masuk.
     */
    const angleLimit =
      speed < 450
        ? 0.15
        : 0.28;

    if (axisDot < angleLimit) continue;

    /*
     * Kalau pusat bola sudah cukup jauh masuk,
     * langsung mulai animasi sink.
     */
    if (dist < k.radius - R * 0.25) {
      this._pocket(b, p);
      return;
    }
  }

  /*
   * Safety fallback.
   */
  const margin = R * 3;

  if (
    b.x < -margin ||
    b.x > this.W + margin ||
    b.y < -margin ||
    b.y > this.H + margin
  ) {
    let best = 0;
    let bestDist = Infinity;

    for (let p = 0; p < 6; p++) {
      const k = this.pockets[p];

      const dx = b.x - k.x;
      const dy = b.y - k.y;

      const d2 = dx * dx + dy * dy;

      if (d2 < bestDist) {
        bestDist = d2;
        best = p;
      }
    }

    this._pocket(b, best);
  }
}
  /** Apakah bola yang menabrak dinding belakang kantong jatuh? Batas kecepatan = pocketMaxSpeed × (1 + 3f²) × (1 + gain·spin),
   *  f = seberapa lurus arah gerak terhadap sumbu lubang (0 pada ≥ 63° miring, 1 pada lurus), spin>0 = topspin (membantu), <0 = backspin. */
  // _pocketAccepts(b, sh, sp) {
  //   const P = this.cfg.physics, cosA = (b.vx * sh.axis[0] + b.vy * sh.axis[1]) / sp;
  //   const base = P.pocketMaxSpeed || 0.3 * P.maxShotSpeed, f = Util.clamp((cosA - 0.45) / 0.55, 0, 1);
  //   const rel = Util.clamp((b.rvx * b.vx + b.rvy * b.vy) / (sp * sp), -1, 1);   // 0 = meluncur tanpa putaran (netral), + topspin, − backspin
  //   return sp <= base * (1 + 3 * f * f) * (1 + (P.pocketSpinGain === undefined ? 0.35 : P.pocketSpinGain) * rel);
  // }

  _pocketAccepts(b, sh, sp) {
  const P = this.cfg.physics;
  const cosA = (b.vx * sh.axis[0] + b.vy * sh.axis[1]) / sp;
  // base lebih rendah → hanya bola yang benar-benar searah lubang yang diterima
  const base = P.pocketMaxSpeed || 0.22 * P.maxShotSpeed;    // ↓ dari 0.3 → 0.22
  const f = Util.clamp((cosA - 0.55) / 0.45, 0, 1);          // f jadi 0 saat < 56°, 1 saat searah
  const rel = Util.clamp((b.rvx * b.vx + b.rvy * b.vy) / (sp * sp), -1, 1);
  const gain = P.pocketSpinGain === undefined ? 0.35 : P.pocketSpinGain;
  return sp <= base * (1 + 2 * f * f) * (1 + gain * rel);    // ↓ dari 3 → 2 (kurang toleran)
}

  /** Bola masuk: simpan keadaan awal untuk animasi jatuh (posisi, kecepatan terbatas, normal dinding yang ditabrak). */
  // _pocket(b, index, nx, ny) {
  //   const sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy), k = this.pockets[index], sh = this.geo.pocketShapes[index], R = this.R, vmax = R * 26;
  //   b.state = BallState.POCKETED; b.pocketIndex = index; b.sinkT = 0; b.wallHits = 0;
  //   b.fallX = b.x; b.fallY = b.y; b.fallVx = b.vx; b.fallVy = b.vy; b.pocketSeq = ++this.pocketCounter;
  //   const q = sp > vmax ? vmax / sp : 1; b.sx = b.x; b.sy = b.y; b.svx = b.vx * q; b.svy = b.vy * q; b.sz = 0; b.sHit = false;
  //   if (nx !== undefined) {                                                          // menabrak dinding belakang: pantul kecil ke dalam
  //     const vn = b.svx * nx + b.svy * ny; b.svx -= 1.35 * vn * nx; b.svy -= 1.35 * vn * ny; b.sHit = true;
  //   } else if (sp < 40) { b.svx += sh.axis[0] * 30; b.svy += sh.axis[1] * 30; }        // bola pelan: dorongan kecil melewati bibir
  //   b.stop();
  //   this.events.push(PhysicsEvent.POCKET, b.id, index, sp, k.x, k.y);
  // }

/** Bola masuk: simpan keadaan awal untuk animasi jatuh yang realistis.
 *  Fase:
 *   1. Ngguling (bola menyentuh bibir → geser ke dalam)
 *   2. Turun di dinding lubang (z naik pelan)
 *   3. Drop ke dasar (z → 1, fade out)
 */
// _pocket(b, index, nx, ny) {
//   const sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
//   const k = this.pockets[index];
//   const sh = this.geo.pocketShapes[index];
//   const R = this.R;

//   // Batasi kecepatan masuk biar animasi tetap terlihat (jangan skip fase)
//   const vmax = R * 22;                                        // ~330 u/s untuk R=15
//   const q = sp > vmax ? vmax / sp : 1;

//   b.state = BallState.POCKETED;
//   b.pocketIndex = index;
//   b.sinkT = 0;
//   b.wallHits = 0;
//   b.fallX = b.x; b.fallY = b.y;
//   b.fallVx = b.vx; b.fallVy = b.vy;
//   b.pocketSeq = ++this.pocketCounter;

//   // Setup posisi awal animasi
//   b.sx = b.x;
//   b.sy = b.y;
//   b.svx = b.vx * q;
//   b.svy = b.vy * q;
//   b.sz = 0;
//   b.sDownV = 0;
//   b.sHit = false;

//   // === Hitung arah orbit di dalam lubang ===
//   // Bola yang masuk dengan sudut tertentu akan "ngguling" di dinding lubang
//   const dxToCenter = k.cx - b.x;
//   const dyToCenter = k.cy - b.y;
//   const distToCenter = Math.sqrt(dxToCenter * dxToCenter + dyToCenter * dyToCenter) || 1;
//   const ux = dxToCenter / distToCenter;
//   const uy = dyToCenter / distToCenter;

//   // Komponen kecepatan tegak lurus (tangensial) → jadi orbit
//   const vTangential = b.vx * -uy + b.vy * ux;
//   b.sOrbitV = vTangential / (R * 0.6);                       // kecepatan angular
//   b.sOrbit = Math.atan2(b.y - k.cy, b.x - k.cx);             // sudut awal

//   // Tilt awal = sudut masuk terhadap sumbu lubang (0..0.5 rad)
//   const dotAxis = (b.vx * sh.axis[0] + b.vy * sh.axis[1]) / (sp || 1);
//   b.sTilt = Math.acos(Math.max(-1, Math.min(1, dotAxis))) * 0.35;

//   if (nx !== undefined) {
//     // Bola menabrak dinding belakang → animasi micilpi
//     const vn = b.svx * nx + b.svy * ny;
//     b.svx -= 1.35 * vn * nx;
//     b.svy -= 1.35 * vn * ny;
//     b.sHit = true;
//     b.sDownV = 0.15;                                          // mulai turun pelan
//   } else if (sp < 40) {
//     // Bola sangat pelan: dorongan kecil melewati bibir, langsung drop
//     b.svx += sh.axis[0] * 20;
//     b.svy += sh.axis[1] * 20;
//     b.sDownV = 0.05;
//   } else {
//     // Bola sedang/cepat: sedikit "micilpi" di bibir
//     b.sHit = sp > 60;
//     b.sDownV = 0.02;
//   }

//   b.stop();
//   this.events.push(PhysicsEvent.POCKET, b.id, index, sp, k.x, k.y);
// }
  /** Dipanggil Game.update tiap frame untuk bola yang sedang jatuh (sinkT 0→1). Simulasi kecil: meluncur, menabrak ujung/dinding
   *  lubang, lalu menggelinding turun ke pusat lubang sambil "tenggelam" (sz 0→1). Mengembalikan true saat menabrak dinding (untuk suara). */

_pocket(b, index, nx, ny) {
  const k = this.pockets[index];
  const sh = this.geo.pocketShapes[index];

  const R = this.R;

  const vx = b.vx;
  const vy = b.vy;

  const speed = Math.hypot(vx, vy);

  b.state = BallState.POCKETED;

  b.pocketIndex = index;
  b.sinkT = 0;
  b.wallHits = 0;

  b.fallX = b.x;
  b.fallY = b.y;

  b.fallVx = vx;
  b.fallVy = vy;

  b.pocketSeq = ++this.pocketCounter;

  /*
   * Posisi animasi dimulai dari posisi sebenarnya.
   */
  b.sx = b.x;
  b.sy = b.y;

  /*
   * Batasi velocity supaya bola tidak teleport
   * ketika masuk pocket dengan power besar.
   */
  const MAX_POCKET_SPEED = R * 24;

  const scale =
    speed > MAX_POCKET_SPEED
      ? MAX_POCKET_SPEED / speed
      : 1;

  b.svx = vx * scale;
  b.svy = vy * scale;

  /*
   * Kedalaman pocket.
   */
  b.sz = 0;

  /*
   * State tambahan.
   */
  b.sDownV = 0;
  b.sOrbit = 0;
  b.sOrbitV = 0;

  /*
   * Sudut masuk.
   */
  const dot =
    speed > 0
      ? (vx * sh.axis[0] + vy * sh.axis[1]) / speed
      : 1;

  b.sTilt = Math.acos(
    Math.max(-1, Math.min(1, dot))
  );

  /*
   * Kalau datang dari arah dinding belakang,
   * kurangi momentum sedikit.
   */
  if (nx !== undefined && ny !== undefined) {
    const vn =
      b.svx * nx +
      b.svy * ny;

    if (vn > 0) {
      b.svx -= vn * 0.65 * nx;
      b.svy -= vn * 0.65 * ny;
    }
  }

  /*
   * Bola pelan mendapat dorongan kecil
   * menuju pusat pocket.
   */
  if (speed < 80) {
    b.svx += sh.axis[0] * 18;
    b.svy += sh.axis[1] * 18;
  }

  b.stop();

  this.events.push(
    PhysicsEvent.POCKET,
    b.id,
    index,
    speed,
    k.x,
    k.y
  );
}
  /** Animasi bola jatuh ke lubang — 3 fase realistis (mirip 8 Ball Pool):
 *   Fase 1 (t = 0.00 – 0.25)  : ngguling di bibir, muter di dinding
 *   Fase 2 (t = 0.25 – 0.75)  : turun pelan di dalam lubang (z naik)
 *   Fase 3 (t = 0.75 – 1.00)  : drop cepat ke dasar, fade out
 */
stepSink(b, dt) {
  if (b.sinkT >= 1) return false;

  const k  = this.pockets[b.pocketIndex];
  const sh = this.geo.pocketShapes[b.pocketIndex];
  const R  = this.R;

  // Total durasi animasi (lebih lama dari sebelumnya)
  const DUR = 0.95;

  let hit = false;
  b.sinkT = Math.min(1, b.sinkT + dt / DUR);

  // Substep untuk akurasi tinggi
  const n = Math.max(1, Math.ceil(dt / (1 / 120)));
  const h = dt / n;

  const rw   = k.radius * 0.88;              // radius dinding dalam
  const tNow = b.sinkT;                      // 0..1

  // === FASE TRANSISI ===
  // f1: 0→1 saat t 0.00–0.25 (ngguling di bibir)
  // f2: 0→1 saat t 0.25–0.75 (turun pelan)
  // f3: 0→1 saat t 0.75–1.00 (drop ke dasar)
  const f1 = Math.min(1, Math.max(0, tNow / 0.25));
  const f2 = Math.min(1, Math.max(0, (tNow - 0.25) / 0.50));
  const f3 = Math.min(1, Math.max(0, (tNow - 0.75) / 0.25));

  for (let i = 0; i < n; i++) {
    // === FASE 1: ngguling ===
    // Geser posisi dari titik masuk ke dalam lubang (menuju pusat)
    // Damping rendah supaya bola masih "hidup"
    const damp1 = Math.exp(-2.5 * h);
    b.svx *= damp1;
    b.svy *= damp1;

    // === FASE 2 & 3: tarikan ke pusat + orbit ===
    if (tNow > 0.20) {
      const pullStrength = 320 * f2 + 800 * f3;
      b.svx += (k.cx - b.sx) * pullStrength * h;
      b.svy += (k.cy - b.sy) * pullStrength * h;

      // Orbit: bola ngguling di dinding lubang
      b.sOrbit += b.sOrbitV * h;
      b.sOrbitV *= Math.exp(-3.0 * h);                 // orbit melambat

      // Tarik posisi ke lingkaran orbit dengan radius yang mengecil
      const orbitR = rw * (0.85 - 0.55 * f2 - 0.25 * f3);   // 0.85 → 0.05 (mengecil)
      const orbX = k.cx + Math.cos(b.sOrbit) * orbitR;
      const orbY = k.cy + Math.sin(b.sOrbit) * orbitR;
      const blend = Math.min(1, 3.5 * f2);             // blend dari gerak lurus ke orbit
      b.sx = b.sx * (1 - blend) + orbX * blend;
      b.sy = b.sy * (1 - blend) + orbY * blend;
    }

    // === KEDALAMAN (z) ===
    // Naik pelan di fase 2, cepat di fase 3
    const zSpeed = 0.35 * f2 + 1.8 * f3;
    b.sz = Math.min(1, b.sz + zSpeed * h);

    // Update posisi (masih ada momentum)
    b.sx += b.svx * h;
    b.sy += b.svy * h;

    // === TABRAKAN DENGAN UJUNG LUBANG (untuk efek micilpi) ===
    const dx = b.sx - k.cx, dy = b.sy - k.cy, d = Math.sqrt(dx * dx + dy * dy);
    if (!b.sHit && d > rw && dx * sh.axis[0] + dy * sh.axis[1] > 0) {
      const nx = dx / d, ny = dy / d, vn = b.svx * nx + b.svy * ny;
      if (vn > 0) {
        b.svx -= 1.45 * vn * nx;
        b.svy -= 1.45 * vn * ny;
      }
      b.sx = k.cx + nx * rw;
      b.sy = k.cy + ny * rw;
      b.sHit = true;
      hit = true;
    }

    // Rotasi bola (ngguling di dinding)
    const rollScale = 1 + 2 * f2 + 4 * f3;
    rotateOrientation(b.orient, b.svy / R, -b.svx / R, b.sOrbitV * 0.5, h * rollScale);
  }

  b.dirty = true;
  return hit;
}
}

/** Ray-cast untuk garis bidik: bola pertama yang kena atau cushion pertama. */
class AimPredictor {
  static cast(world, ox, oy, dx, dy, ignoreId, out) {
    const R = world.R, D = 2 * R, W = world.W, H = world.H;
    let best = Infinity, hitId = -1;
    for (let i = 1; i < 16; i++) {
      if (i === ignoreId) continue;
      const b = world.balls[i];
      if (b.state !== BallState.ON_TABLE) continue;
      const fx = b.x - ox, fy = b.y - oy, proj = fx * dx + fy * dy;
      if (proj <= 0) continue;
      const perp2 = fx * fx + fy * fy - proj * proj;
      if (perp2 >= D * D) continue;
      const t = proj - Math.sqrt(D * D - perp2);
      if (t < best) { best = t; hitId = i; }
    }
    let tw = Infinity, wnx = 0, wny = 0;
    if (dx > 1e-9) { const t = (W - R - ox) / dx; if (t < tw) { tw = t; wnx = -1; wny = 0; } }
    else if (dx < -1e-9) { const t = (R - ox) / dx; if (t < tw) { tw = t; wnx = 1; wny = 0; } }
    if (dy > 1e-9) { const t = (H - R - oy) / dy; if (t < tw) { tw = t; wnx = 0; wny = -1; } }
    else if (dy < -1e-9) { const t = (R - oy) / dy; if (t < tw) { tw = t; wnx = 0; wny = 1; } }
    if (tw < 0) tw = 0;
    if (hitId >= 0 && best <= tw) {
      const gx = ox + dx * best, gy = oy + dy * best, b = world.balls[hitId];
      let nx = (b.x - gx) / D, ny = (b.y - gy) / D;
      const dot = dx * nx + dy * ny;
      let cx = dx - dot * nx, cy = dy - dot * ny;
      const cl = Math.sqrt(cx * cx + cy * cy);
      if (cl > 1e-6) { cx /= cl; cy /= cl; }
      out.kind = 1; out.t = best; out.hitId = hitId; out.x = gx; out.y = gy;
      out.objX = nx; out.objY = ny; out.cueX = cx; out.cueY = cy; out.cueLen = cl;
    } else {
      out.kind = 2; out.t = tw; out.hitId = -1; out.x = ox + dx * tw; out.y = oy + dy * tw;
      const dot = dx * wnx + dy * wny;
      out.objX = dx - 2 * dot * wnx; out.objY = dy - 2 * dot * wny; out.cueX = 0; out.cueY = 0; out.cueLen = 0;
    }
    return out;
  }
}

/** Matematika jarak tempuh: dipakai bot untuk menentukan power. */
const ShotMath = {
  distanceForSpeed(v, P) { const c0 = P.rollingDecel, c1 = P.rollingDrag; return v / c1 - (c0 / (c1 * c1)) * Math.log(1 + c1 * v / c0); },
  speedForDistance(d, P) {
    let lo = 0, hi = P.maxShotSpeed * 1.3;
    for (let i = 0; i < 32; i++) { const mid = (lo + hi) / 2; if (ShotMath.distanceForSpeed(mid, P) < d) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
  },
};