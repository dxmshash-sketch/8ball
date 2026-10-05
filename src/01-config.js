'use strict';

/* =====================================================================
   01 · CONFIG & UTIL
   Semua angka "ajaib" ada di sini. Satuan dunia: 1 unit ≈ 1,27 mm
   (meja 9-kaki = 2000 × 1000 unit, bola berdiameter 44 unit).
   ===================================================================== */

/* ---------------------------------------------------------------------
   Profil meja — sumber kebenaran geometri.
   CONFIG.table akan diisi otomatis dari TABLE_PROFILES.standard.table.
   --------------------------------------------------------------------- */
 const TABLE_PROFILES = {
  standard: {
    id: 'standard',
    name: '8 Ball Pool',
    desc: 'Miniclip-inspired 8 Ball Pool table geometry.',
    table: {
      // ============================================================
      // WORLD / PLAYFIELD
      // ============================================================
      width: 1600,
      height: 728,

      // ============================================================
      // TABLE STRUCTURE
      // ============================================================
      rail: 40,
      cushion: 20,

      // ============================================================
      // BALL
      // ============================================================
      ballRadius: 15,

      // ============================================================
      // POCKET GEOMETRY
      // ============================================================
      cornerMouth: 52,
      cornerThroat: 60,

      sideMouth: 50,
      sideThroat: 56,

      // ============================================================
      // BREAK / RACK
      // ============================================================
      headStringX: 400,
      footSpotX: 1200,

      // ============================================================
      // REFERENCE MARKERS
      // ============================================================
      headSpotX: 400,
      footSpotY: 364,

      // ============================================================
      // POCKET CENTERS
      // ============================================================
      pockets: {
        topLeft: {
          x: 0,
          y: 0,
          type: 'corner',
        },

        topSide: {
          x: 800,
          y: 0,
          type: 'side',
        },

        topRight: {
          x: 1600,
          y: 0,
          type: 'corner',
        },

        bottomLeft: {
          x: 0,
          y: 728,
          type: 'corner',
        },

        bottomSide: {
          x: 800,
          y: 728,
          type: 'side',
        },

        bottomRight: {
          x: 1600,
          y: 728,
          type: 'corner',
        },
      },

      // ============================================================
      // RACK
      // ============================================================
      rack: {
        balls: 15,
        rows: 5,

        // Apex ball points toward head of table.
        apexX: 1200,

        // Center of table.
        centerY: 364,

        // 8-ball goes in center of rack.
        eightBallRow: 3,
        eightBallIndex: 1,

        // Ball diameter = 30.
        spacing: 30.05,
      },
    },
  },
    american: {
    id: 'american',
    name: 'American',
    desc: 'Meja sedang 880×440, kantong bundar — dinamis dan tetap menantang.',
    table: {
      width: 880, height: 440,
      rail: 31,
      cushion: 13,
      ballRadius: 11.5,
      cornerMouth: 48, cornerThroat: 38,
      sideMouth: 44,  sideThroat: 32,
      headStringX: 220, footSpotX: 660,
    },
  },
};

