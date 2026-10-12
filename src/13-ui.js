/* =====================================================================
   13 · UI CORE — navigasi, HUD, efek, input. Halaman ada di 14-pages.js & 15-dev.js
   ===================================================================== */


/* =====================================================================
   SYSTEM UI — terminal loader, notification stack, glitch text, log
   ===================================================================== */

/** Terminal boot loader — cinematic, no generic spinners. */
class TerminalLoader {
  constructor(root) {
    this.el = document.createElement('div');
    this.el.id = 'sysBoot';
    this.el.innerHTML = `
      <div class="boot">
        <div class="boot-head"><b>BLACK CHROME · v3</b><span id="sysClock">--:--:--</span></div>
        <div id="sysSteps"></div>
        <div class="boot-foot"><span>READY <b id="sysReady">0%</b></span><span class="cursor"></span></div>
      </div>`;
    (root || document.body).appendChild(this.el);
    this.stepsEl = this.el.querySelector('#sysSteps');
    this.readyEl = this.el.querySelector('#sysReady');
    this.clockEl = this.el.querySelector('#sysClock');
    this._clockTimer = setInterval(() => {
      const d = new Date();
      this.clockEl.textContent = String(d.getHours()).padStart(2,'0') + ':' +
        String(d.getMinutes()).padStart(2,'0') + ':' + String(d.getSeconds()).padStart(2,'0');
    }, 1000);
  }
  _bar(pct, width = 10) {
    const filled = Math.round(pct * width);
    return '[' + '█'.repeat(filled) + '░'.repeat(width - filled) + ']';
  }
  async run(steps) {
    const reduced = matchMedia('(prefers-reduced-motion:reduce)').matches;
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      const line = document.createElement('div');
      line.className = 'boot-line';
      line.innerHTML = `<span class="label">${s.label}</span><span class="val"><span class="bar">${this._bar(0)}</span> <span class="pct">0%</span></span>`;
      this.stepsEl.appendChild(line);
      // force reflow supaya transisi opacity jalan
      void line.offsetWidth;
      line.classList.add('on');
      const bar = line.querySelector('.bar');
      const pctEl = line.querySelector('.pct');
      const total = reduced ? 60 : (s.ms || 420);
      const t0 = performance.now();
      await new Promise((res) => {
        const tick = (now) => {
          const k = Math.min(1, (now - t0) / total);
          const eased = 1 - Math.pow(1 - k, 3);
          bar.textContent = this._bar(eased);
          pctEl.textContent = Math.round(eased * 100) + '%';
          this.readyEl.textContent = Math.round(((i + eased) / steps.length) * 100) + '%';
          if (k < 1) requestAnimationFrame(tick); else res();
        };
        requestAnimationFrame(tick);
      });
      // Baris terakhir kadang ganti jadi "ACCESS GRANTED" jika s.granted
      if (s.granted) {
        bar.innerHTML = '<span class="f">██████████</span>';
        pctEl.textContent = s.grantedText || 'OK';
      }
    }
  }
  close() {
    clearInterval(this._clockTimer);
    this.el.classList.add('done');
    setTimeout(() => this.el.remove(), 600);
  }
}

/** Stacked notifications (top-right). max 4, auto-dismiss. */
class NotificationCenter {
  constructor(root) {
    this.el = document.createElement('div');
    this.el.id = 'sysNotes';
    (root || document.body).appendChild(this.el);
    this.queue = [];
  }
  push({ title = 'SYSTEM', body = '', kind = '', ttl = 4200 } = {}) {
    if (!body) return;
    const note = document.createElement('div');
    note.className = 'sys-note ' + kind;
    const stamp = new Date().toTimeString().slice(0,8);
    note.innerHTML = `<div class="n-head"><b>${title}</b><span>${stamp}</span></div><div class="n-body">${body}</div>`;
    this.el.appendChild(note);
    this.queue.push(note);
    while (this.queue.length > 4) this._remove(this.queue[0]);
    const t = setTimeout(() => this._remove(note), ttl);
    note.addEventListener('click', () => { clearTimeout(t); this._remove(note); });
  }
  _remove(note) {
    const i = this.queue.indexOf(note);
    if (i >= 0) this.queue.splice(i, 1);
    if (!note.parentNode) return;
    note.classList.add('out');
    setTimeout(() => note.remove(), 320);
  }
}

/** Sparse glitch — call sparingly. */
function glitchText(text, intensity = 1, opts = {}) {
  const cls = 'glitch' + (intensity >= 2 ? ' glitch-hot' : '');
  const tag = opts.tag || 'span';
  return `<${tag} class="${cls}" data-text="${esc(text)}">${esc(text)}</${tag}>`;
}

