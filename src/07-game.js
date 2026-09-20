/* =====================================================================
   07 · GAME — orkestrator pertandingan (tanpa DOM; UI/audio disuntikkan)
   ===================================================================== */
class ParticlePool {
  constructor(n) {
    this.n = n; this.x = new Float32Array(n); this.y = new Float32Array(n);
    this.vx = new Float32Array(n); this.vy = new Float32Array(n);
    this.life = new Float32Array(n); this.max = new Float32Array(n); this.size = new Float32Array(n);
    this.tone = new Uint8Array(n); this.head = 0;
  }
  burst(x, y, count, tone, speed) {
    for (let i = 0; i < count; i++) {
      const k = this.head; this.head = (this.head + 1) % this.n;
      const a = Math.random() * Math.PI * 2, s = speed * (0.35 + Math.random() * 0.65);
      this.x[k] = x; this.y[k] = y; this.vx[k] = Math.cos(a) * s; this.vy[k] = Math.sin(a) * s;
      this.max[k] = this.life[k] = 0.35 + Math.random() * 0.35; this.size[k] = 2 + Math.random() * 4; this.tone[k] = tone;
    }
  }
  update(dt) {
    const damp = Math.exp(-3 * dt);
    for (let k = 0; k < this.n; k++) {
      if (this.life[k] <= 0) continue;
      this.life[k] -= dt; this.x[k] += this.vx[k] * dt; this.y[k] += this.vy[k] * dt;
      this.vx[k] *= damp; this.vy[k] *= damp;
    }
  }
}

const ACCEPTING = [GameState.BREAK, GameState.PLAYER_TURN, GameState.OPPONENT_TURN];

class Game {
  constructor(services) {
    this.cfg = CONFIG; this.ui = services.ui; this.audio = services.audio; this.store = services.store;
    this.settings = this.store.data.settings;
    this.world = new PhysicsWorld(CONFIG);
    this.rules = new MatchRules();
    this.sm = new StateMachine(GameState.MENU, STATE_TRANSITIONS);
    this.sm.onChange((next, prev) => this.ui.stateChanged(this, next, prev));
    this.particles = new ParticlePool(180);
    this.aim = { angle: 0, power: 0.5, spinX: 0, spinY: 0 };
    this.seats = [{ name: 'Pemain', control: 'local', level: 1 }, { name: 'Lawan', control: 'bot', level: 1 }];
    this.mode = 'bot'; this.difficulty = 'medium'; this.lastOptions = null;
    this.time = 0; this.paused = false; this.shake = 0;
    this.matchId = ''; this.seed = 1; this.rackCount = 0; this.breakerSeat = 0;
    this.expectedSeq = 0; this.shotPending = false; this.pendingShot = null; this.cueAnim = null; this.wasBreak = false;
    this.ballInHandZone = 'none'; this.turnLeft = 0; this.turnTotal = 1;
    this.report = null; this.shotTime = 0; this.foulTimer = 0; this.mmTimer = 0; this.foulInfo = null; this.result = null;
    this.transport = null; this.brain = null; this.botState = { t: 0, plan: null, placed: false };
    this.disconnected = false; this.attract = { t: 0, phase: 'wait' };
    this.cueStats = { force: 5, aim: 5, spin: 5, time: 5 };
    this.rng = new Rng((Math.random() * 4294967296) >>> 0);
    this._resetAttract();
  }

  /* ------------------------------ helpers ------------------------------ */
  get state() { return this.sm.state; }
  get currentSeat() { return this.rules.currentSeat; }
  get cue() { return this.world.balls[0]; }
  isTurnState() { return ACCEPTING.indexOf(this.sm.state) !== -1; }
  canControl() { return this.isTurnState() && !this.paused && !this.shotPending && !this.disconnected && this.seats[this.rules.currentSeat].control === 'local'; }
  canPlace() { return !this.paused && !this.disconnected && this.ballInHandZone !== 'none' && (this.sm.state === GameState.BALL_IN_HAND || this.isTurnState()) && !this.shotPending && this.seats[this.rules.currentSeat].control === 'local'; }
  isActiveMatch() { const s = this.sm.state; return s !== GameState.MENU && s !== GameState.MATCHMAKING && s !== GameState.GAME_OVER; }

