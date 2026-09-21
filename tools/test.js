// Uji headless (Node 18+, tanpa dependensi): geometri, physics, aturan, validator, ekonomi/level/hadiah, dan pertandingan penuh.
const fs = require('fs'), path = require('path'), vm = require('vm');
const src = (f) => fs.readFileSync(path.join(__dirname, '..', 'src', f + '.js'), 'utf8');
const mem = {}; const window = { localStorage: { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } } };
const ctx = vm.createContext({ console, setTimeout, clearTimeout, Math, Set, Map, Float32Array, Float64Array, Uint8Array, Proxy, Error, Object, Array, Number, JSON, isFinite, Date, window, String, parseFloat, Image: function () {} });
const code = ['01-config', '02-core', '03-physics', '04-rules', '05-net', '06-bot', '07-game'].map(src).join('\n') +
  "\nconst CUE_IMAGES = new Proxy({}, { get: () => 'data:image/png;base64,AAAA' });\n" + ['09-content', '10-store', '11-leaderboard'].map(src).join('\n') +
  '\nthis.__x={CONFIG,buildTableGeometry,PhysicsWorld,Rng,Game,MatchRules,ShotValidator,Store,levelInfo,xpForLevel,rewardsForLevel,BETS,HOUSE_FEE,START_COINS,TABLE_THEMES,CUE_CATALOG,MockLeaderboard,botAvatar,AVATAR_COLORS,fmtShort,BADGE_DEFS,DAILY_REWARDS};';
vm.runInContext(code, ctx);
const X = ctx.__x; const { CONFIG, buildTableGeometry, PhysicsWorld, Rng, Game, MatchRules, ShotValidator, Store, levelInfo, rewardsForLevel } = X;
let failed = 0;
const ok = (name, cond, info) => { console.log((cond ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + info : '')); if (!cond) failed++; };
const freshStore = () => { for (const k of Object.keys(mem)) delete mem[k]; return new Store(); };

/* ---- geometri ---- */
const G = buildTableGeometry(CONFIG.table), A = G.pocketShapes[0], S = G.pocketShapes[1], d = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
ok('mulut corner 58', Math.abs(d(A.tipA, A.tipB) - 58) < 0.1); ok('leher corner < mulut', d(A.baseA, A.baseB) < d(A.tipA, A.tipB));
ok('mulut side 52', Math.abs(d(S.tipA, S.tipB) - 52) < 0.1); ok('leher side < mulut', d(S.baseA, S.baseB) < d(S.tipA, S.tipB));
ok('cushion trapesium (dasar > nose)', G.cushions[0][2][0] - G.cushions[0][3][0] > G.cushions[0][1][0] - G.cushions[0][0][0]);

/* ---- physics ---- */
const fresh = () => { const w = new PhysicsWorld(CONFIG); for (const b of w.balls) { b.state = 1; b.stop(); } return w; };
const put = (w, i, x, y) => { const b = w.balls[i]; b.state = 0; b.x = x; b.y = y; b.stop(); };
const run = (w, s) => { for (let t = 0; t < s; t += 1 / 60) w.update(1 / 60); };
{ const w = fresh(); put(w, 1, 300, 300); w.balls[1].vx = w.balls[1].rvx = -500; w.balls[1].vy = w.balls[1].rvy = -500; run(w, 1.2); ok('bola masuk corner lewat mulut', w.balls[1].state === 1); }
{ const w = fresh(); put(w, 1, 800, 300); w.balls[1].vy = w.balls[1].rvy = -500; run(w, 1.2); ok('bola masuk side pocket', w.balls[1].state === 1); }
{ const x = {}; for (const [n, sy] of [['draw', -1], ['stop', 0], ['follow', 1]]) { const w = fresh(); put(w, 0, 300, 364); put(w, 1, 600, 364); w.strike(1, 0, 0.16, 0, sy); run(w, 4); x[n] = w.balls[0].x; } ok('draw < stop < follow', x.draw < x.stop && x.stop < x.follow, JSON.stringify(x)); }
{ let out = 0; for (let k = 0; k < 24; k++) { const w = fresh(); put(w, 0, 800, 364); w.strike(Math.cos(k * Math.PI / 12 + 0.07), Math.sin(k * Math.PI / 12 + 0.07), 1, 0, 0); run(w, 10); const c = w.balls[0]; if (c.state === 0 && (c.x < 0 || c.x > 1600 || c.y < 0 || c.y > 728)) out++; } ok('tidak ada bola tembus cushion', out === 0); }

