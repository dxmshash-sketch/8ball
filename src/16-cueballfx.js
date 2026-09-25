/* =====================================================================
   16 · CUEBALL FX — skin bola putih: tint/gambar dekal + partikel animasi
   (api, es, aurora, listrik, emas). Dipakai saat main (CueballFXSystem,
   terikat posisi bola putih) dan di pratinjau halaman Developer (DevBallPreview).
   ===================================================================== */
const CUEBALL_FX = {
  none: { name: 'Tanpa efek', desc: 'Bola putih polos, tanpa animasi.' },
  fire: { name: 'Api', desc: 'Kobaran api & bara yang menari di sekeliling bola.' },
  ice: { name: 'Es', desc: 'Kristal es dingin melayang pelan, aura biru pucat.' },
  aurora: { name: 'Aurora', desc: 'Pita cahaya warna-warni berputar lembut, seperti aurora.' },
  electric: { name: 'Listrik', desc: 'Percikan petir kecil berkedip di sekitar bola.' },
  gold: { name: 'Kilau Emas', desc: 'Kelip-kelip partikel emas mewah.' },
};

class CueballFX {
  constructor() { this.type = 'none'; this.p = []; this.t = 0; this.spawnAcc = 0; }
  setType(t) { if (t !== this.type) { this.type = t; this.p.length = 0; } }
  /** cx,cy,R = posisi & radius bola (satuan dunia/meja). speed = kelajuan bola saat ini. */
  update(dt, cx, cy, R, speed) {
    if (this.type === 'none') return;
    this.t += dt;
    const moving = speed > 40, rateBoost = moving ? 2.2 : 1;
    this.spawnAcc += dt * rateBoost;
    const rates = { fire: 46, ice: 20, aurora: 14, electric: 9, gold: 26 }, step = 1 / (rates[this.type] || 20);
    while (this.spawnAcc > step) { this.spawnAcc -= step; this._spawn(cx, cy, R, moving); }
    for (const q of this.p) {
      q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= q.drag || 1; q.vy *= q.drag || 1;
      if (q.grav) q.vy += q.grav * dt; if (q.spin !== undefined) q.rot += q.spin * dt;
    }
    if (this.p.length > 140) this.p.splice(0, this.p.length - 140);
    this.p = this.p.filter((q) => q.life > 0);
  }
  _rand(a, b) { return a + Math.random() * (b - a); }
  _spawn(cx, cy, R, moving) {
    const a = Math.random() * Math.PI * 2, rr = Math.random() * R * 0.6;
    const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
    if (this.type === 'fire') {
      const ang = -Math.PI / 2 + this._rand(-1, 1) * 1.1, sp = this._rand(R * 0.8, R * 2.2);
      this.p.push({ x, y, vx: Math.cos(ang) * sp * 0.3, vy: Math.sin(ang) * sp, life: this._rand(0.3, 0.55), max: 0.55, size: this._rand(R * 0.32, R * 0.58), drag: 0.94, grav: -R * 0.6, hue: this._rand(18, 48), kind: 'glow' });
    } else if (this.type === 'ice') {
      const sp = this._rand(R * 0.15, R * 0.5);
      this.p.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - R * 0.1, life: this._rand(0.7, 1.3), max: 1.3, size: this._rand(R * 0.16, R * 0.3), drag: 0.99, rot: this._rand(0, 7), spin: this._rand(-2, 2), kind: Math.random() < 0.4 ? 'star' : 'dot', hue: this._rand(190, 210) });
    } else if (this.type === 'aurora') {
      this.p.push({ x, y, vx: Math.cos(a) * R * 0.12, vy: Math.sin(a) * R * 0.12 - R * 0.25, life: this._rand(0.9, 1.5), max: 1.5, size: this._rand(R * 0.7, R * 1.15), drag: 1, hue: this._rand(140, 300), kind: 'soft' });
    } else if (this.type === 'electric') {
      const ang2 = Math.random() * Math.PI * 2, len = this._rand(R * 1.1, R * 1.9);
      this.p.push({ x: cx + Math.cos(ang2) * R * 0.9, y: cy + Math.sin(ang2) * R * 0.9, ang: ang2, len, life: this._rand(0.07, 0.14), max: 0.14, vx: 0, vy: 0, kind: 'bolt', hue: this._rand(185, 200) });
      if (Math.random() < 0.5) this.p.push({ x, y, vx: this._rand(-R, R), vy: this._rand(-R, R), life: this._rand(0.12, 0.22), max: 0.22, size: R * 0.09, drag: 0.9, kind: 'dot', hue: 195 });
    } else if (this.type === 'gold') {
      const sp = this._rand(R * 0.1, R * 0.45);
      this.p.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - R * 0.15, life: this._rand(0.5, 1), max: 1, size: this._rand(R * 0.14, R * 0.28), drag: 0.98, rot: this._rand(0, 7), spin: this._rand(-3, 3), kind: 'star', hue: 46 });
    }
  }
  /** Aura tipis di bawah bola (dipanggil sebelum bola digambar). */
  renderGlow(c, cx, cy, R) {
    if (this.type === 'none') return;
    const glowHue = { fire: [255, 130, 40], ice: [140, 210, 255], aurora: [170, 140, 255], electric: [120, 220, 255], gold: [255, 205, 80] }[this.type];
    const pulse = 0.8 + 0.2 * Math.sin(this.t * (this.type === 'electric' ? 14 : 3.2));
    const g = c.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 3 * pulse);
    g.addColorStop(0, 'rgba(' + glowHue.join(',') + ',0.5)'); g.addColorStop(0.55, 'rgba(' + glowHue.join(',') + ',0.16)'); g.addColorStop(1, 'rgba(' + glowHue.join(',') + ',0)');
    c.fillStyle = g; c.beginPath(); c.arc(cx, cy, R * 3 * pulse, 0, 7); c.fill();
  }
  /** Partikel (dipanggil setelah semua bola digambar, supaya melayang di atas). */
  render(c) {
    if (this.type === 'none') return;
    c.save(); c.globalCompositeOperation = 'lighter';
    for (const q of this.p) {
      const a = Math.max(0, q.life / q.max);
      if (q.kind === 'bolt') { this._drawBolt(c, q, a); continue; }
      const col = 'hsla(' + q.hue + ',95%,' + (this.type === 'ice' ? 88 : 62) + '%,' + (a * 0.9).toFixed(2) + ')';
      if (q.kind === 'star') this._drawStar(c, q.x, q.y, q.size * a * 1.4, q.rot, col);
      else if (q.kind === 'soft') { const g = c.createRadialGradient(q.x, q.y, 0, q.x, q.y, q.size * a); g.addColorStop(0, col); g.addColorStop(1, 'hsla(' + q.hue + ',95%,60%,0)'); c.fillStyle = g; c.beginPath(); c.arc(q.x, q.y, q.size * a, 0, 7); c.fill(); }
      else if (q.kind === 'glow') { const g = c.createRadialGradient(q.x, q.y, 0, q.x, q.y, q.size * a); g.addColorStop(0, 'hsla(' + q.hue + ',100%,70%,' + (a * 0.95).toFixed(2) + ')'); g.addColorStop(1, 'hsla(' + q.hue + ',100%,50%,0)'); c.fillStyle = g; c.beginPath(); c.arc(q.x, q.y, q.size * a, 0, 7); c.fill(); }
      else { c.fillStyle = col; c.beginPath(); c.arc(q.x, q.y, Math.max(0.4, (q.size || 1.6) * a), 0, 7); c.fill(); }
    }
    c.restore();
  }
  _drawStar(c, x, y, r, rot, col) {
    if (r <= 0.1) return;
    c.save(); c.translate(x, y); c.rotate(rot || 0); c.fillStyle = col; c.beginPath();
    for (let i = 0; i < 4; i++) { const a1 = (i / 4) * Math.PI * 2; c.lineTo(Math.cos(a1) * r, Math.sin(a1) * r); c.lineTo(Math.cos(a1 + Math.PI / 4) * r * 0.32, Math.sin(a1 + Math.PI / 4) * r * 0.32); }
    c.closePath(); c.fill(); c.restore();
  }
  _drawBolt(c, q, a) {
    const segs = 4, ex = Math.cos(q.ang) * q.len, ey = Math.sin(q.ang) * q.len;
    c.strokeStyle = 'hsla(' + q.hue + ',100%,80%,' + (a * 0.95).toFixed(2) + ')'; c.lineWidth = Math.max(0.6, q.len * 0.045); c.shadowColor = 'hsl(' + q.hue + ',100%,70%)'; c.shadowBlur = q.len * 0.5;
    c.beginPath(); c.moveTo(q.x, q.y);
    for (let i = 1; i <= segs; i++) { const t = i / segs, jig = (i === segs ? 0 : (Math.random() - 0.5) * q.len * 0.35); c.lineTo(q.x + ex * t - ey * 0 + (-Math.sin(q.ang)) * jig, q.y + ey * t + Math.cos(q.ang) * jig); }
    c.stroke(); c.shadowBlur = 0;
  }
}