/** Random system log — displays ambient log lines during matches. */
class SystemLog {
  constructor(root) {
    this.el = document.createElement('div');
    this.el.id = 'sysLog';
    (root || document.body).appendChild(this.el);
    this.lines = [];
    this._timer = 0;
    this._phrases = [
      ['NET','ping [server:eu-west-1] <b>14ms</b>','ok'],
      ['AI','neural target lock <b>acquired</b>',''],
      ['PKT','stream integrity <b>100%</b>','ok'],
      ['SIG','spectrum clean',''],
      ['SHOT','ballistic model <b>v3.4</b>',''],
      ['DATA','sync window <b>+12ms</b>',''],
      ['SYS','thermal nominal <b>42°C</b>',''],
      ['KRN','render pipeline <b>ready</b>',''],
      ['NET','jitter <b>3ms</b>','ok'],
      ['ERR','packet 0x2A dropped','err'],
    ];
  }
  start(interval = 5200) {
    if (this._timer) return;
    const fire = () => {
      const [tag, msg, kind] = this._phrases[Math.floor(Math.random()*this._phrases.length)];
      const line = document.createElement('div');
      line.className = 'line ' + kind;
      const t = new Date().toTimeString().slice(0,8);
      line.innerHTML = `<b>[${t}] ${tag}</b> · ${msg}`;
      this.el.appendChild(line);
      this.lines.push(line);
      if (this.lines.length > 4) this.lines.shift().remove();
    };
    fire();
    this._timer = setInterval(fire, interval);
  }
  stop() {
    clearInterval(this._timer); this._timer = 0;
    this.lines.forEach(l => l.remove()); this.lines = [];
  }
}

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const COIN_SVG = '<svg class="coin" viewBox="0 0 22 22"><circle cx="11" cy="11" r="10" fill="#F4C542"/><circle cx="11" cy="11" r="6.5" fill="none" stroke="#b8850c" stroke-width="1.6"/></svg>';
const SHIELD_SVG = '<svg viewBox="0 0 30 34"><path d="M15 1l12 4.5v10.2c0 8.1-5.3 14.4-12 17.3C8.3 30.1 3 23.8 3 15.7V5.5L15 1z" fill="#3b2a00" stroke="#F7C948" stroke-width="2"/><rect x="13" y="9" width="4" height="4" rx="1" fill="#F7C948"/><rect x="13.5" y="14" width="3" height="10" rx="1.2" fill="#F7C948"/></svg>';
const ICONS = {
  gift: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 9h18v4H3zM4 14h16v7H4zM11 9h2v12h-2z" opacity=".95"/><path d="M12 9C9 9 7 7.5 7.5 5.8 8.2 3.8 11 5 12 9zM12 9c3 0 5-1.5 4.5-3.2C15.8 3.8 13 5 12 9z"/></svg>',
  rank: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 21h5V11H3zM9.5 21h5V4h-5zM16 21h5v-7h-5z"/></svg>',
  table: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M2 7h20v10H2z" opacity=".55"/><path d="M4 9h16v6H4z"/><circle cx="4" cy="9" r="1.6"/><circle cx="20" cy="9" r="1.6"/><circle cx="4" cy="15" r="1.6"/><circle cx="20" cy="15" r="1.6"/></svg>',
  cue: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M3.5 20.5L19 5"/><path d="M19.5 4.5l1-1" stroke-width="3.4"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="8" r="4.2"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7z"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1" stroke-linecap="round"/></svg>',
  friend: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="8" cy="8" r="3.4"/><path d="M2 20c0-3.6 2.8-5.8 6-5.8s6 2.2 6 5.8z"/><circle cx="17.5" cy="9" r="2.6" opacity=".7"/><path d="M22 20c0-2.7-1.9-4.6-4.3-5.2 1.5 1.2 2.3 2.9 2.3 5.2z" opacity=".7"/></svg>',
  market: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 8l1.5-4h15L21 8z" opacity=".7"/><path d="M4 8h16v12H4z" opacity=".3"/><path d="M4 8h16v2.2A3 3 0 0114 10a3 3 0 01-6 0 3 3 0 01-6 .2z"/></svg>',
  dev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4L2 12l6 8M16 4l6 8-6 8"/></svg>',
};
function avatarHTML(av, size, badgeId) {
  const col = AVATAR_COLORS[(av.color | 0) % AVATAR_COLORS.length], fr = FRAMES[av.frame] || FRAMES.none, b = badgeId ? BADGE_DEFS.find((x) => x.id === badgeId) : null;
  return '<div class="avx" data-frame="' + (av.frame || 'none') + '" style="' + (size ? '--s:' + size + 'px;' : '') + '--c1:' + col[0] + ';--c2:' + col[1] + ';--frame:' + fr.color + '"><svg class="sym" viewBox="0 0 24 24">' + (SYMBOLS[av.sym] || SYMBOLS.ball8) + '</svg>' + (b ? '<span class="bdg">' + badgeHTML(b, '100%') + '</span>' : '') + '</div>';
}
function badgeHTML(def, size) {
  return '<svg class="bdgx" width="' + size + '" height="' + size + '" viewBox="0 0 32 32"><path d="M16 2l12 4.5v9c0 7.5-5 12.6-12 15.5C9 28.1 4 23 4 15.5v-9z" fill="' + TIER_COLOR[def.tier] + '" stroke="rgba(0,0,0,.45)" stroke-width="1.6"/><g transform="translate(8 7.5) scale(.67)" style="color:#2a1c00">' + SYMBOLS[def.icon] + '</g></svg>';
}
function countUp(el, from, to, ms, fmt) {
  const t0 = performance.now(); fmt = fmt || fmtCoins;
  const step = (now) => { const k = Util.easeOutCubic((now - t0) / ms); el.textContent = fmt(from + (to - from) * k); if (k < 1) requestAnimationFrame(step); else el.textContent = fmt(to); };
  requestAnimationFrame(step);
}

/** Konfeti ringan (satu canvas overlay, berhenti otomatis). */
// class Fx {
//   constructor(canvas) { t
//     his.cv = canvas; 
//     this.ctx = canvas.getContext('2d'); 
//     this.p = []; 
//     this.on = false; 
//   }

//   burst(x, y, n, spread) {
//     const cols = ['#F4C542', '#fff2b0', '#32D74B', '#57BFEA', '#FF5A5F', '#d99cff'];
//     for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, s = (2 + Math.random() * 9) * (spread || 1); this.p.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 4, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, w: 5 + Math.random() * 6, h: 3 + Math.random() * 5, life: 1, c: cols[i % cols.length] }); }
//     if (!this.on) { this.on = true; this._resize(); requestAnimationFrame((t) => this._loop(t)); }
//   }
//   _resize() { const d = Math.min(window.devicePixelRatio || 1, 2); this.cv.width = innerWidth * d; this.cv.height = innerHeight * d; this.d = d; }
//   _loop() {
//     const c = this.ctx, d = this.d; c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, this.cv.width, this.cv.height); c.setTransform(d, 0, 0, d, 0, 0);
//     for (const q of this.p) { q.vy += 0.28; q.x += q.vx; q.y += q.vy; q.vx *= 0.985; q.r += q.vr; q.life -= 0.011; c.save(); c.globalAlpha = Math.max(0, q.life); c.translate(q.x, q.y); c.rotate(q.r); c.fillStyle = q.c; c.fillRect(-q.w / 2, -q.h / 2, q.w, q.h); c.restore(); }
//     this.p = this.p.filter((q) => q.life > 0 && q.y < innerHeight + 40);
//     if (this.p.length) requestAnimationFrame(() => this._loop()); else { this.on = false; c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, this.cv.width, this.cv.height); }
//   }
// }
class Fx {
  constructor(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.p = [];
    this.on = false;
    this._dpr = 1;
  }

  _resize() {
    const d = Math.min(window.devicePixelRatio || 1, 2);
    this.cv.width = innerWidth * d;
    this.cv.height = innerHeight * d;
    this._dpr = d;
  }

  // /** Ledakan partikel dari titik (x, y). */
  // burst(x, y, n, spread) {
  //   if (!this.on) { this.on = true; this._resize(); requestAnimationFrame((t) => this._loop(t)); }
  //   const palette = [
  //     '#F2C14E', '#FFE9A8',        // gold
  //     '#3BA8FF', '#4FC3FF',        // blue
  //     '#9FB3C8',                   // silver
  //     '#FF5A6A', '#32D583', '#D99CFF',  // accent
  //     '#FFFFFF',
  //   ];
  //   for (let i = 0; i < n; i++) {
  //     const a = Math.random() * Math.PI * 2;
  //     const speed = (3 + Math.random() * 11) * (spread || 1);
  //     const type = Math.random();
  //     // 60% rect, 25% ribbon, 15% circle
  //     let shape = 'rect';
  //     if (type > 0.6 && type < 0.85) shape = 'ribbon';
  //     else if (type >= 0.85) shape = 'circle';

