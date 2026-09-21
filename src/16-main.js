/* =====================================================================
   16 · MAIN — bootstrap & game loop
   ===================================================================== */
(function main() {
  const store = new Store(), audio = new AudioManager(store.data.settings), ui = new UI(store, audio);
  const game = new Game({ ui, audio, store });
  const renderer = new Renderer($('stage'), game, store);
  const board = new MockLeaderboard(store);
  ui.attach(game, renderer, board);
  const input = new InputController($('stage'), game, renderer, ui);
  let resizeT = 0;
  window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(() => renderer.resize(), 80); });
  window.addEventListener('orientationchange', () => setTimeout(() => renderer.resize(), 200));
  window.addEventListener('blur', () => { if (game.isActiveMatch() && !game.paused) game.setPaused(true); });
  window.__pantul = { game, renderer, store, ui, audio };     // untuk debugging/tes
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    try { input.update(dt); game.update(dt); ui.tick(dt, game); renderer.render(dt); }
    catch (err) { console.error(err); ui.toast('Terjadi kesalahan: ' + err.message, 'foul'); }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
