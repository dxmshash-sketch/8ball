/* =====================================================================
   19 · FIREBASE BACKEND — implementasi nyata (lintas perangkat), SAMA
   bentuk API-nya dengan MockBackend, siap ditukar begitu FIREBASE_CONFIG
   diisi. Perlu <script> Firebase (compat SDK) dimuat di <head> — lihat
   FIREBASE_SETUP.md. Belum aktif di build ini karena CONFIG masih kosong;
   diaktifkan dari 20-main.js: `const backend = FIREBASE_CONFIG ? new FirebaseBackend() : new MockBackend();`
   ===================================================================== */
const FIREBASE_CONFIG = null;   // isi dari Project Settings → General → Your apps (lihat FIREBASE_SETUP.md), lalu build ulang

class FirebaseBackend {
  constructor() {
    this.name = 'firebase';
    if (typeof firebase === 'undefined') throw new Error('SDK Firebase belum dimuat (cek <script> di index.html)');
    if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    this.auth = firebase.auth(); this.db = firebase.firestore(); this.storage = firebase.storage();
    this.user = null; this.listeners = []; this.roomUnsubs = new Map();
    this.auth.onAuthStateChanged(async (fbUser) => {
  // ── Belum login ──
 if (!fbUser) {
  this.user = null;

  // ── RESET store ke default ──
  if (typeof window !== 'undefined' && window.store) {
    const s = window.store;
    s.data.profile = {
      name: 'Pemain', coins: START_COINS, xp: 0,
      avatar: { sym: 'ball8', color: 0, frame: 'none' },
      badge: null, created: Date.now(),
    };
    s.data.stats = { matches: 0, wins: 0, losses: 0, streak: 0, bestStreak: 0, potted: 0, maxBetWon: 0, totalWon: 0, totalLost: 0, wins9: 0, golden: 0 };
    s.data.progress = { claimedLevel: 1, dailyLast: null, dailyStreak: 0, helpLast: 0 };
    s.data.unlocks = { avatars: FREE_AVATAR_ITEMS.slice(), badges: [] };
    s.data.cues = { equipped: 'maple', owned: { maple: 1 } };
    s.data.tables = { equipped: 'klasik', owned: ['klasik'] };
    s.data.cueball = { equipped: 'none' };

    try { window.localStorage.setItem(s.key, JSON.stringify(s.data)); } catch (e) {}

    if (window.ui && window.ui.refreshMenu) window.ui.refreshMenu();
  }

  this._emitAuth();
  return;
}
  const ref = this.db.collection('users').doc(fbUser.uid);
  let snap = await ref.get();

  // ═══════════════════════════════════════════════════════════
  // USER BARU — buat doc lengkap
  // ═══════════════════════════════════════════════════════════
 if (!snap.exists) {
  const s = window.ui && window.ui.store;
  const doc = {
    uid: fbUser.uid,
    email: fbUser.email,
    name: (s && s.data.profile.name !== 'Pemain')
          ? s.data.profile.name
          : (fbUser.displayName || fbUser.email.split('@')[0]).slice(0, 20),
    avatarImage: fbUser.photoURL || null,
    role: 'user',
    coins: (s && s.data.profile.coins) || START_COINS,        // ← pakai coins guest
    xp: (s && s.data.profile.xp) || 0,                        // ← pakai xp guest
    wins: (s && s.data.stats.wins) || 0,                      // ← pakai wins guest
    bestStreak: (s && s.data.stats.bestStreak) || 0,
    potted: (s && s.data.stats.potted) || 0,
    avatar: (s && s.data.profile.avatar) || { sym: 'ball8', color: 0, frame: 'none' },
    badge: null,
    fx: { equipped: 'none', owned: ['none'] },   // ← tambah
    owned: [],
    createdAt: Date.now(),
  };
  await ref.set(doc);
  snap = await ref.get();
  console.log('[Firebase] User baru dibuat:', doc.name, '· coins:', doc.coins);
}
  // ═══════════════════════════════════════════════════════════
  // USER LAMA — migrasi field baru kalau belum ada
  // ═══════════════════════════════════════════════════════════
  else {
    const u = snap.data();
    const patch = {};

    if (u.xp === undefined) patch.xp = 0;
    if (u.wins === undefined) patch.wins = 0;
    if (u.bestStreak === undefined) patch.bestStreak = 0;
    if (u.potted === undefined) patch.potted = 0;
    if (u.badge === undefined) patch.badge = null;
    if (u.avatar === undefined) patch.avatar = { sym: 'ball8', color: 0, frame: 'none' };
    if (!Array.isArray(u.owned)) patch.owned = [];
    if (u.coins === undefined || u.coins === null) patch.coins = START_COINS;
    if (u.fx === undefined) patch.fx = { equipped: 'none', owned: ['none'] };
    if (Object.keys(patch).length > 0) {
      console.log('[Firebase] Migrasi user lama — field baru:', Object.keys(patch).join(', '));
      await ref.update(patch);
      snap = await ref.get();
    }
  }

  // ═══════════════════════════════════════════════════════════
  // ASSIGN USER
  // ═══════════════════════════════════════════════════════════
  this.user = snap.data();

  // ═══════════════════════════════════════════════════════════
// SINKRON Firebase → store lokal (localStorage)
// ═══════════════════════════════════════════════════════════
if (typeof window !== 'undefined' && window.store) {
  const store = window.store;

  // ▼ DISABLE sync biar tidak loop
  if (typeof store._setSyncingFromCloud === 'function') store._setSyncingFromCloud(true);

  if (this.user.coins !== undefined) store.data.profile.coins = this.user.coins;
  if (this.user.name) store.data.profile.name = this.user.name;
  if (this.user.xp !== undefined) store.data.profile.xp = this.user.xp;
  if (this.user.avatar) store.data.profile.avatar = this.user.avatar;
  if (this.user.badge !== undefined) store.data.profile.badge = this.user.badge;
  if (this.user.wins !== undefined) store.data.stats.wins = this.user.wins;
  if (this.user.bestStreak !== undefined) store.data.stats.bestStreak = this.user.bestStreak;
  if (this.user.potted !== undefined) store.data.stats.potted = this.user.potted;
  if (this.user.fx) store.data.fx = this.user.fx;
  // Tulis langsung ke localStorage — jangan pakai store.save()
  try { window.localStorage.setItem(store.key, JSON.stringify(store.data)); } catch (e) {}

  // ▼ RE-ENABLE sync
  if (typeof store._setSyncingFromCloud === 'function') store._setSyncingFromCloud(false);

  if (window.ui && window.ui.refreshMenu) window.ui.refreshMenu();
}
  // ═══════════════════════════════════════════════════════════
  // NOTIFIKASI semua listener (UI update, redirect dari auth, dll)
  // ═══════════════════════════════════════════════════════════
  this._emitAuth();
});
  }
  _emitAuth() { for (const fn of this.listeners) fn(this.user); }
  onAuthChanged(fn) { this.listeners.push(fn); fn(this.user); return () => { const i = this.listeners.indexOf(fn); if (i >= 0) this.listeners.splice(i, 1); }; }
  currentUser() { return this.user; }
  isAdmin() { return !!(this.user && this.user.role === 'admin'); }

