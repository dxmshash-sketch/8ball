/* =====================================================================
   11 · UI — HUD, layar, input. Hanya modul ini yang menyentuh DOM.
   ===================================================================== */
const $ = (id) => document.getElementById(id);
const AV_COLORS = ['#4a8fd6', '#d6684a', '#5bb37a', '#a46bd6', '#d6a94a', '#4ab5b5'];
const BALL_CSS = (id) => ({ c: CONFIG.colors.balls[id <= 8 ? id : id - 8], stripe: id > 8 });
const SHIELD_SVG = '<svg viewBox="0 0 30 34"><path d="M15 1l12 4.5v10.2c0 8.1-5.3 14.4-12 17.3C8.3 30.1 3 23.8 3 15.7V5.5L15 1z" fill="#3b2a00" stroke="#F7C948" stroke-width="2"/><rect x="13" y="9" width="4" height="4" rx="1" fill="#F7C948"/><rect x="13.5" y="14" width="3" height="10" rx="1.2" fill="#F7C948"/></svg>';
const COIN_SVG = '<svg width="20" height="20" viewBox="0 0 22 22"><circle cx="11" cy="11" r="10" fill="#F4C542"/><circle cx="11" cy="11" r="6.5" fill="none" stroke="#b8850c" stroke-width="1.6"/></svg>';

class UI {
  constructor(store, audio) {
    this.store = store; this.audio = audio; this.game = null; this.renderer = null;
    this.current = 'screenMenu'; this.stack = []; this.selectedMode = 'bot'; this.selectedDiff = 'medium';
    this.powerShown = 0.5; this.toastTimer = 0; this.dragPower = false; this.spinDrag = false; this.fineDir = 0; this.fineHold = 0;
    this.spinCtx = $('spinCv').getContext('2d'); this.lastSpin = '';
    this.settingsReturn = 'screenMenu';
  }

