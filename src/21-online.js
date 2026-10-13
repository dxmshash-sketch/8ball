/* =====================================================================
   21 · MARKET & ONLINE — mixin UI (muat PALING AKHIR, setelah 20-main.js).
   Menimpa render_market, render_friend, dan startQuickMatch:
   · Market: semua skin yang dijual dari Developer DIY (meja, cue, bola putih) tampil, lengkap pratinjau & tombol beli.
   · Main dengan Teman: buat/gabung room, taruhan opsional, mulai bersama; jeda & main lagi harus disetujui kedua pihak (lihat Game).
   · Quick match online: taruhan, game, dan meja harus sama; bila tidak ada pemain lain dalam 12 dtk → lawan simulasi (diberi label).
   ===================================================================== */
(function () {
  const ensurePage = (screenId, pageId) => {
    let el = $(pageId);
    if (!el) { el = document.createElement('div'); el.id = pageId; el.className = 'page'; ($(screenId) || document.body).appendChild(el); }
    return el;
  };
  const lsUsed = () => { let n = 0; try { for (let i = 0; i < localStorage.length; i++) n += (localStorage.getItem(localStorage.key(i)) || '').length; } catch (e) { /* abaikan */ } return n; };
  const when = (v) => (v && typeof v.then === 'function' ? v : Promise.resolve(v));

  /* gaya kartu market + room (sekali) */
  const css = document.createElement('style'); css.id = 'mkStyle';
  css.textContent = `
.mk-tabs{display:flex;gap:8px;margin:12px 0;flex-wrap:wrap}
.mk-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:12px}
.mk-card{display:flex;flex-direction:column;gap:8px;padding:12px;border-radius:16px;background:linear-gradient(180deg,rgba(34,46,78,.9),rgba(16,23,42,.92));border:1px solid rgba(255,255,255,.12);box-shadow:0 8px 20px rgba(0,0,0,.3)}
.mk-thumb{height:112px;border-radius:12px;background:rgba(0,0,0,.28);display:flex;align-items:center;justify-content:center;overflow:hidden}
.mk-thumb img,.mk-thumb canvas{max-width:100%;max-height:100%;object-fit:contain}
.mk-card h4{margin:0;font-size:15px}.mk-meta{display:flex;justify-content:space-between;align-items:center;font-size:12px;opacity:.85}
.mk-kind{padding:2px 8px;border-radius:999px;background:rgba(255,205,80,.16);color:#ffd45a;font-weight:700;font-size:11px}
.mk-price{display:flex;align-items:center;gap:6px;font-weight:800;color:#ffd45a}.mk-row{display:flex;gap:8px;justify-content:space-between;align-items:center}
.fr-wrap{display:flex;flex-direction:column;gap:14px;max-width:560px;margin:0 auto}
.fr-card{padding:16px;border-radius:18px;background:linear-gradient(180deg,rgba(34,46,78,.9),rgba(16,23,42,.92));border:1px solid rgba(255,255,255,.12);display:flex;flex-direction:column;gap:10px}
.fr-code{font:900 38px/1 ui-monospace,monospace;letter-spacing:8px;text-align:center;color:#ffd45a;padding:12px;border-radius:14px;background:rgba(0,0,0,.3)}
.fr-card label{display:flex;flex-direction:column;gap:5px;font-size:13px;opacity:.95}.fr-card select,.fr-card input{padding:10px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:rgba(0,0,0,.3);color:#fff;font:600 15px system-ui}
.fr-peers{display:flex;align-items:center;justify-content:center;gap:14px;font-weight:800}
#qmOverlay{position:fixed;inset:0;z-index:80;display:flex;align-items:center;justify-content:center;background:rgba(3,6,14,.72);backdrop-filter:blur(4px)}
#qmOverlay[hidden]{display:none}.qm-box{width:min(88vw,340px);padding:22px;border-radius:22px;background:linear-gradient(180deg,#223056,#111a33);border:1px solid rgba(255,255,255,.16);text-align:center;display:flex;flex-direction:column;gap:12px;color:#fff;font:600 14px system-ui}
.qm-spin{width:46px;height:46px;margin:0 auto;border-radius:50%;border:4px solid rgba(255,255,255,.15);border-top-color:#ffd45a;animation:qmr 1s linear infinite}@keyframes qmr{to{transform:rotate(360deg)}}`;
  document.head.appendChild(css);

  /* ------------------------------ ball thumbnail ------------------------------ */
  function ballThumb(p, size) {
    const cv = document.createElement('canvas'); cv.width = cv.height = size; const c = cv.getContext('2d'), R = size * 0.36, cx = size / 2, cy = size / 2;
    const fxCol = { fire: '255,130,40', ice: '140,210,255', aurora: '170,140,255', electric: '120,220,255', gold: '255,205,80' }[p.fx];
    if (fxCol) { const g = c.createRadialGradient(cx, cy, R * 0.3, cx, cy, R * 1.6); g.addColorStop(0, 'rgba(' + fxCol + ',.65)'); g.addColorStop(1, 'rgba(' + fxCol + ',0)'); c.fillStyle = g; c.beginPath(); c.arc(cx, cy, R * 1.6, 0, 7); c.fill(); }
    c.save(); c.beginPath(); c.arc(cx, cy, R, 0, 7); c.clip(); c.fillStyle = p.tint || '#f6f6f0'; c.fillRect(0, 0, size, size);
    const done = () => { const sh = c.createRadialGradient(cx - R * 0.4, cy - R * 0.5, R * 0.1, cx, cy, R * 1.15); sh.addColorStop(0, 'rgba(255,255,255,.55)'); sh.addColorStop(0.5, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(0,20,40,.55)'); c.fillStyle = sh; c.fillRect(0, 0, size, size); c.restore(); };
    if (p.image) { const im = new Image(); im.onload = () => { const s = R * 1.7; c.globalAlpha = 0.92; c.drawImage(im, cx - s / 2, cy - s / 2, s, s); c.globalAlpha = 1; done(); }; im.onerror = done; im.src = p.image; } else done();
    return cv;
  }

  Object.assign(UI.prototype, {

     attachBackend(backend) {
    this.backend = backend;
    backend.onAuthChanged((user) => { this.account = user; this.refreshMenu(); if (this.current === 'screenAuth' && user) this.back(); });
    if (backend.onDirectoryChanged) backend.onDirectoryChanged(() => { if (this.current === 'screenFriend') this.render_friend(); });
  },
  /** Buat (sekali) & kembalikan div konten untuk screen yang dibangun murni lewat JS (bukan lewat body.html statis). */
  _mount(pageId, screenId) {
    let el = $(pageId);
    if (!el) { el = document.createElement('div'); el.id = pageId; el.className = 'pg'; $(screenId).appendChild(el); }
    return el;
  },
  accountAvatarHTML(u, size) {
    if (u && u.avatarImage) return '<div class="avx" style="--s:' + (size || 44) + 'px;overflow:hidden"><img src="' + u.avatarImage + '" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%"></div>';
    return avatarHTML(this.store.data.profile.avatar, size, this.store.data.profile.badge);
  },
    /* ============================== MARKET ============================== */
    async render_market() {
      const el = ensurePage('screenMarket', 'pageMarket'), be = this.backend, st = this.store, mk = this.mk = this.mk || { tab: 'all' };
      if (!be.__mkHook) { be.__mkHook = true; be.onMarketChanged(() => { if (this.current === 'screenMarket') this.render_market(); }); }
      el.innerHTML = this._head('Market', this._wallet()) + '<div class="pg-body"><p class="muted">Memuat…</p></div>';
      let list = []; try { list = (await when(be.listMarket())) || []; } catch (e) { list = []; }
       this._marketCache = { list: list, ts: Date.now() };
      const user = be.currentUser() || {}, owned = new Set(user.owned || []), isAdmin = be.isAdmin();
      const own = (it) => owned.has(it.id) || st.custom.cues.some((x) => x.id === 'mk_' + it.id) || st.custom.tables.some((x) => x.id === 'mk_' + it.id) || st.custom.cueballs.some((x) => x.id === 'mk_' + it.id);
      const shown = list.filter((it) => mk.tab === 'all' || it.kind === mk.tab).sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0));
      const KIND = { table: 'Meja', cue: 'Cue', cueball: 'Bola putih', fx: 'FX Bola' };
      const tabs = [
        ['all', 'Semua'],
        ['table', 'Meja'],
        ['cue', 'Cue'],
        ['cueball', 'Bola putih'],
        ['fx', 'FX Bola'],     // ← tambah
      ];
      el.innerHTML = this._head('Market', this._wallet()) + '<div class="pg-body">' +
        '<div class="mk-tabs seg">' + tabs.map((t) => '<button data-act="tab" data-v="' + t[0] + '" aria-pressed="' + (mk.tab === t[0]) + '">' + t[1] + ' <small>(' + (t[0] === 'all' ? list.length : list.filter((x) => x.kind === t[0]).length) + ')</small></button>').join('') + '</div>' +
        (shown.length ? '<div class="mk-grid">' + shown.map((it) =>
          '<div class="mk-card"><div class="mk-thumb" data-mk="' + esc(it.id) + '"></div><h4>' + esc(it.name) + '</h4>' +
          '<div class="mk-meta"><span class="mk-kind">' + (KIND[it.kind] || it.kind) + '</span><span>oleh ' + esc(it.by || 'admin') + '</span></div>' +
          '<div class="mk-row"><span class="mk-price">' + COIN_SVG + fmtCoins(it.price || 0) + '</span>' +
          (own(it) ? '<button class="btn small" disabled>Dimiliki</button>' : '<button class="btn small green" data-act="buy" data-v="' + esc(it.id) + '">Beli</button>') +
          (isAdmin ? '<button class="btn small" data-act="pull" data-v="' + esc(it.id) + '" title="Tarik dari Market">✕</button>' : '') + '</div></div>').join('') + '</div>'
          : '<p class="muted" style="text-align:center;margin:40px 0">Belum ada item di kategori ini.' + (isAdmin ? '<br>Buka <b>Developer</b>, buat skin, lalu tekan <b>Jual</b>.' : '') + '</p>') + '</div>';
      shown.forEach((it) => {                                                              // pratinjau
        const slot = el.querySelector('[data-mk="' + (window.CSS && CSS.escape ? CSS.escape(it.id) : it.id) + '"]'); if (!slot) return; const pl = it.payload || {};
        if (it.kind === 'cue') { const im = new Image(); im.src = pl.image || it.image || ''; slot.appendChild(im); }
           else if (it.kind === 'fx') {
           const cv = document.createElement('canvas');
           cv.width = 240; cv.height = 180;
           cv.style.width = '100%'; cv.style.height = 'auto';
           slot.appendChild(cv);
           const preview = new DevBallPreview(cv);
           preview.set(null, null, (it.payload && it.payload.id) || 'none');
           preview.start();
           if (!this._fxPreviews) this._fxPreviews = new Map();
           this._fxPreviews.set(cv, preview);
         }
        else if (it.kind === 'cueball') slot.appendChild(ballThumb({ tint: pl.tint || it.tint, image: pl.image || it.image, fx: pl.fx || it.fx }, 112));
        else if (it.thumb) { const im = new Image(); im.src = it.thumb; slot.appendChild(im); }
        else { const th = Object.assign({}, pl); loadThemeImages(th, (imgs) => { slot.appendChild(renderTablePreview(th, 220, imgs, th.imageProfile || 'american')); }); }
      });
      this._bind(el, {
        tab: (d) => { mk.tab = d.v; this.render_market(); },
        pull: async (d) => { if (await when(be.unpublish(d.v))) { this.toast('Item ditarik dari Market', 'ok'); this.render_market(); } },
        buy: async (d) => {
          const it = list.find((x) => x.id === d.v); if (!it) return;
          const price = it.price || 0, pl = it.payload || {};
                     // ── FX: cuma license, tidak simpan data ──
           if (it.kind === 'fx') {
             const r = st.buyFxFromMarket(pl.id, price);
             if (!r.ok) { this.toast(r.error, 'foul'); return; }
             try { await when(be.updateProfile({ owned: (user.owned || []).concat(it.id) })); } catch (e) {}
             this.toast('"' + it.name + '" dibuka — pakai di halaman FX Bola', 'ok');
             this.fx.burst(innerWidth / 2, innerHeight / 2, 70);
             this.render_market();
             return;
          if (st.coins < price) { this.toast('Koin tidak cukup', 'foul'); return; }
          if (lsUsed() + JSON.stringify(pl).length > 4.6e6) { this.toast('Penyimpanan browser hampir penuh — hapus skin lama di Developer dulu', 'foul'); return; }
          if (!st.spend(price)) { this.toast('Koin tidak cukup', 'foul'); return; }
          const nid = 'mk_' + it.id; let ok = true;
          if (it.kind === 'cue') ok = st.addCustomCue({ id: nid, name: it.name, rarity: pl.rarity || 'Epic', base: pl.base || 'maple', image: pl.image });
          else if (it.kind === 'table') ok = st.addCustomTable(Object.assign({}, pl, { id: nid, name: it.name }));
          else ok = st.addCustomCueball({ id: nid, name: it.name, tint: pl.tint || null, image: pl.image || null, fx: pl.fx || 'none' });
          if (!ok) { st.addCoins(price); this.toast('Gagal menyimpan skin (penyimpanan penuh) — koin dikembalikan', 'foul'); return; }
          try { await when(be.updateProfile({ owned: (user.owned || []).concat(it.id) })); } catch (e) { /* kepemilikan lokal tetap tersimpan */ }
          this.toast('"' + it.name + '" dibeli — buka menu Meja / Cue / Bola untuk memakainya', 'ok'); this.fx.burst(innerWidth / 2, innerHeight / 2, 70); this.render_market();
        },
      });
    },

     /* ------------------------------ Auth ------------------------------ */
  render_auth() {
    const el = this._mount('pageAuth', 'screenAuth');
    const tab = this.authTab || 'signin';
    const isMock = this.backend.name === 'mock';
    el.innerHTML = this._head('Masuk / Daftar') + '<div class="pg-body"><div class="narrow" style="max-width:420px;margin:0 auto">' +
      (isMock ? '<p class="note" style="background:rgba(244,197,66,.1);border:1px solid rgba(244,197,66,.35);padding:10px 12px;border-radius:10px">Mode <b>simulasi lokal</b>: akun hanya tersimpan di browser ini. Untuk akun sungguhan lintas perangkat (termasuk Sign in with Google asli), sambungkan Firebase — lihat <code>FIREBASE_SETUP.md</code>.</p>' : '') +
      '<div class="seg" style="margin:10px 0"><button data-act="atab" data-v="signin" aria-pressed="' + (tab === 'signin') + '">Masuk</button><button data-act="atab" data-v="signup" aria-pressed="' + (tab === 'signup') + '">Daftar</button></div>' +
      '<button class="btn" style="width:100%;margin-bottom:10px" data-act="google">' + (isMock ? 'Simulasikan Sign in with Google' : 'Lanjutkan dengan Google') + '</button>' +
      (isMock ? '<input class="text-input" id="authGoogleName" placeholder="Nama tampilan (untuk simulasi)" style="width:100%;height:40px;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:var(--panel-2);padding:0 12px;margin-bottom:14px">' : '') +
      '<div class="row" style="align-items:center;margin:6px 0 14px"><hr style="flex:1;border-color:rgba(255,255,255,.1)"><span class="muted">atau email</span><hr style="flex:1;border-color:rgba(255,255,255,.1)"></div>' +
      (tab === 'signup' ? '<label class="note">Nama<input class="text-input" id="authName" maxlength="20" style="width:100%;height:40px;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:var(--panel-2);padding:0 12px;margin:4px 0 10px"></label>' : '') +
      '<label class="note">Email<input class="text-input" id="authEmail" type="email" style="width:100%;height:40px;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:var(--panel-2);padding:0 12px;margin:4px 0 10px"></label>' +
      '<label class="note">Password<input class="text-input" id="authPass" type="password" style="width:100%;height:40px;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:var(--panel-2);padding:0 12px;margin:4px 0 14px"></label>' +
      '<button class="btn primary big" data-act="submit">' + (tab === 'signup' ? 'Buat akun' : 'Masuk') + '</button>' +
      '<p class="note" id="authErr" style="color:var(--bad)"></p></div></div>';
    const err = (m) => { $('authErr').textContent = m || ''; };
    this._bind(el, {
      atab: (d) => { this.authTab = d.v; this.render_auth(); },
      google: async () => {
        this.click();
        if (isMock) { const r = await this.backend.signInGoogleMock($('authGoogleName').value); if (!r.ok) err(r.error); else { if (r.isFirstAdmin) this.toast('Akun ini otomatis jadi ADMIN (akun pertama di browser ini)', 'ok'); } }
        else { const r = await this.backend.signInGoogle(); if (!r.ok) err(r.error); }
      },
      submit: async () => {
        this.click(); err('');
        const email = $('authEmail').value, pass = $('authPass').value;
        const r = tab === 'signup' ? await this.backend.signUpPassword(email, pass, $('authName').value) : await this.backend.signInPassword(email, pass);
        if (!r.ok) err(r.error); else if (r.isFirstAdmin) this.toast('Akun ini otomatis jadi ADMIN (akun pertama di browser ini)', 'ok');
      },
    });
  },
  requireAuth(thenGo) {
    if (this.backend.currentUser()) { this.go(thenGo); return; }
    this.authReturn = thenGo; this.go('auth');
  },
  back() {
    if (this.current === 'screenAuth' && this.authReturn) { const t = this.authReturn; this.authReturn = null; if (this._gateBlocked(t)) return; this._renderPage(t); this.show(PAGE_SCREENS[t], true); return; }
    const id = this.stack.pop() || 'screenMenu';
    const name = Object.keys(PAGE_SCREENS).find((k) => PAGE_SCREENS[k] === id);
    if (name && this._gateBlocked(name)) return;
    if (name) this._renderPage(name);
    this.show(id, true);
  },
    /* ============================== MAIN DENGAN TEMAN ============================== */
    render_friend() {
      const el = ensurePage('screenFriend', 'pageFriend'), be = this.backend, fr = this.fr = this.fr || { step: 'home', game: '8ball', table: 'american', bet: 0, code: '', role: '', peer: null };
      const user = be.currentUser(); if (!user) { el.innerHTML = this._head('Main dengan Teman') + '<div class="pg-body"><p class="muted">Masuk ke akun dulu.</p></div>'; return; }
      const games = [['8ball', '8-Ball'], ['9ball', '9-Ball'], ['9call', '9-Ball Kantong Pilihan']], betOpts = [0].concat(BETS.slice(0, 8));
      const opt = (arr, cur, lab) => arr.map((v) => '<option value="' + (Array.isArray(v) ? v[0] : v) + '"' + ((Array.isArray(v) ? v[0] : v) === cur ? ' selected' : '') + '>' + (lab ? lab(v) : v[1]) + '</option>').join('');
      let body = '';
      if (fr.step === 'home') body =
        '<div class="fr-card"><b>Buat room</b><label>Game<select id="frGame">' + opt(games, fr.game) + '</select></label>' +
        '<label>Meja<select id="frTable">' + Object.values(TABLE_PROFILES).map((p) => '<option value="' + p.id + '"' + (p.id === fr.table ? ' selected' : '') + '>' + p.name + '</option>').join('') + '</select></label>' +
        '<label>Taruhan (masing-masing pemain)<select id="frBet">' + opt(betOpts, fr.bet, (b) => (b ? fmtCoins(b) + ' ' + COIN_NAME : 'Tanpa taruhan')) + '</select></label>' +
        '<button class="btn green" data-act="create">Buat room</button></div>' +
        '<div class="fr-card"><b>Gabung room</b><label>Kode room<input id="frCode" maxlength="8" placeholder="mis. K7Q2A" style="text-transform:uppercase"></label><button class="btn primary" data-act="join">Gabung</button></div>' +
        '<p class="note">Room hanya terhubung antar tab/browser yang sama bila backend Mock; lintas perangkat butuh Firebase aktif. Jeda dan "main lagi" harus disetujui kedua pemain.</p>';
      else body =
        '<div class="fr-card"><div class="fr-code">' + esc(fr.code) + '</div>' +
        '<div class="fr-peers"><span>' + esc(user.name) + '</span><span class="gold">VS</span><span>' + (fr.peer ? esc(fr.peer.name) : '<span class="muted">menunggu teman…</span>') + '</span></div>' +
        '<div class="muted" style="text-align:center;font-size:13px">' + (games.find((g) => g[0] === fr.game) || games[0])[1] + ' · meja ' + esc((TABLE_PROFILES[fr.table] || TABLE_PROFILES.american).name) + ' · ' + (fr.bet ? 'taruhan ' + fmtCoins(fr.bet) : 'tanpa taruhan') + '</div>' +
        (fr.role === 'host' ? '<button class="btn green" data-act="start"' + (fr.peer && !fr.starting ? '' : ' disabled') + '>' + (fr.starting ? 'Memulai…' : 'Mulai pertandingan') + '</button>' : '<p class="muted" style="text-align:center">' + (fr.starting ? 'Memulai…' : 'Menunggu tuan rumah memulai…') + '</p>') +
        '<button class="btn small" data-act="leave">Tutup room</button></div>';
      el.innerHTML = this._head('Main dengan Teman', this._wallet()) + '<div class="pg-body"><div class="fr-wrap">' + body + '</div></div>';
      const val = (id) => ($(id) || {}).value;
      this._bind(el, {
        create: () => {
          fr.game = val('frGame'); fr.table = val('frTable'); fr.bet = +val('frBet') || 0;
          if (fr.bet > this.store.coins) { this.toast('Saldo tidak cukup untuk taruhan ini', 'foul'); return; }
          fr.code = be.createRoom(); fr.role = 'host'; fr.peer = null; fr.step = 'room'; fr.starting = false; this._frListen(); this.render_friend();
        },
        join: async () => {
          const code = String(val('frCode') || '').toUpperCase().trim(); if (!code) { this.toast('Masukkan kode room', 'foul'); return; }
          const r = await when(be.joinRoom(code)); if (!r || !r.ok) { this.toast((r && r.error) || 'Room tidak ditemukan', 'foul'); return; }
          if (r.asHost) { this.toast('Itu room milikmu — bagikan kodenya ke teman', 'foul'); return; }
          fr.code = code; fr.role = 'guest'; fr.peer = r.room.host; fr.step = 'room'; fr.starting = false; this._frListen(); this.render_friend();
        },
        start: () => {
          if (!fr.peer || fr.starting) return; if (fr.bet > this.store.coins) { this.toast('Saldo tidak cukup untuk taruhan ini', 'foul'); return; }
          fr.starting = true; be.sendRoomStart(fr.code, { game: fr.game, table: fr.table, bet: fr.bet }); this.render_friend();
          clearTimeout(fr.startTimer); fr.startTimer = setTimeout(() => { if (fr.starting && fr.step === 'room') { fr.starting = false; this.toast('Teman tidak merespons — coba lagi', 'foul'); this.render_friend(); } }, 8000);
        },
        leave: () => this._frClose(true),
      });
    },
    _frListen() {
      const fr = this.fr, be = this.backend;
      be.onRoom(fr.code, (m) => {
        if (!m) return;
        if (m.kind === 'guest-joined' && fr.role === 'host') { fr.peer = m.guest; this.toast(m.guest.name + ' bergabung', 'ok'); if (this.current === 'screenFriend') this.render_friend(); }
        else if (m.kind === 'start' && fr.role === 'guest') {
          const info = m.info || {};
          if ((info.bet || 0) > this.store.coins) { be.sendRoomChat(fr.code, '__nocoins__'); this.toast('Saldo tidak cukup untuk taruhan ' + fmtCoins(info.bet), 'foul'); return; }
          fr.starting = true; this._frLaunch(info, false); be.sendRoomChat(fr.code, '__ready__');
        } else if (m.kind === 'chat') {
          if (m.text === '__ready__' && fr.role === 'host' && fr.starting) this._frLaunch({ game: fr.game, table: fr.table, bet: fr.bet }, true);
          else if (m.text === '__nocoins__' && fr.role === 'host') { fr.starting = false; this.toast('Saldo temanmu tidak cukup untuk taruhan ini', 'foul'); this.render_friend(); }
          else if (m.text === '__left__') { this.toast('Teman menutup room', 'foul'); this._frClose(false); }
        }
      });
    },
    _frLaunch(info, isHost) {
      const fr = this.fr, be = this.backend, user = be.currentUser();
      clearTimeout(fr.startTimer); be.offRoom(fr.code);
      const transport = new RoomTransport(be, fr.code), peer = fr.peer || {};
      const ok = this.game.startMatch({ mode: 'online', game: info.game || '8ball', table: info.table || 'american', bet: info.bet || 0, room: { transport, code: fr.code, isHost, myName: user.name, peerName: peer.name || 'Teman' } });
      if (!ok) { transport.close(); this.toast('Saldo tidak cukup untuk taruhan ini', 'foul'); fr.starting = false; return; }
      fr.step = 'home'; fr.starting = false;
    },
    _frClose(notify) {
      const fr = this.fr; if (!fr) return;
      if (notify && fr.code) { try { this.backend.sendRoomChat(fr.code, '__left__'); } catch (e) { /* abaikan */ } }
      clearTimeout(fr.startTimer); if (fr.code) this.backend.offRoom(fr.code); fr.step = 'home'; fr.code = ''; fr.peer = null; fr.starting = false;
      if (this.current === 'screenFriend') this.render_friend();
    },

    /* ============================== QUICK MATCH ONLINE (bertaruhan) ============================== */
    startQuickMatch(opts) {
      opts = opts || {}; const be = this.backend, st = this.store, bet = Math.max(0, opts.bet | 0);
      if (!be || !be.currentUser()) { if (this.requireAuth) this.requireAuth('modes'); else this.go('auth'); return; }
      if (bet > st.coins) { this.toast('Saldo tidak cukup untuk taruhan ini', 'foul'); return; }
      let ov = $('qmOverlay'); if (!ov) { ov = document.createElement('div'); ov.id = 'qmOverlay'; document.body.appendChild(ov); }
      ov.hidden = false;
      ov.innerHTML = '<div class="qm-box"><div class="qm-spin"></div><b style="font-size:17px">Mencari lawan…</b><span class="muted">' + (bet ? 'Taruhan ' + COIN_SVG + ' <b class="gold">' + fmtCoins(bet) + '</b>' : 'Tanpa taruhan') + ' · ' + esc(opts.game || '8ball') + ' · meja ' + esc(opts.table || 'standard') + '</span><button class="btn small" id="qmCancel">Batal</button></div>';
      let done = false; const finish = () => { done = true; clearTimeout(timer); ov.hidden = true; };
      const timer = setTimeout(() => {                                                    // tidak ada pemain sungguhan: lawan simulasi (diberi label)
        if (done) return; finish(); be.leaveQueue();
        this.toast('Belum ada pemain lain dengan taruhan yang sama — kamu melawan lawan simulasi', '');
        if (!this.game.startMatch({ mode: 'online', game: opts.game || '8ball', table: opts.table || 'standard', bet })) this.toast('Saldo tidak cukup untuk taruhan ini', 'foul');
      }, 12000);
      $('qmCancel').onclick = () => { this.click(); if (done) return; finish(); be.leaveQueue(); };
      be.joinQueue((m) => {
        if (done) return; finish(); const o = Object.assign({}, opts, m.opts || {}), user = be.currentUser();
        const transport = new RoomTransport(be, m.code);
        const ok = this.game.startMatch({ mode: 'online', game: o.game || '8ball', table: o.table || 'standard', bet: o.bet || 0, room: { transport, code: m.code, isHost: m.isHost, myName: user.name, peerName: (m.peer && m.peer.name) || 'Lawan' } });
        if (!ok) { transport.close(); this.toast('Saldo tidak cukup untuk taruhan ini', 'foul'); }
      }, { bet, game: opts.game || '8ball', table: opts.table || 'standard' });
    },
  });
})();