/* ---- aturan & validator ---- */
{ const r = new MatchRules(); r.reset(0); r.evaluate({ firstContact: 1, pocketed: [1], cuePocketed: false, railAfterContact: true, cushionBalls: 5 }); ok('break sah dengan bola masuk: giliran lanjut', r.currentSeat === 0);
  ok('meja terbuka: bola 9 legal', !r.evaluate({ firstContact: 9, pocketed: [], cuePocketed: false, railAfterContact: true, cushionBalls: 0 }).foul); }
{ const r = new MatchRules(); r.reset(0); r.isBreak = false; r.groups = ['solid', 'stripe']; r.tableOpen = false; r.pocketedIds = new Set([1, 2, 3, 4, 5, 6, 7]);
  const res = r.evaluate({ firstContact: 8, pocketed: [8], cuePocketed: false, railAfterContact: true, cushionBalls: 0 }); ok('bola 8 sah setelah semua bola habis = menang', res.gameOver && res.gameOver.winner === 0); }
{ const r = new MatchRules(); r.reset(0); r.isBreak = false; r.groups = ['solid', 'stripe']; r.tableOpen = false;
  const res = r.evaluate({ firstContact: 1, pocketed: [8], cuePocketed: false, railAfterContact: true, cushionBalls: 0 }); ok('bola 8 terlalu cepat = kalah', res.gameOver && res.gameOver.winner === 1); }
{ const view = { matchId: 'M', acceptsShots: true, currentSeat: 0, expectedSeq: 3, cue: { x: 400, y: 364 }, ballInHandZone: 'none', isPlacementValid: () => true };
  const shot = { matchId: 'M', seat: 0, seq: 3, angle: 0.3, power: 0.5, spinX: 0, spinY: 0, cue: { x: 400, y: 364 } };
  ok('shot valid diterima', ShotValidator.validate(shot, view) === null); ok('bukan giliran ditolak', ShotValidator.validate({ ...shot, seat: 1 }, view) !== null);
  ok('power >1 ditolak', ShotValidator.validate({ ...shot, power: 1.5 }, view) !== null); ok('replay seq ditolak', ShotValidator.validate({ ...shot, seq: 2 }, view) !== null);
  ok('teleport bola putih ditolak', ShotValidator.validate({ ...shot, cue: { x: 900, y: 300 } }, view) !== null); }

/* ---- level & hadiah ---- */
{ ok('level 1 di XP 0', levelInfo(0).level === 1); ok('level 2 tepat di 100 XP', levelInfo(100).level === 2 && levelInfo(100).into === 0);
  let prev = 0, mono = true; for (let xp = 0; xp < 20000; xp += 37) { const l = levelInfo(xp).level; if (l < prev) mono = false; prev = l; } ok('level monoton naik terhadap XP', mono);
  ok('level 1 tanpa hadiah', rewardsForLevel(1).length === 0); ok('level 5: koin + cue', rewardsForLevel(5).some((i) => i.type === 'cue'));
  ok('level 7: ada tema meja', rewardsForLevel(7).some((i) => i.type === 'table')); ok('level 3: ada avatar', rewardsForLevel(3).some((i) => i.type === 'avatar'));
  ok('semua hadiah level merujuk konten yang ada', Array.from({ length: 80 }, (_, i) => rewardsForLevel(i + 1)).flat().every((it) => it.type === 'coins' || (it.type === 'cue' && X.CUE_CATALOG.some((c) => c.id === it.id)) || (it.type === 'table' && X.TABLE_THEMES.some((t) => t.id === it.id)) || it.type === 'avatar')); }