  attach(game) {
    this.game = game;
    document.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => { this.click(); this.go(b.dataset.go, !!b.dataset.back); }));
    $('modeGrid').addEventListener('click', (e) => { const b = e.target.closest('.mode-card'); if (!b) return; this.click(); this.selectedMode = b.dataset.mode; this.syncModes(); });
    $('diffSeg').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; this.click(); this.selectedDiff = b.dataset.d; this.syncModes(); });
    $('btnStart').addEventListener('click', () => { this.click(); game.startMatch({ mode: this.selectedMode, difficulty: this.selectedDiff }); });
    $('btnPause').addEventListener('click', () => { this.click(); game.setPaused(true); });
    $('btnResume').addEventListener('click', () => { this.click(); game.setPaused(false); });
    $('btnPauseSettings').addEventListener('click', () => { this.click(); this.settingsReturn = 'screenPause'; this.go('settings'); });
    $('btnSettingsBack').addEventListener('click', () => { this.click(); this.store.save(); this.show(this.settingsReturn, true); this.settingsReturn = 'screenMenu'; });
    $('btnRestart').addEventListener('click', () => { this.click(); game.restartMatch(); });
    $('btnQuit').addEventListener('click', () => { this.click(); game.quitToMenu(); });
    $('btnDisc').addEventListener('click', () => { this.click(); if (game.simulateDisconnect()) game.setPaused(false); });
    $('btnRematch').addEventListener('click', () => { this.click(); game.rematch(); });
    $('btnResMenu').addEventListener('click', () => { this.click(); game.quitToMenu(); });
    $('setName').addEventListener('input', (e) => { this.store.data.profile.name = e.target.value.trim().slice(0, 14) || 'Pemain'; this.refreshProfile(); });
    document.querySelectorAll('.switch').forEach((sw) => sw.addEventListener('click', () => {
      const k = sw.dataset.set, s = this.store.data.settings; s[k] = !s[k]; this.syncSettings(); this.store.save();
      if (k === 'sfx' || k === 'music') { this.audio.unlock(); this.audio.applySettings(); }
    }));
    this._bindPower(); this._bindSpin(); this._bindFine();
    this.syncModes(); this.syncSettings(); this.refreshProfile();
  }

  click() { this.audio.unlock(); this.audio.play('ui', 0.5); }

  /* ------------------------------ layar ------------------------------ */
  show(id, back) {
    if (id === this.current) return;
    const cur = this.current ? $(this.current) : null, next = $(id);
    if (cur) { cur.classList.remove('active'); cur.classList.toggle('left', !back); }
    next.classList.remove('left'); next.style.transform = ''; next.classList.add('active');
    this.current = id;
  }
  hideAll() { const cur = this.current ? $(this.current) : null; if (cur) cur.classList.remove('active'); this.current = ''; }
  go(name, back) {
    const id = { menu: 'screenMenu', modes: 'screenModes', settings: 'screenSettings', cues: 'screenCues' }[name];
    if (name === 'cues') this.renderCues();
    if (name === 'settings') this.syncSettings();
    this.show(id, back);
  }
  syncModes() {
    document.querySelectorAll('.mode-card').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === this.selectedMode)));
    document.querySelectorAll('#diffSeg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.d === this.selectedDiff)));
    $('diffRow').style.visibility = this.selectedMode === 'bot' ? 'visible' : 'hidden';
  }
  syncSettings() {
    const s = this.store.data.settings; document.querySelectorAll('.switch').forEach((sw) => sw.setAttribute('aria-checked', String(!!s[sw.dataset.set])));
    $('setName').value = this.store.data.profile.name;
  }
  avatar(el, name, seat) { el.textContent = (name || '?').trim().charAt(0).toUpperCase(); el.style.setProperty('--c1', AV_COLORS[(name.length * 3 + seat) % AV_COLORS.length]); }
  refreshProfile() {
    const p = this.store.data.profile;
    this.avatar($('menuAv'), p.name, 0); $('menuName').textContent = p.name; $('menuLevel').textContent = 'Lv ' + this.store.level();
    $('menuCoins').textContent = p.coins.toLocaleString('id-ID');
  }

  /* ------------------------------ callback dari Game ------------------------------ */
  stateChanged(game, next, prev) {
    const S = GameState;
    if (this.renderer) { /* kamera fixed: tidak ada penyesuaian */ }
    $('hud').hidden = [S.MENU, S.MATCHMAKING].indexOf(next) !== -1;
    if (next === S.MENU) { this.refreshProfile(); this.show('screenMenu', true); $('rotateHint').style.visibility = 'hidden'; return; }
    $('rotateHint').style.visibility = 'visible';
    if (next === S.MATCHMAKING) { this.show('screenMM'); return; }
    if (next === S.GAME_OVER) return;
    if (this.current === 'screenMM' || this.current === 'screenResult') this.hideAll();
    this.refreshPlayers(game);
  }

  showMatchmaking(game) {
    const online = game.mode === 'online';
    $('mmSpin').style.display = 'block';
    $('mmTitle').textContent = online ? 'Mencari lawan…' : 'Menyiapkan meja…';
    $('mmVs').innerHTML = ''; $('mmSub').textContent = online ? 'Room dibuat di server simulasi' : ' ';
    const t = game.mmTimer;
    if (online) setTimeout(() => {
      if (game.state !== GameState.MATCHMAKING) return;
      $('mmTitle').textContent = 'Lawan ditemukan'; $('mmSpin').style.display = 'none';
      $('mmVs').innerHTML = ['0', '1'].map((i) => '<div class="side"><div class="av big-av" id="mmAv' + i + '"></div><span>' + game.seats[+i].name + '</span></div>').join('<span style="color:var(--gold)">VS</span>');
      this.avatar($('mmAv0'), game.seats[0].name, 0); this.avatar($('mmAv1'), game.seats[1].name, 1);
      $('mmSub').textContent = 'Room ' + game.transport.roomId;
    }, t * 1000 * 0.55);
    this.refreshPlayers(game);
  }

  refreshPlayers(game) {
    const seats = game.seats, r = game.rules;
    for (let i = 0; i < 2; i++) {
      $('pn' + i).textContent = seats[i].name; $('lv' + i).textContent = seats[i].level;
      this.avatar($('av' + i), seats[i].name, i);
      const tray = $('tr' + i), g = r.groups[i]; let html = '', n = 0;
      if (g) for (const id of r.pocketedIds) { if (groupOf(id) === g) { const b = BALL_CSS(id); html += '<span class="mb' + (b.stripe ? ' stripe' : '') + '" style="--c:' + b.c + '"></span>'; n++; } }
      for (; n < 7; n++) html += '<span class="slot"></span>';
      tray.innerHTML = html;
    }
    const reward = game.mode === 'bot' ? CONFIG.bots[game.difficulty].reward : game.mode === 'online' ? 120 : 0;
    $('pot').textContent = reward;
    $('conn').style.display = game.mode === 'online' ? 'flex' : 'none';
    this.updateBanner(game);
  }
  connectionChanged(game, ok) { $('conn').classList.toggle('off', !ok); }

  updateBanner(game) {
    const chip = $('turnChip'), S = GameState, seat = game.seats[game.rules.currentSeat], me = seat && seat.control === 'local' && game.mode !== 'local' ;
    let txt = '', cls = '';
    switch (game.state) {
      case S.BREAK: txt = me ? 'Break — pecah rack' : seat.name + ' melakukan break'; cls = me ? 'mine' : ''; break;
      case S.PLAYER_TURN: case S.OPPONENT_TURN: txt = game.mode === 'local' ? 'Giliran ' + seat.name : me ? 'Giliranmu' : 'Giliran ' + seat.name; cls = me ? 'mine' : ''; break;
      case S.BALL_IN_HAND: txt = seat.control === 'local' ? 'Tempatkan bola putih' : seat.name + ' menempatkan bola putih'; cls = seat.control === 'local' ? 'mine' : ''; break;
      case S.FOUL: txt = 'Foul'; cls = 'foul'; break;
      case S.SHOT_RESOLVING: txt = ''; break;
      default: txt = '';
    }
    chip.textContent = txt; chip.className = cls; chip.style.display = txt ? '' : 'none';
    if (game.ballInHandZone === 'head' && game.state === S.BREAK && seat.control === 'local') chip.insertAdjacentHTML('beforeend', '<span class="wide-only"> · geser bola putih di area kiri</span>');
  }

  toast(msg, kind) {
    const t = $('toast'); t.textContent = msg; t.className = 'show ' + (kind || ''); clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { t.className = ''; }, 2400);
  }

  pausedChanged(game, p) {
    if (p) { $('btnDisc').hidden = game.mode !== 'online'; this.show('screenPause'); }
    else if (this.current === 'screenPause' || this.current === 'screenSettings') this.hideAll();
  }

  showResult(game) {
    const r = game.result, win = game.mode === 'local' || r.youWon;
    $('resTitle').textContent = game.mode === 'local' ? r.winnerName + ' menang' : (r.youWon ? 'Kamu menang' : 'Kamu kalah');
    $('resTitle').className = game.mode === 'local' || r.youWon ? 'win' : 'lose';
    $('resReason').textContent = r.reason;
    $('resReward').innerHTML = r.reward ? COIN_SVG + '<span>+' + r.reward + ' koin</span>' : '';
    $('btnRematch').textContent = 'Main lagi';
    this.show('screenResult'); this.refreshProfile();
  }

  /* ------------------------------ per-frame ------------------------------ */
  tick(dt, game) {
    const hudVisible = !$('hud').hidden; if (!hudVisible) return;
    const s = game.seats[game.rules.currentSeat], active = game.isTurnState() || game.state === GameState.BALL_IN_HAND;
    for (let i = 0; i < 2; i++) {
      const el = $('p' + i), on = active && game.rules.currentSeat === i;
      el.classList.toggle('active', on);
      const frac = on ? Util.clamp(game.turnLeft / game.turnTotal, 0, 1) : 0;
      el.classList.toggle('urgent', on && game.turnLeft < 6);
      el.querySelector('.ring-fg').style.strokeDashoffset = String(138.2 * (1 - frac));
    }
    const locked = !(game.canControl());
    $('hud').classList.toggle('locked', locked && !game.canPlace());
    const target = game.aim.power;
    this.powerShown += (target - this.powerShown) * Math.min(1, dt * (this.dragPower ? 40 : 12));
    const p = Util.clamp(this.powerShown, 0, 1);
    $('powerFill').style.clipPath = 'inset(0 0 ' + ((1 - p) * 100).toFixed(1) + '% 0)';
    $('powerHandle').style.top = (p * 100).toFixed(1) + '%';
    $('powerVal').textContent = Math.round(p * 100);
    if (this.fineDir && game.canControl()) { this.fineHold += dt; game.nudgeAim(this.fineDir * CONFIG.aim.fineRate * dt * (this.fineHold > 0.7 ? 2.2 : 1) * 0.35); } else this.fineHold = 0;
    this.drawSpin(game);
    if (game.state === GameState.BREAK || game.state === GameState.BALL_IN_HAND || game.state === GameState.PLAYER_TURN || game.state === GameState.OPPONENT_TURN) { /* banner stabil */ }
  }

  /* ------------------------------ power, spin, fine ------------------------------ */
  _bindPower() {
    const tr = $('powerTrack'), g = () => this.game;
    const upd = (e) => { const r = tr.getBoundingClientRect(); g().setPower(Util.clamp((e.clientY - r.top) / r.height, 0, 1)); };
    tr.addEventListener('pointerdown', (e) => { if (!g().canControl()) return; this.audio.unlock(); this.dragPower = true; tr.setPointerCapture(e.pointerId); upd(e); });
    tr.addEventListener('pointermove', (e) => { if (this.dragPower) upd(e); });
    const end = (e) => {
      if (!this.dragPower) return; this.dragPower = false;
      if (g().aim.power > 0.04) g().requestShot(); else this.toast('Tembakan dibatalkan', '');
    };
    tr.addEventListener('pointerup', end); tr.addEventListener('pointercancel', () => { this.dragPower = false; });
  }
  _bindSpin() {
    const el = $('spin'), g = () => this.game;
    const upd = (e) => { const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * 2 - 1, y = (e.clientY - r.top) / r.height * 2 - 1; g().setSpin(x * 1.12, -y * 1.12); };
    el.addEventListener('pointerdown', (e) => { if (!g().canControl()) return; this.spinDrag = true; el.setPointerCapture(e.pointerId); upd(e); });
    el.addEventListener('pointermove', (e) => { if (this.spinDrag) upd(e); });
    el.addEventListener('pointerup', () => { this.spinDrag = false; });
    el.addEventListener('dblclick', () => g().setSpin(0, 0));
  }
  drawSpin(game) {
    const key = game.aim.spinX.toFixed(2) + game.aim.spinY.toFixed(2) + game.canControl(); if (key === this.lastSpin) return; this.lastSpin = key;
    const c = this.spinCtx, w = 168, h = c.canvas.height, r = w / 2 - 8;
    c.clearRect(0, 0, w, h);
    const gr = c.createRadialGradient(w * 0.4, h * 0.36, 8, w / 2, h / 2, r + 10); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#c4ced8');
    c.fillStyle = gr; c.beginPath(); c.arc(w / 2, h / 2, r + 8, 0, 7); c.fill();
    c.strokeStyle = 'rgba(30,40,55,.28)'; c.lineWidth = 2; c.beginPath(); c.moveTo(w / 2, 14); c.lineTo(w / 2, h - 14); c.moveTo(14, h / 2); c.lineTo(w - 14, h / 2); c.stroke();
    c.beginPath(); c.arc(w / 2, h / 2, r * 0.5, 0, 7); c.stroke();
    const x = w / 2 + game.aim.spinX * r * 0.86, y = h / 2 - game.aim.spinY * r * 0.86;
    c.fillStyle = '#d23c3c'; c.strokeStyle = '#7a1414'; c.lineWidth = 3; c.beginPath(); c.arc(x, y, 12, 0, 7); c.fill(); c.stroke();
  }
  _bindFine() {
    for (const [id, dir] of [['fineL', -1], ['fineR', 1]]) {
      const b = $(id);
      b.addEventListener('pointerdown', (e) => { this.audio.unlock(); this.fineDir = dir; b.setPointerCapture(e.pointerId); });
      const up = () => { this.fineDir = 0; }; b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
    }
  }

  /* ------------------------------ Cue Collection ------------------------------ */
  renderCues() {
    const st = this.store, list = $('cuesList'); list.innerHTML = '';
    $('cueCoins').textContent = st.data.profile.coins.toLocaleString('id-ID');
    $('cuePts').textContent = st.data.profile.cuePoints + ' poin koleksi';
    for (const cue of CUE_CATALOG) {
      const lv = st.ownedLevel(cue.id), owned = lv > 0, shown = st.effectiveStats(cue.id, Math.max(1, lv));
      const equipped = st.data.cues.equipped === cue.id;
      const card = document.createElement('article'); card.className = 'cue-card' + (owned ? '' : ' locked');
      const stat = (k, label) => '<div class="stat"><span>' + label + '</span><div class="cells">' + Array.from({ length: 10 }, (_, i) => '<i' + (i < shown[k] ? ' class="on"' : '') + '></i>').join('') + '</div></div>';
      card.innerHTML =
        '<div class="cue-preview"><img alt="' + cue.name + '" src="' + cue.image + '" draggable="false"></div>' +
        '<div class="cue-panel"><h3>' + cue.name + '</h3><div class="cue-row">' +
        '<div class="cue-left"><div class="lvl-line">Level <span class="lvl-box">' + (owned ? lv : '–') + '</span></div>' +
        '<div class="pips">' + Array.from({ length: MAX_CUE_LEVEL }, (_, i) => '<i' + (i < lv ? ' class="on"' : '') + '></i>').join('') + '</div>' +
        '<div class="badges"><span class="badge r-' + cue.rarity + '">' + cue.rarity + '</span>' + cue.tags.map((t) => '<span class="badge">' + t + '</span>').join('') + '</div></div>' +
        '<div class="stat-box">' + stat('force', 'Force') + stat('aim', 'Aim') + stat('spin', 'Spin') + stat('time', 'Time') + '</div>' +
        '<div class="cp-box"><div class="cp-title">Cue Collection Points</div><div class="cp-line"><span>Unlock</span><b>+' + cue.collectionPoints.unlock + '</b></div><div class="cp-line"><span>Upgrade</span><b>+' + cue.collectionPoints.upgrade + '</b></div>' + SHIELD_SVG + '</div>' +
        '</div><div class="cue-actions"></div></div>';
      const act = card.querySelector('.cue-actions');
      const mk = (label, cls, fn, disabled) => { const b = document.createElement('button'); b.className = 'btn small ' + cls; b.innerHTML = label; b.disabled = !!disabled; b.addEventListener('click', () => { this.click(); fn(); this.renderCues(); this.refreshProfile(); }); act.appendChild(b); };
      if (owned) mk(equipped ? 'Dipakai' : 'Pakai', equipped ? '' : 'primary', () => st.equipCue(cue.id), equipped);
      if (!owned) mk('Unlock · ' + COIN_SVG + ' ' + cue.price, 'green', () => { if (!st.unlockCue(cue.id)) this.toast('Koin tidak cukup', 'foul'); }, false);
      else if (lv < MAX_CUE_LEVEL) mk('Upgrade · ' + COIN_SVG + ' ' + st.upgradePrice(cue.id), 'green', () => { if (!st.upgradeCue(cue.id)) this.toast('Koin tidak cukup', 'foul'); }, false);
      else mk('Level maksimum', '', () => {}, true);
      list.appendChild(card);
    }
  }
}

