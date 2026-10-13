/* =====================================================================
   22 · MAIN — bootstrap & game loop
   ===================================================================== */
(function main() {
  // ── Buat instance inti ──
  const store = new Store();
  const audio = new AudioManager(store.data.settings);
  const ui = new UI(store, audio);

  // ── EXPOSE ke window DULU ──
  // Wajib: semua sync Firebase (incrementCoins, incrementStats, dll)
  // mencari window.store / window.ui.backend / window.backend.
  // Tanpa ini, koin & stats tidak akan pernah tersinkron ke cloud.
  window.store = store;
  window.ui = ui;

  const game = new Game({ ui, audio, store });
  const renderer = new Renderer($('stage'), game, store);

  // ── Backend DULU sebelum leaderboard ──
  const backend = FIREBASE_CONFIG ? new FirebaseBackend() : new MockBackend();
  window.backend = backend;

  // ── Leaderboard ──
  // FirestoreLeaderboard = data dari koleksi users Firestore (real user).
  // MockLeaderboard = hanya fallback kalau Firestore tidak aktif.
  const board = (typeof FirestoreLeaderboard !== 'undefined' && FIREBASE_CONFIG)
    ? new FirestoreLeaderboard(store, backend)
    : new MockLeaderboard(store);

  // ── Attach ke UI ──
  ui.attach(game, renderer, board);

  // attachBackend = pasang listener auth + redirect otomatis dari halaman auth.
  if (typeof ui.attachBackend === 'function') {
    ui.attachBackend(backend);
  } else {
    ui.backend = backend;
    if (typeof backend.onAuthChanged === 'function') {
      backend.onAuthChanged(() => ui.refreshMenu());
    }
  }

  // ── Input ──
  const input = new InputController($('stage'), game, renderer, ui);

  // ── Resize ──
  let resizeT = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => renderer.resize(), 80);
  });
  window.addEventListener('orientationchange', () => {
    setTimeout(() => renderer.resize(), 200);
  });

  // ── Auto-pause saat window blur ──
  window.addEventListener('blur', () => {
    if (game.isActiveMatch && game.isActiveMatch() && !game.paused) game.setPaused(true);
  });

  // ── Debug handle ──
  window.__pantul = { game, renderer, store, ui, audio, CONFIG, backend, board };

  // ── Game loop ──
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    try {
      input.update(dt);
      game.update(dt);
      ui.tick(dt, game);
      renderer.render(dt);
    } catch (err) {
      console.error(err);
      ui.toast('Terjadi kesalahan: ' + err.message, 'foul');
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
