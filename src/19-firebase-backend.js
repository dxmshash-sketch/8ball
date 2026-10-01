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
      if (!fbUser) { this.user = null; this._emitAuth(); return; }
      const ref = this.db.collection('users').doc(fbUser.uid);
      let snap = await ref.get();
      if (!snap.exists) {
        // role SELALU 'user' di sini — lihat FIREBASE_SETUP.md. Harus dipromosikan manual lewat Firestore Console;
        // aturan keamanan HARUS menolak client menulis role lain selain 'user' saat create, dan menolak perubahan
        // role sama sekali saat update, kalau tidak sembarang client bisa klaim admin untuk dirinya sendiri.
        const doc = { uid: fbUser.uid, email: fbUser.email, name: (fbUser.displayName || fbUser.email.split('@')[0]).slice(0, 20), avatarImage: fbUser.photoURL || null, role: 'user', coins: START_COINS, owned: [], createdAt: Date.now() };
        await ref.set(doc); snap = await ref.get();
      }
      this.user = snap.data(); this._emitAuth();
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
  async listOtherUsers() { const q = await this.db.collection('users').limit(50).get(); return q.docs.map((d) => d.data()).filter((u) => !this.user || u.uid !== this.user.uid); }

  /* ------------ marketplace ------------ */
  async listMarket() { const q = await this.db.collection('market').orderBy('publishedAt', 'desc').get(); return q.docs.map((d) => Object.assign({ id: d.id }, d.data())); }
  async publish(item) { if (!this.isAdmin()) return false; await this.db.collection('market').add(Object.assign({ publishedAt: Date.now(), by: this.user.name }, item)); return true; }
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
  async joinQueue(cb) {
    const me = { uid: this.user.uid, name: this.user.name, avatarImage: this.user.avatarImage }, qref = this.db.collection('queue');
    const found = await this.db.runTransaction(async (tx) => {
      const snap = await qref.orderBy('ts').limit(5).get(); const other = snap.docs.find((d) => d.id !== me.uid && Date.now() - d.data().ts < 45000);
      if (other) { tx.delete(other.ref); return other.data(); }
      tx.set(qref.doc(me.uid), { user: me, ts: Date.now() }); return null;
    });
    if (found) {
      const code = Math.random().toString(36).slice(2, 7).toUpperCase();
      await this.db.collection('rooms').doc(code).set({ code, host: me, guest: found.user, msgs: [] });
      await this.db.collection('matches').doc(found.user.uid).set({ code, peer: me, ts: Date.now() });
      cb({ code, isHost: true, peer: found.user });
    } else {
      this._matchUnsub = this.db.collection('matches').doc(me.uid).onSnapshot(async (d) => {
        if (!d.exists) return; const m = d.data(); this._matchUnsub && this._matchUnsub(); this._matchUnsub = null; await d.ref.delete(); cb({ code: m.code, isHost: false, peer: m.peer });
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
  sendRoomChat(code, text) { this.db.collection('rooms').doc(code).update({ msgs: firebase.firestore.FieldValue.arrayUnion({ kind: 'chat', text, from: this.user.name }) }); }
  sendRoomStart(code, info) { this.db.collection('rooms').doc(code).update({ msgs: firebase.firestore.FieldValue.arrayUnion({ kind: 'start', info }) }); }
}
