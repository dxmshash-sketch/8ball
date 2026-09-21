/* =====================================================================
   09 · CONTENT — semua konten berbasis data: cue, tema meja, avatar,
   badge, kurva level, hadiah. Tambah konten baru cukup dengan menambah data.
   ===================================================================== */
const COIN_NAME = 'BCPOOL', START_COINS = 30000, HOUSE_FEE = 0.05, MAX_CUE_LEVEL = 4, MAX_LEVEL = 80;
const BETS = [100, 500, 1000, 5000, 10000, 50000, 100000, 500000, 1000000, 5000000];
const DAILY_REWARDS = [5000, 7500, 10000, 15000, 20000, 30000, 50000];

const fmtCoins = (n) => Math.round(n).toLocaleString('id-ID');
const fmtShort = (n) => {
  const t = (x) => String(parseFloat(x.toFixed(1)));
  return n >= 1e9 ? t(n / 1e9) + 'B' : n >= 1e6 ? t(n / 1e6) + 'M' : n >= 1e3 ? t(n / 1e3) + 'K' : String(Math.round(n));
};

/* ---------------- level & XP ---------------- */
const xpForLevel = (l) => 100 + (l - 1) * 50;                  // XP untuk naik dari level l ke l+1
function levelInfo(xp) {
  let l = 1, rem = xp;
  while (l < MAX_LEVEL && rem >= xpForLevel(l)) { rem -= xpForLevel(l); l++; }
  const need = l >= MAX_LEVEL ? 1 : xpForLevel(l);
  return { level: l, into: l >= MAX_LEVEL ? 1 : rem, need, pct: l >= MAX_LEVEL ? 1 : rem / need };
}

/* ---------------- cue ---------------- */
const RARITY_PRICE = { Standard: 0, Rare: 15000, Epic: 60000, Legendary: 250000 };
const cueDef = (id, name, rarity, tags, s, cp) => ({ id, name, rarity, tags, stats: { force: s[0], aim: s[1], spin: s[2], time: s[3] }, collectionPoints: { unlock: cp, upgrade: cp }, price: RARITY_PRICE[rarity], image: CUE_IMAGES[id] });
const CUE_CATALOG = [
  cueDef('maple', 'Maple Klasik', 'Standard', ['Pemula'], [3, 3, 3, 3], 0),
  cueDef('kristal', 'Kristal Es', 'Rare', ['Musim Dingin'], [4, 6, 5, 4], 80),
  cueDef('samudra', 'Samudra', 'Rare', ['Laut'], [5, 5, 6, 4], 80),
  cueDef('rimba', 'Rimba', 'Rare', ['Alam'], [5, 4, 5, 6], 80),
  cueDef('sakura', 'Sakura', 'Rare', ['Musim Semi'], [4, 5, 6, 5], 80),
  cueDef('jade', 'Jade Nusantara', 'Epic', ['Nusantara', 'Koleksi'], [6, 6, 5, 6], 160),
  cueDef('batik', 'Batik Senja', 'Epic', ['Nusantara'], [5, 7, 6, 5], 160),
  cueDef('kobaran', 'Kobaran', 'Epic', ['Api'], [8, 5, 6, 5], 160),
  cueDef('petir', 'Petir', 'Epic', ['Listrik'], [6, 6, 7, 6], 160),
  cueDef('garuda', 'Garuda Emas', 'Legendary', ['Legenda', 'Emas'], [8, 7, 7, 6], 240),
  cueDef('malam', 'Bayangan Malam', 'Legendary', ['Legenda'], [7, 8, 8, 7], 240),
  cueDef('rajaemas', 'Raja Emas', 'Legendary', ['Legenda', 'Kerajaan'], [8, 8, 7, 8], 240),
];

/* ---------------- tema meja ----------------
   rail.style: 'wood' | 'neon' | 'ornate' | 'metal'. Tema kustom (halaman Developer) memakai struktur yang sama
   dan boleh menambah `clothImage` (1600×728) dan `railImage` (frame 1760×888) berupa data URI. */