  async signUpPassword(email, password, name) {
    try { const cred = await this.auth.createUserWithEmailAndPassword(email, password); if (name) await cred.user.updateProfile({ displayName: name }); return { ok: true }; }
    catch (e) { return { ok: false, error: e.message }; }
  }
  async signInPassword(email, password) { try { await this.auth.signInWithEmailAndPassword(email, password); return { ok: true }; } catch (e) { return { ok: false, error: e.message }; } }
  async signInGoogle() { try { await this.auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()); return { ok: true }; } catch (e) { return { ok: false, error: e.message }; } }
  signOut() { this.auth.signOut(); }

  async updateProfile(patch) {
    if (!this.user) return false;
    if (patch.avatarImage && patch.avatarImage.startsWith('data:')) {
      const ref = this.storage.ref('avatars/' + this.user.uid + '.jpg'); await ref.putString(patch.avatarImage, 'data_url'); patch.avatarImage = await ref.getDownloadURL();
    }
    await this.db.collection('users').doc(this.user.uid).update(patch); Object.assign(this.user, patch); this._emitAuth(); return true;
  }
  spendCoins(n) { if (!this.user || this.user.coins < n) return false; this.updateProfile({ coins: this.user.coins - n }); return true; }
  addCoins(n) { if (this.user) this.updateProfile({ coins: this.user.coins + n }); }
  /** Atomic coin increment (race-safe). delta bisa positif/negatif. */
