import { describe, expect, it } from "vitest";
import {
  applyMove,
  applyPower,
  initialState,
  isFrozen,
  isGameOver,
  isInCheck,
  isShielded,
  movesFrom,
  powerTargets,
  POWERS,
  type GameState,
  type PowerId,
} from "./chess";

function emptyState(): GameState {
  return { ...initialState(), board: Array(64).fill(null), energy: { w: 0, b: 0 } };
}

describe("Powers consume the whole turn", () => {
  it.each<[PowerId, number, number | undefined]>([
    ["shield", 52, undefined],
    ["freeze", 12, undefined],
    ["teleport", 52, 36],
    ["bolt", 8, undefined],
    ["bomb", 9, undefined],
  ])("%s passes play to the opponent and charges only its cost", (power, target, dest) => {
    const state = initialState();
    state.energy = { w: 10, b: 4 };
    if (power === "bolt") {
      state.board[48] = null;
      state.board[32] = { t: "p", c: "w" };
    }
    const before = JSON.stringify(state);
    const next = applyPower(state, power, target, dest)!;
    expect(next).not.toBeNull();
    expect(next.turn).toBe("b");
    expect(next.move).toBe(1);
    expect(next.energy).toEqual({ w: 10 - POWERS[power].cost, b: 4 });
    expect(applyMove(next, 51, 35)).toBeNull();
    expect(applyPower(next, "shield", 51)).toBeNull();
    expect(applyMove(next, 11, 27)).not.toBeNull();
    expect(JSON.stringify(state)).toBe(before);
  });

  it("shield and freeze last through the enemy turn and expire on return", () => {
    const state = initialState();
    state.energy.w = 10;
    const shielded = applyPower(state, "shield", 52)!;
    expect(isShielded(shielded.board[52]!, shielded.move)).toBe(true);
    const returned = applyMove(shielded, 11, 27)!;
    expect(isShielded(returned.board[52]!, returned.move)).toBe(false);
    const frozen = applyPower(state, "freeze", 12)!;
    expect(isFrozen(frozen.board[12]!, frozen.move)).toBe(true);
    expect(applyMove(frozen, 12, 28)).toBeNull();
    const thawed = applyMove(frozen, 11, 27)!;
    expect(isFrozen(thawed.board[12]!, thawed.move)).toBe(false);
  });

  it("rejects incomplete, occupied, off-board and fractional teleport destinations", () => {
    const state = initialState();
    state.energy.w = 10;
    for (const dest of [undefined, 60, -1, 64, 36.5])
      expect(applyPower(state, "teleport", 52, dest)).toBeNull();
    expect(applyPower(state, "teleport", 60, 36)).toBeNull();
  });

  it("a power cannot leave its own king exposed", () => {
    const state = emptyState();
    state.board[60] = { t: "k", c: "w" };
    state.board[4] = { t: "r", c: "b" };
    state.board[0] = { t: "k", c: "b" };
    state.board[48] = { t: "p", c: "w" };
    state.energy.w = 10;
    expect(isInCheck(state)).toBe(true);
    expect(applyPower(state, "shield", 48)).toBeNull();
    expect(powerTargets(state, "shield")).toEqual([]);
    expect(applyPower(state, "shield", 60)).toBeNull();
    expect(applyPower(state, "bolt", 4)).toBeNull();
    expect(applyPower(state, "freeze", 4)?.turn).toBe("b");
  });
});

describe("Check, mate and legal escapes", () => {
  it("pawns attack diagonally and kings cannot move adjacent to each other", () => {
    const state = emptyState();
    state.board[36] = { t: "k", c: "w" };
    state.board[27] = { t: "p", c: "b" };
    state.board[4] = { t: "k", c: "b" };
    expect(isInCheck(state)).toBe(true);
    state.board[36] = null;
    state.board[35] = { t: "k", c: "w" };
    expect(isInCheck(state)).toBe(false);
    state.board[27] = null;
    state.board[4] = null;
    state.board[19] = { t: "k", c: "b" };
    expect(movesFrom(state, 35)).not.toContain(27);
  });

  it("prevents a pinned piece from exposing its king", () => {
    const state = emptyState();
    state.board[60] = { t: "k", c: "w" };
    state.board[52] = { t: "r", c: "w" };
    state.board[4] = { t: "r", c: "b" };
    state.board[0] = { t: "k", c: "b" };
    expect(movesFrom(state, 52)).not.toContain(51);
    expect(applyMove(state, 52, 44)).not.toBeNull();
  });

  function beforeFoolsMate() {
    let state = initialState();
    for (const [from, to] of [
      [53, 45],
      [12, 28],
      [54, 38],
    ])
      state = applyMove(state, from!, to!)!;
    return state;
  }

  it("recognizes Fool's Mate and blocks every action after the result", () => {
    const state = beforeFoolsMate();
    state.energy.w = 0;
    const mate = applyMove(state, 3, 39)!;
    expect(mate.result).toBe("checkmate");
    expect(mate.winner).toBe("b");
    expect(isGameOver(mate)).toBe(true);
    expect(isInCheck(mate)).toBe(true);
    expect(applyMove(mate, 48, 40)).toBeNull();
    expect(applyPower(mate, "shield", 60)).toBeNull();
  });

  it("does not declare mate when a player can save the king with a power", () => {
    const state = beforeFoolsMate();
    const checked = applyMove(state, 3, 39)!;
    expect(isInCheck(checked)).toBe(true);
    expect(checked.winner).toBeNull();
    expect(checked.result).toBeUndefined();
    expect(powerTargets(checked, "freeze")).toContain(39);
    expect(applyPower(checked, "freeze", 39)?.turn).toBe("b");
  });

  it("records stalemate as a draw", () => {
    const state = emptyState();
    state.board[0] = { t: "k", c: "b" };
    state.board[18] = { t: "k", c: "w" };
    state.board[10] = { t: "q", c: "w" };
    const draw = applyMove(state, 10, 17)!;
    expect(draw.result).toBe("stalemate");
    expect(draw.winner).toBeNull();
    expect(isGameOver(draw)).toBe(true);
  });

  it("promotes a pawn and gives each transition a distinct animation ID", () => {
    const state = emptyState();
    state.board[60] = { t: "k", c: "w" };
    state.board[7] = { t: "k", c: "b" };
    state.board[8] = { t: "p", c: "w" };
    state.fx = { id: Date.now() + 1000, kind: "move", squares: [16, 8] };
    const next = applyMove(state, 8, 0)!;
    expect(next.board[0]?.t).toBe("q");
    expect(next.fx?.kind).toBe("promote");
    expect(next.fx!.id).toBeGreaterThan(state.fx.id);
  });
});