  isPlacementValid(x, y, zone) {
    zone = zone || this.ballInHandZone;
    const R = this.world.R, W = this.world.W, H = this.world.H;
    if (x < R || x > W - R || y < R || y > H - R) return false;
    if (zone === 'head' && x > this.cfg.table.headStringX) return false;
    for (let i = 1; i < 16; i++) {
      const b = this.world.balls[i];
      if (b.state !== BallState.ON_TABLE) continue;
      if ((b.x - x) ** 2 + (b.y - y) ** 2 < (2 * R + 1) ** 2) return false;
    }
    for (const k of this.world.pockets) if ((k.x - x) ** 2 + (k.y - y) ** 2 < (k.r + 6) ** 2) return false;
    return true;
  }

  _rack(rng) {
    const T = this.cfg.table, R = T.ballRadius, balls = this.world.balls;
    const dx = R * Math.sqrt(3) + 0.35, dy = R + 0.2;
    const slots = [];
    for (let r = 0; r < 5; r++) for (let c = 0; c <= r; c++) slots.push({ x: T.footSpotX + r * dx, y: T.height / 2 + (c - r / 2) * 2 * dy });
    const solids = rng.shuffle([1, 2, 3, 4, 5, 6, 7]), stripes = rng.shuffle([9, 10, 11, 12, 13, 14, 15]);
    const order = new Array(15);
    order[4] = 8; order[10] = solids.pop(); order[14] = stripes.pop();
    const rest = rng.shuffle(solids.concat(stripes));
    for (let i = 0; i < 15; i++) if (order[i] === undefined) order[i] = rest.pop();
    for (let i = 0; i < 15; i++) {
      const b = balls[order[i]];
      b.state = BallState.ON_TABLE; b.stop(); b.x = slots[i].x; b.y = slots[i].y; b.resetOrientation(rng);
    }
    const c = balls[0];
    c.state = BallState.ON_TABLE; c.stop(); c.x = T.headStringX; c.y = T.height / 2; c.resetOrientation(null);
    this.world.events.clear(); this.world.accumulator = 0;
  }

  /* ------------------------------ menu / attract ------------------------------ */
  _resetAttract() {
    this._rack(new Rng((Math.random() * 4294967296) >>> 0));
    this.attract.t = 0; this.attract.phase = 'wait';
  }
  _updateAttract(dt) {
    const a = this.attract, w = this.world; a.t += dt;
    if (a.phase === 'wait') {
      if (a.t > 1.6) {
        const c = w.balls[0], ang = Math.atan2(w.H / 2 - c.y, this.cfg.table.footSpotX - c.x) + (Math.random() - 0.5) * 0.05;
        w.strike(Math.cos(ang), Math.sin(ang), 0.9, (Math.random() - 0.5) * 0.5, Math.random() * 0.5 - 0.1);
        a.phase = 'run'; a.t = 0;
      }
    } else {
      w.update(dt); this._consumeEvents(true);
      if ((w.allStopped() && a.t > 2.5) || a.t > 16) this._resetAttract();
    }
  }

