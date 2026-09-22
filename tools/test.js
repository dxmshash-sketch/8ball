// Uji headless (Node 18+, tanpa dependensi): geometri, physics, aturan, validator, ekonomi/level/hadiah, dan pertandingan penuh.
const fs = require('fs'), path = require('path'), vm = require('vm');
const src = (f) => fs.readFileSync(path.join(__dirname, '..', 'src', f + '.js'), 'utf8');
const mem = {}; const window = { localStorage: { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } } };
const ctx = vm.createContext({ console, setTimeout, clearTimeout, Math, Set, Map, Float32Array, Float64Array, Uint8Array, Proxy, Error, Object, Array, Number, JSON, isFinite, Date, window, String, parseFloat, Image: function () {} });
const code = ['01-config', '02-core', '03-physics', '04-rules', '05-net', '06-bot', '07-game'].map(src).join('\n') +
  "\nconst CUE_IMAGES = new Proxy({}, { get: () => 'data:image/png;base64,AAAA' });\n" + ['09-content', '10-store', '11-leaderboard'].map(src).join('\n') +
  '\nthis.__x={NineBallRules,CONFIG,buildTableGeometry,PhysicsWorld,Rng,Game,MatchRules,ShotValidator,Store,levelInfo,xpForLevel,rewardsForLevel,BETS,HOUSE_FEE,START_COINS,TABLE_THEMES,CUE_CATALOG,MockLeaderboard,botAvatar,AVATAR_COLORS,fmtShort,BADGE_DEFS,DAILY_REWARDS,TABLE_PROFILES,applyTableProfile};';
vm.runInContext(code, ctx);
const X = ctx.__x; const { NineBallRules, CONFIG, buildTableGeometry, PhysicsWorld, Rng, Game, MatchRules, ShotValidator, Store, levelInfo, rewardsForLevel, TABLE_PROFILES, applyTableProfile } = X;
const PHYSICS_BASE_TEST = CONFIG.physics.maxShotSpeed;
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