  //     this.p.push({
  //       x, y,
  //       vx: Math.cos(a) * speed,
  //       vy: Math.sin(a) * speed - 5,
  //       rot: Math.random() * Math.PI * 2,
  //       vr: (Math.random() - 0.5) * 0.45,
  //       w: 4 + Math.random() * 8,
  //       h: shape === 'ribbon' ? 2 + Math.random() * 3 : 3 + Math.random() * 6,
  //       life: 1,
  //       decay: 0.008 + Math.random() * 0.008,
  //       c: palette[(Math.random() * palette.length) | 0],
  //       shape,
  //       swayPhase: Math.random() * Math.PI * 2,
  //       swayAmp: 0.3 + Math.random() * 0.8,
  //     });
  //   }
  // }
burst(x, y, n, spread) {
  if (!this.on) { this.on = true; this._resize(); requestAnimationFrame((t) => this._loop(t)); }
  const palette = [
    '#F2C14E', '#FFE9A8', '#FFD34E',   // gold
    '#3BA8FF', '#4FC3FF',               // blue
    '#FFFFFF', '#FFEEDD',               // white
    '#FF5A6A', '#32D583', '#D99CFF',    // accent
  ];
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const speed = (3 + Math.random() * 13) * (spread || 1);
    const r = Math.random();
    const shape = r < 0.55 ? 'rect' : r < 0.85 ? 'ribbon' : 'circle';
    this.p.push({
      x, y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed - 6,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.55,
      w: 4 + Math.random() * 8,
      h: shape === 'ribbon' ? 2 + Math.random() * 3 : 3 + Math.random() * 6,
      life: 1,
      decay: 0.007 + Math.random() * 0.008,
      c: palette[(Math.random() * palette.length) | 0],
      shape,
      swayPhase: Math.random() * Math.PI * 2,
      swayAmp: 0.3 + Math.random() * 0.9,
    });
  }
}
  /** Hujan dari atas layar (koin / confetti). */
  rain(n) {
    if (!this.on) { this.on = true; this._resize(); requestAnimationFrame((t) => this._loop(t)); }
    const W = innerWidth;
    const palette = ['#F2C14E', '#FFE9A8', '#FFD34E', '#B8850C', '#FFFFFF'];
    for (let i = 0; i < n; i++) {
      const isCoin = Math.random() < 0.55;
      this.p.push({
        x: Math.random() * W,
        y: -20 - Math.random() * 120,
        vx: (Math.random() - 0.5) * 1.6,
        vy: 1.5 + Math.random() * 3,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.35,
        w: isCoin ? 8 + Math.random() * 6 : 5 + Math.random() * 8,
        h: isCoin ? 8 + Math.random() * 6 : 3 + Math.random() * 5,
        life: 1,
        decay: 0.003 + Math.random() * 0.004,
        c: palette[(Math.random() * palette.length) | 0],
        shape: isCoin ? 'coin' : 'ribbon',
        swayPhase: Math.random() * Math.PI * 2,
        swayAmp: 0.4 + Math.random() * 1.2,
      });
    }
  }

  // _loop() {
  //   const c = this.ctx, d = this._dpr;
  //   c.setTransform(1, 0, 0, 1, 0, 0);
  //   c.clearRect(0, 0, this.cv.width, this.cv.height);
  //   c.setTransform(d, 0, 0, d, 0, 0);

  //   const t = performance.now() * 0.001;

  //   for (const q of this.p) {
  //     // Fisika
  //     q.vy += 0.32;                        // gravity
  //     q.vx *= 0.992;                       // air drag
  //     q.vy *= 0.992;
  //     // Sway (efek kertas melayang)
  //     q.x += q.vx + Math.sin(t * 2 + q.swayPhase) * q.swayAmp;
  //     q.y += q.vy;
  //     q.rot += q.vr;
  //     q.life -= q.decay;
  //     if (q.life < 0) q.life = 0;

  //     // Fade + scale kecil menuju akhir
  //     const alpha = Math.max(0, Math.min(1, q.life * 1.4));
  //     const scale = 0.7 + q.life * 0.3;

  //     c.save();
  //     c.globalAlpha = alpha;
  //     c.translate(q.x, q.y);
  //     c.rotate(q.rot);
  //     c.scale(scale, scale);
  //     c.fillStyle = q.c;

  //     if (q.shape === 'circle') {
  //       c.beginPath();
  //       c.arc(0, 0, q.w / 2, 0, Math.PI * 2);
  //       c.fill();
  //     } else if (q.shape === 'coin') {
  //       // Koin: circle emas dengan rim gelap
  //       c.beginPath();
  //       c.arc(0, 0, q.w / 2, 0, Math.PI * 2);
  //       c.fill();
  //       c.strokeStyle = 'rgba(0,0,0,0.35)';
  //       c.lineWidth = 1.2;
  //       c.stroke();
  //       // Highlight kecil
  //       c.fillStyle = 'rgba(255,255,255,0.55)';
  //       c.beginPath();
  //       c.arc(-q.w * 0.18, -q.h * 0.18, q.w * 0.14, 0, Math.PI * 2);
  //       c.fill();
  //     } else if (q.shape === 'ribbon') {
  //       // Ribbon: rect tipis panjang
  //       c.fillRect(-q.w / 2, -q.h / 2, q.w, q.h);
  //     } else {
  //       // Rect default
  //       c.fillRect(-q.w / 2, -q.h / 2, q.w, q.h);
  //     }

  //     c.restore();
  //   }

  //   // Buang partikel yang mati atau di luar layar bawah
  //   this.p = this.p.filter((q) => q.life > 0 && q.y < innerHeight + 60 && q.x > -80 && q.x < innerWidth + 80);

  //   if (this.p.length) {
  //     requestAnimationFrame(() => this._loop());
  //   } else {
  //     this.on = false;
  //     c.setTransform(1, 0, 0, 1, 0, 0);
  //     c.clearRect(0, 0, this.cv.width, this.cv.height);
  //   }
  // }

  _loop() {
  const c = this.ctx, d = this._dpr || 1;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, this.cv.width, this.cv.height);
  c.setTransform(d, 0, 0, d, 0, 0);
  const t = performance.now() * 0.001;

  for (const q of this.p) {
    q.vy += 0.32;
    q.vx *= 0.992; q.vy *= 0.992;
    q.x += q.vx + Math.sin(t * 2 + q.swayPhase) * q.swayAmp;
    q.y += q.vy;
    q.rot += q.vr;
    q.life -= q.decay;
    if (q.life < 0) q.life = 0;

    const alpha = Math.max(0, Math.min(1, q.life * 1.4));
    const scale = 0.7 + q.life * 0.3;

    c.save();
    c.globalAlpha = alpha;
    c.translate(q.x, q.y);
    c.rotate(q.rot);
    c.scale(scale, scale);
    c.fillStyle = q.c;

    if (q.shape === 'circle') {
      c.beginPath(); c.arc(0, 0, q.w / 2, 0, Math.PI * 2); c.fill();
    } else if (q.shape === 'coin') {
      c.beginPath(); c.arc(0, 0, q.w / 2, 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1.2; c.stroke();
      c.fillStyle = 'rgba(255,255,255,.55)';
      c.beginPath(); c.arc(-q.w*.18, -q.h*.18, q.w*.14, 0, Math.PI * 2); c.fill();
    } else {
      c.fillRect(-q.w / 2, -q.h / 2, q.w, q.h);
    }
    c.restore();
  }

  this.p = this.p.filter((q) =>
    q.life > 0 && q.y < innerHeight + 60 &&
    q.x > -80 && q.x < innerWidth + 80
  );

  if (this.p.length) requestAnimationFrame(() => this._loop());
  else {
    this.on = false;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.cv.width, this.cv.height);
  }
}
}
const PAGE_SCREENS = { menu: 'screenMenu', modes: 'screenModes', settings: 'screenSettings', profile: 'screenProfile', rewards: 'screenRewards', board: 'screenBoard', tables: 'screenTables', cues: 'screenCues', dev: 'screenDev', auth: 'screenAuth', market: 'screenMarket', friend: 'screenFriend' };

