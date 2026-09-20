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

  /** Waktu habis: seat yang sedang giliran melakukan foul. */
  forceFoul() { this.isBreak = false; this.currentSeat = 1 - this.currentSeat; return this.currentSeat; }
}
