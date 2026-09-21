/* =====================================================================
   10 · STORE — profil, ekonomi (BCPOOL), level, hadiah, koleksi, konten kustom.
   ===================================================================== */
const todayKey = (d) => { d = d || new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

class Store {
  constructor() {
    this.key = 'pantul.v3'; this.customKey = 'pantul.custom.v1'; this.imgCache = new Map(); this.listeners = [];
    this.data = {
      profile: { name: 'Pemain', coins: START_COINS, xp: 0, avatar: { sym: 'ball8', color: 0, frame: 'none' }, badge: null, created: Date.now() },
      stats: { matches: 0, wins: 0, losses: 0, streak: 0, bestStreak: 0, potted: 0, maxBetWon: 0, totalWon: 0, totalLost: 0 },
      progress: { claimedLevel: 1, dailyLast: null, dailyStreak: 0, helpLast: 0 },
      unlocks: { avatars: FREE_AVATAR_ITEMS.slice(), badges: [] },
      cues: { equipped: 'maple', owned: { maple: 1 } },
      tables: { equipped: 'klasik', owned: ['klasik'] },
      settings: { sfx: true, music: false, aimAssist: true, showBounce: true, aimZoom: 1 },
    };
    this.custom = { cues: [], tables: [] };
    try {
      const raw = window.localStorage.getItem(this.key);
      if (raw) { const d = JSON.parse(raw); for (const k of Object.keys(this.data)) this.data[k] = Object.assign(this.data[k], d[k] || {}); }
      const c = window.localStorage.getItem(this.customKey); if (c) this.custom = Object.assign(this.custom, JSON.parse(c));
    } catch (e) { /* penyimpanan tidak tersedia: pakai memori */ }
  }
  onChange(fn) { this.listeners.push(fn); }
  _emit(what) { for (const fn of this.listeners) fn(what); }
  save() { try { window.localStorage.setItem(this.key, JSON.stringify(this.data)); } catch (e) { /* abaikan */ } }
  saveCustom() { try { window.localStorage.setItem(this.customKey, JSON.stringify(this.custom)); return true; } catch (e) { return false; } }

  /* ------------ ekonomi & level ------------ */
  get coins() { return this.data.profile.coins; }
  level() { return levelInfo(this.data.profile.xp).level; }
  progress() { return levelInfo(this.data.profile.xp); }
  addCoins(n) { this.data.profile.coins += n; this.save(); this._emit('coins'); }
  spend(n) { if (n < 0 || this.data.profile.coins < n) return false; this.data.profile.coins -= n; this.save(); this._emit('coins'); return true; }

  /** Dipanggil setelah pertandingan (mode bertaruh). Taruhan sudah dipotong saat mulai. */
  recordMatch(r) {
    const p = this.data.profile, s = this.data.stats, prevXp = p.xp, prevLevel = levelInfo(prevXp).level, bet = r.bet || 0;
    let payout = 0;
    s.matches++;
    if (r.youWon) { s.wins++; s.streak++; s.bestStreak = Math.max(s.bestStreak, s.streak); payout = Math.floor(bet * 2 * (1 - HOUSE_FEE)); p.coins += payout; s.totalWon += payout - bet; s.maxBetWon = Math.max(s.maxBetWon, bet); }
    else { s.losses++; s.streak = 0; s.totalLost += bet; }
    s.potted += r.potted || 0;
    const lg = Math.log10(Math.max(100, bet));
    const xpGain = r.youWon ? 40 + Math.round(lg * 12) : 15 + Math.round(lg * 4);
    p.xp += xpGain;
    const newBadges = this._checkBadges();
    this.save(); this._emit('coins');
    return { bet, payout, net: r.youWon ? payout - bet : -bet, xpGain, prevXp, newXp: p.xp, prevLevel, newLevel: levelInfo(p.xp).level, newBadges };
  }
  _checkBadges() {
    const out = [];
    for (const b of BADGE_DEFS) if (this.data.unlocks.badges.indexOf(b.id) === -1 && b.check(this.data.stats, this.data.profile, this)) { this.data.unlocks.badges.push(b.id); out.push(b); }
    return out;
  }
  checkBadges() { const n = this._checkBadges(); if (n.length) this.save(); return n; }

  /* ------------ hadiah level & harian ------------ */
  claimableLevels() {
    const out = [], lv = this.level();
    for (let l = this.data.progress.claimedLevel + 1; l <= lv; l++) out.push({ level: l, items: rewardsForLevel(l) });
    return out;
  }
  hasClaimable() { return this.claimableLevels().length > 0 || this.dailyStatus().available; }
  claimAllLevels() {
    const list = this.claimableLevels(), items = [];
    for (const r of list) { for (const it of r.items) { this.grant(it); items.push(it); } this.data.progress.claimedLevel = r.level; }
    this.save(); return { list, items };
  }
  claimLevel(l) {
    if (l !== this.data.progress.claimedLevel + 1 || l > this.level()) return null;
    const items = rewardsForLevel(l); for (const it of items) this.grant(it);
    this.data.progress.claimedLevel = l; this.save(); return items;
  }
  grant(it) {
    if (it.type === 'coins') this.data.profile.coins += it.amount;
    else if (it.type === 'cue') this.data.cues.owned[it.id] = this.data.cues.owned[it.id] || 1;
    else if (it.type === 'table') { if (this.data.tables.owned.indexOf(it.id) === -1) this.data.tables.owned.push(it.id); }
    else if (it.type === 'avatar') { if (this.data.unlocks.avatars.indexOf(it.id) === -1) this.data.unlocks.avatars.push(it.id); }
    this._emit('coins');
  }
  dailyStatus(now) {
    const pr = this.data.progress, today = todayKey(now), y = new Date(now || Date.now()); y.setDate(y.getDate() - 1);
    const avail = pr.dailyLast !== today;
    const nextStreak = pr.dailyLast === todayKey(y) ? pr.dailyStreak + 1 : 1;
    const day = avail ? (nextStreak - 1) % 7 : (pr.dailyStreak - 1 + 7) % 7;
    return { available: avail, day, streak: avail ? nextStreak : pr.dailyStreak, amount: DAILY_REWARDS[day] };
  }
  claimDaily(now) {
    const st = this.dailyStatus(now); if (!st.available) return null;
    this.data.progress.dailyLast = todayKey(now); this.data.progress.dailyStreak = st.streak;
    this.addCoins(st.amount); return st.amount;
  }
  helpAvailable() { return this.coins < 500 && Date.now() - this.data.progress.helpLast > 10 * 60 * 1000; }
  claimHelp() { if (!this.helpAvailable()) return 0; this.data.progress.helpLast = Date.now(); this.addCoins(3000); return 3000; }

  /* ------------ avatar & badge ------------ */
  avatarUnlocked(id) { return this.data.unlocks.avatars.indexOf(id) !== -1; }
  setAvatar(part, value) {
    const a = this.data.profile.avatar;
    if (part === 'color') a.color = value;
    else if (this.avatarUnlocked(part + ':' + value)) a[part] = value; else return false;
    this.save(); this._emit('avatar'); return true;
  }
  equipBadge(id) { if (id === null || this.data.unlocks.badges.indexOf(id) !== -1) { this.data.profile.badge = id; this.save(); this._emit('avatar'); return true; } return false; }

  /* ------------ cue ------------ */
  allCues() {
    return CUE_CATALOG.concat(this.custom.cues.map((c) => {
      const base = CUE_CATALOG.find((x) => x.id === c.base) || CUE_CATALOG[0];
      return { id: c.id, name: c.name, rarity: c.rarity || 'Epic', tags: ['Kustom'], stats: this.effectiveStats(base.id, this.ownedLevel(base.id) || 1), collectionPoints: { unlock: 0, upgrade: 0 }, price: 0, image: c.image, custom: true };
    }));
  }
  cueDefById(id) { return this.allCues().find((c) => c.id === id) || CUE_CATALOG[0]; }
  ownedLevel(id) { if (this.custom.cues.some((c) => c.id === id)) return 1; return this.data.cues.owned[id] || 0; }
  effectiveStats(id, level) {
    const c = CUE_CATALOG.find((x) => x.id === id) || CUE_CATALOG[0], out = {};
    for (const k of Object.keys(c.stats)) out[k] = Math.min(10, c.stats[k] + (level - 1) * 2);
    return out;
  }
  cueStats() {
    const id = this.data.cues.equipped, c = this.cueDefById(id), out = {};
    if (c.custom) return c.stats;
    return this.effectiveStats(id, this.ownedLevel(id) || 1);
  }
  upgradePrice(id) { const c = CUE_CATALOG.find((x) => x.id === id); return Math.round(Math.max(3000, c.price * 0.35) * this.ownedLevel(id)); }
  unlockCue(id) {
    const c = CUE_CATALOG.find((x) => x.id === id);
    if (!c || this.ownedLevel(id) || !this.spend(c.price)) return false;
    this.data.cues.owned[id] = 1; this.checkBadges(); this.save(); return true;
  }
  upgradeCue(id) {
    const lv = this.ownedLevel(id);
    if (!lv || lv >= MAX_CUE_LEVEL || !this.spend(this.upgradePrice(id))) return false;
    this.data.cues.owned[id] = lv + 1; this.save(); return true;
  }
  equipCue(id) { if (this.ownedLevel(id)) { this.data.cues.equipped = id; this.save(); this._emit('cue'); return true; } return false; }
  cueImage(id) {
    if (!this.imgCache.has(id)) { const im = new Image(); im.src = this.cueDefById(id).image; this.imgCache.set(id, im); }
    return this.imgCache.get(id);
  }

  /* ------------ tema meja ------------ */
  allThemes() { return TABLE_THEMES.concat(this.custom.tables.map((t) => Object.assign({ rarity: 'Kustom', price: 0, custom: true }, t))); }
  themeDef(id) { return this.allThemes().find((t) => t.id === id) || TABLE_THEMES[0]; }
  themeOwned(id) { return this.data.tables.owned.indexOf(id) !== -1 || this.custom.tables.some((t) => t.id === id); }
  buyTable(id) {
    const t = TABLE_THEMES.find((x) => x.id === id);
    if (!t || this.themeOwned(id) || !this.spend(t.price)) return false;
    this.data.tables.owned.push(id); this.save(); return true;
  }
  equipTable(id) { if (this.themeOwned(id)) { this.data.tables.equipped = id; this.save(); this._emit('table'); return true; } return false; }

  /* ------------ konten kustom (halaman Developer) ------------ */
  addCustomCue(c) { this.custom.cues.push(c); if (!this.saveCustom()) { this.custom.cues.pop(); return false; } return true; }
  addCustomTable(t) { this.custom.tables.push(t); if (!this.saveCustom()) { this.custom.tables.pop(); return false; } return true; }
  removeCustom(kind, id) {
    const arr = this.custom[kind]; const i = arr.findIndex((x) => x.id === id); if (i < 0) return;
    arr.splice(i, 1); this.saveCustom();
    if (kind === 'cues' && this.data.cues.equipped === id) this.data.cues.equipped = 'maple';
    if (kind === 'tables' && this.data.tables.equipped === id) this.data.tables.equipped = 'klasik';
    this.save(); this._emit('table');
  }
  exportCustom() { return JSON.stringify({ format: 'pantul-skins', version: 1, cues: this.custom.cues, tables: this.custom.tables }); }
  importCustom(text) {
    let d; try { d = JSON.parse(text); } catch (e) { return { ok: false, error: 'JSON tidak valid' }; }
    if (!d || d.format !== 'pantul-skins') return { ok: false, error: 'Bukan berkas skin Pantul' };
    let n = 0;
    for (const c of d.cues || []) if (c.image && String(c.image).startsWith('data:image/') && !this.custom.cues.some((x) => x.id === c.id)) { this.custom.cues.push({ id: String(c.id), name: String(c.name || 'Cue'), rarity: c.rarity || 'Epic', base: c.base || 'maple', image: c.image }); n++; }
    for (const t of d.tables || []) if (t.cloth && t.cushion && t.rail && !this.custom.tables.some((x) => x.id === t.id)) { this.custom.tables.push(t); n++; }
    if (!this.saveCustom()) return { ok: false, error: 'Penyimpanan penuh' };
    return { ok: true, count: n };
  }
  resetAll() { try { window.localStorage.removeItem(this.key); window.localStorage.removeItem(this.customKey); } catch (e) { /* abaikan */ } }
}