class UI {
  constructor(store, audio) {
    this.store = store; this.audio = audio; this.game = null; this.renderer = null; this.board = null; this.fx = new Fx($('fx'));
    this.current = 'screenMenu'; this.stack = []; this.selectedMode = 'bot'; this.selectedDiff = 'medium'; this.selectedBet = 1000;
    this.powerShown = 0.5; this.toastTimer = 0; this.dragPower = false; this.spinDrag = false; this.fineDir = 0; this.fineHold = 0;
    this.spinCtx = $('spinCv').getContext('2d'); this.lastSpin = '';
  }

  attach(game, renderer, board) {
    this.game = game; this.renderer = renderer; this.board = board;
    document.querySelectorAll('[data-ico]').forEach((el) => { el.innerHTML = ICONS[el.dataset.ico] || ''; });
    document.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => { this.click(); this.go(b.dataset.go); }));
    $('chipProfile').addEventListener('click', () => { this.click(); this.go(this.backend && this.backend.currentUser() ? 'profile' : 'auth'); });
    $('btnHelp').addEventListener('click', () => { this.click(); const n = this.store.claimHelp(); if (n) { this.toast('+' + fmtCoins(n) + ' ' + COIN_NAME + ' diterima', 'ok'); this.fx.burst(innerWidth / 2, innerHeight / 2, 60); this.refreshMenu(); } });
    $('btnPause').addEventListener('click', () => { this.click(); game.setPaused(true); });
    $('btnResume').addEventListener('click', () => { this.click(); game.setPaused(false); });
    $('btnPauseSettings').addEventListener('click', () => { this.click(); this.go('settings'); });
    $('btnSettingsBack').addEventListener('click', () => { this.click(); this.store.save(); this.back(); });
    $('btnRestart').addEventListener('click', () => { this.click(); if (!game.restartMatch()) { this.toast('Saldo tidak cukup untuk taruhan yang sama', 'foul'); this.go('modes'); } });
    $('btnQuit').addEventListener('click', () => { this.click(); game.quitToMenu(); });
    $('btnDisc').addEventListener('click', () => { this.click(); if (game.simulateDisconnect()) game.setPaused(false); });
    document.querySelectorAll('.switch').forEach((sw) => sw.addEventListener('click', () => {
      const k = sw.dataset.set, s = this.store.data.settings; s[k] = !s[k]; this.syncSettings(); this.store.save();
      if (k === 'sfx' || k === 'music') { this.audio.unlock(); this.audio.applySettings(); }
    }));
    $('zoomSeg').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; this.store.data.settings.aimZoom = +b.dataset.z; this.store.save(); this.syncSettings(); });
    let armed = 0; $('btnReset').addEventListener('click', () => { if (Date.now() - armed > 4000) { armed = Date.now(); this.toast('Ketuk sekali lagi untuk menghapus SEMUA data', 'foul'); return; } this.store.resetAll(); location.reload(); });
    this.store.onChange((what) => { if (what === 'table') this.renderer.applyTheme(); if (what === 'cueball') this.renderer.applyCueSkin(); if (what === 'coins' || what === 'avatar') this.refreshMenu(); });
    this._bindPower(); this._bindSpin(); this._bindFine(); this.syncSettings(); this.refreshMenu();
     
    attachBackend(backend) {
  this.backend = backend;
  if (typeof backend.onAuthChanged === 'function') {
    backend.onAuthChanged(() => this.refreshMenu());
  }
  if (typeof backend.onDirectoryChanged === 'function') {
    backend.onDirectoryChanged(() => { /* refresh halaman yang menampilkan direktori, mis. render_friend */ });
  }
      // ── System UI bootstrap ──
    this.notes = new NotificationCenter();
    this.syslog = new SystemLog();
    // Glitch pada logo menu (jarang)
    const logo = document.querySelector('#screenMenu .logo');
    if (logo && !matchMedia('(prefers-reduced-motion:reduce)').matches) {
      const apply = () => {
        if (logo.dataset.glitching) return;
        logo.dataset.glitching = '1';
        const raw = logo.textContent;
        logo.innerHTML = glitchText(raw, 2, { tag: 'span' });
        setTimeout(() => { logo.dataset.glitching = ''; logo.textContent = raw; }, 700);
      };
      // Pertama kali setelah 3 detik, lalu tiap 18–34 detik
      setTimeout(apply, 3000);
      const reFire = () => setTimeout(() => { apply(); reFire(); }, 18000 + Math.random()*16000);
      reFire();
    }
    // Boot loader sekali per sesi (sessionStorage)
    if (!sessionStorage.getItem('sysBooted')) {
      const loader = new TerminalLoader();
      const steps = [
        { label: 'INITIALIZING CORE', ms: 380 },
        { label: 'CHECKING SERVER', ms: 520 },
        { label: 'DECRYPTING MODULES', ms: 480 },
        { label: 'VERIFYING SIGNATURE', ms: 420 },
        { label: 'ACCESS GRANTED', ms: 220, granted: true, grantedText: 'OK' },
      ];
      loader.run(steps).then(() => {
        loader.close();
        sessionStorage.setItem('sysBooted', '1');
        this.notes.push({ title: 'READY', body: 'Black Chrome initialized.', kind: 'ok', ttl: 3400 });
      });
    }
    // Hook toast() → notification stack
    const _origToast = this.toast.bind(this);
    this.toast = (msg, kind) => {
      _origToast(msg, kind);              // tetap update #toast lama
      const nk = kind === 'foul' ? 'err' : kind === 'ok' ? 'ok' : '';
      const nt = kind === 'foul' ? 'ALERT' : kind === 'ok' ? 'CONFIRMED' : 'SYSTEM';
      this.notes.push({ title: nt, body: esc(msg), kind: nk });
    };
    // System log aktif saat match
    this._lastState = this.current;
    setInterval(() => {
      const inMatch = this.game && this.game.isActiveMatch && this.game.isActiveMatch();
      if (inMatch && !this.syslog._timer) this.syslog.start(6200);
      if (!inMatch && this.syslog._timer) this.syslog.stop();
    }, 2500);
  }
  click() { this.audio.unlock(); this.audio.play('ui', 0.5); }

  /* ------------------------------ navigasi ------------------------------ */
  show(id, back) {
    if (id === this.current) return;
    const cur = this.current ? $(this.current) : null, next = $(id);
    if (cur) { cur.classList.remove('active'); cur.classList.toggle('left', !back); }
    next.classList.remove('left'); next.classList.add('active'); this.current = id;
  }
  hideAll() { const cur = this.current ? $(this.current) : null; if (cur) cur.classList.remove('active'); this.current = ''; }
  /** true = navigasi diblokir (dan sudah menangani redirect/toast-nya sendiri). Dipakai oleh go() maupun back() agar tombol "kembali" tidak bisa melewati gerbang admin/auth. */
  _gateBlocked(name) {
    if ((name === 'friend' || name === 'market') && this.backend && !this.backend.currentUser()) { this.stack = []; this.requireAuth(name); return true; }
    if (name === 'dev' && !(this.backend && this.backend.isAdmin())) { this.stack = []; this.toast('Halaman Developer khusus admin', 'foul'); this.go('menu'); return true; }
    return false;
  }
  go(name) {
    if (this._gateBlocked(name)) return;
    const id = PAGE_SCREENS[name]; if (!id) return;
    if (this.current) this.stack.push(this.current);
    this._renderPage(name); this.show(id);
  }
  back() {
    const id = this.stack.pop() || 'screenMenu';
    const name = Object.keys(PAGE_SCREENS).find((k) => PAGE_SCREENS[k] === id);
    if (name) this._renderPage(name);
    this.show(id, true);
  }
  _renderPage(name) {
    if (this.current === 'screenDev' && name !== 'dev' && this.dev && this.dev.preview) this.dev.preview.stop();
    if (name === 'menu') this.refreshMenu();
    else if (name === 'settings') this.syncSettings();
    else if (this['render_' + name]) this['render_' + name]();
  }
  syncSettings() {
    const s = this.store.data.settings; document.querySelectorAll('.switch').forEach((sw) => sw.setAttribute('aria-checked', String(!!s[sw.dataset.set])));
    document.querySelectorAll('#zoomSeg button').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.z === (s.aimZoom | 0))));
  }
  refreshMenu() {
    const p = this.store.data.profile, acc = this.backend && this.backend.currentUser();
    if (acc) { $('menuAv').innerHTML = this.accountAvatarHTML(acc, 34); $('menuName').textContent = acc.name; $('menuLevel').textContent = (acc.role === 'admin' ? 'Admin · ' : '') + 'Level ' + this.store.level(); }
    else { $('menuAv').innerHTML = avatarHTML(p.avatar, 34, p.badge); $('menuName').textContent = p.name; $('menuLevel').textContent = 'Tamu — ketuk untuk masuk'; }
    $('menuCoins').textContent = fmtCoins(p.coins);
    $('dotRewards').hidden = !this.store.hasClaimable(); $('btnHelp').hidden = !this.store.helpAvailable();
    $('tileDev').hidden = !(this.backend && this.backend.isAdmin());
  }

  /* ------------------------------ callback dari Game ------------------------------ */
  stateChanged(game, next) {
        if (next === GameState.GAME_OVER && this.notes) {
      const w = game.result && game.result.youWon;
      this.notes.push({
        title: w ? 'VICTORY' : 'DEFEAT',
        body: game.result ? esc(game.result.reason) : 'Match ended.',
        kind: w ? 'ok' : 'err',
        ttl: 5200,
      });
    }
    const S = GameState;
    const inMatch = next !== S.MENU && next !== S.MATCHMAKING;
    $('hud').hidden = next === S.MENU || next === S.MATCHMAKING;
    if (next === S.MENU) { this.stack = []; this.refreshMenu(); this.show('screenMenu', true); return; }
    if (next === S.MATCHMAKING) { this.show('screenMM'); return; }
    if (next === S.GAME_OVER) { $('turnChip').style.display = 'none'; $('tracker').hidden = true; return; }
    if (this.current === 'screenMM' || this.current === 'screenResult') this.hideAll();
    this.refreshPlayers(game);
  }
  showMatchmaking(game) {
    const online = game.mode === 'online';
    $('mmSpin').style.display = 'block'; $('mmTitle').textContent = online ? 'Mencari lawan…' : 'Menyiapkan meja…'; $('mmVs').innerHTML = '';
    $('mmSub').innerHTML = game.bet ? 'Taruhan ' + COIN_SVG + ' <b class="gold">' + fmtCoins(game.bet) + '</b>' : 'Tanpa taruhan';
    if (online) setTimeout(() => {
      if (game.state !== GameState.MATCHMAKING) return;
      $('mmTitle').textContent = 'Lawan ditemukan'; $('mmSpin').style.display = 'none';
      $('mmVs').innerHTML = [0, 1].map((i) => '<div class="side">' + this._seatAvatar(game, i, 64) + '<span>' + esc(game.seats[i].name) + '</span></div>').join('<span class="gold">VS</span>');
    }, game.mmTimer * 550);
    this.refreshPlayers(game);
  }
  _seatAvatar(game, i, size) {
    const p = this.store.data.profile;
    if (game.mode !== 'local' && game.seats[i].control === 'local') return avatarHTML(p.avatar, size, p.badge);
    return avatarHTML(botAvatar(game.seats[i].name), size, null);
  }
  refreshPlayers(game) {
    const seats = game.seats, r = game.rules;
    for (let i = 0; i < 2; i++) {
      $('pn' + i).textContent = seats[i].name; $('lv' + i).textContent = game.mode !== 'local' && seats[i].control === 'local' ? this.store.level() : seats[i].level;
      $('av' + i).innerHTML = this._seatAvatar(game, i, 0);
      const g = game.gameType === '8ball' ? r.groups[i] : null; let html = '', n = 0;
      $('tr' + i).style.display = game.gameType === '8ball' ? '' : 'none';
      if (g) for (const id of r.pocketedIds) if (groupOf(id) === g) { const b = { c: CONFIG.colors.balls[id <= 8 ? id : id - 8], stripe: id > 8 }; html += '<span class="mb' + (b.stripe ? ' stripe' : '') + '" style="--c:' + b.c + '"></span>'; n++; }
      for (; n < 7; n++) html += '<span class="slot"></span>';
      $('tr' + i).innerHTML = html;
    }
    $('pot').textContent = game.bet ? fmtShort(game.bet * 2) : '—'; this._tracker(game);
    $('conn').style.display = game.mode === 'online' ? 'flex' : 'none';
    this.updateBanner(game);
  }
  /** Pelacak 9-ball: bola 1–9, yang sudah masuk meredup, bola target (terkecil) diberi cincin emas. */
  _tracker(game) {
    const el = $('tracker'); if (game.gameType === '8ball') { el.hidden = true; return; }
    const low = game.rules.lowest(); el.hidden = false;
    el.innerHTML = Array.from({ length: 9 }, (_, i) => i + 1).map((id) => '<span class="mb' + (id > 8 ? ' stripe' : '') + (game.rules.pocketedIds.has(id) ? ' off' : '') + (id === low ? ' next' : '') + '" style="--c:' + CONFIG.colors.balls[id <= 8 ? id : id - 8] + '"></span>').join('');
  }
  tableChanged(game) { this.renderer.onTableChanged(); if (this.current === 'screenTables') this.render_tables(); }
  connectionChanged(game, ok) { $('conn').classList.toggle('off', !ok); }
  updateBanner(game) {
    const chip = $('turnChip'), S = GameState, seat = game.seats[game.rules.currentSeat], me = seat && seat.control === 'local' && game.mode !== 'local';
    let txt = '', cls = '';
    switch (game.state) {
      case S.BREAK: txt = me ? 'Break — pecah rack' : seat.name + ' melakukan break'; cls = me ? 'mine' : ''; break;
      case S.PLAYER_TURN: case S.OPPONENT_TURN: txt = game.mode === 'local' ? 'Giliran ' + seat.name : me ? 'Giliranmu' : 'Giliran ' + seat.name; cls = me ? 'mine' : ''; break;
      case S.BALL_IN_HAND: txt = seat.control === 'local' ? 'Tempatkan bola putih' : seat.name + ' menempatkan bola putih'; cls = seat.control === 'local' ? 'mine' : ''; break;
      case S.FOUL: txt = 'Foul'; cls = 'foul'; break;
      default: txt = '';
    }
    if (txt && game.isTurnState() && game.rules.callRequired() && seat.control === 'local') txt += game.aim.call < 0 ? ' · pilih kantong' : ' · kantong ✓';
    chip.textContent = txt; chip.className = cls; chip.style.display = txt ? '' : 'none';
    if (game.ballInHandZone === 'head' && game.state === S.BREAK && seat.control === 'local') chip.insertAdjacentHTML('beforeend', '<span class="wide-only"> · geser bola putih di area kiri</span>');
  }
  toast(msg, kind) {
    const t = $('toast'); t.textContent = msg; t.className = 'show ' + (kind || ''); clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { t.className = ''; }, 2600);
  }
  pausedChanged(game, p) {
  if (p) {
    const consent = typeof game.needsConsent === 'function' ? game.needsConsent() : false;
    const isOnline = game.mode === 'online';
    $('btnDisc').hidden = !isOnline || game.isRoomMatch === true;
    $('btnRestart').hidden = consent;
    $('pauseNote').textContent =
      (game.bet ? 'Keluar sekarang dihitung kalah — taruhan ' + fmtCoins(game.bet) + ' hangus. ' : '') +
      (consent ? 'Jeda disetujui kedua pemain · otomatis lanjut dalam 60 detik · sisa jatah jeda kamu: ' + (game.pauseLeft != null ? game.pauseLeft : '–') + '.' : '');
    this.stack.push(this.current || '');
    this.show('screenPause');
  } else if (this.current === 'screenPause' || this.current === 'screenSettings') {
    this.stack = [];
    this.hideAll();
  }
}
  /** Menunggu lawan menyetujui permintaan jeda. */
  pausePending(game, on) {
    this._ensureHudExtras(); const el = $('pauseWait'); el.hidden = !on;
    if (on) el.innerHTML = '<span class="pw-dot"></span>Menunggu persetujuan lawan untuk jeda…';
  }
  /** Lawan meminta jeda: tampilkan dialog setuju/tolak (otomatis ditolak setelah 10 dtk). */
  pausePrompt(game, on) {
    this._ensureHudExtras(); const el = $('pausePrompt'); el.hidden = !on; if (!on) return;
    const who = game.seats.find((x) => x.control !== 'local');
    el.innerHTML = '<div class="pp-box"><b>' + esc(who ? who.name : 'Lawan') + ' meminta jeda</b><span>Pertandingan berhenti untuk kedua pemain. Jatah jeda tiap pemain 2×.</span><div class="pp-bar"><i></i></div><div class="pp-btns"><button class="btn small" data-a="no">Tolak</button><button class="btn small green" data-a="yes">Setuju</button></div></div>';
    el.querySelector('[data-a=no]').onclick = () => { this.click(); game.answerPause(false); };
    el.querySelector('[data-a=yes]').onclick = () => { this.click(); game.answerPause(true); };
  }
  /** Elemen & gaya tambahan HUD (dibuat sekali): skor per pemain, skor sesi, dialog jeda. Hapus <style id="hudStyle"> bila ingin kembali ke gaya lama. */
  _ensureHudExtras() {
    if (this._hudExtras) return; this._hudExtras = true;
    const st = document.createElement('style'); st.id = 'hudStyle';
    st.textContent = `
#p0,#p1{backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);background:linear-gradient(180deg,rgba(30,40,66,.86),rgba(13,19,35,.86))!important;border:1px solid rgba(255,255,255,.13)!important;border-radius:18px!important;box-shadow:0 8px 22px rgba(0,0,0,.38),inset 0 1px 0 rgba(255,255,255,.08)!important;transition:box-shadow .25s,border-color .25s,transform .25s}
#p0.active,#p1.active{border-color:rgba(255,205,80,.9)!important;box-shadow:0 0 0 1px rgba(255,205,80,.55),0 0 26px rgba(255,190,50,.38),0 8px 22px rgba(0,0,0,.4)!important;transform:translateY(-1px)}
#p0 .ring-fg,#p1 .ring-fg{stroke-linecap:round;filter:drop-shadow(0 0 4px rgba(255,205,80,.7))}
#pn0,#pn1{font-weight:800;letter-spacing:.2px;text-shadow:0 1px 2px rgba(0,0,0,.5)}
#turnChip{backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);border-radius:999px;box-shadow:0 6px 18px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.12);letter-spacing:.3px}
#turnChip.mine{box-shadow:0 0 0 1px rgba(80,220,140,.6),0 0 20px rgba(60,210,130,.35)}
#turnChip.foul{box-shadow:0 0 0 1px rgba(255,90,95,.7),0 0 20px rgba(255,80,90,.4)}
.hud-sc{position:absolute;left:50%;bottom:-11px;transform:translateX(-50%);display:flex;gap:6px;align-items:center;white-space:nowrap;padding:3px 9px;border-radius:999px;background:rgba(8,12,24,.92);border:1px solid rgba(255,255,255,.16);font:800 11px/1 system-ui,sans-serif;color:#dbe6ff;box-shadow:0 3px 8px rgba(0,0,0,.4);pointer-events:none}
.hud-sc b{color:#ffd45a}.hud-sc i{font-style:normal;opacity:.55}
#hudSeries{position:absolute;left:50%;top:calc(100% + 16px);transform:translateX(-50%);display:flex;align-items:center;gap:10px;padding:5px 14px;border-radius:999px;background:linear-gradient(180deg,rgba(30,40,66,.92),rgba(13,19,35,.92));border:1px solid rgba(255,255,255,.15);font:800 15px/1 system-ui,sans-serif;color:#fff;box-shadow:0 6px 16px rgba(0,0,0,.4);z-index:5;pointer-events:none}
#hudSeries small{font-size:10px;font-weight:700;opacity:.65;letter-spacing:1px;text-transform:uppercase}
#hudSeries b{color:#ffd45a;font-size:18px;min-width:12px;text-align:center}
#pauseWait{position:fixed;left:50%;top:calc(env(safe-area-inset-top,0px) + 72px);transform:translateX(-50%);z-index:60;display:flex;align-items:center;gap:8px;padding:9px 16px;border-radius:999px;background:rgba(12,18,34,.94);border:1px solid rgba(255,205,80,.5);color:#ffe9a8;font:700 13px system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.45)}
#pauseWait[hidden],#pausePrompt[hidden]{display:none}
.pw-dot{width:9px;height:9px;border-radius:50%;background:#ffd45a;animation:pwp 1s infinite}@keyframes pwp{50%{opacity:.25;transform:scale(.7)}}
#pausePrompt{position:fixed;inset:0;z-index:70;display:flex;align-items:center;justify-content:center;background:rgba(3,6,14,.55);backdrop-filter:blur(3px)}
.pp-box{width:min(88vw,340px);padding:18px;border-radius:20px;background:linear-gradient(180deg,#223056,#111a33);border:1px solid rgba(255,255,255,.16);box-shadow:0 20px 50px rgba(0,0,0,.6);display:flex;flex-direction:column;gap:10px;color:#fff;font:600 14px system-ui,sans-serif}
.pp-box b{font-size:17px}.pp-box span{opacity:.75;font-size:13px}
.pp-bar{height:5px;border-radius:5px;background:rgba(255,255,255,.12);overflow:hidden}.pp-bar i{display:block;height:100%;width:100%;background:#ffd45a;animation:ppb 10s linear forwards}@keyframes ppb{to{width:0}}
.pp-btns{display:flex;gap:10px;justify-content:flex-end}`;
    document.head.appendChild(st);
    for (const id of ['p0', 'p1']) { const el = $(id); if (el && getComputedStyle(el).position === 'static') el.style.position = 'relative'; const sc = document.createElement('div'); sc.className = 'hud-sc'; sc.id = 'sc' + id[1]; el.appendChild(sc); }
    const hud = $('hud'), se = document.createElement('div'); se.id = 'hudSeries'; se.hidden = true;
    const anchor = $('turnChip') && $('turnChip').parentNode; (anchor || hud).appendChild(se);
    for (const id of ['pauseWait', 'pausePrompt']) { const el = document.createElement('div'); el.id = id; el.hidden = true; document.body.appendChild(el); }
  }