  /* ------------------------------ match lifecycle ------------------------------ */
  startMatch(opts) {
    this._closeTransport();
    this.lastOptions = opts; this.mode = opts.mode; this.difficulty = opts.difficulty || 'medium';
    const profile = this.store.data.profile, bot = this.cfg.bots[this.difficulty];
    const myLevel = 1 + Math.floor(profile.xp / 100);
    this.seed = (Math.random() * 4294967296) >>> 0;
    if (this.mode === 'bot') this.seats = [{ name: profile.name, control: 'local', level: myLevel }, { name: bot.name, control: 'bot', level: bot.level }];
    else if (this.mode === 'local') this.seats = [{ name: 'Pemain 1', control: 'local', level: 1 }, { name: 'Pemain 2', control: 'local', level: 1 }];
    else {
      const names = this.cfg.onlineOpponents;
      this.seats = [{ name: profile.name, control: 'local', level: myLevel }, { name: names[this.seed % names.length], control: 'bot', level: 3 + (this.seed % 6) }];
    }
    this.brain = new BotBrain(this.cfg, this.mode === 'bot' ? this.difficulty : 'medium', new Rng(this.seed ^ 0x9e3779b9));
    this.matchId = 'M-' + this.seed.toString(36);
    this.cueStats = this.mode === 'local' ? { force: 5, aim: 5, spin: 5, time: 5 } : this.store.cueStats();
    this.transport = new MockTransport({ latency: this.mode === 'online' ? 110 : 0, online: this.mode === 'online' });
    this._bindTransport(this.transport);
    this.expectedSeq = 0; this.result = null; this.rackCount = 0; this.paused = false; this.disconnected = false;
    this.shotPending = false; this.cueAnim = null; this.report = null;
    this.sm.transition(GameState.MATCHMAKING);
    this.mmTimer = this.cfg.rules.matchmakingSeconds[this.mode];
    this.ui.showMatchmaking(this);
  }

  _bindTransport(t) {
    t.authority = (shot) => ShotValidator.validate(shot, {
      matchId: this.matchId, acceptsShots: this.isTurnState() && !this.cueAnim, currentSeat: this.rules.currentSeat,
      expectedSeq: this.expectedSeq, cue: { x: this.cue.x, y: this.cue.y }, ballInHandZone: this.ballInHandZone,
      isPlacementValid: (x, y) => this.isPlacementValid(x, y),
    });
    t.on('shot', (s) => this._onShotAccepted(s));
    t.on('rejected', (e) => {
      this.shotPending = false;
      if (this.seats[this.rules.currentSeat] && this.seats[this.rules.currentSeat].control === 'bot') { this.botState.plan = null; this.botState.t = 0; }
      this.ui.toast('Tembakan ditolak: ' + e.reason, 'foul');
    });
    t.on('disconnected', () => { this.disconnected = true; this.ui.toast('Koneksi terputus. Menyambung ulang…', 'foul'); this.ui.connectionChanged(this, false); });
    t.on('reconnected', (e) => {
      this.disconnected = false;
      if (e.snapshot) this.restore(e.snapshot);
      this.ui.toast('Tersambung kembali', 'ok'); this.ui.connectionChanged(this, true);
    });
  }
  _closeTransport() { if (this.transport) { this.transport.close(); this.transport = null; } }

  _finishMatchmaking() {
    this.breakerSeat = this.result || this.rackCount > 0 ? 1 - this.breakerSeat : this.seed & 1;
    this._beginRack(this.breakerSeat);
    this.sm.transition(GameState.BREAK);
    this._afterTurnStart(true);
    this.turnTotal = this.turnLeft = this.cfg.rules.breakSeconds;
  }
  _beginRack(seat) {
    this.rackCount++;
    this.rules.reset(seat);
    this._rack(new Rng(this.seed + this.rackCount * 7919));
    this.ballInHandZone = 'head';
  }
  _afterTurnStart(isBreak) {
    this.botState = { t: 0, plan: null, placed: false };
    this.shotPending = false; this.aim.spinX = 0; this.aim.spinY = 0; this.aim.power = 0.5;
    this.aim.angle = isBreak ? 0 : this._angleToNearestTarget();
    this.turnTotal = this.turnLeft = this._turnSeconds();
    this.ui.refreshPlayers(this); this._publishSnapshot();
  }
  _turnSeconds() { return this.cfg.rules.turnSeconds + (this.rules.currentSeat === 0 ? this.cueStats.time * 1.5 : 0); }
  _angleToNearestTarget() {
    const cue = this.cue, targets = this.rules.legalTargets(this.rules.currentSeat);
    let best = null, bd = Infinity;
    for (const id of targets) { const b = this.world.balls[id]; if (b.state !== BallState.ON_TABLE) continue; const d = (b.x - cue.x) ** 2 + (b.y - cue.y) ** 2; if (d < bd) { bd = d; best = b; } }
    return best ? Math.atan2(best.y - cue.y, best.x - cue.x) : 0;
  }
  _beginTurn(seat) {
    this.rules.currentSeat = seat;
    this.sm.transition(seat === 0 ? GameState.PLAYER_TURN : GameState.OPPONENT_TURN);
    this._afterTurnStart(false);
  }

