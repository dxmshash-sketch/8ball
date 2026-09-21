/* =====================================================================
   04 · RULES — 8-ball (murni logika, tanpa DOM/physics)
   ===================================================================== */
function groupOf(id) { return id === 0 ? null : id === 8 ? 'eight' : id < 8 ? 'solid' : 'stripe'; }

class MatchRules {
  constructor() { this.reset(0); }
  reset(breakerSeat) {
    this.groups = [null, null];
    this.tableOpen = true;
    this.currentSeat = breakerSeat;
    this.isBreak = true;
    this.pocketedIds = new Set();
    this.winner = -1;
  }

  remaining(seat) {
    const g = this.groups[seat]; if (!g) return 7;
    let n = 0;
    for (let id = 1; id <= 15; id++) if (id !== 8 && groupOf(id) === g && !this.pocketedIds.has(id)) n++;
    return n;
  }
  /** Bola yang boleh disentuh pertama kali oleh seat. */
  legalTargets(seat) {
    const out = [];
    if (this.tableOpen || !this.groups[seat]) { for (let id = 1; id <= 15; id++) if (id !== 8 && !this.pocketedIds.has(id)) out.push(id); return out; }
    if (this.remaining(seat) === 0) { if (!this.pocketedIds.has(8)) out.push(8); return out; }
    for (let id = 1; id <= 15; id++) if (id !== 8 && groupOf(id) === this.groups[seat] && !this.pocketedIds.has(id)) out.push(id);
    return out;
  }
  isLegalFirstContact(seat, id) { return this.legalTargets(seat).indexOf(id) !== -1; }

  /**
   * @param rep {firstContact, pocketed:number[], cuePocketed, railAfterContact, cushionBalls}
   * @returns {foul, continueTurn, nextSeat, ballInHand, gameOver, reRack, assigned}
   */
  evaluate(rep) {
    const seat = this.currentSeat, opp = 1 - seat;
    const res = { foul: null, continueTurn: false, nextSeat: opp, ballInHand: 'none', gameOver: null, reRack: false, assigned: null };
    const potted = rep.pocketed, eightPotted = potted.indexOf(8) !== -1;

    if (this.isBreak) {
      if (eightPotted) { res.reRack = true; res.nextSeat = seat; return res; }     // bola 8 masuk saat break: susun ulang, pemecah sama
      let foul = null;
      if (rep.cuePocketed) foul = 'Bola putih masuk saat break';
      else if (rep.firstContact < 0) foul = 'Bola putih tidak mengenai apa pun';
      else if (potted.length === 0 && rep.cushionBalls < CONFIG.rules.breakMinCushionBalls) foul = 'Break tidak sah: kurang dari 4 bola menyentuh cushion';
      for (const id of potted) this.pocketedIds.add(id);
      this.isBreak = false;
      if (foul) { res.foul = foul; res.ballInHand = 'any'; this.currentSeat = opp; return res; }
      res.continueTurn = potted.length > 0; res.nextSeat = res.continueTurn ? seat : opp; this.currentSeat = res.nextSeat;
      return res;
    }

    const cleared = !!this.groups[seat] && this.remaining(seat) === 0;
    let foul = null;
    if (rep.firstContact < 0) foul = 'Bola putih tidak mengenai bola apa pun';
    else if (!this.isLegalFirstContact(seat, rep.firstContact)) {
      foul = rep.firstContact === 8 && !cleared ? 'Menyentuh bola 8 lebih dulu' : 'Bola pertama yang disentuh salah';
    }
    if (rep.cuePocketed) foul = 'Bola putih masuk';
    else if (!foul && potted.length === 0 && !rep.railAfterContact) foul = 'Tidak ada bola yang menyentuh cushion';

    for (const id of potted) this.pocketedIds.add(id);

    if (eightPotted) {
      const legalWin = !foul && cleared;
      res.gameOver = {
        winner: legalWin ? seat : opp,
        reason: legalWin ? 'Bola 8 masuk dengan sah' : (foul ? 'Bola 8 masuk bersamaan dengan foul' : 'Bola 8 masuk sebelum waktunya'),
      };
      this.winner = res.gameOver.winner;
      return res;
    }

    if (!foul && this.tableOpen) {
      const hasSolid = potted.some((id) => groupOf(id) === 'solid'), hasStripe = potted.some((id) => groupOf(id) === 'stripe');
      if (hasSolid !== hasStripe) {
        const g = hasSolid ? 'solid' : 'stripe';
        this.groups[seat] = g; this.groups[opp] = g === 'solid' ? 'stripe' : 'solid';
        this.tableOpen = false; res.assigned = { seat, group: g };
      }
    }

    if (foul) { res.foul = foul; res.ballInHand = 'any'; res.nextSeat = opp; }
    else {
      const mine = this.groups[seat];
      res.continueTurn = mine ? potted.some((id) => groupOf(id) === mine) : potted.length > 0;
      res.nextSeat = res.continueTurn ? seat : opp;
    }
    this.currentSeat = res.nextSeat;
    return res;
  }