const TABLE_THEMES = [
  { id: 'klasik', name: 'Biru Klasik', rarity: 'Standard', price: 0,
    cloth: { a: '#86d9f6', b: '#57BFEA', c: '#2d8dbd' }, cushion: { base: '#2a86b8', mid: '#3fa5d6', nose: '#63c6f0' },
    rail: { style: 'wood', a: '#a83232', accent: '#c04545', b: '#8a2426', c: '#671719', d: '#3d0c0f' }, sight: '#ffffff', rim: '#2b0709' },
  { id: 'turnamen', name: 'Hijau Turnamen', rarity: 'Rare', price: 8000,
    cloth: { a: '#5fcf8f', b: '#2f9e63', c: '#175c38' }, cushion: { base: '#1b6b40', mid: '#27895a', nose: '#44b07c' },
    rail: { style: 'wood', a: '#7a4a2a', accent: '#98603a', b: '#60381e', c: '#432411', d: '#2a150a' }, sight: '#f3e6b8', rim: '#1e0f06' },
  { id: 'kutub', name: 'Es Kutub', rarity: 'Rare', price: 30000,
    cloth: { a: '#ecfaff', b: '#b6e2f5', c: '#6fb3d6' }, cushion: { base: '#5c9ec4', mid: '#7ab8dc', nose: '#b4e0f6' },
    rail: { style: 'metal', a: '#eef3f8', b: '#b9c4cf', c: '#7e8b98' }, sight: '#3b82b8', rim: '#44525f' },
  { id: 'neon', name: 'Lounge Neon', rarity: 'Epic', price: 60000,
    cloth: { a: '#b04ae0', b: '#7a26b0', c: '#3c0f66' }, cushion: { base: '#8a1f9a', mid: '#b02fbf', nose: '#e05ae8' },
    rail: { style: 'neon', bg: '#160f1f', glow: '#ff3fd0' }, sight: '#ff8ae8', rim: '#ff3fd0' },
  { id: 'karnaval', name: 'Karnaval Pantai', rarity: 'Epic', price: 120000,
    cloth: { a: '#2f8fe0', b: '#1560ad', c: '#0a3a72' }, cushion: { base: '#12a5c4', mid: '#20c4e4', nose: '#6ae6f8' },
    rail: { style: 'ornate', bg: '#f0c060', ink: '#7a2b8f', spot: '#1fb6c9', edge: '#8a5a10' }, sight: '#ffffff', rim: '#3a1a4a' },
  { id: 'naga', name: 'Naga Merah', rarity: 'Epic', price: 200000,
    cloth: { a: '#d04040', b: '#a02020', c: '#560d0d' }, cushion: { base: '#8a1a1a', mid: '#b52a2a', nose: '#e8574c' },
    rail: { style: 'ornate', bg: '#ead9a6', ink: '#a0761c', spot: '#2aa6a0', edge: '#8a5a10' }, sight: '#2aa6a0', rim: '#3a0b0b' },
  { id: 'istana', name: 'Istana Senja', rarity: 'Legendary', price: 400000,
    cloth: { a: '#f0a640', b: '#cc7414', c: '#7a3f06' }, cushion: { base: '#b8720f', mid: '#dc9420', nose: '#ffc94a' },
    rail: { style: 'ornate', bg: '#f6cf62', ink: '#2b8f83', spot: '#d23e5b', edge: '#8a6210' }, sight: '#fff4c8', rim: '#4a2a06' },
  { id: 'hitam', name: 'Hitam Emas', rarity: 'Legendary', price: 1000000,
    cloth: { a: '#3a3a42', b: '#1d1d24', c: '#08080c' }, cushion: { base: '#8a6a1c', mid: '#b48a26', nose: '#f0c85a' },
    rail: { style: 'metal', a: '#f6dc8a', b: '#c99a2a', c: '#7a5a10' }, sight: '#fff0b8', rim: '#2a1e06' },
];

