/* =====================================================================
   02 · CORE — state machine & event bus
   ===================================================================== */
const GameState = Object.freeze({
  MENU: 'MENU', MATCHMAKING: 'MATCHMAKING', BREAK: 'BREAK',
  PLAYER_TURN: 'PLAYER_TURN', OPPONENT_TURN: 'OPPONENT_TURN',
  SHOT_RESOLVING: 'SHOT_RESOLVING', FOUL: 'FOUL', BALL_IN_HAND: 'BALL_IN_HAND',
  GAME_OVER: 'GAME_OVER',
});

const STATE_TRANSITIONS = (() => {
  const S = GameState;
  const turn = [S.SHOT_RESOLVING, S.FOUL, S.MENU];
  return Object.freeze({
    [S.MENU]: [S.MATCHMAKING],
    [S.MATCHMAKING]: [S.BREAK, S.MENU],
    [S.BREAK]: turn,
    [S.PLAYER_TURN]: turn,
    [S.OPPONENT_TURN]: turn,
    [S.SHOT_RESOLVING]: [S.PLAYER_TURN, S.OPPONENT_TURN, S.BREAK, S.FOUL, S.GAME_OVER, S.MENU],
    [S.FOUL]: [S.BALL_IN_HAND, S.MENU],
    [S.BALL_IN_HAND]: [S.PLAYER_TURN, S.OPPONENT_TURN, S.FOUL, S.MENU],
    [S.GAME_OVER]: [S.MATCHMAKING, S.MENU],
  });
})();

class StateMachine {
  constructor(initial, table) { this.state = initial; this.previous = null; this.table = table; this.listeners = []; }
  can(next) { const allowed = this.table[this.state]; return !!allowed && allowed.indexOf(next) !== -1; }
  transition(next) {
    if (!this.can(next)) throw new Error('Transisi state tidak valid: ' + this.state + ' -> ' + next);
    this.previous = this.state; this.state = next;
    for (let i = 0; i < this.listeners.length; i++) this.listeners[i](next, this.previous);
  }
  /** Hanya untuk restore snapshot (reconnect); melewati validasi secara sengaja. */
  restore(state) { this.previous = this.state; this.state = state; for (const fn of this.listeners) fn(state, this.previous); }
  onChange(fn) { this.listeners.push(fn); }
}

class EventBus {
  constructor() { this.map = new Map(); }
  on(evt, fn) { if (!this.map.has(evt)) this.map.set(evt, []); this.map.get(evt).push(fn); return () => this.off(evt, fn); }
  off(evt, fn) { const a = this.map.get(evt); if (!a) return; const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); }
  emit(evt, payload) { const a = this.map.get(evt); if (!a) return; for (const fn of a.slice()) fn(payload); }
}