  callRequired() { return false; }

  /** Waktu habis: seat yang sedang giliran melakukan foul. */
  forceFoul() { this.isBreak = false; this.currentSeat = 1 - this.currentSeat; return this.currentSeat; }
}


/* =====================================================================
   9-BALL — dua varian:
   'standard' : bola 1–9, wajib menyentuh bola bernomor terkecil lebih dulu, bola 9 sah masuk = menang.
   'call'     : sama, tetapi sebelum menembak (selain break) pemain memilih kantong tujuan;
                bola masuk kantong lain = foul.
   Bola 9 yang masuk saat foul dikembalikan ke meja (respot). Bola 9 masuk saat break sah = menang (golden break).
   ===================================================================== */
class NineBallRules {
  constructor(variant) { this.variant = variant === 'call' ? 'call' : 'standard'; this.reset(0); }
  reset(breakerSeat) {
    this.groups = [null, null]; this.tableOpen = false; this.currentSeat = breakerSeat; this.isBreak = true; this.pocketedIds = new Set(); this.winner = -1;
  }
  lowest() { for (let id = 1; id <= 9; id++) if (!this.pocketedIds.has(id)) return id; return 0; }
  legalTargets() { const l = this.lowest(); return l ? [l] : []; }
  isLegalFirstContact(seat, id) { return id === this.lowest(); }
  remaining() { let n = 0; for (let id = 1; id <= 9; id++) if (!this.pocketedIds.has(id)) n++; return n; }
  /** Varian kantong pilihan mewajibkan panggilan kantong pada setiap tembakan selain break. */
  callRequired() { return this.variant === 'call' && !this.isBreak; }

  /** @param rep {firstContact, pocketed:number[], pocketedAt:[{id,pocket}], call, cuePocketed, railAfterContact, cushionBalls} */
  evaluate(rep) {
    const seat = this.currentSeat, opp = 1 - seat, potted = rep.pocketed, nineIn = potted.indexOf(9) !== -1, wasBreak = this.isBreak;
    const res = { foul: null, continueTurn: false, nextSeat: opp, ballInHand: 'none', gameOver: null, reRack: false, assigned: null, respot: [] };
    const low = this.lowest();
    let foul = null;
    if (rep.cuePocketed) foul = wasBreak ? 'Bola putih masuk saat break' : 'Bola putih masuk';
    else if (rep.firstContact < 0) foul = 'Bola putih tidak mengenai bola apa pun';
    else if (rep.firstContact !== low) foul = wasBreak ? 'Break harus mengenai bola 1 lebih dulu' : 'Harus mengenai bola ' + low + ' lebih dulu';
    else if (potted.length === 0 && (wasBreak ? rep.cushionBalls < CONFIG.rules.breakMinCushionBalls : !rep.railAfterContact)) foul = wasBreak ? 'Break tidak sah: kurang dari 4 bola menyentuh cushion' : 'Tidak ada bola yang menyentuh cushion';
    if (!foul && this.callRequired()) {
      const call = rep.call;
      if (!(Number.isInteger(call) && call >= 0 && call < 6)) foul = 'Kantong tujuan belum dipilih';
      else if ((rep.pocketedAt || []).some((x) => x.pocket !== call)) foul = 'Bola masuk kantong yang salah';
    }
    for (const id of potted) this.pocketedIds.add(id);
    this.isBreak = false;
    if (nineIn) {
      if (!foul) { res.gameOver = { winner: seat, reason: wasBreak ? 'Golden break! Bola 9 masuk saat break' : 'Bola 9 masuk dengan sah', golden: wasBreak }; this.winner = seat; return res; }
      this.pocketedIds.delete(9); res.respot.push(9);                                   // bola 9 masuk saat foul: kembali ke meja
    }
    if (foul) { res.foul = foul; res.ballInHand = 'any'; this.currentSeat = opp; return res; }
    res.continueTurn = potted.length > 0; res.nextSeat = res.continueTurn ? seat : opp; this.currentSeat = res.nextSeat;
    return res;
  }
  forceFoul() { this.isBreak = false; this.currentSeat = 1 - this.currentSeat; return this.currentSeat; }
}
