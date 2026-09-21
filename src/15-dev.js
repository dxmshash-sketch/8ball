/* =====================================================================
   15 · DEVELOPER / DIY — buat skin cue & meja dari gambar sendiri (tersimpan lokal di perangkat)
   ===================================================================== */
const hex2rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const rgb2hex = (r) => '#' + r.map((v) => Math.round(Util.clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
const shadeHex = (h, f) => rgb2hex(hex2rgb(h).map((v) => (f < 0 ? v * (1 + f) : v + (255 - v) * f)));
const mixHex = (a, b, t) => { const A = hex2rgb(a), B = hex2rgb(b); return rgb2hex(A.map((v, i) => v + (B[i] - v) * t)); };
const RAIL_LABELS = { wood: ['Kayu terang', 'Kayu tengah', 'Kayu gelap'], neon: ['Latar gelap', 'Warna neon', '(tidak dipakai)'], ornate: ['Warna dasar', 'Warna motif', 'Warna titik'], metal: ['Logam terang', 'Logam tengah', 'Logam gelap'] };

function readImageFile(file) {
  return new Promise((res, rej) => { const url = URL.createObjectURL(file), im = new Image(); im.onload = () => { URL.revokeObjectURL(url); res(im); }; im.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Gambar tidak bisa dibaca')); }; im.src = url; });
}
function trimAlpha(cv) {
  const c = cv.getContext('2d'), d = c.getImageData(0, 0, cv.width, cv.height).data; let x0 = cv.width, y0 = cv.height, x1 = -1, y1 = -1;
  for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) if (d[(y * cv.width + x) * 4 + 3] > 12) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return cv;
  const out = document.createElement('canvas'); out.width = x1 - x0 + 1; out.height = y1 - y0 + 1; out.getContext('2d').drawImage(cv, x0, y0, out.width, out.height, 0, 0, out.width, out.height); return out;
}
/** Gambar cue → kanvas 1200×120 transparan, ujung (tip) di kanan. */
function buildCueCanvas(img, flip) {
  const k = Math.min(1, 3000 / Math.max(img.width, img.height)), src = document.createElement('canvas'); src.width = Math.max(1, Math.round(img.width * k)); src.height = Math.max(1, Math.round(img.height * k));
  src.getContext('2d').drawImage(img, 0, 0, src.width, src.height);
  const t = trimAlpha(src), s = Math.min(1200 / t.width, 120 / t.height), w = Math.round(t.width * s), h = Math.round(t.height * s);
  const out = document.createElement('canvas'); out.width = 1200; out.height = 120; const c = out.getContext('2d');
  c.imageSmoothingQuality = 'high'; c.save(); if (flip) { c.translate(1200, 0); c.scale(-1, 1); c.drawImage(t, 0, (120 - h) / 2, w, h); } else c.drawImage(t, 1200 - w, (120 - h) / 2, w, h); c.restore();
  return out;
}
function fitDataURL(img, w, h, q) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; drawCover(cv.getContext('2d'), img, 0, 0, w, h); return cv.toDataURL('image/jpeg', q);
}
function downloadBlob(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }

Object.assign(UI.prototype, {
  render_dev() {
    const el = $('pageDev'), D = this.dev = this.dev || { tab: 'cue', flip: false, cueCanvas: null, clothImg: null, railImg: null, clothData: null, railData: null };
    const st = this.store;
    const spec = '<div class="spec"><b>Pakai gambar milik sendiri atau yang berlisensi.</b> Skin tersimpan di perangkat ini saja dan hanya kosmetik (statistik cue mengikuti cue dasar yang dipilih).<br>' +
      '<b>Cue:</b> PNG transparan, horizontal, pangkal di kiri, ujung (tip) di kanan (bila terbalik centang "balik"). Tepi transparan dipangkas otomatis lalu diskalakan ke 1200×120.<br>' +
      '<b>Meja:</b> gambar <b>kain</b> 1648×776 (playfield + area cushion; di-crop cover) dan gambar <b>frame</b> 1760×888 (rail kayu; bagian tengah tertutup kain). Unduh template panduan di tab Meja.</div>';
    let body = '';
    if (D.tab === 'cue') {
      const owned = CUE_CATALOG.filter((c) => st.ownedLevel(c.id) > 0);
      body = '<div class="dev-grid" style="margin-top:12px"><div class="form">' +
        '<label>Gambar cue<span class="filebtn btn small">Pilih gambar…<input type="file" id="dvCueFile" accept="image/*"></span></label>' +
        '<label class="chk"><input type="checkbox" id="dvFlip"' + (D.flip ? ' checked' : '') + '> Ujung (tip) ada di KIRI pada gambar → balik</label>' +
        '<label>Nama skin<input type="text" id="dvCueName" maxlength="24" placeholder="mis. Naga Laut"></label>' +
        '<div class="two"><label>Kelangkaan (label)<select id="dvRar"><option>Rare</option><option selected>Epic</option><option>Legendary</option></select></label>' +
        '<label>Statistik mengikuti<select id="dvBase">' + owned.map((c) => '<option value="' + c.id + '">' + esc(c.name) + '</option>').join('') + '</select></label></div>' +
        '<button class="btn green" data-act="saveCue">Simpan skin cue</button>' + this._devList('cues') + '</div>' +
        '<div class="prev-box"><canvas id="dvCuePrev" width="1200" height="120"></canvas><canvas id="dvCueTable"></canvas><span class="note" style="margin:0">Pratinjau: kartu koleksi (atas) dan di atas meja (bawah).</span></div></div>';
    } else if (D.tab === 'table') {
      const sy = D.style || 'wood';
      body = '<div class="dev-grid" style="margin-top:12px"><div class="form">' +
        '<label>Nama tema<input type="text" id="dvTName" maxlength="24" placeholder="mis. Malam Jakarta"></label>' +
        '<div class="two"><label>Gaya rail<select id="dvStyle">' + ['wood', 'neon', 'ornate', 'metal'].map((s) => '<option value="' + s + '"' + (s === sy ? ' selected' : '') + '>' + { wood: 'Kayu', neon: 'Neon', ornate: 'Ornamen', metal: 'Logam' }[s] + '</option>').join('') + '</select></label><label>Sight / titik rail<input type="color" id="dvSight" value="' + (D.sight || '#ffffff') + '"></label></div>' +
        '<div class="two"><label>Kain: tengah<input type="color" id="dvCl1" value="' + (D.cl1 || '#86d9f6') + '"></label><label>Kain: tepi<input type="color" id="dvCl2" value="' + (D.cl2 || '#2d8dbd') + '"></label></div>' +
        '<label>Cushion<input type="color" id="dvCu" value="' + (D.cu || '#63c6f0') + '"></label>' +
        '<div class="two"><label id="lbR1">' + RAIL_LABELS[sy][0] + '<input type="color" id="dvR1" value="' + (D.r1 || '#a83232') + '"></label><label id="lbR2">' + RAIL_LABELS[sy][1] + '<input type="color" id="dvR2" value="' + (D.r2 || '#8a2426') + '"></label></div>' +
        '<label id="lbR3">' + RAIL_LABELS[sy][2] + '<input type="color" id="dvR3" value="' + (D.r3 || '#671719') + '"></label>' +
        '<label>Gambar kain (opsional) <span class="filebtn btn small">Pilih…<input type="file" id="dvClothFile" accept="image/*"></span></label>' +
        '<label>Gambar frame/rail (opsional) <span class="filebtn btn small">Pilih…<input type="file" id="dvRailFile" accept="image/*"></span></label>' +
        '<div class="row"><button class="btn small" data-act="clearImgs">Hapus gambar</button><button class="btn small" data-act="tplCloth">Template kain</button><button class="btn small" data-act="tplFrame">Template frame</button></div>' +
        '<button class="btn green" data-act="saveTable">Simpan tema meja</button>' + this._devList('tables') + '</div>' +
        '<div class="prev-box"><canvas id="dvTablePrev"></canvas><span class="note" style="margin:0">Pratinjau langsung. Gambar kain/frame menggantikan warna bila diisi.</span></div></div>';
    } else {
      body = '<div class="form" style="margin-top:12px;max-width:640px"><h3 class="sec" style="margin:0">Ekspor</h3><textarea id="dvExport" readonly></textarea><div class="row"><button class="btn small" data-act="copy">Salin</button><button class="btn small" data-act="download">Unduh .json</button></div>' +
        '<h3 class="sec" style="margin:8px 0 0">Impor</h3><textarea id="dvImport" placeholder="Tempel JSON skin di sini"></textarea><div class="row"><span class="filebtn btn small">Pilih berkas .json<input type="file" id="dvImpFile" accept=".json,application/json"></span><button class="btn small green" data-act="import">Impor</button></div>' +
        '<button class="btn small danger" data-act="wipe">Hapus semua skin kustom</button></div>';
    }
    el.innerHTML = this._head('Developer · Skin DIY', this._wallet()) + '<div class="pg-body">' + spec +
      '<div class="seg" style="margin-top:12px">' + [['cue', 'Cue'], ['table', 'Meja'], ['share', 'Bagikan']].map((t) => '<button data-act="tab" data-v="' + t[0] + '" aria-pressed="' + (D.tab === t[0]) + '">' + t[1] + '</button>').join('') + '</div>' + body + '</div>';
    this._bindDev(el, D);
  },
  _devList(kind) {
    const items = this.store.custom[kind]; if (!items.length) return '<p class="note">Belum ada skin kustom.</p>';
    return '<div class="dev-list">' + items.map((x) => '<div class="dev-item">' + (kind === 'cues' ? '<img alt="" src="' + x.image + '">' : '<span class="tprev" style="width:90px;height:28px;display:block;background:linear-gradient(90deg,' + x.cloth.a + ',' + x.cloth.c + ');border-radius:4px"></span>') + '<span>' + esc(x.name) + '</span><button class="btn small" data-act="use" data-k="' + kind + '" data-v="' + x.id + '">Pakai</button><button class="btn small danger" data-act="del" data-k="' + kind + '" data-v="' + x.id + '">Hapus</button></div>').join('') + '</div>';
  },
  _bindDev(el, D) {
    const st = this.store, redo = () => this.render_dev();
    this._bind(el, {
      tab: (d) => { D.tab = d.v; redo(); },
      saveCue: () => {
        if (!D.cueCanvas) { this.toast('Pilih gambar cue dulu', 'foul'); return; }
        const name = ($('dvCueName').value.trim() || 'Cue Kustom').slice(0, 24), image = D.cueCanvas.toDataURL('image/png');
        if (image.length > 1.2e6) { this.toast('Gambar terlalu besar — sederhanakan gambar', 'foul'); return; }
        const ok = st.addCustomCue({ id: 'c_' + Date.now().toString(36), name, rarity: $('dvRar').value, base: $('dvBase').value, image });
        this.toast(ok ? 'Skin cue disimpan' : 'Penyimpanan penuh — hapus skin lama', ok ? 'ok' : 'foul'); if (ok) { D.cueCanvas = null; redo(); }
      },
      saveTable: () => {
        const th = this._devTheme(); th.id = 't_' + Date.now().toString(36); th.name = ($('dvTName').value.trim() || 'Meja Kustom').slice(0, 24);
        if (D.clothData) th.clothImage = D.clothData; if (D.railData) th.railImage = D.railData;
        const ok = st.addCustomTable(th); this.toast(ok ? 'Tema meja disimpan' : 'Penyimpanan penuh — hapus skin lama', ok ? 'ok' : 'foul'); if (ok) redo();
      },
      use: (d) => { if (d.k === 'cues') st.equipCue(d.v); else st.equipTable(d.v); this.toast('Skin dipakai', 'ok'); },
      del: (d) => { st.removeCustom(d.k, d.v); redo(); },
      clearImgs: () => { D.clothImg = D.railImg = D.clothData = D.railData = null; this._devTablePreview(); },
      tplCloth: () => this._downloadTemplate('cloth'), tplFrame: () => this._downloadTemplate('frame'),
      copy: () => { const t = $('dvExport'); t.select(); try { navigator.clipboard.writeText(t.value); this.toast('Disalin', 'ok'); } catch (e) { document.execCommand('copy'); } },
      download: () => downloadBlob(new Blob([st.exportCustom()], { type: 'application/json' }), 'pantul-skins.json'),
      import: () => { const r = st.importCustom($('dvImport').value); this.toast(r.ok ? r.count + ' skin diimpor' : r.error, r.ok ? 'ok' : 'foul'); if (r.ok) redo(); },
      wipe: () => { st.custom.cues = []; st.custom.tables = []; st.saveCustom(); st.data.cues.equipped = st.ownedLevel(st.data.cues.equipped) ? st.data.cues.equipped : 'maple'; st.data.tables.equipped = st.themeOwned(st.data.tables.equipped) ? st.data.tables.equipped : 'klasik'; st.save(); this.toast('Skin kustom dihapus', 'ok'); redo(); },
    });
    const onFile = (id, fn) => { const f = $(id); if (f) f.addEventListener('change', async () => { if (!f.files[0]) return; try { await fn(await readImageFile(f.files[0]), f.files[0]); } catch (e) { this.toast(e.message, 'foul'); } }); };
    if (D.tab === 'cue') {
      const build = () => { if (D.cueSrc) { D.cueCanvas = buildCueCanvas(D.cueSrc, D.flip); this._devCuePreview(); } };
      onFile('dvCueFile', (img) => { D.cueSrc = img; build(); });
      $('dvFlip').addEventListener('change', (e) => { D.flip = e.target.checked; build(); });
      this._devCuePreview();
    } else if (D.tab === 'table') {
      const upd = () => this._devTablePreview(), fields = ['dvSight', 'dvCl1', 'dvCl2', 'dvCu', 'dvR1', 'dvR2', 'dvR3'], keys = ['sight', 'cl1', 'cl2', 'cu', 'r1', 'r2', 'r3'];
      fields.forEach((id, i) => $(id).addEventListener('input', (e) => { D[keys[i]] = e.target.value; clearTimeout(this._dt); this._dt = setTimeout(upd, 90); }));
      $('dvStyle').addEventListener('change', (e) => { D.style = e.target.value; const L = RAIL_LABELS[D.style]; ['lbR1', 'lbR2', 'lbR3'].forEach((id, i) => { $(id).firstChild.nodeValue = L[i]; }); upd(); });
      onFile('dvClothFile', (img) => { D.clothImg = img; D.clothData = fitDataURL(img, 1024, 482, 0.82); upd(); });
      onFile('dvRailFile', (img) => { D.railImg = img; D.railData = fitDataURL(img, 1024, 517, 0.82); upd(); });
      upd();
    } else {
      $('dvExport').value = st.exportCustom();
      const f = $('dvImpFile'); f.addEventListener('change', () => { if (f.files[0]) f.files[0].text().then((t) => { $('dvImport').value = t; }); });
    }
  },
  _devCuePreview() {
    const D = this.dev, cv = $('dvCuePrev'); if (!cv) return; const c = cv.getContext('2d'); c.clearRect(0, 0, 1200, 120);
    if (D.cueCanvas) c.drawImage(D.cueCanvas, 0, 0);
    else { c.fillStyle = '#6b7484'; c.font = '28px sans-serif'; c.textAlign = 'center'; c.fillText('Pilih gambar cue…', 600, 70); }
    const th = this.store.themeDef(this.store.data.tables.equipped), tcv = $('dvCueTable');
    loadThemeImages(th, (imgs) => {
      const base = renderTablePreview(th, 900, imgs); tcv.width = base.width; tcv.height = base.height; const t = tcv.getContext('2d'); t.drawImage(base, 0, 0);
      if (!D.cueCanvas) return;
      const T = CONFIG.table, tx = T.rail + T.cushion + 46, s = base.width / (T.width + 2 * tx), R = T.ballRadius, L = T.width * CONFIG.aim.cueLengthRatio, h = L * 0.1 * 0.62, off = R + CONFIG.aim.cueGap + 40;
      const bx = (tx + T.headStringX) * s, by = (tx + T.height / 2) * s;
      t.drawImage(D.cueCanvas, bx - (off + L) * s, by - h * s / 2, L * s, h * s);
      t.fillStyle = '#f6f6f0'; t.beginPath(); t.arc(bx, by, R * s, 0, 7); t.fill(); t.strokeStyle = 'rgba(0,0,0,.35)'; t.lineWidth = 1; t.stroke();
    });
  },
  _devTheme() {
    const D = this.dev, sy = D.style || 'wood', g = (k, d) => D[k] || d;
    const cl1 = g('cl1', '#86d9f6'), cl2 = g('cl2', '#2d8dbd'), cu = g('cu', '#63c6f0'), r1 = g('r1', '#a83232'), r2 = g('r2', '#8a2426'), r3 = g('r3', '#671719');
    let rail;
    if (sy === 'neon') rail = { style: 'neon', bg: r1, glow: r2 };
    else if (sy === 'ornate') rail = { style: 'ornate', bg: r1, ink: r2, spot: r3, edge: shadeHex(r2, -0.3) };
    else if (sy === 'metal') rail = { style: 'metal', a: r1, b: r2, c: r3 };
    else rail = { style: 'wood', a: r1, accent: shadeHex(r1, 0.15), b: r2, c: r3, d: shadeHex(r3, -0.4) };
    return { name: 'Pratinjau', rarity: 'Kustom', price: 0, cloth: { a: cl1, b: mixHex(cl1, cl2, 0.5), c: cl2 }, cushion: { base: shadeHex(cu, -0.4), mid: shadeHex(cu, -0.2), nose: cu }, rail, sight: g('sight', '#ffffff'), rim: shadeHex(r3, -0.6) };
  },
  _devTablePreview() {
    const D = this.dev, cv = $('dvTablePrev'); if (!cv) return;
    const base = renderTablePreview(this._devTheme(), 900, { cloth: D.clothImg, rail: D.railImg }); cv.width = base.width; cv.height = base.height; cv.getContext('2d').drawImage(base, 0, 0);
  },
  /** Template panduan (PNG) menampilkan zona yang tertutup/terlihat, dengan geometri meja yang sama. */
  _downloadTemplate(kind) {
    const T = CONFIG.table, ct = T.cushion, ext = T.cushion + T.rail, geo = buildTableGeometry(T), off = kind === 'cloth' ? ct : ext;
    const w = T.width + 2 * off, h = T.height + 2 * off, cv = document.createElement('canvas'); cv.width = w; cv.height = h; const c = cv.getContext('2d');
    c.fillStyle = '#3a4152'; c.fillRect(0, 0, w, h);
    c.save(); c.translate(off, off);
    if (kind === 'frame') { c.fillStyle = '#5a6278'; c.fillRect(-ct, -ct, T.width + 2 * ct, T.height + 2 * ct); c.fillStyle = '#fff'; c.font = 'bold 34px sans-serif'; c.textAlign = 'center'; c.fillText('AREA TERTUTUP KAIN — boleh kosong', T.width / 2, T.height / 2); c.font = '26px sans-serif'; c.fillText('Rail kayu terlihat di sekeliling (lebar ' + T.rail + ' px) · gambar 1760×888', T.width / 2, T.height / 2 + 44); }
    else { c.fillStyle = '#fff'; c.font = 'bold 34px sans-serif'; c.textAlign = 'center'; c.fillText('KAIN — di-crop cover ke 1648×776', T.width / 2, T.height / 2); c.font = '26px sans-serif'; c.fillText('Playfield 1600×728 + area cushion ' + ct + ' px di sekeliling', T.width / 2, T.height / 2 + 44); }
    c.strokeStyle = '#57BFEA'; c.lineWidth = 3; c.setLineDash([16, 10]); c.strokeRect(0, 0, T.width, T.height); c.setLineDash([]);
    c.strokeStyle = '#ffb347'; c.lineWidth = 3; for (const P of geo.cushions) { c.beginPath(); c.moveTo(P[0][0], P[0][1]); for (let i = 1; i < 4; i++) c.lineTo(P[i][0], P[i][1]); c.closePath(); c.stroke(); }
    c.strokeStyle = '#ff5a5f'; for (const p of geo.pockets) { c.beginPath(); c.arc(p.x, p.y, p.r, 0, 7); c.stroke(); }
    c.restore(); c.fillStyle = '#ffb347'; c.font = '24px sans-serif'; c.textAlign = 'left'; c.fillText('oranye = cushion · merah = area pocket · biru putus-putus = tepi playfield', 20, h - 16);
    cv.toBlob((b) => downloadBlob(b, 'template-' + kind + '-' + w + 'x' + h + '.png'));
  },
});
