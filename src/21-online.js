/* =====================================================================
   21 · ONLINE UI — autentikasi, profil-akun (avatar gambar), marketplace,
   dan main-dengan-teman (buat/gabung room). Semua lewat objek `backend`
   (MockBackend sekarang; tinggal tukar ke FirebaseBackend bila sudah
   dikonfigurasi — lihat 19-firebase-backend.js & FIREBASE_SETUP.md).
   ===================================================================== */
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

  /* ------------------------------ Marketplace ------------------------------ */
  render_market() {
    const el = this._mount('pageMarket', 'screenMarket');
    const items = this.backend.listMarket(), me = this.backend.currentUser(), owned = (me && me.owned) || [];
    el.innerHTML = this._head('Market', this._wallet()) + '<div class="pg-body">' +
      (items.length ? '<div class="tb-grid">' + items.map((it) => {
        const has = owned.includes(it.id), previewHTML = it.kind === 'cue' ? '<img src="' + it.image + '" style="width:100%;max-height:80px;object-fit:contain">' : it.kind === 'cueball' ? '<div style="width:70px;height:70px;border-radius:50%;margin:0 auto;background:' + (it.tint || '#fff') + (it.image ? ';background-image:url(' + it.image + ');background-size:cover' : '') + '"></div>' : '<span data-theme-market="' + it.id + '"></span>';
        return '<div class="tb-card"><div class="tb-prev">' + previewHTML + '</div><div class="tb-info"><h4>' + esc(it.name) + '<span class="rar Epic">' + { cue: 'Cue', table: 'Meja', cueball: 'Bola' }[it.kind] + '</span></h4><p class="muted" style="margin:0;font-size:13px">oleh ' + esc(it.by) + (it.kind === 'cueball' && it.fx !== 'none' ? ' · FX ' + CUEBALL_FX[it.fx].name : '') + '</p>' +
          (has ? '<button class="btn small" disabled>Sudah dimiliki</button>' : '<button class="btn small green" data-act="buy" data-v="' + it.id + '">Beli · ' + COIN_SVG + ' ' + fmtShort(it.price) + '</button>') + '</div></div>';
      }).join('') + '</div>' : '<p class="muted">Belum ada skin yang dijual admin.</p>') +
      '<p class="note">Skin yang dibeli langsung ditambahkan ke koleksi Cue/Meja/Bola Putih kamu.</p></div>';
    this._bind(el, { buy: (d) => this._buyMarketItem(d.v) });
    el.querySelectorAll('[data-theme-market]').forEach((slot) => { const it = items.find((x) => x.id === slot.dataset.themeMarket); if (it) loadThemeImages(it.theme, (imgs) => { slot.innerHTML = ''; slot.appendChild(renderTablePreview(it.theme, 260, imgs)); }); });
  },
  _buyMarketItem(id) {
    if (!this.backend.currentUser()) { this.toast('Masuk dulu untuk membeli', 'foul'); return; }
    const item = this.backend.listMarket().find((x) => x.id === id); if (!item) return;
    if (this.store.coins < item.price) { this.toast('Koin tidak cukup', 'foul'); return; }
    if (!this.store.spend(item.price)) { this.toast('Koin tidak cukup', 'foul'); return; }
    const r = this.backend.buy(id, () => {});
    if (!r.ok) { this.store.addCoins(item.price); this.toast(r.error, 'foul'); return; }
    if (item.kind === 'cue') this.store.addCustomCue(item.payload);
    else if (item.kind === 'table') this.store.addCustomTable(item.payload);
    else if (item.kind === 'cueball') this.store.addCustomCueball(item.payload);
    this.toast('Berhasil membeli ' + item.name, 'ok'); this.fx.burst(innerWidth / 2, innerHeight / 2, 70); this.render_market(); this.refreshMenu();
  },

  /* ------------------------------ Matchmaking (cari lawan) ------------------------------ */
  startQuickMatch(opts) {
    const b = this.backend, me = b.currentUser();
    if (!me) { this.requireAuth('modes'); return; }
    const isMock = b.name === 'mock'; let cancelled = false;
    $('mmSpin').style.display = 'block'; $('mmTitle').textContent = 'Mencari lawan…';
    $('mmSub').textContent = isMock ? 'Mode simulasi: hanya menemukan pemain yang membuka game ini di browser yang sama.' : 'Mencari pemain lain yang sedang online';
    $('mmVs').innerHTML = '<div class="stack" style="margin-top:14px"><button class="btn" id="mmCancel">Batal</button><button class="btn" id="mmBot" hidden>Main lawan bot saja</button></div>';
    this.show('screenMM');
    const botTimer = setTimeout(() => { const bt = $('mmBot'); if (bt) bt.hidden = false; }, 12000);
    const stop = () => { cancelled = true; clearTimeout(botTimer); b.leaveQueue(); };
    $('mmCancel').onclick = () => { stop(); this.show('screenModes', true); };
    $('mmBot').onclick = () => { stop(); this.show('screenModes', true); this.game.startMatch({ game: opts.game, table: opts.table, mode: 'bot', difficulty: 'medium', bet: 0 }); };
    b.joinQueue(({ code, isHost, peer }) => {
      if (cancelled) return; clearTimeout(botTimer);
      $('mmTitle').textContent = 'Lawan ditemukan: ' + peer.name; $('mmSpin').style.display = 'none'; $('mmVs').innerHTML = '';
      this._enterRoom(code, isHost, { guest: isHost ? peer : null, silent: true });
      if (isHost) setTimeout(() => { const info = { game: opts.game, table: opts.table, hostName: me.name }; b.sendRoomStart(code, info); this._launchRoomMatch(info); }, 900);   // jeda agar pendengar lawan sudah siap (BroadcastChannel tidak menyimpan pesan)
    });
  },

  /* ------------------------------ Main dengan Teman ------------------------------ */
  render_friend() {
    const el = this._mount('pageFriend', 'screenFriend');
    const isMock = this.backend.name === 'mock';
    if (this.activeRoom) { this._renderRoomLobby(el); return; }
    el.innerHTML = this._head('Main dengan Teman') + '<div class="pg-body narrow" style="max-width:440px;margin:0 auto">' +
      (isMock ? '<p class="note">Mode simulasi: kode room hanya tersambung antar <b>tab/window di browser yang sama</b>. Untuk mengundang teman di perangkat lain sungguhan, sambungkan Firebase.</p>' : '') +
      '<div class="stack"><button class="btn primary big" data-act="create">Buat room & undang teman</button></div>' +
      '<h3 class="sec">Atau gabung dengan kode</h3><div class="row"><input id="roomCode" maxlength="5" placeholder="KODE" style="flex:1;height:44px;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:var(--panel-2);padding:0 12px;text-transform:uppercase;letter-spacing:2px;font-weight:700"><button class="btn green" data-act="join">Gabung</button></div>' +
      '<p class="note" id="friendErr" style="color:var(--bad)"></p></div>';
    this._bind(el, {
      create: () => { const code = this.backend.createRoom(); this._enterRoom(code, true); },
      join: () => { const r = this.backend.joinRoom($('roomCode').value); if (!r.ok) $('friendErr').textContent = r.error; else this._enterRoom(r.room.code, false); },
    });
  },
  _enterRoom(code, isHost, extra) {
    this.activeRoom = { code, isHost, guest: (extra && extra.guest) || null, chat: [] };
    this.backend.onRoom(code, (msg) => {
      if (msg.kind === 'guest-joined') { this.activeRoom.guest = msg.guest; this.toast(msg.guest.name + ' bergabung ke room', 'ok'); }
      else if (msg.kind === 'chat') this.activeRoom.chat.push(msg);
      else if (msg.kind === 'start' && !this.activeRoom.isHost) { this._launchRoomMatch(msg.info); return; }
      if (this.current === 'screenFriend') this.render_friend();
    });
    if (!(extra && extra.silent)) this.render_friend();
  },
  /** Dipanggil host (saat menekan Mulai) dan guest (saat menerima pesan 'start'): keduanya membangun Game dengan seed & transport room yang sama. */
  _launchRoomMatch(info) {
    const r = this.activeRoom; if (!r) return;
    const peerName = r.isHost ? (r.guest ? r.guest.name : 'Teman') : (info.hostName || 'Host');
    this.backend.offRoom(r.code);                       // lepas pendengar lobi dulu; RoomTransport memasang pendengar barunya sendiri di konstruktornya
    const transport = new RoomTransport(this.backend, r.code);
    this.stack = []; this.activeRoom = null;
    this.game.startMatch({ mode: 'online', game: info.game, table: info.table, bet: 0, room: { code: r.code, isHost: r.isHost, peerName, myName: (this.backend.currentUser() || {}).name, transport } });
  },
  _renderRoomLobby(el) {
    const r = this.activeRoom, me = this.backend.currentUser();
    el.innerHTML = this._head('Room ' + r.code) + '<div class="pg-body narrow" style="max-width:440px;margin:0 auto">' +
      '<div class="chip" style="font-size:28px;justify-content:center;letter-spacing:4px;padding:14px;margin-bottom:6px"><b>' + r.code + '</b></div>' +
      '<p class="muted" style="text-align:center">Bagikan kode ini ke temanmu (di tab/window lain pada browser ini untuk mode simulasi).</p>' +
      '<div class="row" style="justify-content:center;gap:22px;margin:14px 0">' +
      '<div style="text-align:center">' + this.accountAvatarHTML(r.isHost ? me : { name: 'Host' }, 54) + '<div>' + esc(r.isHost ? me.name : 'Host') + '</div></div>' +
      '<span class="gold" style="font:700 22px var(--f-head)">VS</span>' +
      '<div style="text-align:center">' + (r.guest ? this.accountAvatarHTML(r.guest, 54) + '<div>' + esc(r.guest.name) + '</div>' : '<div class="avx" style="--s:54px;opacity:.4"></div><div class="muted">Menunggu…</div>') + '</div></div>' +
      (r.isHost ? (r.guest ? '<button class="btn primary big" data-act="startroom">Mulai main</button>' : '<button class="btn big" disabled>Menunggu teman bergabung…</button>') : '<button class="btn big" disabled>Menunggu host memulai…</button>') +
      '<button class="btn" style="margin-top:10px;width:100%" data-act="leaveroom">Batal / keluar room</button></div>';
    this._bind(el, {
      startroom: () => { const info = { game: '8ball', table: 'standard', hostName: me.name }; this.backend.sendRoomStart(r.code, info); this._launchRoomMatch(info); },
      leaveroom: () => { this.backend.offRoom(r.code); this.activeRoom = null; this.render_friend(); },
    });
  },
});
