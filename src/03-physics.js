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
    this.dirty = true; this.pocketIndex = -1; this.sinkT = 0; this.fallX = 0; this.fallY = 0;
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
  // Kantong: bola jatuh saat pusatnya melewati GARIS MULUT (antara dua ujung nose). (x,y) = titik jatuh (animasi & bidikan bot),
  // r = jari-jari larangan menaruh bola putih, hw = setengah lebar mulut.
  const R = T.ballRadius;
  for (const sh of shapes) {
    const mx = (sh.tipA[0] + sh.tipB[0]) / 2, my = (sh.tipA[1] + sh.tipB[1]) / 2, ax = sh.axis[0], ay = sh.axis[1];
    pockets.push({ x: mx + ax * 2.5 * R, y: my + ay * 2.5 * R, r: sh.corner ? 1.9 * R : 1.4 * R, corner: sh.corner, mx, my, ax, ay, hw: Math.hypot(sh.tipA[0] - sh.tipB[0], sh.tipA[1] - sh.tipB[1]) / 2 });
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
    this.accumulator = 0;
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
  _bounce(b, nx, ny, pen) {
    const P = this.cfg.physics, R = this.R;
    b.x += nx * pen; b.y += ny * pen;
    const vn = b.vx * nx + b.vy * ny;
    if (vn >= 0) return;
    const sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
    const e = Math.max(P.cushionMinRestitution, P.cushionRestitution - P.cushionSpeedLoss * sp);
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

  /** Bola jatuh bila pusatnya melewati garis mulut kantong (sedikit lebih awal), atau bila melaju pelan tepat di bibir kantong — tidak ada bola yang "macet". */
  _checkPockets(b) {
    const R = this.R, slow = b.vx * b.vx + b.vy * b.vy < 8100;
    for (let p = 0; p < 6; p++) {
      const k = this.pockets[p], dx = b.x - k.mx, dy = b.y - k.my, depth = dx * k.ax + dy * k.ay;
      if ((depth > -0.15 * R || (slow && depth > -0.55 * R)) && Math.abs(-dx * k.ay + dy * k.ax) < k.hw) { this._pocket(b, p); return; }
    }
    const m = this.R * 4;
    if (b.x < -m || b.x > this.W + m || b.y < -m || b.y > this.H + m) {
      let best = 0, bd = Infinity;
      for (let p = 0; p < 6; p++) { const k = this.pockets[p], d = (b.x - k.x) ** 2 + (b.y - k.y) ** 2; if (d < bd) { bd = d; best = p; } }
      this._pocket(b, best);
    }
  }

  _pocket(b, index) {
    const sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
    b.state = BallState.POCKETED; b.pocketIndex = index; b.sinkT = 0;
    b.fallX = b.x; b.fallY = b.y; b.stop();
    this.events.push(PhysicsEvent.POCKET, b.id, index, sp, this.pockets[index].x, this.pockets[index].y);
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
