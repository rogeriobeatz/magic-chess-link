import { describe, expect, it } from "vitest";
import { applyMove, initialState, isInCheck, type GameState } from "./chess";
import {
  applyComputerAction,
  chooseComputerAction,
  DIFFICULTIES,
  soloDifficulty,
  type Difficulty,
} from "./computer";

function emptyState(): GameState {
  const state = initialState();
  state.board = Array(64).fill(null);
  state.energy = { w: 0, b: 0 };
  state.board[63] = { t: "k", c: "w" };
  state.board[0] = { t: "k", c: "b" };
  return state;
}

describe("Computer opponent", () => {
  it.each(Object.keys(DIFFICULTIES) as Difficulty[])(
    "%s chooses a legal reply without changing the original state",
    (difficulty) => {
      const state = applyMove(initialState(), 52, 36)!;
      const before = JSON.stringify(state);
      const action = chooseComputerAction(state, difficulty, { random: () => 0.5 });
      expect(action).not.toBeNull();
      const reply = applyComputerAction(state, action!)!;
      expect(reply.turn).toBe("w");
      expect(reply.move).toBe(2);
      expect(isInCheck(reply, "b")).toBe(false);
      expect(JSON.stringify(state)).toBe(before);
    },
  );

  it("medium anticipates a recapture instead of sacrificing a queen for a rook", () => {
    const state = emptyState();
    state.board[27] = { t: "q", c: "w" };
    state.board[28] = { t: "r", c: "b" };
    state.board[21] = { t: "p", c: "b" };
    expect(chooseComputerAction(state, "easy", { random: () => 0 })).toEqual({
      kind: "move",
      from: 27,
      to: 28,
    });
    const action = chooseComputerAction(state, "medium", { timeBudgetMs: 5000 });
    expect(action).not.toEqual({ kind: "move", from: 27, to: 28 });
  });

  it.each(Object.keys(DIFFICULTIES) as Difficulty[])(
    "%s takes an immediate checkmate",
    (difficulty) => {
      const state = emptyState();
      state.board[63] = null;
      state.board[18] = { t: "k", c: "w" };
      state.board[10] = { t: "q", c: "w" };
      const action = chooseComputerAction(state, difficulty)!;
      expect(applyComputerAction(state, action)?.winner).toBe("w");
    },
  );

  it("uses a power when it is the only escape from check, and passes the turn", () => {
    let state = initialState();
    for (const [from, to] of [
      [53, 45],
      [12, 28],
      [54, 38],
      [3, 39],
    ])
      state = applyMove(state, from!, to!)!;
    expect(isInCheck(state)).toBe(true);
    const action = chooseComputerAction(state, "hard", { timeBudgetMs: 5000 })!;
    expect(action.kind).toBe("power");
    const next = applyComputerAction(state, action)!;
    expect(next.turn).toBe("b");
    expect(next.move).toBe(state.move + 1);
    expect(isInCheck(next, "w")).toBe(false);
  });

  it("can use an offensive power instead of a normal move", () => {
    const state = emptyState();
    state.board[63] = null;
    state.board[47] = { t: "k", c: "w" };
    state.board[28] = { t: "r", c: "b" };
    state.energy.w = 6;
    const action = chooseComputerAction(state, "easy", { random: () => 0 })!;
    expect(action).toEqual({ kind: "power", power: "bolt", target: 28 });
    const next = applyComputerAction(state, action)!;
    expect(next.board[28]).toBeNull();
    expect(next.energy.w).toBe(0);
    expect(next.turn).toBe("b");
  });

  it("returns a legal fallback even when the time budget runs out", () => {
    const state = initialState();
    const action = chooseComputerAction(state, "hard", { timeBudgetMs: 0 })!;
    expect(applyComputerAction(state, action)).not.toBeNull();
  });

  it("stops playing after victory or a draw", () => {
    expect(chooseComputerAction({ ...initialState(), winner: "w" }, "hard")).toBeNull();
    expect(chooseComputerAction({ ...initialState(), result: "stalemate" }, "easy")).toBeNull();
  });

  it("recognizes only supported solo URLs", () => {
    expect(soloDifficulty("solo-hard-classico")).toBe("hard");
    expect(soloDifficulty("solo-hard")).toBe("hard");
    expect(soloDifficulty("solo-medium")).toBe("medium");
    expect(soloDifficulty("solo-easy")).toBe("easy");
    for (const id of [
      "treino",
      "solo-impossible",
      "solo-constructor",
      "solo-__proto__",
      "some-game-id",
    ])
      expect(soloDifficulty(id)).toBeNull();
  });
});