/* ---- 9-ball: aturan ---- */
{
  const rep9 = (o) => Object.assign({ firstContact: 1, pocketed: [], pocketedAt: [], call: -1, cuePocketed: false, railAfterContact: true, cushionBalls: 0 }, o);
  const mk = (variant, brk) => { const r = new NineBallRules(variant); r.reset(0); if (!brk) r.isBreak = false; return r; };
  { const r = mk('standard', true), res = r.evaluate(rep9({ pocketed: [4], pocketedAt: [{ id: 4, pocket: 2 }] })); ok('9B break sah + bola masuk: lanjut menembak', !res.foul && res.continueTurn && r.currentSeat === 0); }
  { const r = mk('standard', true), res = r.evaluate(rep9({ cushionBalls: 3 })); ok('9B break tanpa bola masuk & <4 cushion = foul', !!res.foul && res.ballInHand === 'any' && r.currentSeat === 1); }
  { const r = mk('standard', true), res = r.evaluate(rep9({ cushionBalls: 4 })); ok('9B break 4 bola kena cushion sah, giliran pindah', !res.foul && !res.continueTurn && r.currentSeat === 1); }
  { const r = mk('standard', true), res = r.evaluate(rep9({ firstContact: 2, pocketed: [3] })); ok('9B break wajib kena bola 1 dulu', !!res.foul); }
  { const r = mk('standard', true), res = r.evaluate(rep9({ pocketed: [9], pocketedAt: [{ id: 9, pocket: 0 }] })); ok('9B golden break: bola 9 masuk saat break = menang', res.gameOver && res.gameOver.winner === 0 && res.gameOver.golden === true); }
  { const r = mk('standard', true), res = r.evaluate(rep9({ cuePocketed: true, pocketed: [9], pocketedAt: [{ id: 9, pocket: 0 }] })); ok('9B scratch + 9 masuk saat break: bola 9 respot, tidak menang', !res.gameOver && res.respot.includes(9) && !r.pocketedIds.has(9) && r.currentSeat === 1); }
  { const r = mk('standard', false); r.pocketedIds = new Set([1, 2]); ok('9B bola terkecil = 3', r.lowest() === 3 && r.legalTargets()[0] === 3 && r.isLegalFirstContact(0, 3) && !r.isLegalFirstContact(0, 4)); }
  { const r = mk('standard', false), res = r.evaluate(rep9({ firstContact: 2 })); ok('9B menyentuh bola bukan terkecil = foul', /bola 1/.test(res.foul) && res.ballInHand === 'any'); }
  { const r = mk('standard', false), res = r.evaluate(rep9({ firstContact: -1 })); ok('9B tidak menyentuh apa pun = foul', !!res.foul); }
  { const r = mk('standard', false), res = r.evaluate(rep9({ railAfterContact: false })); ok('9B tanpa bola masuk & tanpa cushion = foul', !!res.foul); }
  { const r = mk('standard', false), res = r.evaluate(rep9({ cuePocketed: true })); ok('9B bola putih masuk = foul, bola bebas di mana saja', !!res.foul && res.ballInHand === 'any'); }
  { const r = mk('standard', false), res = r.evaluate(rep9({ pocketed: [5], pocketedAt: [{ id: 5, pocket: 3 }] })); ok('9B bola apa pun boleh masuk (standar): lanjut', !res.foul && res.continueTurn && r.currentSeat === 0); }
  { const r = mk('standard', false); r.pocketedIds = new Set([1, 2, 3, 4, 5, 6, 7, 8]); const res = r.evaluate(rep9({ firstContact: 9, pocketed: [9], pocketedAt: [{ id: 9, pocket: 1 }] })); ok('9B bola 9 sah masuk = menang', res.gameOver && res.gameOver.winner === 0 && !res.gameOver.golden); }
  { const r = mk('standard', false), res = r.evaluate(rep9({ firstContact: 1, pocketed: [9], pocketedAt: [{ id: 9, pocket: 1 }] })); ok('9B kombinasi: kena 1 lalu 9 masuk = menang', res.gameOver && res.gameOver.winner === 0); }
  { const r = mk('standard', false), res = r.evaluate(rep9({ firstContact: 2, pocketed: [9], pocketedAt: [{ id: 9, pocket: 1 }] })); ok('9B bola 9 masuk saat foul: respot, bukan menang', !res.gameOver && res.respot.includes(9) && !r.pocketedIds.has(9) && r.currentSeat === 1); }
  { const r = mk('standard', false); r.currentSeat = 1; const res = r.evaluate(rep9({ pocketed: [1], pocketedAt: [{ id: 1, pocket: 0 }] })); ok('9B pemenang adalah penembak (seat 1)', !res.foul && r.currentSeat === 1 && res.continueTurn); }
  // varian kantong pilihan
  { const r = mk('call', true); ok('kantong pilihan: break tidak wajib memilih kantong', r.callRequired() === false); const res = r.evaluate(rep9({ pocketed: [3, 4], pocketedAt: [{ id: 3, pocket: 0 }, { id: 4, pocket: 5 }] })); ok('kantong pilihan: break bola masuk di kantong mana pun sah', !res.foul && res.continueTurn); }
  { const r = mk('call', false); ok('kantong pilihan: setelah break wajib memilih kantong', r.callRequired() === true); const res = r.evaluate(rep9({ pocketed: [1], pocketedAt: [{ id: 1, pocket: 4 }], call: 4 })); ok('kantong pilihan: masuk di kantong yang dipilih = sah, lanjut', !res.foul && res.continueTurn && r.currentSeat === 0); }
  { const r = mk('call', false), res = r.evaluate(rep9({ pocketed: [1], pocketedAt: [{ id: 1, pocket: 4 }], call: 2 })); ok('kantong pilihan: masuk kantong lain = FOUL', res.foul === 'Bola masuk kantong yang salah' && res.ballInHand === 'any' && r.currentSeat === 1); }
  { const r = mk('call', false), res = r.evaluate(rep9({ pocketed: [1, 5], pocketedAt: [{ id: 1, pocket: 2 }, { id: 5, pocket: 3 }], call: 2 })); ok('kantong pilihan: satu bola masuk kantong salah cukup untuk foul', !!res.foul); }
  { const r = mk('call', false), res = r.evaluate(rep9({ call: 3 })); ok('kantong pilihan: tidak ada bola masuk = bukan foul (giliran pindah)', !res.foul && !res.continueTurn && r.currentSeat === 1); }
  { const r = mk('call', false), res = r.evaluate(rep9({ pocketed: [1], pocketedAt: [{ id: 1, pocket: 2 }], call: -1 })); ok('kantong pilihan: tanpa memilih kantong = foul', res.foul === 'Kantong tujuan belum dipilih'); }
  { const r = mk('call', false); r.pocketedIds = new Set([1, 2, 3, 4, 5, 6, 7, 8]); const res = r.evaluate(rep9({ firstContact: 9, pocketed: [9], pocketedAt: [{ id: 9, pocket: 1 }], call: 1 })); ok('kantong pilihan: bola 9 di kantong yang dipilih = menang', res.gameOver && res.gameOver.winner === 0); }
  { const r = mk('call', false); r.pocketedIds = new Set([1, 2, 3, 4, 5, 6, 7, 8]); const res = r.evaluate(rep9({ firstContact: 9, pocketed: [9], pocketedAt: [{ id: 9, pocket: 0 }], call: 1 })); ok('kantong pilihan: bola 9 di kantong salah = foul + respot, tidak menang', !res.gameOver && !!res.foul && res.respot.includes(9)); }
  { const view = { matchId: 'M', acceptsShots: true, currentSeat: 0, expectedSeq: 0, cue: { x: 400, y: 364 }, ballInHandZone: 'none', isPlacementValid: () => true, callRequired: true };
    const shot = { matchId: 'M', seat: 0, seq: 0, angle: 0.1, power: 0.5, spinX: 0, spinY: 0, cue: { x: 400, y: 364 } };
    ok('validator: shot tanpa call ditolak saat wajib', ShotValidator.validate(shot, view) !== null && ShotValidator.validate({ ...shot, call: 9 }, view) !== null);
    ok('validator: shot dengan call 0–5 diterima', ShotValidator.validate({ ...shot, call: 3 }, view) === null && ShotValidator.validate(shot, { ...view, callRequired: false }) === null); }
}
/* ---- 9-ball: rack, respot, dan Game ---- */
{
  const st = freshStore(), g = new Game({ ui: nul, audio: nul, store: st }); g.startMatch({ game: '9ball', mode: 'local' }); g._rack(new Rng(5));
  const on = g.world.balls.filter((b) => b.state === 0 && b.id > 0), T = CONFIG.table;
  ok('rack 9-ball: hanya bola 1–9 di meja', on.length === 9 && on.every((b) => b.id >= 1 && b.id <= 9));
  ok('rack 9-ball: bola 1 di apex (foot spot) & bola 9 di tengah diamond', Math.abs(g.world.balls[1].x - T.footSpotX) < 0.1 && Math.abs(g.world.balls[9].y - T.height / 2) < 0.1 && g.world.balls[9].x > g.world.balls[1].x);
  let overlap = false; for (let i = 0; i < on.length; i++) for (let j = i + 1; j < on.length; j++) if (Math.hypot(on[i].x - on[j].x, on[i].y - on[j].y) < 2 * T.ballRadius) overlap = true;
  ok('rack 9-ball: tidak ada bola yang bertumpuk', !overlap);
  ok('rack 9-ball: bola 10–15 tidak ikut simulasi', g.world.balls.slice(10).every((b) => b.state === 1 && b.sinkT >= 1));
  g.world.balls[9].state = 1; g._respotBall(9); ok('respot bola 9 di foot spot', g.world.balls[9].state === 0 && Math.abs(g.world.balls[9].x - T.footSpotX) < 0.1 || g.world.balls[9].x > T.footSpotX);
  g.world.balls[9].state = 1; g.world.balls[1].x = T.footSpotX; g.world.balls[1].y = T.height / 2; g._respotBall(9);
  ok('respot bola 9 bila foot spot terisi: geser ke belakang tanpa menumpuk', g.world.balls[9].x > T.footSpotX && Math.hypot(g.world.balls[9].x - g.world.balls[1].x, g.world.balls[9].y - g.world.balls[1].y) >= 2 * T.ballRadius);
  ok('Game 9call memakai NineBallRules varian kantong', (() => { const g2 = new Game({ ui: nul, audio: nul, store: freshStore() }); g2.startMatch({ game: '9call', mode: 'local' }); return g2.rules.variant === 'call'; })());
  ok('Game tanpa pilihan game = 8-ball', (() => { const g2 = new Game({ ui: nul, audio: nul, store: freshStore() }); g2.startMatch({ mode: 'local' }); return g2.rules instanceof MatchRules && g2.gameType === '8ball'; })());
}
for (const [type, label] of [['9ball', '9-ball standar'], ['9call', '9-ball kantong pilihan']]) {
  for (let i = 1; i <= 3; i++) {
    const r = new Rng(i * 313 + (type === '9call' ? 7 : 0)); const realRandom = Math.random; Math.random = () => r.next();
    const st = freshStore(), g = new Game({ ui: nul, audio: nul, store: st }); g.startMatch({ game: type, mode: 'bot', difficulty: ['easy', 'medium', 'hard'][i - 1], bet: 1000 });
    let t = 0, err = null, calls = 0, wrongCallFouls = 0;
    const origFinish = g._finishShot.bind(g); g._finishShot = function () { const rp = this.report; if (type === '9call' && !this.rules.isBreak && rp) calls += rp.call >= 0 ? 1 : 0; origFinish(); };
    try { while (g.state !== 'GAME_OVER' && t < 4000) { g.update(1 / 60); t += 1 / 60; if (['PLAYER_TURN', 'OPPONENT_TURN', 'BREAK', 'BALL_IN_HAND'].includes(g.state)) g.seats[g.currentSeat].control = 'bot'; } } catch (e) { err = e.message; }
    Math.random = realRandom;
    ok(label + ' bot vs bot #' + i + ' selesai tanpa error', g.state === 'GAME_OVER' && !err, err || g.result.reason);
    ok('  ' + label + ' #' + i + ': pemenang sah lewat bola 9 & ekonomi konsisten', g.state === 'GAME_OVER' && /Bola 9|Golden/.test(g.result.reason) && st.coins === 29000 + g.result.summary.payout);
  }
}
{ const st = freshStore(); st.recordMatch({ youWon: true, bet: 100, game: '9ball', golden: true }); ok('statistik & badge 9-ball (menang, golden break)', st.data.stats.wins9 === 1 && st.data.stats.golden === 1 && st.data.unlocks.badges.includes('nine_1') && st.data.unlocks.badges.includes('golden')); }
/* ---- meja American: geometri, skala fisika, kantong tidak macet ---- */
{
  applyTableProfile('american'); const TA = CONFIG.table;
  ok('American: playfield 800×400', TA.width === 800 && TA.height === 400);
  ok('American: bola lebih besar secara relatif (rasio Ø/lebar meja)', (TA.ballRadius * 2) / TA.width > (30 / 1600) * 1.3, ((TA.ballRadius * 2) / TA.width).toFixed(4));
  const GA = buildTableGeometry(TA), dA = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
  const cA = GA.pocketShapes[0], sA = GA.pocketShapes[1], D = TA.ballRadius * 2;
  ok('American: mulut kantong corner ≥ 2× diameter bola', dA(cA.tipA, cA.tipB) >= 2 * D, dA(cA.tipA, cA.tipB).toFixed(1) + ' vs min ' + (2 * D));
  ok('American: leher kantong corner ≥ 2× diameter bola', dA(cA.baseA, cA.baseB) >= 2 * D, dA(cA.baseA, cA.baseB).toFixed(1));
  ok('American: mulut kantong side ≥ 2× diameter bola', dA(sA.tipA, sA.tipB) >= 2 * D, dA(sA.tipA, sA.tipB).toFixed(1));
  ok('American: leher kantong side ≥ 2× diameter bola', dA(sA.baseA, sA.baseB) >= 2 * D, dA(sA.baseA, sA.baseB).toFixed(1));
  applyTableProfile('standard'); const TS = CONFIG.table;
  const GS = buildTableGeometry(TS), cS = GS.pocketShapes[0];
  ok('Standar: TETAP tidak diubah (kompatibilitas mundur)', TS.width === 1600 && TS.height === 728 && TS.ballRadius === 15 && Math.abs(dA(cS.tipA, cS.tipB) - 58) < 0.1);

  const freshT = (id) => { applyTableProfile(id); const w = new PhysicsWorld(CONFIG); for (const b of w.balls) { b.state = 1; b.stop(); } return w; };
  const putT = (w, i, x, y) => { const b = w.balls[i]; b.state = 0; b.x = x; b.y = y; b.stop(); };
  const runT = (w, s) => { for (let t = 0; t < s; t += 1 / 60) w.update(1 / 60); };
  { const w = freshT('american'); putT(w, 0, 200, 200); w.strike(1, 0, 1, 0, 0); runT(w, 1.5);
    ok('American: tembakan power penuh tidak menembus cushion', w.balls[0].state === 0 && w.balls[0].x > 0 && w.balls[0].x < 800 && w.balls[0].y > 0 && w.balls[0].y < 400); }
  { const w = freshT('american'); putT(w, 0, 400, 200); putT(w, 1, 430, 200); w.strike(1, 0, 0.15, 0, -0.3); runT(w, 3);
    ok('American: draw shot tetap bekerja (bola putih mundur)', w.balls[0].x < 400); }
  { let stuck = 0; for (let k = 0; k < 40; k++) {
      const w = freshT('american'), sh = GA.pocketShapes[k % 6], mx = (sh.tipA[0] + sh.tipB[0]) / 2, my = (sh.tipA[1] + sh.tipB[1]) / 2;
      const dx = sh.axis[0], dy = sh.axis[1], back = 55 + (k * 3) % 40, speed = (0.05 + (k % 5) * 0.03) * CONFIG.physics.maxShotSpeed;
      const b = w.balls[1]; b.state = 0; b.x = mx - dx * back; b.y = my - dy * back; b.vx = b.rvx = dx * speed; b.vy = b.rvy = dy * speed;
      runT(w, 3);
      if (b.state === 0) stuck++;
    } ok('American: bola pelan menuju kantong tidak "macet" di bibir (tetap masuk)', stuck === 0, stuck + '/40 macet'); }
  { const w = freshT('standard'); ok('Fisika standar tetap identik setelah bolak-balik profil', Math.abs(w.cfg.physics.maxShotSpeed - PHYSICS_BASE_TEST) < 1); }
  applyTableProfile('standard');
}
/* ---- Game: pilih meja per match, respot & aturan tetap benar di meja kecil ---- */
{
  const st = freshStore(), g = new Game({ ui: nul, audio: nul, store: st });
  ok('startMatch tanpa table = standard', g.startMatch({ mode: 'local' }) && g.tableId === 'standard' && CONFIG.table.width === 1600);
  g.quitToMenu();
  const g2 = new Game({ ui: nul, audio: nul, store: freshStore() });
  ok('startMatch table:"american" mengganti profil & dunia fisika', g2.startMatch({ mode: 'local', table: 'american' }) && g2.tableId === 'american' && CONFIG.table.width === 800 && g2.world.W === 800);
  const cue = g2.cue; ok('bola putih di meja American berada di dalam batas kecil', cue.x > 0 && cue.x < 800 && cue.y > 0 && cue.y < 400);
  g2.quitToMenu();
  const g3 = new Game({ ui: nul, audio: nul, store: freshStore() }); g3.startMatch({ mode: 'bot', game: '9ball', table: 'american', bet: 100 }); g3._rack(new Rng(9));
  const on9 = g3.world.balls.filter((b) => b.state === 0 && b.id > 0 && b.id <= 9);
  ok('rack 9-ball di meja American: 9 bola, tidak tumpang tindih, di dalam batas', on9.length === 9 && on9.every((b) => b.x > 0 && b.x < 800 && b.y > 0 && b.y < 400));
  applyTableProfile('standard');
}
console.log(failed ? '\n' + failed + ' tes gagal' : '\nSemua tes lulus'); process.exit(failed ? 1 : 0);
