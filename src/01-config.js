'use strict';

/* =====================================================================
   01 · CONFIG & UTIL
   Semua angka "ajaib" ada di sini. Satuan dunia: 1 unit ≈ 1,27 mm
   (meja 9-kaki = 2000 × 1000 unit, bola berdiameter 44 unit).
   ===================================================================== */
const CONFIG = {
  table: {
    // Geometri mengikuti brief: playfield 1600×728 (≈2.2:1), bola Ø30, rail kayu 56 + cushion 24.
    // Catatan: brief menulis outer 1760×800, tetapi 728 + 2×(56+24) = 888. Ubah `rail`/`cushion` di sini bila ingin lain.
    width: 1600, height: 728, rail: 56, cushion: 24, ballRadius: 15,
    cornerMouth: 58, cornerThroat: 44, sideMouth: 52, sideThroat: 34,
    headStringX: 400, footSpotX: 1200,
  },
  physics: {
    fixedStep: 1 / 240, maxStepsPerFrame: 14, maxTravelFraction: 0.4, maxSubsteps: 8,
    slidingAccel: 1200,          // unit/s² saat bola meluncur di kain
    rollingDecel: 72,            // perlambatan konstan saat menggelinding
    rollingDrag: 0.45,           // perlambatan proporsional kecepatan (1/s)
    stopSpeed: 7, slideEpsilon: 2.4,
    sideSpinDecayConst: 30, sideSpinDecayRate: 0.7, sideSpinStopped: 7, sideSpinStop: 0.5,
    ballRestitution: 0.96, ballFriction: 0.05,
    cushionRestitution: 0.9, cushionSpeedLoss: 0.00005, cushionMinRestitution: 0.55,
    cushionFriction: 0.15, cushionSpinKeep: 0.55,
    maxShotSpeed: 4960, maxSpinOffset: 0.5,
    shotTimeoutSeconds: 30,
  },
  rules: {
    turnSeconds: 35, breakSeconds: 45, foulBannerSeconds: 1.7,
    breakMinCushionBalls: 4, matchmakingSeconds: { bot: 0.9, local: 0.4, online: 2.4 },
  },
  aim: { pullMax: 90, cueLengthRatio: 0.75, cueGap: 5, cueAnimSeconds: 0.08, fineRate: 0.32, keyStep: 0.02, keyStepFine: 0.004 },
  bots: {
    easy:   { name: 'Dewi',  level: 2, aimSigma: 0.030, powerSigma: 0.14, think: [1.1, 2.0], pickTop: 3, breakPower: 0.82, reward: 60 },
    medium: { name: 'Rio',   level: 5, aimSigma: 0.012, powerSigma: 0.07, think: [1.3, 2.4], pickTop: 2, breakPower: 0.95, reward: 100 },
    hard:   { name: 'Bima',  level: 9, aimSigma: 0.004, powerSigma: 0.03, think: [1.5, 2.6], pickTop: 1, breakPower: 1.0,  reward: 160 },
  },
  onlineOpponents: ['Ayu_88', 'Kevin.R', 'Nadya', 'Fajar_pool', 'Tasya'],
  colors: {
    balls: [null, '#f2c21c', '#1f56c4', '#d92d2d', '#6a2fa0', '#ee7a1c', '#1f8f4e', '#7a1f2a', '#15131a'],
  },
};

/* ---------------- profil meja ----------------
   Dua ukuran meja per pertandingan. `applyTableProfile` mengganti CONFIG.table/physics/aim di tempat; fisika (kecepatan,
   percepatan gesek) diskalakan mengikuti panjang meja sehingga power 100% menempuh proporsi meja yang sama. */
const TABLE_PROFILES = {
  standard: { id: 'standard', name: 'Standar', desc: 'Meja penuh 1600×728. Ukuran saat ini.',
    table: { width: 1600, height: 728, rail: 56, cushion: 24, ballRadius: 15, cornerMouth: 58, cornerThroat: 44, sideMouth: 52, sideThroat: 34, headStringX: 400, footSpotX: 1200 } },
  american: { id: 'american', name: 'American', desc: 'Meja sedang 880×400, kantong bundar lebar (≥ 2× diameter bola) — lebih mudah dan lebih cepat.',
    table: { width: 880, height: 400, rail: 31, cushion: 13, ballRadius: 13, cornerMouth: 74, cornerThroat: 54, sideMouth: 68, sideThroat: 54, headStringX: 220, footSpotX: 660 } },
};
const PHYSICS_BASE = Object.assign({}, CONFIG.physics), AIM_BASE = Object.assign({}, CONFIG.aim);
function applyTableProfile(id) {
  const p = TABLE_PROFILES[id] || TABLE_PROFILES.standard, k = p.table.width / TABLE_PROFILES.standard.table.width;
  CONFIG.table = Object.assign({}, p.table); CONFIG.tableId = p.id;
  const P = Object.assign({}, PHYSICS_BASE);
  for (const key of ['maxShotSpeed', 'slidingAccel', 'rollingDecel', 'stopSpeed', 'slideEpsilon']) P[key] = PHYSICS_BASE[key] * k;
  P.cushionSpeedLoss = PHYSICS_BASE.cushionSpeedLoss / k;
  CONFIG.physics = P; CONFIG.aim = Object.assign({}, AIM_BASE, { pullMax: AIM_BASE.pullMax * k });
  return CONFIG.table;
}
CONFIG.tableId = 'standard';

const Util = {
  clamp: (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v),
  lerp: (a, b, t) => a + (b - a) * t,
  wrapAngle(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; },
  lerpAngle(a, b, t) { return a + Util.wrapAngle(b - a) * t; },
  smooth(t) { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); },
  easeOutCubic(t) { t = t < 0 ? 0 : t > 1 ? 1 : t; return 1 - Math.pow(1 - t, 3); },
  hexToRgb(hex) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; },
};

/** PRNG deterministik (mulberry32) — dipakai agar rack identik di semua klien. */
class Rng {
  constructor(seed) { this.s = seed >>> 0; }
  next() {
    this.s = (this.s + 0x6D2B79F5) | 0;
    let t = Math.imul(this.s ^ (this.s >>> 15), 1 | this.s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a, b) { return a + (b - a) * this.next(); }
  int(n) { return Math.floor(this.next() * n); }
  gauss() { let u = 0, v = 0; while (u === 0) u = this.next(); v = this.next(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = this.int(i + 1); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; }
}