async incrementCoins(delta) {
  if (!this.user) return false;
  if (delta === 0) return true;
  try {
    await this.db.collection('users').doc(this.user.uid).update({
      coins: firebase.firestore.FieldValue.increment(delta),
    });
    // Update local mirror
    this.user.coins = (this.user.coins || 0) + delta;
    this._emitAuth();
    return true;
  } catch (e) {
    console.error('[Firebase] incrementCoins gagal:', e.message);
    return false;
  }
}

/** Atomic multi-field increment (untuk XP + wins sekaligus setelah match). */
async incrementStats(deltas) {
  if (!this.user) return false;
  const patch = {};
  if (deltas.xp)    patch.xp    = firebase.firestore.FieldValue.increment(deltas.xp);
  if (deltas.wins)  patch.wins  = firebase.firestore.FieldValue.increment(deltas.wins);
  if (deltas.losses)patch.losses= firebase.firestore.FieldValue.increment(deltas.losses);
  if (deltas.potted)patch.potted= firebase.firestore.FieldValue.increment(deltas.potted);
  if (deltas.matches)patch.matches= firebase.firestore.FieldValue.increment(deltas.matches);   // ← TAMBAH INI
  if (deltas.coins) patch.coins = firebase.firestore.FieldValue.increment(deltas.coins);
  
  if (Object.keys(patch).length === 0) return true;
  try {
    await this.db.collection('users').doc(this.user.uid).update(patch);
    // Update local mirror
    for (const k of Object.keys(deltas)) {
      if (k === 'coins') this.user.coins = (this.user.coins || 0) + deltas[k];
      else this.user[k] = (this.user[k] || 0) + deltas[k];
    }
    this._emitAuth();
    return true;
  } catch (e) {
    console.error('[Firebase] incrementStats gagal:', e.message);
    return false;
  }
}
  async listOtherUsers() { const q = await this.db.collection('users').limit(50).get(); return q.docs.map((d) => d.data()).filter((u) => !this.user || u.uid !== this.user.uid); }

  /* ------------ marketplace ------------ */
  async listMarket() { const q = await this.db.collection('market').orderBy('publishedAt', 'desc').get(); return q.docs.map((d) => Object.assign({ id: d.id }, d.data())); }
  async publish(item) { if (!this.isAdmin()) return false; try { await this.db.collection('market').add(Object.assign({ publishedAt: Date.now(), by: this.user.name }, item)); this.lastError = null; return true; } catch (e) { this.lastError = e.message; return false; } }
  async unpublish(id) { if (!this.isAdmin()) return false; await this.db.collection('market').doc(id).delete(); return true; }
  async buy(id, applyFn) {
    const doc = await this.db.collection('market').doc(id).get(); if (!doc.exists) return { ok: false, error: 'Item tidak ditemukan' };
    const item = doc.data(); if ((this.user.owned || []).includes(id)) return { ok: false, error: 'Sudah dimiliki' };
    if (!this.spendCoins(item.price)) return { ok: false, error: 'Koin tidak cukup' };
    await this.updateProfile({ owned: (this.user.owned || []).concat(id) }); applyFn && applyFn(item); return { ok: true, item };
  }
  onMarketChanged(fn) { this.db.collection('market').onSnapshot(() => fn()); }
  onDirectoryChanged() { /* Firestore selalu real-time; tidak perlu polling manual */ }

  /* ------------ room (Firestore realtime — lintas perangkat sungguhan) ------------ */
  /* ------------ matchmaking (antrian cari lawan, lintas perangkat) ------------ */
 /* ------------ matchmaking (antrian cari lawan, lintas perangkat) ------------ */
  async joinQueue(cb, filter) {
    filter = filter || {}; const same = (d) => (d.bet || 0) === (filter.bet || 0) && (d.game || '') === (filter.game || '') && (d.table || '') === (filter.table || '');
    const me = { uid: this.user.uid, name: this.user.name, avatarImage: this.user.avatarImage }, qref = this.db.collection('queue');
    const found = await this.db.runTransaction(async (tx) => {
      const snap = await qref.orderBy('ts').limit(5).get(); const other = snap.docs.find((d) => d.id !== me.uid && Date.now() - d.data().ts < 45000 && same(d.data()));
      if (other) { tx.delete(other.ref); return other.data(); }
      tx.set(qref.doc(me.uid), { user: me, ts: Date.now(), bet: filter.bet || 0, game: filter.game || '', table: filter.table || '' }); return null;
    });
    if (found) {
      const code = Math.random().toString(36).slice(2, 7).toUpperCase();
      await this.db.collection('rooms').doc(code).set({ code, host: me, guest: found.user, msgs: [] });
      await this.db.collection('matches').doc(found.user.uid).set({ code, peer: me, ts: Date.now(), opts: { bet: found.bet || 0, game: found.game, table: found.table } });
      cb({ code, isHost: true, peer: found.user, opts: { bet: found.bet || 0, game: found.game, table: found.table } });
    } else {
      this._matchUnsub = this.db.collection('matches').doc(me.uid).onSnapshot(async (d) => {
        if (!d.exists) return; const m = d.data(); this._matchUnsub && this._matchUnsub(); this._matchUnsub = null; await d.ref.delete(); cb({ code: m.code, isHost: false, peer: m.peer, opts: m.opts });
      });
    }
  }
  leaveQueue() { if (this._matchUnsub) { this._matchUnsub(); this._matchUnsub = null; } if (this.user) this.db.collection('queue').doc(this.user.uid).delete().catch(() => {}); }
  createRoom() {
    const code = Math.random().toString(36).slice(2, 7).toUpperCase();
    this.db.collection('rooms').doc(code).set({ code, host: { uid: this.user.uid, name: this.user.name, avatarImage: this.user.avatarImage }, guest: null, msgs: [] });
    return code;
  }
  async joinRoom(code) {
    code = code.toUpperCase().trim(); const ref = this.db.collection('rooms').doc(code), snap = await ref.get();
    if (!snap.exists) return { ok: false, error: 'Kode room tidak ditemukan' };
    const room = snap.data();
    if (room.host.uid === this.user.uid) return { ok: true, room, asHost: true };
    const guest = { uid: this.user.uid, name: this.user.name, avatarImage: this.user.avatarImage };
    await ref.update({ guest, msgs: firebase.firestore.FieldValue.arrayUnion({ kind: 'guest-joined', guest }) });
    return { ok: true, room, asHost: false };
  }
  onRoom(code, fn) {
    let lastLen = 0;
    const unsub = this.db.collection('rooms').doc(code).onSnapshot((snap) => { const d = snap.data(); if (!d) return; const msgs = d.msgs || []; for (let i = lastLen; i < msgs.length; i++) fn(msgs[i]); lastLen = msgs.length; });
    this.roomUnsubs.set(code, unsub);
  }
  offRoom(code) { const u = this.roomUnsubs.get(code); if (u) u(); this.roomUnsubs.delete(code); }
  sendRoomShot(code, shot) { this.db.collection('rooms').doc(code).update({ msgs: firebase.firestore.FieldValue.arrayUnion({ kind: 'shot', shot }) }); }
  sendRoomCtl(code, ctl, from) { this.db.collection('rooms').doc(code).update({ msgs: firebase.firestore.FieldValue.arrayUnion({ kind: 'ctl', ctl, from }) }); }
   sendRoomChat(code, text) { this.db.collection('rooms').doc(code).update({ msgs: firebase.firestore.FieldValue.arrayUnion({ kind: 'chat', text, from: this.user.name }) }); }
  sendRoomStart(code, info) { this.db.collection('rooms').doc(code).update({ msgs: firebase.firestore.FieldValue.arrayUnion({ kind: 'start', info }) }); }
}
