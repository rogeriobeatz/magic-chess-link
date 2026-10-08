import { describe, expect, it } from "vitest";
import {
  applyMove,
  applyPower,
  initialState,
  powerTargets,
  powerCost,
  powerCooldown,
  positionKey,
  startClock,
  clockRemaining,
  applyTimeout,
  isInCheck,
  isKingThreatened,
  bombArea,
  isFrozen,
  type GameState,
} from "./chess";

function arena(): GameState {
  const state = initialState({ roulette: false });
  state.board = Array(64).fill(null);
  state.board[63] = { t: "k", c: "w", id: "wk" };
  state.board[0] = { t: "k", c: "b", id: "bk" };
  state.board[59] = { t: "n", c: "w", id: "wn" };
  state.energy = { w: 10, b: 10 };
  state.repetitions = {};
  return state;
}

describe("Symmetric resources and material", () => {
  it("both colors start corresponding turns with the same income and respect the cap", () => {
    let state = initialState({ roulette: false });
    const pair = [
      [57, 42],
      [1, 18],
      [42, 57],
      [18, 1],
    ] as const;
    for (let i = 0; i < 40 && !state.result; i++) {
      const [from, to] = pair[i % 4]!;
      const previous = state.energy.w;
      state = applyMove(state, from, to)!;
      expect(state.energy.w).toBe(state.energy.b);
      expect(state.energy.w).toBe(Math.min(10, previous + (state.move % 2 === 0 ? 1 : 0)));
    }
    expect(state.energy).toEqual({ w: 10, b: 10 });
  });

  it("captures award standard material without energy or mutating input", () => {
    const state = arena();
    state.board[59] = { t: "r", c: "w", id: "wr" };
    state.board[27] = { t: "q", c: "b", id: "bq" };
    state.energy = { w: 4, b: 4 };
    const before = JSON.stringify(state);
    const next = applyMove(state, 59, 27)!;
    expect(next.material).toEqual({ w: 9, b: 0 });
    expect(next.captures?.w).toEqual(["q"]);
    expect(next.energy).toEqual({ w: 4, b: 4 });
    expect(JSON.stringify(state)).toBe(before);
  });
});

describe("Power limits and counterplay", () => {
  it("shield never hides check on a king, including a legacy king shield", () => {
    const state = arena();
    state.board[7] = { t: "r", c: "b" };
    state.board[63]!.shield = 999;
    expect(isInCheck(state)).toBe(true);
    expect(applyPower(state, "shield", 63)).toBeNull();
    expect(powerTargets(state, "shield")).not.toContain(63);
  });

  it("freeze removes movement and attacks, expires after the response, and cannot be chained", () => {
    const state = arena();
    state.board[7] = { t: "r", c: "b", id: "br" };
    const frozen = applyPower(state, "freeze", 7)!;
    expect(isFrozen(frozen.board[7]!, frozen.move)).toBe(true);
    expect(isInCheck(frozen, "w")).toBe(false);
    expect(applyMove(frozen, 7, 15)).toBeNull();
    const returned = applyMove(frozen, 0, 1)!;
    expect(isFrozen(returned.board[7]!, returned.move)).toBe(false);
    expect(isInCheck(returned, "w")).toBe(true);
    expect(powerCooldown(returned, "freeze")).toBe(2);
    expect(applyPower(returned, "freeze", 7)).toBeNull();
    returned.cooldowns = { w: {}, b: {} };
    expect(applyPower(returned, "freeze", 7)).toBeNull(); // per-target immunity too
  });

  it("a power is available again exactly on the third subsequent own turn", () => {
    let state = initialState({ roulette: false });
    state.energy.w = 10;
    state = applyPower(state, "shield", 52)!;
    expect(powerCooldown(state, "shield", "w")).toBe(3);
    for (const [from, to] of [
      [1, 18],
      [57, 42],
      [18, 1],
      [42, 57],
      [1, 18],
    ])
      state = applyMove(state, from!, to!)!;
    expect(state.move).toBe(6);
    expect(powerCooldown(state, "shield")).toBe(0);
    expect(applyPower(state, "shield", 52)).not.toBeNull();
  });

  it("teleport has a 3-square range, no captures and no instant pawn promotion", () => {
    const state = arena();
    state.board[59] = null;
    state.board[27] = { t: "n", c: "w" };
    state.board[28] = { t: "p", c: "b" };
    expect(applyPower(state, "teleport", 27, 3)?.board[3]?.t).toBe("n");
    expect(applyPower(state, "teleport", 27, 7)).toBeNull();
    expect(applyPower(state, "teleport", 27, 28)).toBeNull();
    state.board[27] = { t: "p", c: "w" };
    expect(powerTargets(state, "teleport", 27)).not.toContain(3);
    expect(applyPower(state, "teleport", 27, 3)).toBeNull();
    expect(applyPower(state, "teleport", 27, 11)?.board[11]?.t).toBe("p");
  });

  it("bolt requires nearby active presence and excludes queens, kings and shields", () => {
    const state = arena();
    state.board[27] = { t: "r", c: "b" };
    expect(applyPower(state, "bolt", 27)).toBeNull();
    state.board[43] = { t: "p", c: "w" };
    expect(applyPower(state, "bolt", 27)?.material?.w).toBe(5);
    state.board[43]!.frozen = 2;
    expect(applyPower(state, "bolt", 27)).toBeNull();
    delete state.board[43]!.frozen;
    state.board[27]!.shield = 2;
    expect(applyPower(state, "bolt", 27)).toBeNull();
    delete state.board[27]!.shield;
    state.board[27]!.t = "q";
    expect(applyPower(state, "bolt", 27)).toBeNull();
    state.board[27]!.t = "k";
    expect(applyPower(state, "bolt", 27)).toBeNull();
  });
});

