/* =====================================================================
   13 · UI CORE — navigasi, HUD, efek, input. Halaman ada di 14-pages.js & 15-dev.js
   ===================================================================== */
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
class Fx {
  constructor(canvas) { this.cv = canvas; this.ctx = canvas.getContext('2d'); this.p = []; this.on = false; }
  burst(x, y, n, spread) {
    const cols = ['#F4C542', '#fff2b0', '#32D74B', '#57BFEA', '#FF5A5F', '#d99cff'];
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, s = (2 + Math.random() * 9) * (spread || 1); this.p.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 4, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, w: 5 + Math.random() * 6, h: 3 + Math.random() * 5, life: 1, c: cols[i % cols.length] }); }
    if (!this.on) { this.on = true; this._resize(); requestAnimationFrame((t) => this._loop(t)); }
  }
  _resize() { const d = Math.min(window.devicePixelRatio || 1, 2); this.cv.width = innerWidth * d; this.cv.height = innerHeight * d; this.d = d; }
  _loop() {
    const c = this.ctx, d = this.d; c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, this.cv.width, this.cv.height); c.setTransform(d, 0, 0, d, 0, 0);
    for (const q of this.p) { q.vy += 0.28; q.x += q.vx; q.y += q.vy; q.vx *= 0.985; q.r += q.vr; q.life -= 0.011; c.save(); c.globalAlpha = Math.max(0, q.life); c.translate(q.x, q.y); c.rotate(q.r); c.fillStyle = q.c; c.fillRect(-q.w / 2, -q.h / 2, q.w, q.h); c.restore(); }
    this.p = this.p.filter((q) => q.life > 0 && q.y < innerHeight + 40);
    if (this.p.length) requestAnimationFrame(() => this._loop()); else { this.on = false; c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, this.cv.width, this.cv.height); }
  }
}

