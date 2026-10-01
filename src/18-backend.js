/* =====================================================================
   18 · BACKEND — antarmuka akun/online yang bisa ditukar.
   MockBackend (aktif sekarang): simulasi penuh di localStorage + BroadcastChannel,
   sehingga BISA diuji lintas TAB/WINDOW di browser yang SAMA (satu perangkat).
   TIDAK menyambungkan perangkat berbeda — itu perlu backend sungguhan.
   FirebaseBackend (siap pakai, belum aktif): sama persis bentuk API-nya,
   tinggal isi CONFIG di 19-firebase-backend.js dan tukar di 20-main.js.
   ===================================================================== */
const DIRECTORY_KEY = 'pantul.directory.v1';   // "server" tiruan: daftar semua akun di browser ini
const SESSION_KEY = 'pantul.session.v1';
const MARKET_KEY = 'pantul.market.v1';
const ROOM_PREFIX = 'pantul.room.';

function uid(prefix) { return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function readJSON(key, fallback) { try { const s = window.localStorage.getItem(key); return s ? JSON.parse(s) : fallback; } catch (e) { return fallback; } }
function writeJSON(key, val) { try { window.localStorage.setItem(key, JSON.stringify(val)); return true; } catch (e) { return false; } }

/** Transport untuk "Main dengan Teman": bentuk API-nya sama persis dengan MockTransport (05-net.js),
    jadi Game tidak perlu tahu bedanya. Tembakan sendiri diterapkan lokal + dikirim ke lawan; tembakan
    yang datang dari lawan (sudah tervalidasi di sisi pengirim) diterapkan langsung. Bekerja di atas
    MockBackend (satu browser, banyak tab) maupun FirebaseBackend (lintas perangkat sungguhan) karena
    keduanya punya onRoom/sendRoomShot/offRoom dengan bentuk yang sama. */
class RoomTransport {
  constructor(backend, code) {
    this.backend = backend; this.code = code; this.bus = new EventBus(); this.authority = null;
    this.connected = true; this.roomId = code; this.playerId = (backend.currentUser() || {}).uid || 'guest';
    backend.onRoom(code, (msg) => { if (msg.kind === 'shot' && msg.shot.__from !== this.playerId) this.bus.emit('shot', msg.shot); });   // abaikan gema dari tembakan sendiri (Firestore mengirim balik snapshot tulisan sendiri)
  }
  on(evt, fn) { return this.bus.on(evt, fn); }
  sendShot(shot) {
    if (!this.connected) { this.bus.emit('rejected', { shot, reason: 'Tidak terhubung ke room' }); return; }
    const err = this.authority ? this.authority(shot) : null;
    if (err) { this.bus.emit('rejected', { shot, reason: err }); return; }
    this.bus.emit('shot', shot); this.backend.sendRoomShot(this.code, Object.assign({}, shot, { __from: this.playerId }));
  }
  publishSnapshot() { /* penyambungan ulang otomatis belum didukung untuk room teman */ }
  disconnect() { this.connected = false; this.bus.emit('disconnected'); }
  reconnect() { this.connected = true; this.bus.emit('reconnected', { snapshot: null }); }
  close() { this.backend.offRoom(this.code); }
}
/** Hash string sederhana → seed deterministik, supaya kedua pemain di room yang sama menyusun rack yang identik tanpa jabat-tangan tambahan. */
function seedFromRoomCode(code) { let h = 5381; for (let i = 0; i < code.length; i++) h = ((h << 5) + h + code.charCodeAt(i)) >>> 0; return h; }

class MockBackend {
  constructor() {
    this.name = 'mock';
    this.listeners = []; this.roomChannels = new Map();
    this.bc = (typeof BroadcastChannel !== 'undefined') ? new BroadcastChannel('pantul-mock-net') : null;
    if (this.bc) this.bc.onmessage = (e) => this._onNet(e.data);
    const sess = readJSON(SESSION_KEY, null);
    this.user = sess ? this._directory()[sess.uid] || null : null;
  }
  _directory() { return readJSON(DIRECTORY_KEY, {}); }
  _saveDirectory(d) { writeJSON(DIRECTORY_KEY, d); }
  _emitAuth() { for (const fn of this.listeners) fn(this.user); }
  onAuthChanged(fn) { this.listeners.push(fn); fn(this.user); return () => { const i = this.listeners.indexOf(fn); if (i >= 0) this.listeners.splice(i, 1); }; }
  currentUser() { return this.user; }
  isAdmin() { return !!(this.user && this.user.role === 'admin'); }

  /** Akun PERTAMA yang dibuat di browser ini otomatis admin, supaya mudah diuji tanpa Firestore Console. */
  async signUpPassword(email, password, name) {
    email = String(email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'Email tidak valid' };
    if (!password || password.length < 6) return { ok: false, error: 'Password minimal 6 karakter' };
    const dir = this._directory();
    if (Object.values(dir).some((u) => u.email === email)) return { ok: false, error: 'Email sudah terdaftar' };
    const isFirst = Object.keys(dir).length === 0;
    const user = { uid: uid('u'), email, passHash: this._hash(password), name: (name || email.split('@')[0]).slice(0, 20), avatarImage: null, role: isFirst ? 'admin' : 'user', coins: START_COINS, createdAt: Date.now(), provider: 'password' };
    dir[user.uid] = user; this._saveDirectory(dir); writeJSON(SESSION_KEY, { uid: user.uid });
    this.user = user; this._emitAuth(); this._netSend({ type: 'user-joined', user: this._publicUser(user) });
    return { ok: true, user, isFirstAdmin: isFirst };
  }
  async signInPassword(email, password) {
    email = String(email || '').trim().toLowerCase();
    const dir = this._directory(), user = Object.values(dir).find((u) => u.email === email);
    if (!user || user.passHash !== this._hash(password)) return { ok: false, error: 'Email atau password salah' };
    writeJSON(SESSION_KEY, { uid: user.uid }); this.user = user; this._emitAuth();
    return { ok: true, user };
  }
  /** Simulasi "Sign in with Google": di Mock ini membuat/memuat akun berbasis nama yang diketik (tanpa OAuth sungguhan). */
  async signInGoogleMock(displayName) {
    const name = (displayName || 'Pemain Google').trim().slice(0, 20) || 'Pemain Google';
    const fakeEmail = name.toLowerCase().replace(/[^a-z0-9]+/g, '.') + '@gmail.mock';
    const dir = this._directory(); let user = Object.values(dir).find((u) => u.email === fakeEmail);
    const isFirst = Object.keys(dir).length === 0;
    if (!user) { user = { uid: uid('u'), email: fakeEmail, passHash: null, name, avatarImage: null, role: isFirst ? 'admin' : 'user', coins: START_COINS, createdAt: Date.now(), provider: 'google' }; dir[user.uid] = user; this._saveDirectory(dir); this._netSend({ type: 'user-joined', user: this._publicUser(user) }); }
    writeJSON(SESSION_KEY, { uid: user.uid }); this.user = user; this._emitAuth();
    return { ok: true, user, isFirstAdmin: isFirst && Object.keys(dir).length === 1 };
  }
  signOut() { writeJSON(SESSION_KEY, null); this.user = null; this._emitAuth(); }
  _hash(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return 'h' + h.toString(36); }
  _publicUser(u) { return { uid: u.uid, name: u.name, avatarImage: u.avatarImage, role: u.role }; }

  updateProfile(patch) {
    if (!this.user) return false;
    Object.assign(this.user, patch); const dir = this._directory(); dir[this.user.uid] = this.user; this._saveDirectory(dir);
    this._emitAuth(); this._netSend({ type: 'user-updated', user: this._publicUser(this.user) }); return true;
  }
  spendCoins(n) { if (!this.user || this.user.coins < n) return false; this.user.coins -= n; this.updateProfile({ coins: this.user.coins }); return true; }
  addCoins(n) { if (!this.user) return; this.updateProfile({ coins: this.user.coins + n }); }
  /** Daftar akun lain yang pernah terlihat di browser ini (untuk lobi "pemain online" sederhana). */
  listOtherUsers() { return Object.values(this._directory()).filter((u) => !this.user || u.uid !== this.user.uid).map(this._publicUser); }

  /* ------------ marketplace (skin buatan admin) ------------ */
  listMarket() { return readJSON(MARKET_KEY, []); }
  publish(item) {
    if (!this.isAdmin()) return false;
    const list = this.listMarket(); list.push(Object.assign({ id: uid('m'), publishedAt: Date.now(), by: this.user.name }, item));
    writeJSON(MARKET_KEY, list); this._netSend({ type: 'market-changed' }); return true;
  }
  unpublish(id) { if (!this.isAdmin()) return false; writeJSON(MARKET_KEY, this.listMarket().filter((x) => x.id !== id)); this._netSend({ type: 'market-changed' }); return true; }
  buy(id, applyFn) {
    const item = this.listMarket().find((x) => x.id === id); if (!item || !this.user) return { ok: false, error: 'Item tidak ditemukan' };
    if (this.user.owned && this.user.owned.includes(id)) return { ok: false, error: 'Sudah dimiliki' };
    if (!this.spendCoins(item.price)) return { ok: false, error: 'Koin tidak cukup' };
    const owned = (this.user.owned || []).concat(id); this.updateProfile({ owned }); applyFn && applyFn(item);
    return { ok: true, item };
  }
  onMarketChanged(fn) { this._marketCb = fn; }

  /* ------------ room / main dengan teman (BroadcastChannel — satu browser, banyak tab) ------------ */
  _netSend(msg) { if (this.bc) this.bc.postMessage(msg); }
  _onNet(msg) {
    if (msg.type === 'market-changed' && this._marketCb) this._marketCb();
    if (msg.type === 'match-found' && this._queueCb && this.user && msg.to === this.user.uid) { const cb = this._queueCb; this._queueCb = null; cb({ code: msg.code, isHost: false, peer: msg.peer }); }
    if (msg.type === 'user-joined' || msg.type === 'user-updated') { if (this._directoryCb) this._directoryCb(); }
    const rc = this.roomChannels.get(msg.room); if (rc && msg.type === 'room-msg') rc(msg.payload);
  }
  onDirectoryChanged(fn) { this._directoryCb = fn; }
  createRoom() { const code = Math.random().toString(36).slice(2, 7).toUpperCase(); writeJSON(ROOM_PREFIX + code, { code, host: this._publicUser(this.user), guest: null, log: [] }); return code; }
  joinRoom(code) {
    code = code.toUpperCase().trim(); const room = readJSON(ROOM_PREFIX + code, null);
    if (!room) return { ok: false, error: 'Kode room tidak ditemukan (harus tab/browser yang sama)' };
    if (room.host.uid === this.user.uid) return { ok: true, room, asHost: true };
    room.guest = this._publicUser(this.user); writeJSON(ROOM_PREFIX + code, room);
    this._roomSend(code, { kind: 'guest-joined', guest: room.guest });
    return { ok: true, room, asHost: false };
  }
  /* ------------ matchmaking (antrian cari lawan) ------------ */
  /** cb({code,isHost,peer}) dipanggil sekali saat lawan ditemukan. Mock: hanya menemukan pemain di browser yang sama. */
  joinQueue(cb) {
    const me = this._publicUser(this.user), now = Date.now();
    let q = readJSON('pantul.queue.v1', []).filter((e) => now - e.ts < 45000 && e.uid !== me.uid);
    const waiting = q.shift();
    if (waiting) {
      writeJSON('pantul.queue.v1', q);
      const code = Math.random().toString(36).slice(2, 7).toUpperCase();
      writeJSON(ROOM_PREFIX + code, { code, host: me, guest: waiting.user, log: [] });
      this._netSend({ type: 'match-found', to: waiting.uid, code, peer: me });
      cb({ code, isHost: true, peer: waiting.user });
    } else {
      q.push({ uid: me.uid, user: me, ts: now }); writeJSON('pantul.queue.v1', q);
      this._queueCb = cb; this._queueUid = me.uid;
    }
  }
  leaveQueue() { this._queueCb = null; if (this.user) writeJSON('pantul.queue.v1', readJSON('pantul.queue.v1', []).filter((e) => e.uid !== this.user.uid)); }
  onRoom(code, fn) { this.roomChannels.set(code, fn); }
  offRoom(code) { this.roomChannels.delete(code); }
  _roomSend(code, payload) { this._netSend({ type: 'room-msg', room: code, payload }); }
  sendRoomShot(code, shot) { this._roomSend(code, { kind: 'shot', shot }); }
  sendRoomChat(code, text) { this._roomSend(code, { kind: 'chat', text, from: this.user.name }); }
  sendRoomStart(code, info) { this._roomSend(code, { kind: 'start', info }); }
}