/* ---------------- avatar, bingkai, badge ---------------- */
const SYMBOLS = {
  ball8: '<circle cx="12" cy="12" r="9.5" fill="currentColor"/><circle cx="12" cy="10.3" r="4.4" fill="#fff"/><text x="12" y="12.4" font-size="6.4" font-weight="800" text-anchor="middle" fill="#111" font-family="Arial,sans-serif">8</text>',
  cue: '<path d="M3.5 20.5L17 7" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><circle cx="18.7" cy="5.3" r="2.4" fill="currentColor"/>',
  crown: '<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z" fill="currentColor"/>',
  star: '<path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z" fill="currentColor"/>',
  flame: '<path d="M12 2c1 4 5 5.5 5 11a5 5 0 01-10 0c0-2 1-3.5 2-4.5.3 1.6 1.2 2.4 2 2.5C10.5 8 11 5 12 2z" fill="currentColor"/>',
  bolt: '<path d="M13 2L5 13.5h5.5L9.5 22 19 9.5h-6z" fill="currentColor"/>',
  diamond: '<path d="M12 3l8 6-8 12L4 9z" fill="currentColor"/>',
  clover: '<circle cx="12" cy="7.5" r="4" fill="currentColor"/><circle cx="7.5" cy="13" r="4" fill="currentColor"/><circle cx="16.5" cy="13" r="4" fill="currentColor"/><rect x="11" y="14" width="2" height="7" fill="currentColor"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z" fill="currentColor"/>',
  sun: '<circle cx="12" cy="12" r="4.6" fill="currentColor"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  shield: '<path d="M12 2.5l8 3v6.2c0 5-3.4 8.6-8 10.3-4.6-1.7-8-5.3-8-10.3V5.5z" fill="currentColor"/>',
  target: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.4"/><circle cx="12" cy="12" r="4" fill="currentColor"/>',
  trophy: '<path d="M7 3h10v5a5 5 0 01-10 0zM7 5H3.5c0 3 1.5 4.5 3.7 5M17 5h3.5c0 3-1.5 4.5-3.7 5M10.5 13h3v4h-3zM8 21h8l-1-4H9z" fill="currentColor"/>',
};
const AVATAR_COLORS = [['#4a8fd6', '#2b5fa8'], ['#d6684a', '#a83a22'], ['#5bb37a', '#2f7d4c'], ['#a46bd6', '#6d3aa3'], ['#d6a94a', '#a4771c'], ['#4ab5b5', '#267f80'], ['#d65a8c', '#a3305f'], ['#7f8a99', '#4b5561']];
const FRAMES = { none: { name: 'Tanpa bingkai', color: 'transparent' }, bronze: { name: 'Perunggu', color: '#cd7f32' }, silver: { name: 'Perak', color: '#cfd6de' }, gold: { name: 'Emas', color: '#F4C542' }, emerald: { name: 'Zamrud', color: '#32D74B' }, ruby: { name: 'Rubi', color: '#FF5A5F' }, diamond: { name: 'Berlian', color: '#7fe3ff' }, neon: { name: 'Neon', color: '#e04bff' } };
const SYMBOL_NAMES = { ball8: 'Bola 8', cue: 'Tongkat', crown: 'Mahkota', star: 'Bintang', flame: 'Api', bolt: 'Petir', diamond: 'Berlian', clover: 'Semanggi', moon: 'Bulan', sun: 'Matahari', shield: 'Perisai', target: 'Target' };
const FREE_AVATAR_ITEMS = ['sym:ball8', 'sym:cue', 'sym:star', 'sym:target', 'frame:none'];
const TIER_COLOR = { bronze: '#cd7f32', silver: '#cfd6de', gold: '#F4C542' };
const BADGE_DEFS = [
  { id: 'first_win', name: 'Kemenangan Pertama', desc: 'Menangkan 1 pertandingan', tier: 'bronze', icon: 'trophy', check: (s) => s.wins >= 1 },
  { id: 'wins_10', name: 'Pemain Handal', desc: 'Menangkan 10 pertandingan', tier: 'silver', icon: 'star', check: (s) => s.wins >= 10 },
  { id: 'wins_50', name: 'Juara Bertahan', desc: 'Menangkan 50 pertandingan', tier: 'gold', icon: 'crown', check: (s) => s.wins >= 50 },
  { id: 'streak_3', name: 'Panas!', desc: 'Menang 3 kali beruntun', tier: 'bronze', icon: 'flame', check: (s) => s.bestStreak >= 3 },
  { id: 'streak_7', name: 'Tak Terkalahkan', desc: 'Menang 7 kali beruntun', tier: 'gold', icon: 'bolt', check: (s) => s.bestStreak >= 7 },
  { id: 'potter_100', name: 'Penembak Jitu', desc: 'Masukkan 100 bola', tier: 'silver', icon: 'target', check: (s) => s.potted >= 100 },
  { id: 'big_bet', name: 'Berani Bertaruh', desc: 'Menang taruhan 100.000', tier: 'silver', icon: 'diamond', check: (s) => s.maxBetWon >= 100000 },
  { id: 'high_roller', name: 'High Roller', desc: 'Menang taruhan 1.000.000', tier: 'gold', icon: 'diamond', check: (s) => s.maxBetWon >= 1000000 },
  { id: 'rich_100k', name: 'Sultan Muda', desc: 'Punya 100.000 koin', tier: 'silver', icon: 'sun', check: (s, p) => p.coins >= 100000 },
  { id: 'rich_1m', name: 'Jutawan', desc: 'Punya 1.000.000 koin', tier: 'gold', icon: 'crown', check: (s, p) => p.coins >= 1000000 },
  { id: 'level_10', name: 'Veteran', desc: 'Capai level 10', tier: 'silver', icon: 'shield', check: (s, p) => levelInfo(p.xp).level >= 10 },
  { id: 'collector', name: 'Kolektor', desc: 'Miliki 5 cue', tier: 'silver', icon: 'clover', check: (s, p, st) => Object.keys(st.data.cues.owned).length >= 5 },
];