/* ---- ekonomi (Store) ---- */
{ const st = freshStore();
  ok('akun baru mendapat 30.000 koin', st.coins === 30000 && X.START_COINS === 30000);
  ok('taruhan sampai jutaan tersedia', X.BETS[X.BETS.length - 1] >= 5000000 && X.BETS.includes(1000000));
  ok('spend tidak boleh melebihi saldo', st.spend(30001) === false && st.coins === 30000); ok('spend valid', st.spend(1000) && st.coins === 29000);
  const s2 = freshStore(); s2.spend(1000); const r = s2.recordMatch({ youWon: true, bet: 1000, potted: 5 });
  ok('menang: payout = 2×taruhan − biaya 5%', r.payout === 1900 && s2.coins === 29000 + 1900, 'saldo ' + s2.coins);
  ok('menang memberi XP & badge pertama', r.xpGain > 40 && r.newBadges.some((b) => b.id === 'first_win'));
  const s3 = freshStore(); s3.spend(500); const r3 = s3.recordMatch({ youWon: false, bet: 500, potted: 0 }); ok('kalah: tanpa payout, streak reset', r3.payout === 0 && s3.data.stats.streak === 0 && s3.coins === 29500);
  const s4 = freshStore(); s4.data.profile.xp = 95; s4.recordMatch({ youWon: true, bet: 100 }); ok('naik level menghasilkan hadiah yang bisa diklaim', s4.claimableLevels().length === 1 && s4.hasClaimable());
  const before = s4.coins, got = s4.claimAllLevels(); ok('klaim menambah koin & maju claimedLevel', s4.coins > before && s4.data.progress.claimedLevel === 2 && s4.claimableLevels().length === 0);
  ok('klaim level tidak bisa dua kali', s4.claimLevel(2) === null);
  const s5 = freshStore(); const t0 = new Date(2026, 8, 20, 10); ok('hadiah harian tersedia', s5.dailyStatus(t0).available); const a1 = s5.claimDaily(t0);
  ok('hadiah harian hanya sekali per hari', a1 === 5000 && s5.claimDaily(new Date(2026, 8, 20, 22)) === null);
  const a2 = s5.claimDaily(new Date(2026, 8, 21, 9)); ok('streak harian naik → hadiah hari ke-2', a2 === 7500, 'hari ke-2: ' + a2);
  const a3 = s5.claimDaily(new Date(2026, 8, 24, 9)); ok('streak putus → kembali ke hari 1', a3 === 5000);
  const s6 = freshStore(); ok('tidak bisa beli meja mahal dengan saldo kurang', !s6.buyTable('hitam') && !s6.themeOwned('hitam')); ok('beli meja murah berhasil', s6.buyTable('turnamen') && s6.coins === 30000 - 8000 && s6.equipTable('turnamen'));
  ok('cue terkunci tidak bisa dipakai', !s6.equipCue('garuda')); ok('unlock cue rare', s6.unlockCue('kristal') && s6.equipCue('kristal'));
  const s7 = freshStore(); ok('avatar terkunci ditolak', !s7.setAvatar('sym', 'crown')); s7.grant({ type: 'avatar', id: 'sym:crown' }); ok('avatar terbuka setelah hadiah', s7.setAvatar('sym', 'crown'));
  const s8 = freshStore(); s8.data.profile.coins = 10; ok('bantuan koin saat hampir bangkrut', s8.helpAvailable() && s8.claimHelp() === 3000 && !s8.helpAvailable()); }

/* ---- konten kustom (DIY) ---- */
{ const st = freshStore(); const good = JSON.stringify({ format: 'pantul-skins', version: 1, cues: [{ id: 'c1', name: 'X', image: 'data:image/png;base64,AAAA', base: 'maple' }], tables: [{ id: 't1', name: 'T', cloth: { a: '#fff', b: '#eee', c: '#ddd' }, cushion: { base: '#111', mid: '#222', nose: '#333' }, rail: { style: 'wood', a: '#111', b: '#222', c: '#333', d: '#000' } }] });
  const r = st.importCustom(good); ok('impor skin valid', r.ok && r.count === 2 && st.allCues().some((c) => c.id === 'c1') && st.themeOwned('t1'));
  ok('impor menolak JSON rusak / format lain', !st.importCustom('bukan json').ok && !st.importCustom('{"a":1}').ok);
  ok('impor menolak gambar bukan data URI', st.importCustom(JSON.stringify({ format: 'pantul-skins', cues: [{ id: 'evil', name: 'E', image: 'https://x.y/z.png' }], tables: [] })).count === 0);
  st.equipCue('c1'); st.removeCustom('cues', 'c1'); ok('hapus skin yang dipakai → kembali ke default', st.data.cues.equipped === 'maple');
  ok('ekspor → impor bolak-balik', freshStore().importCustom(st.exportCustom()).ok); }