  /* ------------------------------ per-frame ------------------------------ */
  update(dt) {
    this.time += dt;
    this.particles.update(dt);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 2.4);
    for (let i = 0; i < 16; i++) { const b = this.world.balls[i]; if (b.state === BallState.POCKETED && b.sinkT < 1) b.sinkT += dt / 0.12; }
    if (this.paused) return;
    switch (this.sm.state) {
      case GameState.MENU: this._updateAttract(dt); break;
      case GameState.MATCHMAKING: this.mmTimer -= dt; if (this.mmTimer <= 0) this._finishMatchmaking(); break;
      case GameState.BREAK: case GameState.PLAYER_TURN: case GameState.OPPONENT_TURN: case GameState.BALL_IN_HAND: this._updateTurn(dt); break;
      case GameState.SHOT_RESOLVING: this._updateResolving(dt); break;
      case GameState.FOUL: this.foulTimer -= dt; if (this.foulTimer <= 0) this._afterFoul(); break;
      default: break;
    }
  }

  _updateTurn(dt) {
    if (!this.shotPending && !this.disconnected) {
      this.turnLeft -= dt;
      if (this.turnLeft <= 0) { this._timeout(); return; }
    }
    this._updateBot(dt);
  }

  _timeout() {
    const loser = this.seats[this.rules.currentSeat].name;
    const next = this.rules.forceFoul();
    this.shotPending = false;
    this._foul('Waktu habis untuk ' + loser, next);
  }

  _updateResolving(dt) {
    if (this.cueAnim) {
      this.cueAnim.t += dt;
      if (this.cueAnim.t >= this.cueAnim.dur) { this.cueAnim = null; this._strike(); }
      return;
    }
    this.world.update(dt); this._consumeEvents(false); this.shotTime += dt;
    if (this.world.allStopped() || this.shotTime > this.cfg.physics.shotTimeoutSeconds) {
      if (!this.world.allStopped()) this.world.stopAll();
      this._finishShot();
    }
  }

  _consumeEvents(silent) {
    const ev = this.world.events, rep = silent ? null : this.report;
    for (let i = 0; i < ev.count; i++) {
      const e = ev.items[i];
      if (e.type === PhysicsEvent.BALL) {
        if (!silent) this.audio.play('ball', Math.min(1, e.speed / 3200));
        if (rep && rep.firstContact < 0 && (e.a === 0 || e.b === 0)) rep.firstContact = e.a === 0 ? e.b : e.a;
      } else if (e.type === PhysicsEvent.CUSHION) {
        if (!silent) this.audio.play('cushion', Math.min(1, e.speed / 2600));
        if (rep) {
          if (rep.firstContact >= 0) rep.railAfterContact = true;
          if (e.a > 0 && !rep.cushionSeen[e.a]) { rep.cushionSeen[e.a] = 1; rep.cushionBalls++; }
        }
      } else if (e.type === PhysicsEvent.POCKET) {
        if (!silent) this.audio.play('pocket', Math.min(1, e.speed / 2000));
        this.particles.burst(e.x, e.y, 14, e.a === 0 ? 1 : 0, 260);
        if (rep) { if (e.a === 0) rep.cuePocketed = true; else rep.pocketed.push(e.a); }
      }
    }
    ev.clear();
  }

  /* ------------------------------ shot flow ------------------------------ */
  _submitShot(seatIdx) {
    if (this.shotPending || !this.transport) return false;
    const cue = this.cue;
    this.shotPending = true;
    this.transport.sendShot({
      matchId: this.matchId, seat: seatIdx, seq: this.expectedSeq,
      angle: this.aim.angle, power: this.aim.power, spinX: this.aim.spinX, spinY: this.aim.spinY,
      cue: { x: cue.x, y: cue.y },
    });
    return true;
  }

  _onShotAccepted(shot) {
    if (!this.isTurnState()) return;
    this.shotPending = false; this.pendingShot = shot; this.expectedSeq++;
    this.cue.x = shot.cue.x; this.cue.y = shot.cue.y; this.cue.state = BallState.ON_TABLE;
    this.aim.angle = shot.angle; this.aim.power = shot.power; this.aim.spinX = shot.spinX; this.aim.spinY = shot.spinY;
    this.wasBreak = this.rules.isBreak; this.ballInHandZone = 'none';
    this.cueAnim = { t: 0, dur: this.cfg.aim.cueAnimSeconds };
    this.sm.transition(GameState.SHOT_RESOLVING);
  }

  _strike() {
    const s = this.pendingShot;
    this.report = { seat: s.seat, isBreak: this.wasBreak, firstContact: -1, pocketed: [], cuePocketed: false, railAfterContact: false, cushionBalls: 0, cushionSeen: new Uint8Array(16) };
    const st = this.cueStats, mine = s.seat === 0;      // perk cue hanya untuk seat 0 (bukan mode dua pemain)
    const fm = mine ? 0.92 + st.force * 0.016 : 1, sm = mine ? 0.8 + st.spin * 0.04 : 1;
    this.world.strike(Math.cos(s.angle), Math.sin(s.angle), s.power * fm, s.spinX * sm, s.spinY * sm);
    this.shotTime = 0;
    this.audio.play('cue', s.power);
    if (this.wasBreak) { this.audio.play('break'); this.shake = 1; }
  }

  _finishShot() {
    const rep = this.report; this.report = null;
    const res = this.rules.evaluate(rep);
    if (res.reRack) {
      this._beginRack(res.nextSeat);
      this.ui.toast('Bola 8 masuk saat break — bola disusun ulang', 'info');
      this.sm.transition(GameState.BREAK); this._afterTurnStart(true);
      this.turnTotal = this.turnLeft = this.cfg.rules.breakSeconds;
      return;
    }
    if (rep.cuePocketed) this._respotCue();
    if (res.assigned) {
      const who = this.seats[res.assigned.seat].name, g = res.assigned.group === 'solid' ? 'bola penuh (1–7)' : 'bola strip (9–15)';
      this.ui.toast(who + ' memegang ' + g, 'info');
    }
    if (res.gameOver) { this._endMatch(res.gameOver.winner, res.gameOver.reason); return; }
    if (res.foul) { this._foul(res.foul, res.nextSeat); return; }
    if (res.continueTurn) this.ui.toast('Lanjut menembak', 'ok');
    this._beginTurn(res.nextSeat);
  }

  _respotCue() {
    const T = this.cfg.table, cue = this.cue;
    cue.state = BallState.ON_TABLE; cue.stop(); cue.resetOrientation(null);
    let best = null;
    for (let r = 0; r < 900 && !best; r += 28) {
      const steps = r === 0 ? 1 : Math.ceil(r / 14);
      for (let i = 0; i < steps; i++) {
        const a = (i / steps) * Math.PI * 2, x = T.headStringX + Math.cos(a) * r, y = T.height / 2 + Math.sin(a) * r;
        if (this.isPlacementValid(x, y, 'any')) { best = { x, y }; break; }
      }
    }
    cue.x = best ? best.x : T.headStringX; cue.y = best ? best.y : T.height / 2;
  }

  _foul(reason, nextSeat) {
    this.foulInfo = { reason, seat: nextSeat };
    this.ballInHandZone = 'any'; this.foulTimer = this.cfg.rules.foulBannerSeconds;
    this.cueAnim = null; this.shotPending = false;
    this.sm.transition(GameState.FOUL);
    this.ui.toast('Foul — ' + reason, 'foul'); this.audio.play('foul');
    this.ui.refreshPlayers(this);
  }
  _afterFoul() {
    this.sm.transition(GameState.BALL_IN_HAND);
    this.botState = { t: 0, plan: null, placed: false };
    this.turnTotal = this.turnLeft = this._turnSeconds();
    this.aim.angle = this._angleToNearestTarget();
    this.ui.refreshPlayers(this); this._publishSnapshot();
  }

  _endMatch(winner, reason) {
    const youWon = winner === 0;
    let reward = 0;
    if (this.mode === 'bot') reward = youWon ? this.cfg.bots[this.difficulty].reward : 10;
    else if (this.mode === 'online') reward = youWon ? 120 : 15;
    this.result = { winner, reason, youWon, reward, mode: this.mode, winnerName: this.seats[winner].name };
    if (this.mode !== 'local') this.store.recordMatch(this.result);
    this.sm.transition(GameState.GAME_OVER);
    this.audio.play(this.mode === 'local' || youWon ? 'win' : 'lose');
    this.ui.showResult(this);
  }

  /* ------------------------------ bot ------------------------------ */
  _botView() {
    return { balls: this.world.balls, pockets: this.world.pockets, targets: this.rules.legalTargets(this.rules.currentSeat), zone: this.ballInHandZone, isPlacementValid: (x, y) => this.isPlacementValid(x, y) };
  }
  _updateBot(dt) {
    const idx = this.rules.currentSeat, seat = this.seats[idx];
    if (!seat || seat.control !== 'bot' || this.shotPending || this.disconnected) return;
    const b = this.botState; b.t += dt;
    if (this.sm.state === GameState.BALL_IN_HAND) {
      if (!b.placed && b.t > 0.8) {
        const p = this.brain.choosePlacement(this._botView());
        if (p) this._setCue(p.x, p.y);
        b.placed = true; b.t = 0;
      } else if (b.placed && b.t > 0.55) this.confirmPlacement();
      return;
    }
    if (!b.plan) {
      b.plan = this.rules.isBreak ? this.brain.planBreak(this.cue) : this.brain.planShot(this._botView());
      const th = this.cfg.bots[this.mode === 'bot' ? this.difficulty : 'medium'].think;
      b.think = th[0] + this.rng.next() * (th[1] - th[0]); b.t = 0; b.startAngle = this.aim.angle;
    }
    const a = this.aim, p = b.plan;
    a.angle = Util.lerpAngle(b.startAngle, p.angle, Util.easeOutCubic(b.t / (b.think * 0.7)));
    const pk = Util.smooth((b.t - b.think * 0.5) / (b.think * 0.5));
    a.power = 0.05 + (p.power - 0.05) * pk; a.spinX = p.spinX * pk; a.spinY = p.spinY * pk;
    if (b.t >= b.think) { a.angle = p.angle; a.power = p.power; a.spinX = p.spinX; a.spinY = p.spinY; this._submitShot(idx); }
  }

  /* ------------------------------ input API (pemain lokal) ------------------------------ */
  setAimAngle(a) { if (this.canControl()) this.aim.angle = Util.wrapAngle(a); }
  nudgeAim(d) { if (this.canControl()) this.aim.angle = Util.wrapAngle(this.aim.angle + d); }
  setPower(p) { if (this.canControl()) this.aim.power = Util.clamp(p, 0, 1); }
  setSpin(x, y) {
    if (!this.canControl()) return;
    const l = Math.sqrt(x * x + y * y), k = l > 1 ? 1 / l : 1;
    this.aim.spinX = x * k; this.aim.spinY = y * k;
  }
  requestShot() {
    if (!this.canControl() || this.aim.power < 0.03) return false;
    return this._submitShot(this.rules.currentSeat);
  }
  _setCue(x, y) { this.cue.x = x; this.cue.y = y; this.cue.stop(); this.cue.dirty = true; }
  /** Geser bola putih (ball-in-hand / break). Mengembalikan true jika posisi diterima. */
  moveCue(x, y) {
    if (!this.canPlace()) return false;
    const T = this.cfg.table, R = T.ballRadius;
    const maxX = this.ballInHandZone === 'head' ? T.headStringX : T.width - R;
    x = Util.clamp(x, R, maxX); y = Util.clamp(y, R, T.height - R);
    if (this.isPlacementValid(x, y)) { this._setCue(x, y); return true; }
    if (this.isPlacementValid(x, this.cue.y)) { this._setCue(x, this.cue.y); return true; }
    if (this.isPlacementValid(this.cue.x, y)) { this._setCue(this.cue.x, y); return true; }
    return false;
  }
  confirmPlacement() {
    if (this.sm.state !== GameState.BALL_IN_HAND) return false;
    const seat = this.rules.currentSeat;
    this.sm.transition(seat === 0 ? GameState.PLAYER_TURN : GameState.OPPONENT_TURN);
    this.botState = { t: 0, plan: null, placed: false };
    this.ui.refreshPlayers(this);
    return true;
  }

  /* ------------------------------ pause / navigasi ------------------------------ */
  setPaused(p) { if (p && !this.isActiveMatch()) return; this.paused = p; this.ui.pausedChanged(this, p); }
  quitToMenu() {
    this._closeTransport(); this.paused = false; this.disconnected = false; this.cueAnim = null; this.shotPending = false;
    if (this.sm.state !== GameState.MENU) this.sm.transition(GameState.MENU);
    this._resetAttract(); this.ui.pausedChanged(this, false);
  }
  restartMatch() { const o = this.lastOptions; this.quitToMenu(); if (o) this.startMatch(o); }
  rematch() { if (this.lastOptions && this.sm.state === GameState.GAME_OVER) this.startMatch(this.lastOptions); }
  simulateDisconnect() { if (this.transport && this.mode === 'online' && this.isTurnState()) { this.transport.disconnect(); this.transport.reconnect(); return true; } return false; }

  /* ------------------------------ snapshot (reconnect) ------------------------------ */
  serialize() {
    const r = this.rules;
    return {
      matchId: this.matchId, state: this.sm.state, expectedSeq: this.expectedSeq, zone: this.ballInHandZone, rackCount: this.rackCount,
      balls: this.world.balls.map((b) => ({ id: b.id, state: b.state, x: b.x, y: b.y })),
      rules: { groups: r.groups.slice(), tableOpen: r.tableOpen, currentSeat: r.currentSeat, isBreak: r.isBreak, pocketed: Array.from(r.pocketedIds) },
    };
  }
  _publishSnapshot() { if (this.transport) this.transport.publishSnapshot(this.serialize()); }
  restore(s) {
    if (!s || s.matchId !== this.matchId) return;
    for (const d of s.balls) { const b = this.world.balls[d.id]; b.state = d.state; b.x = d.x; b.y = d.y; b.stop(); b.dirty = true; }
    const r = this.rules; r.groups = s.rules.groups.slice(); r.tableOpen = s.rules.tableOpen; r.currentSeat = s.rules.currentSeat; r.isBreak = s.rules.isBreak; r.pocketedIds = new Set(s.rules.pocketed);
    this.expectedSeq = s.expectedSeq; this.ballInHandZone = s.zone; this.shotPending = false; this.cueAnim = null;
    if (this.sm.state !== s.state) this.sm.restore(s.state);
    this.ui.refreshPlayers(this);
  }

  /* ------------------------------ untuk renderer ------------------------------ */
  cuePullDistance() {
    const pm = this.cfg.aim.pullMax;
    if (this.cueAnim && this.pendingShot) { const k = Math.min(1, this.cueAnim.t / this.cueAnim.dur); return this.pendingShot.power * pm * (1 - k * k); }
    return this.aim.power * pm;
  }
  cueVisible() {
    const s = this.sm.state;
    if (s === GameState.SHOT_RESOLVING) return !!this.cueAnim;
    return this.isTurnState() && this.cue.state === BallState.ON_TABLE;
  }
  aimLineVisible() { return this.canControl(); }
  aimGuideLength() { return 260 + this.cueStats.aim * 60; }
}