_updateScore(game) {
  if (!game || !game.pottedBySeat || !game.sessionScore) return;
  const potted = game.pottedBySeat, score = game.sessionScore;
  const key = potted[0] + '|' + potted[1] + '|' + score[0] + '|' + score[1] + '|' + game.mode + '|' + game.gameType + '|' + game.rules.currentSeat;
  if (key === this._scoreKey) return; this._scoreKey = key;
  for (let i = 0; i < 2; i++) {
    const el = $('sc' + i);
    if (!el) continue;
    const left = game.gameType === '8ball' && typeof game.rules.remaining === 'function'
      ? ' <i>·</i> sisa <b>' + (game.rules.groups && game.rules.groups[i] ? game.rules.remaining(i) : 7) + '</b>'
      : '';
    el.innerHTML = 'Masuk <b>' + (potted[i] | 0) + '</b>' + left;
  }
  const se = $('hudSeries');
  if (!se) return;
  const consent = typeof game.needsConsent === 'function' ? !!game.needsConsent() : false;
  const multi = consent || (score[0] + score[1]) > 0;
  se.hidden = !multi;
  if (multi) se.innerHTML = '<small>Skor</small><b>' + (score[0] | 0) + '</b><span style="opacity:.5">–</span><b>' + (score[1] | 0) + '</b>';
}
/** Hujan koin yang terbang masuk ke kotak. Target = elemen box. */
_coinRainToBox(targetEl, count) {
  if (!targetEl) return;
  const rect = targetEl.getBoundingClientRect();
  const targetX = rect.left + rect.width / 2;
  const targetY = rect.top + rect.height / 2;

  for (let i = 0; i < (count || 14); i++) {
    // Spawn acak di sekeliling layar (bawah + kiri + kanan)
    const side = Math.random();
    let spawnX, spawnY;
    if (side < 0.55) {
      // bawah
      spawnX = Math.random() * innerWidth;
      spawnY = innerHeight + 40;
    } else if (side < 0.8) {
      // kiri
      spawnX = -40;
      spawnY = innerHeight * 0.5 + Math.random() * innerHeight * 0.5;
    } else {
      // kanan
      spawnX = innerWidth + 40;
      spawnY = innerHeight * 0.5 + Math.random() * innerHeight * 0.5;
    }

    const dx = targetX - spawnX;
    const dy = targetY - spawnY;

    const coin = document.createElement('div');
    coin.className = 'lu-coin-fly';
    coin.style.left = spawnX + 'px';
    coin.style.top = spawnY + 'px';
    coin.style.setProperty('--dx', dx + 'px');
    coin.style.setProperty('--dy', dy + 'px');
    coin.style.animationDelay = (i * 60 + Math.random() * 80) + 'ms';
    document.body.appendChild(coin);

    // Trigger animasi + hapus setelah selesai
    requestAnimationFrame(() => coin.classList.add('fly'));

    // Saat koin tiba di box → burst mini + suara
    const arriveAt = 1100 + i * 60;
    setTimeout(() => {
      this.fx.burst(targetX, targetY, 6, 0.6);
    }, arriveAt);

    setTimeout(() => coin.remove(), arriveAt + 300);
  }
}
  /* ------------------------------ per-frame ------------------------------ */
  tick(dt, game) {
    if ($('hud').hidden) return;
    if (!game || !game.pottedBySeat || !game.rules || !game.sessionScore) return;
    this._ensureHudExtras(); 
    this._updateScore(game);
    const active = game.isTurnState() || game.state === GameState.BALL_IN_HAND;
    for (let i = 0; i < 2; i++) {
  const el = $('p' + i); if (!el) continue;
  const on = active && game.rules.currentSeat === i;
  el.classList.toggle('active', on);
  const ring = el.querySelector('.ring-fg');
  if (ring) {
    const frac = on ? Util.clamp(game.turnLeft / game.turnTotal, 0, 1) : 0;
    ring.style.strokeDashoffset = String(138.2 * (1 - frac));
  }
  el.classList.toggle('urgent', on && game.turnLeft < 6);
}
    $('hud').classList.toggle('locked', !game.canControl() && !game.canPlace());
    this.powerShown += (game.aim.power - this.powerShown) * Math.min(1, dt * (this.dragPower ? 40 : 12));
    const p = Util.clamp(this.powerShown, 0, 1);
    const fill = $('powerFill'), handle = $('powerHandle'), val = $('powerVal');
    if (fill)   fill.style.clipPath = 'inset(0 0 ' + ((1 - p) * 100).toFixed(1) + '% 0)';
    if (handle) handle.style.top = (p * 100).toFixed(1) + '%';
    if (val)    val.textContent = Math.round(p * 100);
    $('powerFill').style.clipPath = 'inset(0 0 ' + ((1 - p) * 100).toFixed(1) + '% 0)'; $('powerHandle').style.top = (p * 100).toFixed(1) + '%'; $('powerVal').textContent = Math.round(p * 100);
    if (this.fineDir && game.canControl()) { this.fineHold += dt; game.nudgeAim(this.fineDir * CONFIG.aim.fineRate * dt * 0.35 * (this.fineHold > 0.7 ? 2.2 : 1)); } else this.fineHold = 0;
    this.drawSpin(game);
  }
   _bindPower() {
  const tr = $('powerTrack');
  if (!tr) { console.warn('[UI] #powerTrack tidak ditemukan — drag power tidak akan bekerja'); return; }
  const g = () => this.game;
  const upd = (e) => {
    const r = tr.getBoundingClientRect();
    const v = (e.clientY - r.top) / r.height;
    console.log('[UI] drag power →', v, 'rect=', r.top, r.height);
    g().setPower(Util.clamp(v, 0, 1));
  };
  tr.addEventListener('pointerdown', (e) => {
    console.log('[UI] pointerdown powerTrack, canControl=', g().canControl());
    if (!g().canControl()) return;
    this.audio.unlock();
    this.dragPower = true;
    tr.setPointerCapture(e.pointerId);
    upd(e);
  });
  tr.addEventListener('pointermove', (e) => { if (this.dragPower) upd(e); });
  tr.addEventListener('pointerup', () => {
    if (!this.dragPower) return;
    this.dragPower = false;
    if (g().aim.power > 0.04) g().requestShot();
    else this.toast('Tembakan dibatalkan', '');
  });
  tr.addEventListener('pointercancel', () => { this.dragPower = false; });
}
  _bindSpin() {
    const el = $('spin'), g = () => this.game;
    const upd = (e) => { const r = el.getBoundingClientRect(); g().setSpin(((e.clientX - r.left) / r.width * 2 - 1) * 1.12, -((e.clientY - r.top) / r.height * 2 - 1) * 1.12); };
    el.addEventListener('pointerdown', (e) => { if (!g().canControl()) return; this.spinDrag = true; el.setPointerCapture(e.pointerId); upd(e); });
    el.addEventListener('pointermove', (e) => { if (this.spinDrag) upd(e); }); el.addEventListener('pointerup', () => { this.spinDrag = false; });
    el.addEventListener('dblclick', () => g().setSpin(0, 0));
  }
  drawSpin(game) {
    const key = game.aim.spinX.toFixed(2) + game.aim.spinY.toFixed(2) + game.canControl(); if (key === this.lastSpin) return; this.lastSpin = key;
    const c = this.spinCtx, w = 168, r = w / 2 - 8; c.clearRect(0, 0, w, w);
    const gr = c.createRadialGradient(w * 0.4, w * 0.36, 8, w / 2, w / 2, r + 10); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#c4ced8'); c.fillStyle = gr; c.beginPath(); c.arc(w / 2, w / 2, r + 8, 0, 7); c.fill();
    c.strokeStyle = 'rgba(30,40,55,.28)'; c.lineWidth = 2; c.beginPath(); c.moveTo(w / 2, 14); c.lineTo(w / 2, w - 14); c.moveTo(14, w / 2); c.lineTo(w - 14, w / 2); c.stroke(); c.beginPath(); c.arc(w / 2, w / 2, r * 0.5, 0, 7); c.stroke();
    c.fillStyle = '#d23c3c'; c.strokeStyle = '#7a1414'; c.lineWidth = 3; c.beginPath(); c.arc(w / 2 + game.aim.spinX * r * 0.86, w / 2 - game.aim.spinY * r * 0.86, 13, 0, 7); c.fill(); c.stroke();
  }
  _bindFine() {
    for (const [id, dir] of [['fineL', -1], ['fineR', 1]]) {
      const b = $(id); b.addEventListener('pointerdown', (e) => { this.audio.unlock(); this.fineDir = dir; b.setPointerCapture(e.pointerId); });
      const up = () => { this.fineDir = 0; }; b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
    }
  }
}