/* ---- leaderboard ---- */
{ const st = freshStore(), lb = new X.MockLeaderboard(st);
  for (const k of ['coins', 'level', 'wins']) { const rows = lb.fetch(k); ok('leaderboard ' + k + ': terurut & ada pemain', rows.length === 61 && rows.every((r, i) => i === 0 || rows[i - 1].value >= r.value) && rows.filter((r) => r.isYou).length === 1); }
  st.data.profile.coins = 9e12; ok('pemain terkaya = peringkat 1', lb.fetch('coins').find((r) => r.isYou).rank === 1);
  ok('avatar bot selalu valid', ['Raka99', 'Bima88', 'zzz', 'Ayu_pool'].every((n) => { const a = X.botAvatar(n); return a.color >= 0 && a.color < X.AVATAR_COLORS.length; })); }

/* ---- Game + taruhan + pertandingan penuh ---- */
const nul = new Proxy({}, { get: () => () => {} });
{ const st = freshStore(), g = new Game({ ui: nul, audio: nul, store: st });
  ok('startMatch memotong taruhan', g.startMatch({ mode: 'bot', difficulty: 'easy', bet: 5000 }) === true && st.coins === 25000 && g.bet === 5000);
  g.quitToMenu(); ok('batal saat matchmaking → taruhan dikembalikan penuh', st.coins === 30000 && st.data.stats.losses === 0);
  g.startMatch({ mode: 'bot', difficulty: 'easy', bet: 5000 }); for (let i = 0; i < 200 && g.state !== 'BREAK'; i++) g.update(1 / 60);
  const f = g.forfeit(); ok('keluar di tengah = kalah (taruhan hangus)', f && f.payout === 0 && st.data.stats.losses === 1 && st.coins === 25000);
  g.quitToMenu(); const st2 = freshStore(), g2 = new Game({ ui: nul, audio: nul, store: st2 }); st2.data.profile.coins = 50;
  ok('saldo kurang → startMatch ditolak tanpa memotong', g2.startMatch({ mode: 'bot', bet: 100 }) === false && st2.coins === 50 && g2.state === 'MENU');
  const g3 = new Game({ ui: nul, audio: nul, store: freshStore() }); ok('mode dua pemain tanpa taruhan', g3.startMatch({ mode: 'local', bet: 999999 }) && g3.bet === 0 && g3.store.coins === 30000); }
for (let i = 1; i <= 3; i++) {
  const r = new Rng(i * 101); const realRandom = Math.random; Math.random = () => r.next();
  const st = freshStore(), g = new Game({ ui: nul, audio: nul, store: st }); g.startMatch({ mode: 'bot', difficulty: ['easy', 'medium', 'hard'][i - 1], bet: 1000 });
  let t = 0, err = null; try { while (g.state !== 'GAME_OVER' && t < 3000) { g.update(1 / 60); t += 1 / 60; if (['PLAYER_TURN', 'OPPONENT_TURN', 'BREAK', 'BALL_IN_HAND'].includes(g.state)) g.seats[g.currentSeat].control = 'bot'; } } catch (e) { err = e.message; }
  Math.random = realRandom;
  ok('match bot vs bot #' + i + ' selesai tanpa error', g.state === 'GAME_OVER' && !err, err || g.result.reason);
  ok('  ekonomi konsisten (saldo = 29000 + payout)', g.state === 'GAME_OVER' && st.coins === 30000 - 1000 + g.result.summary.payout && st.data.stats.matches === 1);
}
console.log(failed ? '\n' + failed + ' tes gagal' : '\nSemua tes lulus'); process.exit(failed ? 1 : 0);
