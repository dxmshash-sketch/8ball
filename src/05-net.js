/* =====================================================================
   05 · NET — abstraksi multiplayer
   Semua tembakan (manusia maupun bot) lewat Transport → Validator →
   siaran 'shot'. Untuk online sungguhan cukup ganti MockTransport dengan
   WebSocket client dan jalankan ShotValidator di server (server yang
   otoritatif), UI dan Game tidak perlu berubah.
   ===================================================================== */
class ShotValidator {
  /** view: {matchId, acceptsShots, currentSeat, expectedSeq, cue:{x,y}, ballInHandZone, isPlacementValid(x,y)} */
  static validate(shot, view) {
    if (!shot || typeof shot !== 'object') return 'Data tembakan tidak valid';
    if (shot.matchId !== view.matchId) return 'ID pertandingan tidak cocok';
    if (!view.acceptsShots) return 'Bukan saatnya menembak';
    if (shot.seat !== view.currentSeat) return 'Bukan giliran pemain ini';
    if (shot.seq !== view.expectedSeq) return 'Urutan tembakan tidak sesuai';
    const nums = [shot.angle, shot.power, shot.spinX, shot.spinY];
    for (let i = 0; i < nums.length; i++) if (typeof nums[i] !== 'number' || !isFinite(nums[i])) return 'Nilai tembakan tidak valid';
    if (shot.power < 0.02 || shot.power > 1.0001) return 'Power di luar batas';
    if (shot.spinX * shot.spinX + shot.spinY * shot.spinY > 1.0001) return 'Spin di luar batas';
    if (!shot.cue || !isFinite(shot.cue.x) || !isFinite(shot.cue.y)) return 'Posisi bola putih tidak valid';
    const moved = Math.abs(shot.cue.x - view.cue.x) > 0.5 || Math.abs(shot.cue.y - view.cue.y) > 0.5;
    if (moved && (view.ballInHandZone === 'none' || !view.isPlacementValid(shot.cue.x, shot.cue.y))) return 'Penempatan bola putih tidak sah';
    return null;
  }
}

class MockTransport {
  constructor(opts) {
    this.latency = opts.latency || 0; this.online = !!opts.online;
    this.bus = new EventBus(); this.authority = null;
    this.connected = true; this.roomId = opts.online ? 'R-' + Math.random().toString(36).slice(2, 7).toUpperCase() : 'local';
    this.playerId = 'P-' + Math.random().toString(36).slice(2, 8); this.lastSnapshot = null;
    this.timers = new Set();
  }
  on(evt, fn) { return this.bus.on(evt, fn); }
  _later(fn, ms) {
    if (ms <= 0) { fn(); return; }
    const id = setTimeout(() => { this.timers.delete(id); fn(); }, ms); this.timers.add(id);
  }
  sendShot(shot) {
    if (!this.connected) { this.bus.emit('rejected', { shot, reason: 'Tidak terhubung ke server' }); return; }
    this._later(() => {
      const err = this.authority ? this.authority(shot) : null;
      if (err) this.bus.emit('rejected', { shot, reason: err }); else this.bus.emit('shot', shot);
    }, this.latency);
  }
  publishSnapshot(snap) { this.lastSnapshot = snap; }
  disconnect() { if (!this.connected) return; this.connected = false; this.bus.emit('disconnected'); }
  reconnect() {
    if (this.connected) return;
    this._later(() => { this.connected = true; this.bus.emit('reconnected', { snapshot: this.lastSnapshot }); }, 1100);
  }
  close() { for (const id of this.timers) clearTimeout(id); this.timers.clear(); }
}