/* =====================================================================
   INPUT — mouse/touch/keyboard
   ===================================================================== */
class InputController {
  constructor(canvas, game, renderer, ui) {
    this.canvas = canvas; this.game = game; this.r = renderer; this.ui = ui; this.mode = 'none';
    this.startPointer = 0; this.startAim = 0; this.charging = false; this.chargeT = 0; this.keys = {};
    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', (e) => this.down(e));
    canvas.addEventListener('pointermove', (e) => this.move(e));
    canvas.addEventListener('pointerup', (e) => this.up(e)); canvas.addEventListener('pointercancel', (e) => this.up(e));
    canvas.addEventListener('wheel', (e) => { if (game.canControl()) { e.preventDefault(); game.setPower(game.aim.power - Math.sign(e.deltaY) * 0.03); } }, { passive: false });
    window.addEventListener('keydown', (e) => this.key(e, true)); window.addEventListener('keyup', (e) => this.key(e, false));
  }
  _world(e, touchLift) { return this.r.screenToWorld(e.clientX, e.clientY - (touchLift ? 54 : 0)); }
  down(e) {
    this.ui.audio.unlock(); const g = this.game;
    if (g.paused || !g.canControl() && !g.canPlace()) return;
    const touch = e.pointerType !== 'mouse', w = this._world(e, false), cue = g.cue;
    const nearCue = Math.hypot(w.x - cue.x, w.y - cue.y) < CONFIG.table.ballRadius * 3.2;
    if (g.canPlace() && (g.state === GameState.BALL_IN_HAND || nearCue)) { this.mode = 'place'; this.canvas.setPointerCapture(e.pointerId); const p = this._world(e, touch); g.moveCue(p.x, p.y); return; }
    if (!g.canControl()) return;
    this.mode = 'aim'; this.canvas.setPointerCapture(e.pointerId);
    this.startPointer = Math.atan2(w.y - cue.y, w.x - cue.x); this.startAim = g.aim.angle;
    if (!touch) g.setAimAngle(this.startPointer);
  }
  move(e) {
    const g = this.game, touch = e.pointerType !== 'mouse';
    if (g.paused) return;
    if (this.mode === 'place') { const p = this._world(e, touch); g.moveCue(p.x, p.y); return; }
    if (!g.canControl()) return;
    const w = this._world(e, false), cue = g.cue, d = Math.hypot(w.x - cue.x, w.y - cue.y);
    if (!touch) { if (d > CONFIG.table.ballRadius * 1.6 && (this.mode === 'aim' || e.buttons === 0)) g.setAimAngle(Math.atan2(w.y - cue.y, w.x - cue.x)); return; }
    if (this.mode === 'aim' && d > CONFIG.table.ballRadius * 2) g.setAimAngle(this.startAim + Util.wrapAngle(Math.atan2(w.y - cue.y, w.x - cue.x) - this.startPointer) * 0.55);
  }
  up() {
    if (this.mode === 'place') { const g = this.game; if (g.state === GameState.BALL_IN_HAND) g.confirmPlacement(); }
    this.mode = 'none';
  }
  key(e, down) {
    const g = this.game; if (e.target && e.target.tagName === 'INPUT') return;
    if (down && e.code === 'Escape') { if (g.isActiveMatch()) g.setPaused(!g.paused); return; }
    if (g.paused) return;
    if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') { if (down) g.nudgeAim((e.code === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? CONFIG.aim.keyStepFine : CONFIG.aim.keyStep)); e.preventDefault(); }
    else if (e.code === 'ArrowUp' || e.code === 'ArrowDown') { if (down) g.setPower(g.aim.power + (e.code === 'ArrowUp' ? -0.04 : 0.04)); e.preventDefault(); }
    else if (e.code === 'Space') {
      e.preventDefault();
      if (down && !this.charging && g.canControl()) { this.charging = true; this.chargeT = 0; g.aim.power = 0.02; }
      else if (!down && this.charging) { this.charging = false; g.requestShot(); }
    } else if (down && e.code === 'Enter') { g.requestShot(); }
  }
  update(dt) { if (this.charging) { this.chargeT += dt; this.game.setPower(this.chargeT / 1.3); } }
}