describe("Delayed marked bombs", () => {
  function markedArena() {
    const state = arena();
    state.board[27] = { t: "r", c: "b", id: "br" };
    state.board[28] = { t: "q", c: "b", id: "bq" };
    state.board[19] = { t: "n", c: "b", id: "bn" };
    return state;
  }
  const arm = (state: GameState) =>
    applyPower(state, "bomb", 27, undefined, { bombTargets: [27, 28] })!;

  it("arms without captures; only marked enemies remaining in the area die after a reply", () => {
    const state = markedArena();
    const armed = arm(state);
    expect(armed.fx?.kind).toBe("bomb-arm");
    expect(armed.board[27]).not.toBeNull();
    expect(armed.bombs).toHaveLength(1);
    const before = JSON.stringify(armed);
    const next = applyMove(armed, 27, 26)!;
    expect(next.board[26]).toBeNull();
    expect(next.board[28]).toBeNull();
    expect(next.board[19]?.t).toBe("n");
    expect(next.material?.w).toBe(14);
    expect(next.bombs).toEqual([]);
    expect(next.fx?.kind).toBe("bomb");
    expect(next.powerHistory?.[0]?.materialBefore).toBe(-14);
    expect(next.powerHistory?.[0]?.materialAfter).toBe(0);
    expect(JSON.stringify(armed)).toBe(before);
  });

  it("following the marked piece identity, an escape outside 3×3 survives", () => {
    const next = applyMove(arm(markedArena()), 27, 24)!;
    expect(next.board[24]?.id).toBe("br");
    expect(next.board[28]).toBeNull();
    expect(next.material?.w).toBe(9);
  });

  it("a shield during the response protects its target through the explosion", () => {
    const next = applyPower(arm(markedArena()), "shield", 28)!;
    expect(next.board[28]?.id).toBe("bq");
    expect(next.board[27]).toBeNull();
    expect(next.material?.w).toBe(5);
  });

  it("rejects absent, duplicate, immune, remote and more than two marked targets", () => {
    const state = markedArena();
    for (const targets of [[], [27, 27], [0], [59], [27, 28, 19]])
      expect(applyPower(state, "bomb", 27, undefined, { bombTargets: targets })).toBeNull();
    state.board[28]!.shield = 2;
    expect(applyPower(state, "bomb", 27, undefined, { bombTargets: [28] })).toBeNull();
    expect(bombArea(0)).toEqual([0, 1, 8, 9]);
    expect(bombArea(63)).toEqual([54, 55, 62, 63]);
  });

  it("a reply must also keep its king safe when the bomb removes a blocker", () => {
    const state = arena();
    state.board[63] = null;
    state.board[60] = { t: "k", c: "w", id: "wk" };
    state.board[4] = { t: "r", c: "b", id: "br" };
    state.board[52] = { t: "b", c: "w", id: "wb" };
    state.board[49] = { t: "p", c: "w", id: "wp" };
    state.turn = "b";
    state.move = 1;
    const armed = applyPower(state, "bomb", 52, undefined, { bombTargets: [52] })!;
    expect(isInCheck(armed)).toBe(false);
    expect(isKingThreatened(armed)).toBe(true);
    expect(applyMove(armed, 49, 41)).toBeNull();
    expect(applyMove(armed, 60, 61)).not.toBeNull();
    expect(applyPower(armed, "shield", 52)?.board[52]?.t).toBe("b");
  });
});

