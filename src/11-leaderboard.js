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