/* ---------------- pratinjau animasi (halaman Developer) ---------------- */
class DevBallPreview {
  constructor(canvas) { this.cv = canvas; this.ctx = canvas.getContext('2d'); this.fx = new CueballFX(); this.tint = null; this.decal = null; this.running = false; this.raf = 0; this.last = 0; }
  set(tint, decalImg, fxType) { this.tint = tint; this.decal = decalImg; this.fx.setType(fxType); }
  start() { if (this.running) return; this.running = true; this.last = performance.now(); const loop = (t) => { if (!this.running) return; this._frame((t - this.last) / 1000); this.last = t; this.raf = requestAnimationFrame(loop); }; this.raf = requestAnimationFrame(loop); }
  stop() { this.running = false; cancelAnimationFrame(this.raf); }
  _frame(dt) {
    dt = Math.min(0.05, dt || 0.016);
    const c = this.ctx, W = this.cv.width, H = this.cv.height, cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.28;
    c.clearRect(0, 0, W, H);
    this.fx.update(dt, cx, cy, R, this.fx.type === 'none' ? 0 : 80);
    this.fx.renderGlow(c, cx, cy, R);
    // bola: shading radial sederhana + tint + dekal opsional
    c.save(); c.beginPath(); c.arc(cx, cy, R, 0, 7); c.clip();
    const base = this.tint || '#f6f6f0';
    c.fillStyle = base; c.fillRect(cx - R, cy - R, R * 2, R * 2);
    if (this.decal) { const s = R * 1.7; c.globalAlpha = 0.92; c.drawImage(this.decal, cx - s / 2, cy - s / 2, s, s); c.globalAlpha = 1; }
    const sh = c.createRadialGradient(cx - R * 0.4, cy - R * 0.5, R * 0.1, cx, cy, R * 1.15);
    sh.addColorStop(0, 'rgba(255,255,255,0.55)'); sh.addColorStop(0.5, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(0,20,40,0.55)');
    c.fillStyle = sh; c.fillRect(cx - R, cy - R, R * 2, R * 2); c.restore();
    c.strokeStyle = 'rgba(0,15,30,0.35)'; c.lineWidth = 1; c.beginPath(); c.arc(cx, cy, R, 0, 7); c.stroke();
    this.fx.render(c);
  }
}