describe("Public roulette, clocks and complete repetition", () => {
  it.each([0, 1, 2, 3])("roll %s maps to a public event for three full rounds", (roll) => {
    let state = initialState({ roulette: true, rouletteRoll: roll });
    const event = ["stable", "protection", "winter", "distortion"][roll];
    expect(state.roulette?.event).toBe(event);
    const pairs = [
      [57, 42],
      [1, 18],
      [42, 57],
      [18, 1],
      [57, 42],
      [1, 18],
    ];
    for (let i = 0; i < pairs.length; i++) {
      state = applyMove(state, pairs[i]![0]!, pairs[i]![1]!, { rouletteRoll: (roll + 1) % 4 })!;
      expect(state.roulette?.event).toBe(
        i === 5 ? ["stable", "protection", "winter", "distortion"][(roll + 1) % 4] : event,
      );
    }
    expect(state.roulette?.cycle).toBe(1);
    expect(state.roulette?.lastRolledMove).toBe(6);
  });

  it("discounts the same power for both colors; fixed costs ignore rolls", () => {
    const state = initialState({ rouletteRoll: 2 });
    expect(powerCost(state, "freeze")).toBe(2);
    state.turn = "b";
    expect(powerCost(state, "freeze")).toBe(2);
    state.roulette!.enabled = false;
    expect(powerCost(state, "freeze")).toBe(3);
  });

  it("keeps the waiting clock stopped, charges only the acting color, and ends on timeout", () => {
    const waiting = initialState({ clockMs: 5000 });
    expect(applyTimeout(waiting, 999999)).toBeNull();
    const state = startClock(waiting, 1000);
    expect(waiting.clock?.startedAt).toBeNull();
    const next = applyMove(state, 52, 36, { now: 3000 })!;
    expect(next.clock?.remaining).toEqual({ w: 3000, b: 5000 });
    expect(clockRemaining(next, "w", 9000)).toBe(3000);
    expect(clockRemaining(next, "b", 7000)).toBe(1000);
    expect(applyTimeout(next, 7999)).toBeNull();
    const ended = applyTimeout(next, 8000)!;
    expect(ended.result).toBe("timeout");
    expect(ended.winner).toBe("w");
    expect(ended.clock?.startedAt).toBeNull();
    expect(applyMove(next, 12, 28, { now: 8000 })?.result).toBe("timeout");
  });

  it("charges clock time for powers too and disables the clock in training", () => {
    const state = startClock(arena(), 1000);
    const next = applyPower(state, "shield", 59, undefined, { now: 7000 })!;
    expect(next.clock?.remaining.w).toBe(294000);
    expect(next.clock?.startedAt).toBe(7000);
    expect(applyTimeout(startClock(initialState({ clockMs: 0 }), 0), 999999)).toBeNull();
  });

  it("compares energy, relative effects, cooldowns, roulette phase and marked bomb identities", () => {
    const state = arena();
    const base = positionKey(state);
    const copy = structuredClone(state);
    copy.move += 20;
    copy.clock!.remaining.w -= 100;
    expect(positionKey(copy)).toBe(base);
    for (const mutate of [
      (s: GameState) => {
        s.energy.w--;
      },
      (s: GameState) => {
        s.board[59]!.shield = s.move + 2;
      },
      (s: GameState) => {
        s.board[59]!.freezeReady = s.move + 6;
      },
      (s: GameState) => {
        s.cooldowns!.w.freeze = s.move + 4;
      },
      (s: GameState) => {
        s.roulette!.enabled = true;
      },
    ]) {
      const variant = structuredClone(state);
      mutate(variant);
      expect(positionKey(variant)).not.toBe(base);
    }
    const armed = applyPower(
      { ...state, board: state.board.map((p, i) => (i === 27 ? { t: "r", c: "b", id: "br" } : p)) },
      "bomb",
      27,
    )!;
    const without = { ...armed, bombs: [] };
    expect(positionKey(armed)).not.toBe(positionKey(without));
  });

  it("draws on the third complete repetition, only after energy stabilizes", () => {
    let state = initialState({ roulette: false });
    state.energy = { w: 10, b: 10 };
    state.repetitions = { [positionKey(state)]: 1 };
    for (let repeat = 0; repeat < 2; repeat++)
      for (const [from, to] of [
        [57, 42],
        [1, 18],
        [42, 57],
        [18, 1],
      ])
        state = applyMove(state, from!, to!)!;
    expect(state.result).toBe("repetition");
    expect(state.winner).toBeNull();
  });

  it("only kings is a draw, but a lone minor piece is not automatically a draw with powers", () => {
    const state = arena();
    state.board[59] = null;
    expect(applyMove(state, 63, 62)?.result).toBe("insufficient-material");
    state.board[59] = { t: "n", c: "w" };
    expect(applyMove(state, 63, 62)?.result).toBeUndefined();
  });
});