const CONFIG = {
  /* table diisi dari TABLE_PROFILES.standard (single source of truth). */
  table: Object.assign({}, TABLE_PROFILES.standard.table),
  tableId: 'standard',

  // physics: {
  //   // ============================================================
  //   // CORE SIMULATION
  //   // ============================================================
  //   fixedStep: 1 / 300,
  //   maxStepsPerFrame: 14,
  //   maxTravelFraction: 0.4,
  //   maxSubsteps: 8,

  //   // ============================================================
  //   // CLOTH / SLIDING
  //   // Bola baru ditembak akan sedikit slip lalu masuk rolling.
  //   // ============================================================
  //   slidingAccel: 850,

  //   // ============================================================
  //   // ROLLING
  //   // 28   = kehilangan kecepatan konstan
  //   // 0.14 = drag berdasarkan kecepatan
  //   // Kombinasi ini membuat bola terasa panjang tapi tetap berhenti natural.
  //   // ============================================================
  //   rollingDecel: 28,
  //   rollingDrag: 0.14,
  //   stopSpeed: 2.5,
  //   slideEpsilon: 2.4,

  //   // ============================================================
  //   // SIDE SPIN
  //   // ============================================================
  //   sideSpinDecayConst: 20,
  //   sideSpinDecayRate: 0.5,
  //   sideSpinStopped: 6,
  //   sideSpinStop: 0.4,

  //   // ============================================================
  //   // BALL COLLISION
  //   // ============================================================
  //   ballRestitution: 0.96,
  //   ballFriction: 0.06,

  //   // ============================================================
  //   // CUSHION / RAIL
  //   // ============================================================
  //   cushionRestitution: 0.84,
  //   cushionSpeedLoss: 0.000015,
  //   cushionMinRestitution: 0.68,
  //   cushionFriction: 0.17,
  //   cushionSpinKeep: 0.58,

  //   // ============================================================
  //   // SHOT
  //   // ============================================================
  //   maxShotSpeed: 5800,
  //   maxSpinOffset: 0.75,       // 0.5 = normal, 1.0 = ekstrem
  //   shotTimeoutSeconds: 30,
  // },
  physics: {
  // Physics 240 Hz sudah sangat halus untuk billiard
  fixedStep: 1 / 240,

  // Jangan terlalu banyak mengejar physics ketika frame drop
  maxStepsPerFrame: 8,

  // Collision tunneling protection
  maxTravelFraction: 0.35,
  maxSubsteps: 6,

  // --------------------------------
  // BALL MOVEMENT
  // --------------------------------

  slidingAccel: 900,

  rollingDecel: 24,

  rollingDrag: 0.10,

  stopSpeed: 1.5,

  slideEpsilon: 1.8,

  // --------------------------------
  // SPIN
  // --------------------------------

  sideSpinDecayConst: 18,

  sideSpinDecayRate: 0.45,

  sideSpinStopped: 4,

  sideSpinStop: 0.25,

  // --------------------------------
  // BALL COLLISION
  // --------------------------------

  ballRestitution: 0.97,

  ballFriction: 0.045,

  // --------------------------------
  // CUSHION
  // --------------------------------

  cushionRestitution: 0.88,

  cushionSpeedLoss: 0.00001,

  cushionMinRestitution: 0.72,

  cushionFriction: 0.12,

  cushionSpinKeep: 0.62,

  // --------------------------------
  // SHOT
  // --------------------------------

  maxShotSpeed: 5800,

  maxSpinOffset: 0.75,

  shotTimeoutSeconds: 30,
},
  rules: {
    turnSeconds: 35, breakSeconds: 45, foulBannerSeconds: 1.7,
    breakMinCushionBalls: 4,
    matchmakingSeconds: { bot: 0.9, local: 0.4, online: 2.4 },
  },

  aim: {
    pullMax: 90,
    cueLengthRatio: 0.75,
    cueGap: 5,
    cueAnimSeconds: 0.08,
    fineRate: 0.32,
    keyStep: 0.02,
    keyStepFine: 0.004,
  },

  bots: {
    easy:   { name: 'Dewi', level: 2, aimSigma: 0.030, powerSigma: 0.14, think: [1.1, 2.0], pickTop: 3, breakPower: 0.82, reward: 60 },
    medium: { name: 'Rio',  level: 5, aimSigma: 0.012, powerSigma: 0.07, think: [1.3, 2.4], pickTop: 2, breakPower: 0.95, reward: 100 },
    hard:   { name: 'Bima', level: 9, aimSigma: 0.004, powerSigma: 0.03, think: [1.5, 2.6], pickTop: 1, breakPower: 1.0,  reward: 160 },
  },

  onlineOpponents: ['Ayu_88', 'Kevin.R', 'Nadya', 'Fajar_pool', 'Tasya'],

  colors: {
    balls: [null, '#f2c21c', '#1f56c4', '#d92d2d', '#6a2fa0', '#ee7a1c', '#1f8f4e', '#7a1f2a', '#15131a'],
  },
};

/* ---------------------------------------------------------------------
   applyTableProfile(id)
   Mengganti CONFIG.table/physics/aim di tempat. Fisika linier (kecepatan,
   percepatan gesek) diskalakan mengikuti panjang meja, sedangkan koefisien
   tak berdimensi (restitution, friction) dibiarkan tetap.
   --------------------------------------------------------------------- */
const PHYSICS_BASE = Object.assign({}, CONFIG.physics);
const AIM_BASE = Object.assign({}, CONFIG.aim);

function applyTableProfile(id) {
  const p = TABLE_PROFILES[id] || TABLE_PROFILES.standard;
  const k = p.table.width / TABLE_PROFILES.standard.table.width;

  CONFIG.table = Object.assign({}, p.table);
  CONFIG.tableId = p.id;

  const P = Object.assign({}, PHYSICS_BASE);
  for (const key of ['maxShotSpeed', 'slidingAccel', 'rollingDecel', 'stopSpeed', 'slideEpsilon']) {
    P[key] = PHYSICS_BASE[key] * k;
  }
  P.cushionSpeedLoss = PHYSICS_BASE.cushionSpeedLoss / k;
  CONFIG.physics = P;

  CONFIG.aim = Object.assign({}, AIM_BASE, { pullMax: AIM_BASE.pullMax * k });

  return CONFIG.table;
}

/* ---------------------------------------------------------------------
   UTIL — helper matematika kecil.
   --------------------------------------------------------------------- */
const Util = {
  clamp: (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v),
  lerp: (a, b, t) => a + (b - a) * t,
  wrapAngle(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; },
  lerpAngle(a, b, t) { return a + Util.wrapAngle(b - a) * t; },
  smooth(t) { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); },
  easeOutCubic(t) { t = t < 0 ? 0 : t > 1 ? 1 : t; return 1 - Math.pow(1 - t, 3); },
  hexToRgb(hex) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; },
};

/* ---------------------------------------------------------------------
   RNG deterministik (mulberry32) — dipakai agar rack identik di semua klien.
   --------------------------------------------------------------------- */
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

  gauss() {
    let u = 0, v = 0;
    while (u === 0) u = this.next();
    v = this.next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }
}

/* ---------------------------------------------------------------------
   CATATAN: THEME dideklarasikan di `13-ui.js` (BLACK CHROME — design tokens).
   Jangan deklarasikan `const THEME` di sini — akan bentrok (redeclare const).
   --------------------------------------------------------------------- */