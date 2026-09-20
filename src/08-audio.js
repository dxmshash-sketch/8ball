/* =====================================================================
   08 · AUDIO — abstraksi suara. Setiap nama efek punya sintesis bawaan
   (WebAudio, tanpa file) yang bisa diganti sample lewat setSample(name, url).
   ===================================================================== */
class AudioManager {
  constructor(settings) {
    this.settings = settings; this.ctx = null; this.master = null; this.sfxBus = null; this.musicBus = null;
    this.samples = new Map(); this.noise = null; this.frameCount = 0; this.lastFrame = -1; this.musicTimer = null; this.musicStep = 0;
    this.synth = {
      ball: (v) => { this._noiseBurst(0.028, 2600, 0.5 * v + 0.08, 'highpass'); this._tone(1700 + v * 900, 0.05, 'sine', 0.22 * v + 0.05, 0.7); },
      cushion: (v) => { this._noiseBurst(0.11, 420, 0.4 * v + 0.08, 'lowpass'); this._tone(150, 0.09, 'sine', 0.3 * v + 0.05, 0.6); },
      cue: (v) => { this._noiseBurst(0.02, 3200, 0.35, 'highpass'); this._tone(190, 0.07, 'triangle', 0.4 * v + 0.1, 0.5); },
      pocket: (v) => { this._tone(260, 0.24, 'sine', 0.3, 0.35); this._noiseBurst(0.35, 300, 0.25, 'lowpass'); },
      break: () => { this._noiseBurst(0.08, 3800, 0.9, 'highpass'); this._tone(90, 0.25, 'sine', 0.6, 0.5); this._noiseBurst(0.4, 500, 0.3, 'lowpass'); },
      ui: () => this._tone(760, 0.06, 'square', 0.07, 1.25),
      foul: () => { this._tone(220, 0.22, 'sawtooth', 0.12, 0.7); },
      win: () => [523, 659, 784, 1046].forEach((f, i) => this._tone(f, 0.28, 'triangle', 0.2, 1, i * 0.11)),
      lose: () => [392, 330, 262, 196].forEach((f, i) => this._tone(f, 0.32, 'triangle', 0.18, 1, i * 0.14)),
    };
  }
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      this.ctx = new AC(); this.master = this.ctx.createGain(); this.master.connect(this.ctx.destination);
      this.sfxBus = this.ctx.createGain(); this.sfxBus.connect(this.master);
      this.musicBus = this.ctx.createGain(); this.musicBus.gain.value = 0.5; this.musicBus.connect(this.master);
      const n = this.ctx.sampleRate; this.noise = this.ctx.createBuffer(1, n, n);
      const d = this.noise.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.applySettings();
  }
  applySettings() { if (!this.ctx) return; this.sfxBus.gain.value = this.settings.sfx ? 1 : 0; if (this.settings.music) this._startMusic(); else this._stopMusic(); }
  setSample(name, url) {
    if (!this.ctx) return Promise.resolve();
    return fetch(url).then((r) => r.arrayBuffer()).then((b) => this.ctx.decodeAudioData(b)).then((buf) => this.samples.set(name, buf));
  }
  play(name, intensity) {
    if (!this.ctx || !this.settings.sfx) return;
    const v = intensity === undefined ? 0.6 : Math.max(0, Math.min(1, intensity));
    const now = this.ctx.currentTime;
    if (now !== this.lastFrame) { this.lastFrame = now; this.frameCount = 0; }
    if (++this.frameCount > 6) return;                  // batasi suara serentak
    const buf = this.samples.get(name);
    if (buf) { const s = this.ctx.createBufferSource(), g = this.ctx.createGain(); s.buffer = buf; g.gain.value = 0.3 + 0.7 * v; s.connect(g); g.connect(this.sfxBus); s.start(); return; }
    const fn = this.synth[name]; if (fn) fn(v);
  }
  _tone(freq, dur, type, gain, endRatio, delay) {
    const c = this.ctx, t = c.currentTime + (delay || 0), o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * (endRatio || 1)), t + dur);
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.sfxBus); o.start(t); o.stop(t + dur + 0.02);
  }
  _noiseBurst(dur, freq, gain, filterType) {
    const c = this.ctx, t = c.currentTime, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise; f.type = filterType; f.frequency.value = freq;
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.sfxBus); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }
  _startMusic() {
    if (this.musicTimer || !this.ctx) return;
    const chords = [[220, 277, 330], [196, 247, 294], [175, 220, 262], [196, 247, 294]];
    const play = () => {
      const c = this.ctx, t = c.currentTime, ch = chords[this.musicStep++ % chords.length];
      for (const f of ch) {
        const o = c.createOscillator(), g = c.createGain(), lp = c.createBiquadFilter();
        o.type = 'triangle'; o.frequency.value = f / 2; lp.type = 'lowpass'; lp.frequency.value = 700;
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.05, t + 1.2); g.gain.linearRampToValueAtTime(0.0001, t + 3.9);
        o.connect(lp); lp.connect(g); g.connect(this.musicBus); o.start(t); o.stop(t + 4);
      }
    };
    play(); this.musicTimer = setInterval(play, 3600);
  }
  _stopMusic() { if (this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = null; } }
}
