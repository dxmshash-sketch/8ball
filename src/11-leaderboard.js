/* =====================================================================
   11 · LEADERBOARD — antarmuka layanan + implementasi simulasi lokal.
   Untuk peringkat sungguhan, buat kelas dengan method fetch(kind) yang
   memanggil server, lalu ganti MockLeaderboard di 16-main.js.
   ===================================================================== */
const LB_FIRST = ['Raka', 'Sari', 'Bima', 'Dewi', 'Fajar', 'Ayu', 'Kevin', 'Nadya', 'Rizky', 'Tasya', 'Dimas', 'Putri', 'Arif', 'Intan', 'Yoga', 'Mega', 'Bayu', 'Citra', 'Eko', 'Lina', 'Andi', 'Wulan', 'Hadi', 'Salsa', 'Rendra', 'Vina', 'Galih', 'Nia', 'Toni', 'Maya'];
const LB_TAIL = ['_pool', '88', 'ID', '.Pro', '_cue', '77', 'Ace', '_8ball', 'King', '01', 'X', '_shot', 'Jaya', '99'];

class MockLeaderboard {
  constructor(store) { this.store = store; }
  /** kind: 'coins' | 'level' | 'wins'. Data disusun deterministik per minggu agar konsisten antar pembukaan. */
  fetch(kind) {
    const week = Math.floor(Date.now() / (7 * 86400000)), rng = new Rng(week * 2654435761 >>> 0), rows = [], used = new Set();
    while (rows.length < 60) {
      const name = LB_FIRST[rng.int(LB_FIRST.length)] + LB_TAIL[rng.int(LB_TAIL.length)];
      if (used.has(name)) continue; used.add(name);
      const skill = Math.pow(rng.next(), 2.2);                           // sedikit pemain sangat kuat
      const level = 1 + Math.floor(skill * 58), wins = Math.floor(8 + skill * 2600 * (0.5 + rng.next()));
      const coins = Math.floor(20000 * Math.pow(10, skill * 3.6 + rng.range(-0.15, 0.25)));
      rows.push({ name, level, wins, coins, avatar: botAvatar(name), isYou: false });
    }
    const p = this.store.data.profile, s = this.store.data.stats;
    rows.push({ name: p.name, level: this.store.level(), wins: s.wins, coins: p.coins, avatar: p.avatar, badge: p.badge, isYou: true });
    rows.sort((a, b) => b[kind] - a[kind]);
    rows.forEach((r, i) => { r.rank = i + 1; r.value = r[kind]; });
    return rows;
  }
}

/* =====================================================================
   FirestoreLeaderboard — peringkat REAL dari koleksi users Firestore.
   Tidak ada fallback ke mock. Kalau gagal / belum login → array kosong.
   Avatar user tanpa custom avatar memakai botAvatar(name) sebagai fallback.
   ===================================================================== */
class FirestoreLeaderboard {
  constructor(store, backend) {
    this.store = store;
    this.backend = backend;
    this._cache = {};       // { kind: { rows, ts } }
    this._cacheTTL = 30000; // 30 detik
  }

  async fetch(kind) {
    // Cek cache
    const c = this._cache[kind];
    if (c && Date.now() - c.ts < this._cacheTTL) return c.rows;

    // Belum login / belum ada backend → empty (bukan mock)
    if (!this.backend || !this.backend.db || !this.backend.currentUser()) {
      return [];
    }

    const orderField = kind === 'coins' ? 'coins' : kind === 'level' ? 'xp' : 'wins';

    try {
      const snap = await this.backend.db.collection('users')
        .orderBy(orderField, 'desc')
        .limit(50)
        .get();

      const me = this.backend.currentUser();
      const rows = snap.docs.map((doc) => this._rowFromDoc(doc.data(), me));

      // Kalau user sendiri tidak masuk top 50, tambahkan manual di bawah
      if (me && !rows.some((r) => r.uid === me.uid)) {
        rows.push(this._rowFromUserLocal(me));
      }

      rows.sort((a, b) => this._sortVal(b, kind) - this._sortVal(a, kind));
      rows.forEach((r, i) => {
        r.rank = i + 1;
        r.value = kind === 'level' ? r.level : r[kind];
      });

      this._cache[kind] = { rows, ts: Date.now() };
      return rows;

    } catch (e) {
      console.warn('[Leaderboard] Firestore gagal:', e.message);
      return [];      // ← bukan fallback ke mock, tapi empty
    }
  }

  /** Paksa refresh — hapus cache lalu fetch ulang. */
  refresh(kind) {
    if (kind) delete this._cache[kind];
    else this._cache = {};
    return this.fetch(kind || 'coins');
  }

  _sortVal(r, kind) {
    if (kind === 'coins') return r.coins || 0;
    if (kind === 'level') return r.xp || 0;
    return r.wins || 0;
  }

  _rowFromDoc(u, me) {
    const xp = u.xp || 0;
    return {
      uid: u.uid,
      name: u.name || 'Pemain',
      level: this._levelFromXp(xp),
      xp,
      wins: u.wins || 0,
      coins: u.coins || 0,
      // Avatar: pakai struct custom kalau ada, kalau tidak → generate dari nama (botAvatar)
      avatar: (u.avatar && u.avatar.sym) ? u.avatar : botAvatar(u.name || 'Pemain'),
      badge: u.badge || null,
      isYou: !!(me && u.uid === me.uid),
    };
  }

  _rowFromUserLocal(me) {
    const s = this.store.data;
    return {
      uid: me.uid,
      name: me.name,
      level: this.store.level(),
      xp: s.profile.xp || 0,
      wins: s.stats.wins || 0,
      coins: s.profile.coins || 0,
      avatar: s.profile.avatar,
      badge: s.profile.badge,
      isYou: true,
    };
  }

  _levelFromXp(xp) {
    let l = 1, rem = xp;
    while (l < MAX_LEVEL && rem >= xpForLevel(l)) {
      rem -= xpForLevel(l);
      l++;
    }
    return l;
  }
}
