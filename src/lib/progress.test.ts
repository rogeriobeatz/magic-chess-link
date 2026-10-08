import { beforeEach, describe, expect, it } from "vitest";
import { initialState } from "./chess";
import { balanceMetrics, readProgress, recordMatch } from "./progress";

beforeEach(() => localStorage.clear());
describe("Local cosmetic progress", () => {
  it("awards once per match despite realtime echoes; rematches can earn their own XP", () => {
    const state = {
      ...initialState({ matchId: "first" }),
      winner: "w" as const,
      result: "checkmate" as const,
    };
    recordMatch(localStorage, "solo-hard", state, "w", "hard");
    recordMatch(localStorage, "solo-hard", structuredClone(state), "w", "hard");
    expect(readProgress(localStorage).xp).toBe(100);
    expect(readProgress(localStorage).achievements).toEqual(["debut", "victory", "master"]);
    recordMatch(localStorage, "solo-hard", { ...state, matchId: "rematch" }, "b", "hard");
    expect(readProgress(localStorage).xp).toBe(125);
    expect(readProgress(localStorage).matches).toHaveLength(2);
  });

  it("draws award 50 XP; training and unfinished games cannot farm progress", () => {
    const state = { ...initialState(), result: "repetition" as const };
    recordMatch(localStorage, "treino", state, "w", null);
    recordMatch(localStorage, "solo-easy", initialState(), "w", "easy");
    expect(readProgress(localStorage).xp).toBe(0);
    recordMatch(localStorage, "solo-easy", state, "w", "easy");
    expect(readProgress(localStorage).xp).toBe(50);
  });

  it("records material before a power separately from result and color", () => {
    const state = {
      ...initialState(),
      winner: "b" as const,
      powerHistory: [
        {
          power: "bolt" as const,
          color: "b" as const,
          move: 21,
          materialBefore: 5,
          materialAfter: 10,
        },
        {
          power: "bolt" as const,
          color: "w" as const,
          move: 20,
          materialBefore: -5,
          materialAfter: 0,
        },
      ],
    };
    recordMatch(localStorage, "pvp-id", state, "w", null);
    const metrics = balanceMetrics(readProgress(localStorage).matches);
    expect(metrics.blackWins).toBe(1);
    expect(metrics.powers.find((item) => item.power === "bolt")).toEqual({
      power: "bolt",
      count: 2,
      wins: 1,
      ahead: 1,
      behind: 1,
    });
  });

  it("recovers from malformed browser data without changing game strength", () => {
    localStorage.setItem("chess-league-progress-v2", "invalid");
    expect(readProgress(localStorage).xp).toBe(0);
    localStorage.setItem(
      "chess-league-progress-v2",
      JSON.stringify({ xp: 10, awarded: [], matches: [null], achievements: [] }),
    );
    expect(readProgress(localStorage).xp).toBe(0);
    const state = { ...initialState(), winner: "w" as const };
    const before = JSON.stringify(state);
    recordMatch(localStorage, "solo-easy", state, "w", "easy");
    expect(JSON.stringify(state)).toBe(before);
  });
});