/* =====================================================================
   INPUT — mouse/touch/keyboard (koordinat lewat kamera renderer, sehingga portrait & zoom ikut benar)
   ===================================================================== */
class InputController {
  constructor(canvas, game, renderer, ui) {
    this.canvas = canvas; this.game = game; this.r = renderer; this.ui = ui; this.mode = 'none';
    this.startPointer = 0; this.startAim = 0; this.charging = false; this.chargeT = 0;
    canvas.addEventListener('pointerdown', (e) => this.down(e)); canvas.addEventListener('pointermove', (e) => this.move(e));
    canvas.addEventListener('pointerup', () => this.up()); canvas.addEventListener('pointercancel', () => this.up());
    canvas.addEventListener('wheel', (e) => { if (game.canControl()) { e.preventDefault(); game.setPower(game.aim.power - Math.sign(e.deltaY) * 0.03); } }, { passive: false });
    window.addEventListener('keydown', (e) => this.key(e, true)); window.addEventListener('keyup', (e) => this.key(e, false));
  }
  _world(e, lift) { return this.r.screenToWorld(e.clientX, e.clientY - (lift ? 54 : 0)); }
  down(e) {
    this.ui.audio.unlock(); const g = this.game;
    if (g.paused || (!g.canControl() && !g.canPlace())) return;
    const touch = e.pointerType !== 'mouse', w = this._world(e, false), cue = g.cue;
    const nearCue = Math.hypot(w.x - cue.x, w.y - cue.y) < CONFIG.table.ballRadius * 3.2;
    if (g.canPlace() && (g.state === GameState.BALL_IN_HAND || nearCue)) { this.mode = 'place'; this.canvas.setPointerCapture(e.pointerId); const p = this._world(e, touch); g.moveCue(p.x, p.y); return; }
    if (!g.canControl()) return;
    if (g.rules.callRequired()) { const idx = this._pocketAt(w); if (idx >= 0) { this.mode = 'pocketTap'; this.tapIdx = idx; this.tapX = e.clientX; this.tapY = e.clientY; this.canvas.setPointerCapture(e.pointerId); return; } }   // ketuk kantong = pilih tujuan
    this.mode = 'aim'; this.canvas.setPointerCapture(e.pointerId); this.startPointer = Math.atan2(w.y - cue.y, w.x - cue.x); this.startAim = g.aim.angle;
    if (!touch) g.setAimAngle(this.startPointer);
  }
  move(e) {
    const g = this.game, touch = e.pointerType !== 'mouse'; if (g.paused) return;
    if (this.mode === 'place') { const p = this._world(e, touch); g.moveCue(p.x, p.y); return; }
    if (!g.canControl()) return;
    const w = this._world(e, false), cue = g.cue, d = Math.hypot(w.x - cue.x, w.y - cue.y);
    if (this.mode === 'pocketTap') { if (Math.hypot(e.clientX - this.tapX, e.clientY - this.tapY) < 10) return; this.mode = 'aim'; this.startPointer = Math.atan2(w.y - cue.y, w.x - cue.x); this.startAim = g.aim.angle; }   // digeser = mulai membidik
    if (!touch) { if (d > CONFIG.table.ballRadius * 1.6 && (this.mode === 'aim' || e.buttons === 0)) g.setAimAngle(Math.atan2(w.y - cue.y, w.x - cue.x)); return; }
    if (this.mode === 'aim' && d > CONFIG.table.ballRadius * 2) g.setAimAngle(this.startAim + Util.wrapAngle(Math.atan2(w.y - cue.y, w.x - cue.x) - this.startPointer) * 0.55);
  }
  _pocketAt(w) { const P = this.game.world.pockets; let best = -1, bd = 80 * 80; for (let i = 0; i < P.length; i++) { const d2 = (P[i].x - w.x) ** 2 + (P[i].y - w.y) ** 2; if (d2 < bd) { bd = d2; best = i; } } return best; }
  up() { if (this.mode === 'pocketTap') { this.ui.audio.play('ui', 0.5); this.game.setCall(this.tapIdx); }
    if (this.mode === 'place' && this.game.state === GameState.BALL_IN_HAND) this.game.confirmPlacement(); this.mode = 'none'; }
  key(e, down) {
    const g = this.game; if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT')) return;
    if (down && e.code === 'Escape') { if (g.isActiveMatch()) g.setPaused(!g.paused); return; }
    if (g.paused) return;
    if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') { if (down) g.nudgeAim((e.code === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? CONFIG.aim.keyStepFine : CONFIG.aim.keyStep)); e.preventDefault(); }
    else if (e.code === 'ArrowUp' || e.code === 'ArrowDown') { if (down) g.setPower(g.aim.power + (e.code === 'ArrowUp' ? -0.04 : 0.04)); e.preventDefault(); }
    else if (e.code === 'Space') { e.preventDefault(); if (down && !this.charging && g.canControl()) { this.charging = true; this.chargeT = 0; g.aim.power = 0.02; } else if (!down && this.charging) { this.charging = false; g.requestShot(); } }
    else if (down && e.code === 'Enter') g.requestShot();
  }
  update(dt) { if (this.charging) { this.chargeT += dt; this.game.setPower(this.chargeT / 1.3); } }
}
