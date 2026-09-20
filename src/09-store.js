/* =====================================================================
   09 · STORE & CUE CATALOG — profil, pengaturan, koleksi cue (localStorage aman)
   ===================================================================== */
const MAX_CUE_LEVEL = 4;
/** Katalog berbasis data: cukup ganti `image` dan angka `stats` untuk cue baru. */
const CUE_CATALOG = [
  { id: 'maple', name: 'Maple Klasik', image: CUE_IMAGES.maple, level: 1, rarity: 'Standard', tags: ['Pemula'], stats: { force: 3, aim: 3, spin: 3, time: 3 }, collectionPoints: { unlock: 0, upgrade: 20 }, price: 0 },
  { id: 'kristal', name: 'Kristal Es', image: CUE_IMAGES.kristal, level: 1, rarity: 'Rare', tags: ['Musim Dingin'], stats: { force: 4, aim: 6, spin: 5, time: 4 }, collectionPoints: { unlock: 80, upgrade: 80 }, price: 300 },
  { id: 'jade', name: 'Jade Nusantara', image: CUE_IMAGES.jade, level: 1, rarity: 'Epic', tags: ['Nusantara', 'Koleksi'], stats: { force: 6, aim: 6, spin: 5, time: 6 }, collectionPoints: { unlock: 160, upgrade: 160 }, price: 700 },
  { id: 'batik', name: 'Batik Senja', image: CUE_IMAGES.batik, level: 1, rarity: 'Epic', tags: ['Nusantara'], stats: { force: 5, aim: 7, spin: 6, time: 5 }, collectionPoints: { unlock: 160, upgrade: 160 }, price: 700 },
  { id: 'garuda', name: 'Garuda Emas', image: CUE_IMAGES.garuda, level: 1, rarity: 'Legendary', tags: ['Legenda', 'Emas'], stats: { force: 8, aim: 7, spin: 7, time: 6 }, collectionPoints: { unlock: 240, upgrade: 240 }, price: 1500 },
  { id: 'malam', name: 'Bayangan Malam', image: CUE_IMAGES.malam, level: 1, rarity: 'Legendary', tags: ['Legenda'], stats: { force: 7, aim: 8, spin: 8, time: 7 }, collectionPoints: { unlock: 240, upgrade: 240 }, price: 1500 },
];

class Store {
  constructor() {
    this.key = 'pantul.v2'; this.mem = null;
    this.data = {
      profile: { name: 'Pemain', coins: 1200, xp: 0, wins: 0, losses: 0, cuePoints: 0 },
      settings: { sfx: true, music: false, aimAssist: true, showBounce: true },
      cues: { equipped: 'maple', owned: { maple: 1 } },
    };
    try {
      const raw = window.localStorage.getItem(this.key);
      if (raw) { const d = JSON.parse(raw); for (const k of Object.keys(this.data)) Object.assign(this.data[k], d[k] || {}); }
    } catch (e) { /* penyimpanan tidak tersedia: pakai memori */ }
  }
  save() { try { window.localStorage.setItem(this.key, JSON.stringify(this.data)); } catch (e) { /* abaikan */ } }
  level() { return 1 + Math.floor(this.data.profile.xp / 100); }
  recordMatch(r) {
    const p = this.data.profile;
    if (r.youWon) { p.wins++; p.xp += 24; } else { p.losses++; p.xp += 10; }
    p.coins += r.reward; this.save();
  }
  cueDef(id) { return CUE_CATALOG.find((c) => c.id === id); }
  ownedLevel(id) { return this.data.cues.owned[id] || 0; }
  effectiveStats(id, level) {
    const c = this.cueDef(id), out = {};
    for (const k of Object.keys(c.stats)) out[k] = Math.min(10, c.stats[k] + (level - 1) * 2);
    return out;
  }
  cueStats() { const id = this.data.cues.equipped; return this.effectiveStats(id, this.ownedLevel(id) || 1); }
  upgradePrice(id) { const c = this.cueDef(id), lv = this.ownedLevel(id); return Math.round(Math.max(60, c.price * 0.35) * lv); }
  unlockCue(id) {
    const c = this.cueDef(id), p = this.data.profile;
    if (this.ownedLevel(id) || p.coins < c.price) return false;
    p.coins -= c.price; p.cuePoints += c.collectionPoints.unlock; this.data.cues.owned[id] = 1; this.save(); return true;
  }
  upgradeCue(id) {
    const c = this.cueDef(id), p = this.data.profile, lv = this.ownedLevel(id), cost = this.upgradePrice(id);
    if (!lv || lv >= MAX_CUE_LEVEL || p.coins < cost) return false;
    p.coins -= cost; p.cuePoints += c.collectionPoints.upgrade; this.data.cues.owned[id] = lv + 1; this.save(); return true;
  }
  equipCue(id) { if (this.ownedLevel(id)) { this.data.cues.equipped = id; this.save(); return true; } return false; }
}
