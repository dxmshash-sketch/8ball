/* =====================================================================
   06 · BOT — mencari kombinasi (bola target, kantong) terbaik
   ===================================================================== */
class BotBrain {
  constructor(config, levelKey, rng) {
    this.cfg = config; this.level = config.bots[levelKey]; this.rng = rng;
    this.W = config.table.width; this.H = config.table.height; this.R = config.table.ballRadius;
  }

  planBreak(cue) {
    const a = Math.atan2(this.H / 2 - cue.y, this.cfg.table.footSpotX - cue.x) + this.rng.gauss() * this.level.aimSigma * 0.4;
    return { angle: a, power: this.level.breakPower, spinX: 0, spinY: this.level.aimSigma < 0.01 ? 0.25 : 0 };
  }

  planShot(view) {
    const cue = view.balls[0];
    const cands = this._candidates(view, cue.x, cue.y, view.targets);
    let angle, power, pocket = -1;
    if (cands.length) {
      cands.sort((p, q) => q.score - p.score);
      const top = Math.min(this.level.pickTop, cands.length);
      const pick = cands[this.rng.int(top)];
      angle = pick.angle; power = pick.power; pocket = pick.pocket;
    } else {
      let best = null, bd = Infinity;
      for (const id of view.targets) { const b = view.balls[id]; const d = Math.hypot(b.x - cue.x, b.y - cue.y); if (d < bd) { bd = d; best = b; } }
      if (!best) return { angle: 0, power: 0.4, spinX: 0, spinY: 0 };
      angle = Math.atan2(best.y - cue.y, best.x - cue.x);
      let bp = 0, bd2 = Infinity; view.pockets.forEach((k, i) => { const d2 = (k.x - best.x) ** 2 + (k.y - best.y) ** 2; if (d2 < bd2) { bd2 = d2; bp = i; } }); pocket = bp;   // tembakan darurat: kantong terdekat
      power = Util.clamp(1.4 * ShotMath.speedForDistance(bd + 260, this.cfg.physics) / this.cfg.physics.maxShotSpeed, 0.3, 0.85);
    }
    angle += this.rng.gauss() * this.level.aimSigma;
    power = Util.clamp(power * (1 + this.rng.gauss() * this.level.powerSigma), 0.1, 1);
    return { angle, power, spinX: 0, spinY: 0, pocket };
  }

  choosePlacement(view) {
    const T = this.cfg.table, R = this.R;
    let best = null, bestScore = -Infinity;
    const maxX = view.zone === 'head' ? T.headStringX : this.W - R - 8;
    for (let i = 0; i < 90; i++) {
      const x = this.rng.range(R + 8, maxX), y = this.rng.range(R + 8, this.H - R - 8);
      if (!view.isPlacementValid(x, y)) continue;
      const cands = this._candidates(view, x, y, view.targets);
      let s = -1;
      for (const c of cands) if (c.score > s) s = c.score;
      s += this.rng.range(0, 0.05);
      if (s > bestScore) { bestScore = s; best = { x, y }; }
    }
    return best;
  }

  _candidates(view, cx, cy, targets) {
    const P = this.cfg.physics, R = this.R, W = this.W, H = this.H, out = [];
    for (const id of targets) {
      const t = view.balls[id];
      if (t.state !== BallState.ON_TABLE) continue;
      for (let p = 0; p < 6; p++) {
        const k = view.pockets[p];
        const ax = k.x, ay = k.y;
        const dxp = ax - t.x, dyp = ay - t.y, dTP = Math.hypot(dxp, dyp);
        if (dTP < 1) continue;
        const ux = dxp / dTP, uy = dyp / dTP;
        const gx = t.x - ux * 2 * R, gy = t.y - uy * 2 * R;
        if (gx < R || gx > W - R || gy < R || gy > H - R) continue;
        const cdx = gx - cx, cdy = gy - cy, dCG = Math.hypot(cdx, cdy);
        if (dCG < 2) continue;
        const cos = (cdx / dCG) * ux + (cdy / dCG) * uy;
        if (cos < 0.28) continue;
        if (!this._clear(view, cx, cy, gx, gy, 0, id)) continue;
        if (!this._clear(view, t.x, t.y, ax, ay, id, 0)) continue;
        const vObj = ShotMath.speedForDistance(dTP + 260, P);
        const vImp = vObj / Math.max(0.35, cos * 0.96);
        const v0 = 1.4 * ShotMath.speedForDistance(dCG + ShotMath.distanceForSpeed(vImp, P), P);   // 1,4 = kompensasi fase sliding (v→5/7 v)
        const score = cos - (dCG / 2400) * 0.35 - (dTP / 2400) * 0.5 - (k.corner ? 0 : 0.08);
        out.push({ angle: Math.atan2(cdy, cdx), power: Util.clamp(v0 / P.maxShotSpeed, 0.12, 1), score, targetId: id, pocket: p });
      }
    }
    return out;
  }

  _clear(view, ax, ay, bx, by, ignoreA, ignoreB) {
    const sx = bx - ax, sy = by - ay, len2 = sx * sx + sy * sy, lim = 2 * this.R - 2;
    for (let i = 0; i < 16; i++) {
      if (i === ignoreA || i === ignoreB) continue;
      const b = view.balls[i];
      if (b.state !== BallState.ON_TABLE) continue;
      let t = len2 > 0 ? ((b.x - ax) * sx + (b.y - ay) * sy) / len2 : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const px = ax + sx * t - b.x, py = ay + sy * t - b.y;
      if (px * px + py * py < lim * lim) return false;
    }
    return true;
  }
}