/* ---------------- hadiah level ---------------- */
const CUE_REWARDS = ['kristal', 'samudra', 'rimba', 'sakura', 'jade', 'kobaran', 'petir', 'batik'];
const TABLE_REWARDS = ['turnamen', 'kutub', 'neon', 'karnaval'];
const AVATAR_REWARDS = ['sym:crown', 'frame:bronze', 'sym:flame', 'frame:silver', 'sym:bolt', 'frame:gold', 'sym:diamond', 'frame:emerald', 'sym:shield', 'frame:ruby', 'sym:clover', 'frame:diamond', 'sym:moon', 'frame:neon', 'sym:sun'];
function rewardsForLevel(L) {
  if (L < 2) return [];
  const items = [{ type: 'coins', amount: 2000 + 1500 * (L - 1) + (L % 5 === 0 ? 5000 : 0) }];
  if (L % 5 === 0) items.push({ type: 'cue', id: CUE_REWARDS[(L / 5 - 1) % CUE_REWARDS.length] });
  if (L % 7 === 0) items.push({ type: 'table', id: TABLE_REWARDS[(L / 7 - 1) % TABLE_REWARDS.length] });
  if (L % 3 === 0) items.push({ type: 'avatar', id: AVATAR_REWARDS[(L / 3 - 1) % AVATAR_REWARDS.length] });
  return items;
}

/** Avatar bot: deterministik dari nama. */
function botAvatar(name) {
  let h = 7; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const syms = Object.keys(SYMBOLS).filter((k) => k !== 'trophy'), frames = ['none', 'none', 'bronze', 'silver', 'gold'];
  return { sym: syms[h % syms.length], color: (h >>> 3) % AVATAR_COLORS.length, frame: frames[(h >>> 6) % frames.length] };
}
