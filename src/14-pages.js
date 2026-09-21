/* =====================================================================
   14 · PAGES — halaman (mixin ke UI): mode/taruhan, profil, hadiah, peringkat, meja, cue, hasil
   ===================================================================== */
Object.assign(UI.prototype, {
  _head(title, extra) { return '<div class="pg-head"><button class="btn small" data-back>Kembali</button><h2>' + title + '</h2>' + (extra || '') + '</div>'; },
  _wallet() { return '<div class="chip coins">' + COIN_SVG + '<span>' + fmtCoins(this.store.coins) + '</span></div>'; },
  /** Delegasi klik: [data-act] → handler map; [data-back] → kembali. */
  _bind(el, map) {
    el.onclick = (e) => {
      if (e.target.closest('[data-back]')) { this.click(); this.back(); return; }
      const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
      const fn = map[b.dataset.act]; if (fn) { this.click(); fn(b.dataset, b); }
    };
  },
  /** Isi pratinjau meja ke elemen [data-theme]. */
  fillPreviews(root, width) {
    root.querySelectorAll('[data-theme]').forEach((slot) => {
      const th = this.store.themeDef(slot.dataset.theme);
      loadThemeImages(th, (imgs) => { slot.innerHTML = ''; slot.appendChild(renderTablePreview(th, width || 300, imgs)); });
    });
  },
  mergeItems(items) {
    let coins = 0; const out = [];
    for (const it of items) if (it.type === 'coins') coins += it.amount; else out.push(it);
    return (coins ? [{ type: 'coins', amount: coins }] : []).concat(out);
  },
  rewardCardHTML(it) {
    const st = this.store;
    if (it.type === 'coins') return COIN_SVG.replace('class="coin"', 'class="coin" style="width:34px;height:34px"') + '<b class="gold">+' + fmtCoins(it.amount) + '</b><span class="muted">' + COIN_NAME + '</span>';
    if (it.type === 'cue') { const c = st.cueDefById(it.id); return '<img alt="" src="' + c.image + '"><span>' + esc(c.name) + '</span><span class="rar ' + c.rarity + '">' + c.rarity + '</span>'; }
    if (it.type === 'table') { const t = st.themeDef(it.id); return '<span data-theme="' + it.id + '"></span><span>' + esc(t.name) + '</span><span class="rar ' + t.rarity + '">' + t.rarity + '</span>'; }
    const [kind, val] = it.id.split(':'), av = { sym: kind === 'sym' ? val : 'crown', color: 2, frame: kind === 'frame' ? val : 'none' };
    return avatarHTML(av, 54) + '<span>' + (kind === 'sym' ? 'Avatar ' + SYMBOL_NAMES[val] : 'Bingkai ' + FRAMES[val].name) + '</span>';
  },

  /* ------------------------------ mode & taruhan ------------------------------ */
  render_modes() {
    const st = this.store, el = $('pageModes'), coins = st.coins, local = this.selectedMode === 'local';
    if (BETS.indexOf(this.selectedBet) === -1 || this.selectedBet > coins) this.selectedBet = [...BETS].reverse().find((b) => b <= Math.min(coins, 5000)) || BETS[0];
    const bet = this.selectedBet, canPlay = local || coins >= bet;
    el.innerHTML =
      '<h2>Pilih mode</h2><p class="sub">Semua mode memakai aturan 8-ball yang sama.</p>' +
      '<div class="mode-grid">' + [['bot', 'Lawan bot', 'Latihan melawan komputer, tiga tingkat kesulitan.'], ['online', 'Online', 'Cari lawan lewat matchmaking. Saat ini simulasi lokal; server sungguhan tinggal disambungkan.'], ['local', 'Dua pemain', 'Gantian di satu layar. Tanpa taruhan dan tanpa hadiah.']]
        .map((m) => '<button class="mode-card" data-act="mode" data-v="' + m[0] + '" aria-pressed="' + (this.selectedMode === m[0]) + '"><b>' + m[1] + '</b><span>' + m[2] + '</span></button>').join('') + '</div>' +
      (this.selectedMode === 'bot' ? '<div class="diff-row"><span>Tingkat kesulitan</span><div class="seg">' + [['easy', 'Mudah'], ['medium', 'Sedang'], ['hard', 'Sulit']].map((d) => '<button data-act="diff" data-v="' + d[0] + '" aria-pressed="' + (this.selectedDiff === d[0]) + '">' + d[1] + '</button>').join('') + '</div></div>' : '') +
      (local ? '' :
        '<div class="bet-head"><span>Taruhan</span><span class="muted" style="font-size:16px">Saldo ' + COIN_SVG + ' <b class="gold">' + fmtCoins(coins) + '</b></span></div>' +
        '<div class="bet-grid">' + BETS.map((b) => '<button class="bet" data-act="bet" data-v="' + b + '" aria-pressed="' + (b === bet) + '"' + (b > coins ? ' disabled' : '') + '>' + fmtShort(b) + '</button>').join('') + '</div>' +
        '<div class="payout"><span>Menang <b class="ok">+' + fmtCoins(Math.floor(bet * 2 * (1 - HOUSE_FEE))) + '</b></span><span>Kalah <b class="bad">−' + fmtCoins(bet) + '</b></span><span class="muted">Biaya rumah ' + Math.round(HOUSE_FEE * 100) + '%</span></div>') +
      '<div class="row"><button class="btn green" data-act="start"' + (canPlay ? '' : ' disabled') + '>Mulai main</button><button class="btn" data-back>Kembali</button>' + (canPlay ? '' : '<span class="bad">Saldo tidak cukup</span>') + '</div>';
    this._bind(el, {
      mode: (d) => { this.selectedMode = d.v; this.render_modes(); },
      diff: (d) => { this.selectedDiff = d.v; this.render_modes(); },
      bet: (d) => { this.selectedBet = +d.v; this.render_modes(); },
      start: () => {
        if (!this.game.startMatch({ mode: this.selectedMode, difficulty: this.selectedDiff, bet: this.selectedBet })) this.toast('Saldo tidak cukup untuk taruhan ini', 'foul');
        else this.stack = [];
      },
    });
  },

  /* ------------------------------ profil ------------------------------ */
  render_profile() {
    const st = this.store, p = st.data.profile, s = st.data.stats, av = p.avatar, el = $('pageProfile'), tab = this.profTab || 'avatar', pr = st.progress();
    let grid = '';
    if (tab === 'avatar') {
      grid = '<div class="pick-grid">' + Object.keys(SYMBOLS).filter((k) => k !== 'trophy').map((k) => { const ok = st.avatarUnlocked('sym:' + k); return '<button class="pick' + (ok ? '' : ' locked') + '" data-act="sym" data-v="' + k + '" aria-pressed="' + (av.sym === k) + '">' + avatarHTML({ sym: k, color: av.color, frame: 'none' }, 44) + '<span>' + SYMBOL_NAMES[k] + '</span>' + (ok ? '' : '<i class="lock">🔒</i>') + '</button>'; }).join('') + '</div>' +
        '<h3 class="sec">Warna</h3><div class="pick-grid">' + AVATAR_COLORS.map((c, i) => '<button class="pick" data-act="color" data-v="' + i + '" aria-pressed="' + (av.color === i) + '">' + avatarHTML({ sym: av.sym, color: i, frame: 'none' }, 36) + '</button>').join('') + '</div>';
    } else if (tab === 'frame') {
      grid = '<div class="pick-grid">' + Object.keys(FRAMES).map((k) => { const ok = st.avatarUnlocked('frame:' + k); return '<button class="pick' + (ok ? '' : ' locked') + '" data-act="frame" data-v="' + k + '" aria-pressed="' + (av.frame === k) + '">' + avatarHTML({ sym: av.sym, color: av.color, frame: k }, 44) + '<span>' + FRAMES[k].name + '</span>' + (ok ? '' : '<i class="lock">🔒</i>') + '</button>'; }).join('') + '</div><p class="note">Bingkai dan avatar baru didapat dari hadiah naik level.</p>';
    } else {
      grid = '<div class="bdg-grid">' + BADGE_DEFS.map((b) => { const ok = st.data.unlocks.badges.indexOf(b.id) !== -1; return '<button class="bdg-card' + (ok ? '' : ' locked') + '" data-act="badge" data-v="' + b.id + '" aria-pressed="' + (p.badge === b.id) + '">' + badgeHTML(b, 46) + '<b>' + b.name + '</b><span>' + b.desc + '</span></button>'; }).join('') + '</div>' +
        (p.badge ? '<div class="row" style="margin-top:10px"><button class="btn small" data-act="nobadge">Lepas badge</button></div>' : '');
    }
    const wr = s.matches ? Math.round(s.wins / s.matches * 100) : 0;
    el.innerHTML = this._head('Profil', this._wallet()) + '<div class="pg-body">' +
      '<div class="prof-top">' + avatarHTML(av, 84, p.badge) + '<div style="flex:1;min-width:200px"><input id="profName" maxlength="14" autocomplete="off" value="' + esc(p.name) + '" aria-label="Nama pemain"><div class="row" style="margin:10px 0 6px"><b class="gold" style="font:700 22px var(--f-head)">Level ' + pr.level + '</b><span class="muted">' + pr.into + ' / ' + pr.need + ' XP</span></div><div class="xpbar"><div class="xpfill" style="width:' + (pr.pct * 100).toFixed(1) + '%"></div></div></div></div>' +
      '<div class="seg" style="margin-bottom:10px">' + [['avatar', 'Avatar'], ['frame', 'Bingkai'], ['badge', 'Badge']].map((t) => '<button data-act="tab" data-v="' + t[0] + '" aria-pressed="' + (tab === t[0]) + '">' + t[1] + '</button>').join('') + '</div>' + grid +
      '<h3 class="sec">Statistik</h3><div class="stat-grid">' + [['Main', s.matches], ['Menang', s.wins], ['Kalah', s.losses], ['Win rate', wr + '%'], ['Runtun terbaik', s.bestStreak], ['Bola masuk', s.potted], ['Total untung', fmtShort(s.totalWon)], ['Taruhan terbesar dimenangkan', fmtShort(s.maxBetWon)]].map((x) => '<div class="stat-c"><small>' + x[0] + '</small><b>' + x[1] + '</b></div>').join('') + '</div></div>';
    const redo = () => this.render_profile();
    $('profName').addEventListener('input', (e) => { p.name = e.target.value.trim().slice(0, 14) || 'Pemain'; st.save(); });
    this._bind(el, {
      tab: (d) => { this.profTab = d.v; redo(); },
      sym: (d) => { if (!st.setAvatar('sym', d.v)) this.toast('Avatar ini terkunci — raih level tertentu', 'foul'); redo(); },
      color: (d) => { st.setAvatar('color', +d.v); redo(); },
      frame: (d) => { if (!st.setAvatar('frame', d.v)) this.toast('Bingkai ini terkunci — raih level tertentu', 'foul'); redo(); },
      badge: (d) => { if (!st.equipBadge(d.v)) this.toast('Badge belum diraih', 'foul'); redo(); },
      nobadge: () => { st.equipBadge(null); redo(); },
    });
  },

  /* ------------------------------ hadiah ------------------------------ */
  render_rewards() {
    const st = this.store, el = $('pageRewards'), pr = st.progress(), daily = st.dailyStatus(), claimable = st.claimableLevels(), claimed = st.data.progress.claimedLevel;
    const upto = Math.min(MAX_LEVEL, pr.level + 8);
    let rows = '';
    for (let l = claimed + 1; l <= upto; l++) {
      const items = rewardsForLevel(l), can = l <= pr.level, first = l === claimed + 1;
      rows += '<div class="rw-row' + (can ? '' : ' locked') + '"><span class="rw-lv">' + l + '</span><div class="rw-items">' + this.mergeItems(items).map((it) => '<span class="rw-item">' + this._chipHTML(it) + '</span>').join('') + '</div>' +
        (can ? '<button class="btn small green" data-act="claim" data-v="' + l + '"' + (first ? '' : ' disabled') + '>Klaim</button>' : '<span class="muted">Level ' + l + '</span>') + '</div>';
    }
    el.innerHTML = this._head('Hadiah', this._wallet()) + '<div class="pg-body">' +
      '<div class="lvl-card"><div class="lvl-big">' + pr.level + '</div><div style="flex:1"><b style="font:700 22px var(--f-head)">Level ' + pr.level + '</b><div class="muted" style="margin:2px 0 8px">' + pr.into + ' / ' + pr.need + ' XP menuju level berikutnya</div><div class="xpbar"><div class="xpfill" style="width:' + (pr.pct * 100).toFixed(1) + '%"></div></div></div></div>' +
      '<h3 class="sec">Hadiah harian</h3><div class="daily">' + DAILY_REWARDS.map((a, i) => '<div class="day' + (i === daily.day && daily.available ? ' today' : '') + (!daily.available && i <= daily.day ? ' done' : '') + '">Hari ' + (i + 1) + '<b>' + fmtShort(a) + '</b></div>').join('') + '</div>' +
      '<div class="row"><button class="btn primary" data-act="daily"' + (daily.available ? '' : ' disabled') + '>' + (daily.available ? 'Klaim ' + fmtCoins(daily.amount) : 'Sudah diklaim hari ini') + '</button>' + (claimable.length > 1 ? '<button class="btn green" data-act="claimall">Klaim semua level (' + claimable.length + ')</button>' : '') + '</div>' +
      '<h3 class="sec">Hadiah level</h3>' + (rows || '<p class="muted">Semua hadiah sudah diklaim.</p>') + '</div>';
    this._bind(el, {
      daily: () => this.showRewardModal({ title: 'Hadiah harian', sub: 'Hari ke-' + (daily.day + 1) + ' · ' + daily.streak + ' hari beruntun', ring: '🎁', items: [{ type: 'coins', amount: daily.amount }], claim: () => { st.claimDaily(); return true; } }),
      claim: (d) => { const l = +d.v; this.showRewardModal({ title: 'Hadiah Level ' + l, sub: 'Selamat!', ring: String(l), items: rewardsForLevel(l), claim: () => !!st.claimLevel(l) }); },
      claimall: () => { const all = claimable.reduce((a, r) => a.concat(r.items), []); this.showRewardModal({ title: 'Klaim semua', sub: claimable.length + ' level', ring: String(pr.level), items: all, claim: () => { st.claimAllLevels(); return true; } }); },
    });
    this.fillPreviews(el, 160);
  },
  _chipHTML(it) {
    if (it.type === 'coins') return COIN_SVG + ' ' + fmtShort(it.amount);
    if (it.type === 'cue') return '<img alt="" src="' + this.store.cueDefById(it.id).image + '">' + esc(this.store.cueDefById(it.id).name);
    if (it.type === 'table') return '<span data-theme="' + it.id + '"></span>' + esc(this.store.themeDef(it.id).name);
    const [k, v] = it.id.split(':'); return avatarHTML({ sym: k === 'sym' ? v : 'crown', color: 2, frame: k === 'frame' ? v : 'none' }, 26) + (k === 'sym' ? SYMBOL_NAMES[v] : FRAMES[v].name);
  },

  /** Modal hadiah generik: dipakai untuk naik level, hadiah level, dan hadiah harian. */
  showRewardModal(o) {
    const el = $('pageLevelUp'), st = this.store, merged = this.mergeItems(o.items), before = st.coins;
    el.innerHTML = '<div class="lu-ring"><span class="lu-num" id="luNum">' + o.ring + '</span></div><h2>' + esc(o.title) + '</h2><p class="sub" id="luSub">' + esc(o.sub || '') + '</p>' +
      '<div class="lu-rewards">' + merged.map((it, i) => '<div class="lu-card" style="animation-delay:' + (0.35 + 0.14 * i).toFixed(2) + 's">' + this.rewardCardHTML(it) + '</div>').join('') + '</div>' +
      '<div id="luWallet" class="muted" style="min-height:22px"></div><button class="btn primary big" id="luBtn">Klaim hadiah</button>';
    this.fillPreviews(el, 190);
    if (o.countFrom) countUp($('luNum'), o.countFrom, +o.ring, 900, (v) => String(Math.round(v)));
    this.overlayReturn = this.current; this.show('screenLevelUp'); this.audio.play(o.sound || 'win', 0.6);
    this.fx.burst(innerWidth / 2, innerHeight * 0.32, 90, 1);
    let claimed = false;
    $('luBtn').onclick = () => {
      this.audio.unlock();
      if (!claimed) {
        claimed = true; o.claim(); el.querySelectorAll('.lu-card').forEach((c) => c.classList.add('claimed'));
        this.fx.burst(innerWidth / 2, innerHeight * 0.55, 130, 1.3); this.audio.play('pocket', 0.8);
        $('luWallet').innerHTML = 'Saldo ' + COIN_SVG + ' <b class="gold" id="luBal">' + fmtCoins(before) + '</b>'; countUp($('luBal'), before, st.coins, 1100);
        $('luBtn').textContent = 'Lanjut'; this.refreshMenu();
      } else {
        this.show(this.overlayReturn || 'screenMenu', true); if (o.onClose) o.onClose();
        if (this.current === 'screenRewards') this.render_rewards();
      }
    };
  },

  /* ------------------------------ peringkat ------------------------------ */
  render_board() {
    const kind = this.lbKind || 'coins', el = $('pageBoard'), rows = this.board.fetch(kind), you = rows.find((r) => r.isYou);
    const val = (r) => kind === 'coins' ? COIN_SVG + ' ' + fmtShort(r.value) : kind === 'level' ? 'Lv ' + r.value : r.value + ' menang';
    const top = rows.slice(0, 3), list = rows.slice(3, 30), order = [top[1], top[0], top[2]];
    const row = (r) => '<div class="lb-row' + (r.isYou ? ' you' : '') + '"><span class="lb-rank">' + r.rank + '</span>' + avatarHTML(r.avatar, 36, r.badge || null) + '<span class="lb-name">' + esc(r.name) + '<small>Level ' + r.level + '</small></span><span class="lb-val">' + val(r) + '</span></div>';
    el.innerHTML = this._head('Peringkat', this._wallet()) + '<div class="pg-body"><div class="seg" style="margin-bottom:12px">' + [['coins', 'Koin'], ['level', 'Level'], ['wins', 'Kemenangan']].map((t) => '<button data-act="kind" data-v="' + t[0] + '" aria-pressed="' + (kind === t[0]) + '">' + t[1] + '</button>').join('') + '</div>' +
      '<div class="podium">' + order.map((r) => '<div class="pod' + (r.rank === 1 ? ' p1' : '') + '"><span class="medal">#' + r.rank + '</span>' + avatarHTML(r.avatar, r.rank === 1 ? 62 : 50, r.badge || null) + '<b>' + esc(r.name) + '</b><span class="lb-val">' + val(r) + '</span></div>').join('') + '</div>' +
      list.map(row).join('') + (you.rank > 30 ? '<p class="muted" style="text-align:center;margin:8px 0">⋯</p>' + row(you) : '') +
      '<p class="note">Papan peringkat masih simulasi lokal: pemain lain dibuat otomatis dan berganti tiap minggu. Layanan peringkat sungguhan cukup mengganti <code>MockLeaderboard</code> dengan klien server.</p></div>';
    this._bind(el, { kind: (d) => { this.lbKind = d.v; this.render_board(); } });
  },

  /* ------------------------------ toko meja ------------------------------ */
  render_tables() {
    const st = this.store, el = $('pageTables'), eq = st.data.tables.equipped;
    el.innerHTML = this._head('Meja', this._wallet()) + '<div class="pg-body"><div class="tb-grid">' + st.allThemes().map((t) => {
      const owned = st.themeOwned(t.id), on = eq === t.id;
      return '<div class="tb-card' + (on ? ' equipped' : '') + '"><div class="tb-prev"><span data-theme="' + t.id + '" style="display:block;width:100%"></span></div><div class="tb-info"><h4>' + esc(t.name) + '<span class="rar ' + t.rarity + '">' + t.rarity + '</span></h4>' +
        (owned ? '<button class="btn small ' + (on ? '' : 'primary') + '" data-act="equip" data-v="' + t.id + '"' + (on ? ' disabled' : '') + '>' + (on ? 'Dipakai' : 'Pakai') + '</button>' : '<button class="btn small green" data-act="buy" data-v="' + t.id + '"' + (st.coins < t.price ? ' disabled' : '') + '>Beli · ' + COIN_SVG + ' ' + fmtShort(t.price) + '</button>') + '</div></div>';
    }).join('') + '</div><p class="note">Meja kustom (dari halaman Developer) muncul di sini dengan label Kustom.</p></div>';
    this._bind(el, {
      equip: (d) => { st.equipTable(d.v); this.render_tables(); },
      buy: (d) => { if (st.buyTable(d.v)) { this.toast('Meja dibeli', 'ok'); this.fx.burst(innerWidth / 2, innerHeight / 2, 70); } else this.toast('Koin tidak cukup', 'foul'); this.render_tables(); },
    });
    this.fillPreviews(el, 300);
  },

  /* ------------------------------ Cue Collection ------------------------------ */
  render_cues() {
    const st = this.store, el = $('pageCues'), eq = st.data.cues.equipped;
    const cards = st.allCues().map((cue) => {
      const lv = st.ownedLevel(cue.id), owned = lv > 0, shown = cue.custom ? cue.stats : st.effectiveStats(cue.id, Math.max(1, lv));
      const stat = (k, label) => '<div class="stat"><span>' + label + '</span><div class="cells">' + Array.from({ length: 10 }, (_, i) => '<i' + (i < shown[k] ? ' class="on"' : '') + '></i>').join('') + '</div></div>';
      let act = '';
      if (owned) act += '<button class="btn small ' + (eq === cue.id ? '' : 'primary') + '" data-act="equip" data-v="' + cue.id + '"' + (eq === cue.id ? ' disabled' : '') + '>' + (eq === cue.id ? 'Dipakai' : 'Pakai') + '</button>';
      if (!cue.custom) {
        if (!owned) act += '<button class="btn small green" data-act="unlock" data-v="' + cue.id + '"' + (st.coins < cue.price ? ' disabled' : '') + '>Unlock · ' + COIN_SVG + ' ' + fmtShort(cue.price) + '</button>';
        else if (lv < MAX_CUE_LEVEL) act += '<button class="btn small green" data-act="upgrade" data-v="' + cue.id + '"' + (st.coins < st.upgradePrice(cue.id) ? ' disabled' : '') + '>Upgrade · ' + COIN_SVG + ' ' + fmtShort(st.upgradePrice(cue.id)) + '</button>';
        else act += '<button class="btn small" disabled>Level maksimum</button>';
      }
      return '<article class="cue-card' + (owned ? '' : ' locked') + '"><div class="cue-preview"><img alt="' + esc(cue.name) + '" src="' + cue.image + '" draggable="false"></div><div class="cue-panel"><h3>' + esc(cue.name) + '</h3><div class="cue-row">' +
        '<div class="cue-left"><div class="lvl-line">Level <span class="lvl-box">' + (owned ? lv : '–') + '</span></div><div class="pips">' + Array.from({ length: MAX_CUE_LEVEL }, (_, i) => '<i' + (i < lv ? ' class="on"' : '') + '></i>').join('') + '</div>' +
        '<div class="badges"><span class="badge r-' + cue.rarity + '">' + cue.rarity + '</span>' + cue.tags.map((t) => '<span class="badge">' + esc(t) + '</span>').join('') + '</div></div>' +
        '<div class="stat-box">' + stat('force', 'Force') + stat('aim', 'Aim') + stat('spin', 'Spin') + stat('time', 'Time') + '</div>' +
        '<div class="cp-box"><div class="cp-title">Cue Collection Points</div><div class="cp-line"><span>Unlock</span><b>+' + cue.collectionPoints.unlock + '</b></div><div class="cp-line"><span>Upgrade</span><b>+' + cue.collectionPoints.upgrade + '</b></div>' + SHIELD_SVG + '</div></div><div class="cue-actions">' + act + '</div></div></article>';
    });
    el.innerHTML = this._head('Cue Collection', this._wallet()) + '<div class="pg-body"><div class="cue-list">' + cards.join('') + '</div></div>';
    const redo = () => this.render_cues();
    this._bind(el, {
      equip: (d) => { st.equipCue(d.v); redo(); },
      unlock: (d) => { if (!st.unlockCue(d.v)) this.toast('Koin tidak cukup', 'foul'); else this.fx.burst(innerWidth / 2, innerHeight / 2, 60); redo(); },
      upgrade: (d) => { if (!st.upgradeCue(d.v)) this.toast('Koin tidak cukup', 'foul'); redo(); },
    });
  },

  /* ------------------------------ hasil pertandingan ------------------------------ */
  showResult(game) {
    const r = game.result, sm = r.summary, el = $('pageResult'), st = this.store, win = game.mode === 'local' || r.youWon;
    const badges = sm && sm.newBadges.length ? '<div class="chips-row">' + sm.newBadges.map((b) => '<span class="chip" style="padding-left:8px">' + badgeHTML(b, 26) + ' ' + esc(b.name) + '</span>').join('') + '</div>' : '';
    el.innerHTML = '<h2 class="' + (win ? 'ok' : 'bad') + '">' + (game.mode === 'local' ? esc(r.winnerName) + ' menang' : r.youWon ? 'Kamu menang' : 'Kamu kalah') + '</h2><p class="sub" style="text-align:center">' + esc(r.reason) + '</p>' +
      (sm ? '<div class="res-rows"><div class="res-row"><span>Taruhan</span><b class="bad">−' + fmtCoins(sm.bet) + '</b></div><div class="res-row"><span>Hadiah</span><b class="' + (sm.payout ? 'ok' : 'muted') + '">+<span id="resPay">0</span></b></div><div class="res-row"><span>Saldo</span><b class="gold">' + COIN_SVG + ' <span id="resBal">' + fmtCoins(st.coins - sm.payout) + '</span></b></div></div>' +
        '<div class="row" style="justify-content:space-between;margin-bottom:6px"><b class="gold" id="resLv" style="font:700 20px var(--f-head)">Level ' + sm.prevLevel + '</b><span class="muted">+' + sm.xpGain + ' XP</span></div><div class="xpbar"><div class="xpfill" id="resXp" style="width:' + (levelInfo(sm.prevXp).pct * 100) + '%"></div></div>' + badges : '') +
      '<div class="stack" style="margin-top:16px"><button class="btn green" id="btnRematch">Main lagi</button><button class="btn" id="btnResMenu">Menu</button></div>';
    this.show('screenResult'); if (win) this.fx.burst(innerWidth / 2, innerHeight * 0.3, r.youWon ? 100 : 40);
    $('btnRematch').onclick = () => { this.click(); if (!this.game.rematch()) { this.toast('Saldo tidak cukup untuk taruhan yang sama', 'foul'); this.game.quitToMenu(); this.go('modes'); } };
    $('btnResMenu').onclick = () => { this.click(); this.game.quitToMenu(); };
    if (sm) {
      countUp($('resPay'), 0, sm.payout, 900); countUp($('resBal'), st.coins - sm.payout, st.coins, 900);
      this._animateXp(sm, () => { if (sm.newLevel > sm.prevLevel) setTimeout(() => this.showLevelUp(sm), 450); });
    }
  },
  _animateXp(sm, done) {
    const segs = []; let lv = sm.prevLevel, cur = levelInfo(sm.prevXp).into, remain = sm.newXp - sm.prevXp;
    while (remain > 0) { const need = xpForLevel(lv), take = Math.min(remain, need - cur); segs.push({ level: lv, from: cur / need, to: (cur + take) / need }); remain -= take; cur += take; if (cur >= need) { lv++; cur = 0; } }
    const fill = $('resXp'), label = $('resLv'); let i = 0;
    const run = () => {
      if (i >= segs.length) { done(); return; }
      const sg = segs[i++], t0 = performance.now(), dur = 380 + 700 * (sg.to - sg.from);
      label.textContent = 'Level ' + sg.level;
      const step = (now) => {
        const k = Math.min(1, (now - t0) / dur); fill.style.width = ((sg.from + (sg.to - sg.from) * Util.easeOutCubic(k)) * 100) + '%';
        if (k < 1) requestAnimationFrame(step); else if (sg.to >= 1) { label.textContent = 'Level ' + (sg.level + 1); this.fx.burst(innerWidth / 2, innerHeight * 0.6, 24, 0.7); setTimeout(() => { fill.style.width = '0%'; run(); }, 260); } else run();
      };
      requestAnimationFrame(step);
    };
    run();
  },
  showLevelUp(sm) {
    const items = this.store.claimableLevels().reduce((a, r) => a.concat(r.items), []);
    this.showRewardModal({ title: 'Naik Level!', sub: 'Level ' + sm.prevLevel + ' → ' + sm.newLevel, ring: String(sm.newLevel), countFrom: sm.prevLevel, sound: 'levelup', items, claim: () => { this.store.claimAllLevels(); return true; }, onClose: () => { $('resBal').textContent = fmtCoins(this.store.coins); } });
  },
});