const PAGE_SCREENS = { menu: 'screenMenu', modes: 'screenModes', settings: 'screenSettings', profile: 'screenProfile', rewards: 'screenRewards', board: 'screenBoard', tables: 'screenTables', cues: 'screenCues', dev: 'screenDev' };

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
    $('chipProfile').addEventListener('click', () => { this.click(); this.go('profile'); });
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
    this.store.onChange((what) => { if (what === 'table') this.renderer.applyTheme(); if (what === 'coins' || what === 'avatar') this.refreshMenu(); });
    this._bindPower(); this._bindSpin(); this._bindFine(); this.syncSettings(); this.refreshMenu();
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
  go(name) {
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
    if (name === 'menu') this.refreshMenu();
    else if (name === 'settings') this.syncSettings();
    else if (this['render_' + name]) this['render_' + name]();
  }
  syncSettings() {
    const s = this.store.data.settings; document.querySelectorAll('.switch').forEach((sw) => sw.setAttribute('aria-checked', String(!!s[sw.dataset.set])));
    document.querySelectorAll('#zoomSeg button').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.z === (s.aimZoom | 0))));
  }
  refreshMenu() {
    const p = this.store.data.profile;
    $('menuAv').innerHTML = avatarHTML(p.avatar, 34, p.badge); $('menuName').textContent = p.name; $('menuLevel').textContent = 'Level ' + this.store.level();
    $('menuCoins').textContent = fmtCoins(p.coins);
    $('dotRewards').hidden = !this.store.hasClaimable(); $('btnHelp').hidden = !this.store.helpAvailable();
  }

  /* ------------------------------ callback dari Game ------------------------------ */
  stateChanged(game, next) {
    const S = GameState;
    $('hud').hidden = next === S.MENU || next === S.MATCHMAKING;
    if (next === S.MENU) { this.stack = []; this.refreshMenu(); this.show('screenMenu', true); return; }
    if (next === S.MATCHMAKING) { this.show('screenMM'); return; }
    if (next === S.GAME_OVER) { $('turnChip').style.display = 'none'; return; }
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
    if (i === 0 && game.mode !== 'local') return avatarHTML(p.avatar, size, p.badge);
    return avatarHTML(botAvatar(game.seats[i].name), size, null);
  }
  refreshPlayers(game) {
    const seats = game.seats, r = game.rules;
    for (let i = 0; i < 2; i++) {
      $('pn' + i).textContent = seats[i].name; $('lv' + i).textContent = i === 0 && game.mode !== 'local' ? this.store.level() : seats[i].level;
      $('av' + i).innerHTML = this._seatAvatar(game, i, 0);
      const g = r.groups[i]; let html = '', n = 0;
      if (g) for (const id of r.pocketedIds) if (groupOf(id) === g) { const b = { c: CONFIG.colors.balls[id <= 8 ? id : id - 8], stripe: id > 8 }; html += '<span class="mb' + (b.stripe ? ' stripe' : '') + '" style="--c:' + b.c + '"></span>'; n++; }
      for (; n < 7; n++) html += '<span class="slot"></span>';
      $('tr' + i).innerHTML = html;
    }
    $('pot').textContent = game.bet ? fmtShort(game.bet * 2) : '—';
    $('conn').style.display = game.mode === 'online' ? 'flex' : 'none';
    this.updateBanner(game);
  }
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
    chip.textContent = txt; chip.className = cls; chip.style.display = txt ? '' : 'none';
    if (game.ballInHandZone === 'head' && game.state === S.BREAK && seat.control === 'local') chip.insertAdjacentHTML('beforeend', '<span class="wide-only"> · geser bola putih di area kiri</span>');
  }
  toast(msg, kind) {
    const t = $('toast'); t.textContent = msg; t.className = 'show ' + (kind || ''); clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { t.className = ''; }, 2600);
  }
  pausedChanged(game, p) {
    if (p) {
      $('btnDisc').hidden = game.mode !== 'online';
      $('pauseNote').textContent = game.bet ? 'Keluar atau mulai ulang sekarang dihitung kalah — taruhan ' + fmtCoins(game.bet) + ' hangus.' : '';
      this.stack.push(this.current || ''); this.show('screenPause');
    } else if (this.current === 'screenPause' || this.current === 'screenSettings') { this.stack = []; this.hideAll(); }
  }

  /* ------------------------------ per-frame ------------------------------ */
  tick(dt, game) {
    if ($('hud').hidden) return;
    const active = game.isTurnState() || game.state === GameState.BALL_IN_HAND;
    for (let i = 0; i < 2; i++) {
      const el = $('p' + i), on = active && game.rules.currentSeat === i; el.classList.toggle('active', on);
      const frac = on ? Util.clamp(game.turnLeft / game.turnTotal, 0, 1) : 0;
      el.classList.toggle('urgent', on && game.turnLeft < 6); el.querySelector('.ring-fg').style.strokeDashoffset = String(138.2 * (1 - frac));
    }
    $('hud').classList.toggle('locked', !game.canControl() && !game.canPlace());
    this.powerShown += (game.aim.power - this.powerShown) * Math.min(1, dt * (this.dragPower ? 40 : 12));
    const p = Util.clamp(this.powerShown, 0, 1);
    $('powerFill').style.clipPath = 'inset(0 0 ' + ((1 - p) * 100).toFixed(1) + '% 0)'; $('powerHandle').style.top = (p * 100).toFixed(1) + '%'; $('powerVal').textContent = Math.round(p * 100);
    if (this.fineDir && game.canControl()) { this.fineHold += dt; game.nudgeAim(this.fineDir * CONFIG.aim.fineRate * dt * 0.35 * (this.fineHold > 0.7 ? 2.2 : 1)); } else this.fineHold = 0;
    this.drawSpin(game);
  }
  _bindPower() {
    const tr = $('powerTrack'), g = () => this.game;
    const upd = (e) => { const r = tr.getBoundingClientRect(); g().setPower(Util.clamp((e.clientY - r.top) / r.height, 0, 1)); };
    tr.addEventListener('pointerdown', (e) => { if (!g().canControl()) return; this.audio.unlock(); this.dragPower = true; tr.setPointerCapture(e.pointerId); upd(e); });
    tr.addEventListener('pointermove', (e) => { if (this.dragPower) upd(e); });
    tr.addEventListener('pointerup', () => { if (!this.dragPower) return; this.dragPower = false; if (g().aim.power > 0.04) g().requestShot(); else this.toast('Tembakan dibatalkan', ''); });
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
    this.mode = 'aim'; this.canvas.setPointerCapture(e.pointerId); this.startPointer = Math.atan2(w.y - cue.y, w.x - cue.x); this.startAim = g.aim.angle;
    if (!touch) g.setAimAngle(this.startPointer);
  }
  move(e) {
    const g = this.game, touch = e.pointerType !== 'mouse'; if (g.paused) return;
    if (this.mode === 'place') { const p = this._world(e, touch); g.moveCue(p.x, p.y); return; }
    if (!g.canControl()) return;
    const w = this._world(e, false), cue = g.cue, d = Math.hypot(w.x - cue.x, w.y - cue.y);
    if (!touch) { if (d > CONFIG.table.ballRadius * 1.6 && (this.mode === 'aim' || e.buttons === 0)) g.setAimAngle(Math.atan2(w.y - cue.y, w.x - cue.x)); return; }
    if (this.mode === 'aim' && d > CONFIG.table.ballRadius * 2) g.setAimAngle(this.startAim + Util.wrapAngle(Math.atan2(w.y - cue.y, w.x - cue.x) - this.startPointer) * 0.55);
  }
  up() { if (this.mode === 'place' && this.game.state === GameState.BALL_IN_HAND) this.game.confirmPlacement(); this.mode = 'none'; }
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
