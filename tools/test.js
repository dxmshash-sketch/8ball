// Uji headless (Node 18+, tanpa dependensi): geometri, physics, aturan, dan pertandingan bot vs bot lewat kelas Game asli.
const fs = require('fs'), path = require('path'), vm = require('vm');
const load = ['01-config', '02-core', '03-physics', '04-rules', '05-net', '06-bot', '07-game'].map((f) => fs.readFileSync(path.join(__dirname, '..', 'src', f + '.js'), 'utf8')).join('\n');
const ctx = vm.createContext({ console, setTimeout, clearTimeout, Math, Set, Map, Float32Array, Float64Array, Uint8Array, Proxy, Error, Object, Array, Number, JSON, isFinite });
vm.runInContext(load + '\nthis.__x={CONFIG,buildTableGeometry,PhysicsWorld,Rng,Game,MatchRules,ShotValidator,GameState};', ctx);
const { CONFIG, buildTableGeometry, PhysicsWorld, Rng, Game, MatchRules, ShotValidator } = ctx.__x;
let failed = 0;
const ok = (name, cond, info) => { console.log((cond ? 'PASS ' : 'FAIL ') + name + (info ? '  ' + info : '')); if (!cond) failed++; };

// geometri
const G = buildTableGeometry(CONFIG.table), A = G.pocketShapes[0], S = G.pocketShapes[1], d = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
ok('mulut corner 58', Math.abs(d(A.tipA, A.tipB) - 58) < 0.1); ok('leher corner < mulut', d(A.baseA, A.baseB) < d(A.tipA, A.tipB));
ok('mulut side 52', Math.abs(d(S.tipA, S.tipB) - 52) < 0.1); ok('leher side < mulut', d(S.baseA, S.baseB) < d(S.tipA, S.tipB));
ok('cushion trapesium (dasar > nose)', G.cushions[0][2][0] - G.cushions[0][3][0] > G.cushions[0][1][0] - G.cushions[0][0][0]);

// physics
const fresh = () => { const w = new PhysicsWorld(CONFIG); for (const b of w.balls) { b.state = 1; b.stop(); } return w; };
const put = (w, i, x, y) => { const b = w.balls[i]; b.state = 0; b.x = x; b.y = y; b.stop(); };
const run = (w, s) => { for (let t = 0; t < s; t += 1 / 60) w.update(1 / 60); };
{ const w = fresh(); put(w, 1, 300, 300); w.balls[1].vx = w.balls[1].rvx = -500; w.balls[1].vy = w.balls[1].rvy = -500; run(w, 1.2); ok('bola masuk corner lewat mulut', w.balls[1].state === 1); }
{ const w = fresh(); put(w, 1, 800, 300); w.balls[1].vy = w.balls[1].rvy = -500; run(w, 1.2); ok('bola masuk side pocket', w.balls[1].state === 1); }
{ const x = {}; for (const [n, sy] of [['draw', -1], ['stop', 0], ['follow', 1]]) { const w = fresh(); put(w, 0, 300, 364); put(w, 1, 600, 364); w.strike(1, 0, 0.16, 0, sy); run(w, 4); x[n] = w.balls[0].x; }
  ok('draw < stop < follow', x.draw < x.stop && x.stop < x.follow, JSON.stringify(x)); }
{ let out = 0; for (let k = 0; k < 24; k++) { const w = fresh(); put(w, 0, 800, 364); w.strike(Math.cos(k * Math.PI / 12 + 0.07), Math.sin(k * Math.PI / 12 + 0.07), 1, 0, 0); run(w, 10); const c = w.balls[0]; if (c.state === 0 && (c.x < 0 || c.x > 1600 || c.y < 0 || c.y > 728)) out++; } ok('tidak ada bola tembus cushion', out === 0); }

// aturan
{ const r = new MatchRules(); r.reset(0); const rep = { firstContact: 1, pocketed: [1], cuePocketed: false, railAfterContact: true, cushionBalls: 5 }; r.evaluate(rep);
  ok('break sah dengan bola masuk: giliran lanjut', r.currentSeat === 0);
  const res = r.evaluate({ firstContact: 9, pocketed: [], cuePocketed: false, railAfterContact: true, cushionBalls: 0 });
  ok('meja terbuka: menyentuh bola 9 legal, tanpa foul', !res.foul); }
{ const r = new MatchRules(); r.reset(0); r.isBreak = false; r.groups = ['solid', 'stripe']; r.tableOpen = false; r.pocketedIds = new Set([1, 2, 3, 4, 5, 6, 7]);
  const res = r.evaluate({ firstContact: 8, pocketed: [8], cuePocketed: false, railAfterContact: true, cushionBalls: 0 }); ok('bola 8 sah setelah semua bola habis = menang', res.gameOver && res.gameOver.winner === 0); }
{ const r = new MatchRules(); r.reset(0); r.isBreak = false; r.groups = ['solid', 'stripe']; r.tableOpen = false;
  const res = r.evaluate({ firstContact: 1, pocketed: [8], cuePocketed: false, railAfterContact: true, cushionBalls: 0 }); ok('bola 8 terlalu cepat = kalah', res.gameOver && res.gameOver.winner === 1); }

// validator anti-cheat
{ const view = { matchId: 'M', acceptsShots: true, currentSeat: 0, expectedSeq: 3, cue: { x: 400, y: 364 }, ballInHandZone: 'none', isPlacementValid: () => true };
  const shot = { matchId: 'M', seat: 0, seq: 3, angle: 0.3, power: 0.5, spinX: 0, spinY: 0, cue: { x: 400, y: 364 } };
  ok('shot valid diterima', ShotValidator.validate(shot, view) === null);
  ok('bukan giliran ditolak', ShotValidator.validate({ ...shot, seat: 1 }, view) !== null);
  ok('power >1 ditolak', ShotValidator.validate({ ...shot, power: 1.5 }, view) !== null);
  ok('replay seq ditolak', ShotValidator.validate({ ...shot, seq: 2 }, view) !== null);
  ok('teleport bola putih ditolak', ShotValidator.validate({ ...shot, cue: { x: 900, y: 300 } }, view) !== null); }

// pertandingan penuh bot vs bot (state machine tervalidasi: transisi ilegal akan melempar error)
const nul = new Proxy({}, { get: () => () => {} });
for (let i = 1; i <= 3; i++) {
  const r = new Rng(i * 101); const realRandom = Math.random; Math.random = () => r.next();
  const store = { data: { profile: { name: 'T', coins: 0, xp: 0, wins: 0, losses: 0 }, settings: {} }, recordMatch() {}, cueStats: () => ({ force: 5, aim: 5, spin: 5, time: 5 }) };
  const g = new Game({ ui: nul, audio: nul, store }); g.startMatch({ mode: 'bot', difficulty: ['easy', 'medium', 'hard'][i - 1] });
  let t = 0; try { while (g.state !== 'GAME_OVER' && t < 3000) { g.update(1 / 60); t += 1 / 60; if (['PLAYER_TURN', 'OPPONENT_TURN', 'BREAK', 'BALL_IN_HAND'].includes(g.state)) g.seats[g.currentSeat].control = 'bot'; } } catch (e) { ok('match ' + i + ' tanpa error', false, e.message); }
  Math.random = realRandom;
  ok('match bot vs bot #' + i + ' selesai', g.state === 'GAME_OVER', g.result && g.result.reason);
}
console.log(failed ? '\n' + failed + ' tes gagal' : '\nSemua tes lulus'); process.exit(failed ? 1 : 0);
